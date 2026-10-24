import { unregisterPushDevice } from "./push.service";
import api from './api';
import * as SecureStore from 'expo-secure-store';
import { isAxiosError } from 'axios';
import { BASE_URL } from '../config/env';

// ============================================================
// TYPES AND INTERFACES
// ============================================================

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    middle_name?: string | null;
    last_name: string;
    role: string;
    student_id: string | null;
    avatar_url?: string | null;
  };
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  student_id: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
}

// ============================================================
// ERROR HANDLING HELPERS
// ============================================================

/**
 * Extract readable messages from FastAPI responses.
 * Supports strings, 422 validation arrays, and nested error objects.
 */
function extractErrorMessage(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') {
    return detail.trim() || fallback;
  }

  if (Array.isArray(detail)) {
    const messages = detail.map((item: unknown) => {
      if (typeof item === 'string') {
        return item;
      }

      if (item && typeof item === 'object') {
        const validation = item as Record<string, unknown>;
        const location = Array.isArray(validation.loc)
          ? validation.loc
              .filter((part) => part !== 'body')
              .map(String)
              .join('.')
          : '';

        const message =
          typeof validation.msg === 'string'
            ? validation.msg
            : typeof validation.message === 'string'
              ? validation.message
              : 'Invalid value';

        return location ? `${location}: ${message}` : message;
      }

      return String(item);
    });

    return messages.join('\n') || fallback;
  }

  if (detail && typeof detail === 'object') {
    const object = detail as Record<string, unknown>;

    if (typeof object.message === 'string') {
      return object.message;
    }

    if (typeof object.detail === 'string') {
      return object.detail;
    }

    if (object.errors !== undefined) {
      return extractErrorMessage(object.errors, fallback);
    }

    try {
      return JSON.stringify(object);
    } catch {
      return fallback;
    }
  }

  return fallback;
}

/**
 * Convert Axios and unexpected errors into readable Error objects.
 * Does not log passwords or authentication tokens.
 */
function formatApiError(error: unknown, fallback: string): Error {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const responseData = error.response?.data;

    console.error('❌ API request failed:', {
      status: status ?? 'No HTTP response',
      code: error.code,
      detail: responseData?.detail ?? null,
      message: error.message,
    });

    if (!error.response) {
      if (error.code === 'ECONNABORTED') {
        return new Error(
          'The request timed out. Please check your connection and try again.'
        );
      }

      return new Error(
        `Cannot reach the AIMS server at ${BASE_URL}. ` +
        'Make sure your phone and computer are on the same network, ' +
        'FastAPI is running, and the firewall allows port 8000.'
      );
    }

    const detail =
      responseData?.detail ??
      responseData?.message ??
      responseData?.errors;

    const readableMessage = extractErrorMessage(detail, fallback);

    if (detail !== undefined && detail !== null) {
      return new Error(readableMessage);
    }

    switch (status) {
      case 400:
        return new Error('Invalid information. Please review your details.');
      case 401:
        return new Error('Invalid credentials or expired session.');
      case 403:
        return new Error('You do not have permission to perform this action.');
      case 404:
        return new Error('The requested service was not found.');
      case 409:
        return new Error('An account with these details may already exist.');
      case 422:
        return new Error(
          'Some information is invalid. Please check all required fields.'
        );
      case 500:
        return new Error('The server encountered an error. Please try again later.');
      default:
        return new Error(fallback);
    }
  }

  console.error('❌ Unexpected error:', error);
  if (error instanceof Error) {
    return error;
  }
  return new Error(fallback);
}

// ============================================================
// AVATAR URL HELPER
// ============================================================

function resolveAvatarUrl(avatarPath: string | null | undefined): string | null {
  if (!avatarPath) {
    return null;
  }

  const path = avatarPath.trim();
  if (!path) {
    return null;
  }

  if (
    /^https?:\/\//i.test(path) ||
    path.startsWith('file://') ||
    path.startsWith('content://') ||
    path.startsWith('data:')
  ) {
    return path;
  }

  const base = BASE_URL.replace(/\/+$/, '');
  const normalizedPath = path.replace(/^\/+/, '');

  if (normalizedPath.startsWith('static/')) {
    return `${base}/${normalizedPath}`;
  }

  return `${base}/static/${normalizedPath}`;
}

// ============================================================
// AUTHENTICATION SERVICE
// ============================================================

export const authService = {
  // ==========================================================
  // STUDENT LOGIN
  // ==========================================================
  async login(studentId: string, password: string): Promise<LoginResponse> {
    try {
      console.log('🔐 Student login attempt');

      const response = await api.post<LoginResponse>(
        '/auth/login/student',
        {
          email: studentId.trim(),
          password,
        }
      );

      const loginData = response.data;

      if (
        !loginData ||
        typeof loginData.access_token !== 'string' ||
        !loginData.access_token ||
        !loginData.user
      ) {
        throw new Error('The server returned an invalid login response.');
      }

      await SecureStore.setItemAsync('access_token', loginData.access_token);
      await SecureStore.setItemAsync('user', JSON.stringify(loginData.user));

      console.log('✅ Student login successful');
      return loginData;
    } catch (error: unknown) {
      throw formatApiError(error, 'Login failed. Please check your credentials.');
    }
  },

  // ==========================================================
  // STUDENT REGISTRATION
  // ==========================================================
  async register(data: RegisterData): Promise<any> {
    try {
      console.log('📝 Student registration attempt');

      const payload = {
        email: data.email.trim(),
        password: data.password,
        first_name: data.first_name.trim(),
        middle_name: data.middle_name?.trim() || null,
        last_name: data.last_name.trim(),
        student_id: data.student_id.trim(),
        ...(data.gender ? { gender: data.gender } : {}),
      };

      const response = await api.post('/auth/register/student', payload);
      console.log('✅ Student registration successful');
      return response.data;
    } catch (error: unknown) {
      throw formatApiError(error, 'Registration failed. Please try again.');
    }
  },

  // ==========================================================
  // LOGOUT
  // ==========================================================
  async logout(): Promise<void> {
    await unregisterPushDevice();
    try {
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('user');
      await SecureStore.deleteItemAsync('user_avatar');
      console.log('✅ Logout successful');
    } catch (error: unknown) {
      console.error('❌ Logout error:', error);
      throw error;
    }
  },

  // ==========================================================
  // GET CURRENT USER
  // ==========================================================
  async getCurrentUser(): Promise<any> {
    try {
      const response = await api.get('/auth/me');
      const user = { ...response.data };

      if (user.avatar_url) {
        user.avatar_url = resolveAvatarUrl(user.avatar_url);
      }

      return user;
    } catch (error: unknown) {
      throw formatApiError(error, 'Failed to retrieve user information.');
    }
  },

  // ==========================================================
  // UPDATE PROFILE
  // ==========================================================
  async updateProfile(data: {
    first_name?: string;
    middle_name?: string | null;
    last_name?: string;
    phone?: string;
  }): Promise<any> {
    try {
      console.log('📝 Updating student profile');
      const response = await api.put('/auth/me', data);
      const storedUser = await SecureStore.getItemAsync('user');

      if (storedUser) {
        const user = JSON.parse(storedUser);
        const updatedUser = { ...user, ...response.data };
        await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
      }

      console.log('✅ Profile updated successfully');
      return response.data;
    } catch (error: unknown) {
      throw formatApiError(error, 'Failed to update your profile.');
    }
  },

  // ==========================================================
  // UPLOAD AVATAR
  // ==========================================================
  async uploadAvatar(avatarUri: string): Promise<any> {
    try {
      console.log('📤 Uploading student avatar');
      const formData = new FormData();
      const rawFileName = avatarUri.split('/').pop()?.split('?')[0] || 'avatar.jpg';
      const fileName = rawFileName;
      const extension = fileName.split('.').pop()?.toLowerCase();

      let fileType = 'image/jpeg';
      if (extension === 'png') {
        fileType = 'image/png';
      } else if (extension === 'webp') {
        fileType = 'image/webp';
      }

      formData.append(
        'file',
        {
          uri: avatarUri,
          name: fileName,
          type: fileType,
        } as any
      );

      const response = await api.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });

      console.log('✅ Avatar uploaded successfully');
      const fullAvatarUrl = resolveAvatarUrl(response.data?.avatar_url);
      const storedUser = await SecureStore.getItemAsync('user');

      if (storedUser) {
        const user = JSON.parse(storedUser);
        user.avatar_url = fullAvatarUrl;
        await SecureStore.setItemAsync('user', JSON.stringify(user));
      }

      if (fullAvatarUrl) {
        await SecureStore.setItemAsync('user_avatar', fullAvatarUrl);
      }

      return response.data;
    } catch (error: unknown) {
      throw formatApiError(error, 'Failed to upload your profile picture.');
    }
  },

  // ==========================================================
  // DELETE AVATAR
  // ==========================================================
  async deleteAvatar(): Promise<void> {
    try {
      try {
        await api.delete('/users/avatar');
        console.log('✅ Avatar deleted using DELETE');
      } catch (error: unknown) {
        if (isAxiosError(error) && error.response?.status === 403) {
          console.log('⚠️ DELETE returned 403, trying POST fallback');
          await api.post('/users/avatar/delete');
          console.log('✅ Avatar deleted using POST fallback');
        } else {
          throw error;
        }
      }

      await SecureStore.deleteItemAsync('user_avatar');
      const storedUser = await SecureStore.getItemAsync('user');

      if (storedUser) {
        const user = JSON.parse(storedUser);
        delete user.avatar_url;
        await SecureStore.setItemAsync('user', JSON.stringify(user));
      }

      console.log('✅ Avatar removed successfully');
    } catch (error: unknown) {
      throw formatApiError(error, 'Failed to delete your profile picture.');
    }
  },

  // ==========================================================
  // GET AVATAR
  // ==========================================================
  async getAvatar(): Promise<string | null> {
    try {
      const userData = await SecureStore.getItemAsync('user');

      if (userData) {
        const user = JSON.parse(userData);
        if (user.avatar_url) {
          return resolveAvatarUrl(user.avatar_url);
        }
      }

      const storedAvatar = await SecureStore.getItemAsync('user_avatar');
      if (storedAvatar) {
        return resolveAvatarUrl(storedAvatar);
      }
      return null;
    } catch (error: unknown) {
      console.error('❌ Failed to retrieve avatar:', error);
      return null;
    }
  },

  // ==========================================================
  // SAVE AVATAR LOCALLY
  // ==========================================================
  async saveAvatar(avatarUri: string): Promise<void> {
    try {
      await SecureStore.setItemAsync('user_avatar', avatarUri);
      console.log('✅ Avatar saved locally');
    } catch (error: unknown) {
      console.error('❌ Failed to save avatar:', error);
    }
  },

  // ==========================================================
  // CHANGE PASSWORD
  // ==========================================================
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      console.log('✅ Password changed successfully');
    } catch (error: unknown) {
      throw formatApiError(error, 'Failed to change your password.');
    }
  },

  // ==========================================================
  // FORGOT PASSWORD
  // ==========================================================
  async forgotPassword(email: string): Promise<any> {
    try {
      const response = await api.post('/auth/forgot-password', {
        email: email.trim(),
      });
      console.log('✅ Forgot password request completed');
      return response.data;
    } catch (error: unknown) {
      throw formatApiError(error, 'Failed to process your password reset request.');
    }
  },

  // ==========================================================
  // RESET PASSWORD
  // ==========================================================
  async resetPassword(token: string, newPassword: string): Promise<any> {
    try {
      const response = await api.post('/auth/reset-password', {
        token,
        new_password: newPassword,
      });
      console.log('✅ Password reset successfully');
      return response.data;
    } catch (error: unknown) {
      throw formatApiError(error, 'Failed to reset your password.');
    }
  },
};
