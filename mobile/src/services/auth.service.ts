// mobile/src/services/auth.service.ts
import api from './api';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    student_id: string;
    avatar_url?: string;
  };
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  student_id: string;
}

// ✅ Get Base URL from environment
const getBaseUrl = (): string => {
  // You can also hardcode your IP here if env not working
  // return 'http://192.168.1.45:8000';
  return process.env.EXPO_PUBLIC_BASE_URL || 'http://localhost:8000';
};

export const authService = {
  // Student Login (Mobile)
  async login(studentId: string, password: string): Promise<LoginResponse> {
    try {
      const email = studentId;
      
      console.log('🔐 Login attempt:', { email, password: '***' });
      
      const response = await api.post('/auth/login/student', {
        email,
        password,
      });
      
      console.log('✅ Login successful:', response.data.user);
      
      // Store token securely
      await SecureStore.setItemAsync('access_token', response.data.access_token);
      await SecureStore.setItemAsync('user', JSON.stringify(response.data.user));
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Login error:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.detail || 'Network error. Please try again.';
      throw new Error(errorMessage);
    }
  },

  // Student Registration (Mobile)
  async register(data: RegisterData): Promise<any> {
    try {
      console.log('📝 Registration data:', { 
        email: data.email, 
        student_id: data.student_id,
        first_name: data.first_name,
        last_name: data.last_name,
        password: '***' 
      });

      const response = await api.post('/auth/register/student', {
        email: data.email,
        password: data.password,
        first_name: data.first_name,
        last_name: data.last_name,
        student_id: data.student_id,
      });
      
      console.log('✅ Registration successful:', response.data);
      return response.data;
      
    } catch (error: any) {
      console.error('❌ Registration error:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.detail || 'Registration failed. Please try again.';
      throw new Error(errorMessage);
    }
  },

  // Logout
  async logout(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('user');
      await SecureStore.deleteItemAsync('user_avatar');
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  },

  // Get current user with avatar from server
  async getCurrentUser(): Promise<any> {
    try {
      const response = await api.get('/auth/me');
      
      // If avatar_url exists from server, construct full URL
      if (response.data.avatar_url) {
        const BASE_URL = getBaseUrl();
        response.data.avatar_url = `${BASE_URL}/static/${response.data.avatar_url}`;
      }
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Get user error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Update Profile
  async updateProfile(data: { 
    first_name?: string; 
    last_name?: string; 
    phone?: string;
  }): Promise<any> {
    try {
      console.log('📝 Updating profile:', data);
      
      const response = await api.put('/auth/me', data);
      
      // Update stored user data
      const storedUser = await SecureStore.getItemAsync('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        const updatedUser = { ...user, ...response.data };
        await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
      }
      
      console.log('✅ Profile updated successfully:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Update profile error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Upload Avatar to Server
  async uploadAvatar(avatarUri: string): Promise<any> {
    try {
      console.log('📤 Uploading avatar...');
      
      // Create FormData
      const formData = new FormData();
      
      // Get filename from URI
      const fileName = avatarUri.split('/').pop() || 'avatar.jpg';
      const fileType = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';
      
      // @ts-ignore - FormData expects this structure for React Native
      formData.append('file', {
        uri: avatarUri,
        name: fileName,
        type: fileType,
      });
      
      const response = await api.post('/users/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('✅ Avatar uploaded:', response.data);
      
      // Construct full avatar URL
      const BASE_URL = getBaseUrl();
      const fullAvatarUrl = response.data.avatar_url ? `${BASE_URL}/static/${response.data.avatar_url}` : null;
      
      // Update stored user data with full avatar URL
      const storedUser = await SecureStore.getItemAsync('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        user.avatar_url = fullAvatarUrl;
        await SecureStore.setItemAsync('user', JSON.stringify(user));
      }
      
      // Also store in local cache for quick access
      if (fullAvatarUrl) {
        await SecureStore.setItemAsync('user_avatar', fullAvatarUrl);
      }
      
      return response.data;
      
    } catch (error: any) {
      console.error('❌ Upload avatar error:', error.response?.data || error.message);
      throw error;
    }
  },

  // ✅ Delete Avatar from Server - Try DELETE first, fallback to POST
  async deleteAvatar(): Promise<void> {
    try {
      // Try DELETE first
      await api.delete('/users/avatar');
      console.log('✅ Avatar deleted from server (DELETE)');
      
    } catch (error: any) {
      // If DELETE fails with 403, try POST fallback
      if (error.response?.status === 403) {
        console.log('⚠️ DELETE failed with 403, trying POST fallback...');
        try {
          await api.post('/users/avatar/delete');
          console.log('✅ Avatar deleted from server (POST fallback)');
        } catch (postError: any) {
          console.error('❌ POST fallback also failed:', postError.response?.data || postError.message);
          throw postError;
        }
      } else {
        throw error;
      }
    }
    
    // Clear avatar from SecureStore
    await SecureStore.deleteItemAsync('user_avatar');
    
    // Update stored user data
    const storedUser = await SecureStore.getItemAsync('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      delete user.avatar_url;
      await SecureStore.setItemAsync('user', JSON.stringify(user));
    }
  },

  // Get Avatar URL (from server or local cache)
  async getAvatar(): Promise<string | null> {
    try {
      const BASE_URL = getBaseUrl();
      
      // First try to get from user data (server URL)
      const userData = await SecureStore.getItemAsync('user');
      if (userData) {
        const user = JSON.parse(userData);
        if (user.avatar_url) {
          // Check if it's already a full URL
          if (user.avatar_url.startsWith('http')) {
            return user.avatar_url;
          }
          // Construct full URL if it's a relative path
          return `${BASE_URL}/static/${user.avatar_url}`;
        }
      }
      
      // Fallback to local avatar
      const storedAvatar = await SecureStore.getItemAsync('user_avatar');
      if (storedAvatar) {
        // Check if it's already a full URL
        if (storedAvatar.startsWith('http')) {
          return storedAvatar;
        }
        // Construct full URL
        return `${BASE_URL}/static/${storedAvatar}`;
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ Get avatar error:', error);
      return null;
    }
  },

  // Save Avatar (local cache)
  async saveAvatar(avatarUri: string): Promise<void> {
    try {
      await SecureStore.setItemAsync('user_avatar', avatarUri);
      console.log('✅ Avatar saved locally');
    } catch (error) {
      console.error('❌ Save avatar error:', error);
    }
  },

  // Change Password
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      console.log('✅ Password changed successfully');
    } catch (error: any) {
      console.error('❌ Change password error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Forgot Password
  async forgotPassword(email: string): Promise<any> {
    try {
      const response = await api.post('/auth/forgot-password', { email });
      console.log('✅ Forgot password request sent');
      return response.data;
    } catch (error: any) {
      console.error('❌ Forgot password error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Reset Password
  async resetPassword(token: string, newPassword: string): Promise<any> {
    try {
      const response = await api.post('/auth/reset-password', {
        token,
        new_password: newPassword,
      });
      console.log('✅ Password reset successfully');
      return response.data;
    } catch (error: any) {
      console.error('❌ Reset password error:', error.response?.data || error.message);
      throw error;
    }
  },
};