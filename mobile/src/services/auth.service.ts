// mobile/src/services/auth.service.ts
import api from './api';
import * as SecureStore from 'expo-secure-store';

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
    avatar?: string;
  };
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  student_id: string;
}

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

  // ✅ UPDATED: Logout - Keep avatar
  async logout(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('user');
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  },

  // ✅ UPDATED: Get current user with avatar
  async getCurrentUser(): Promise<any> {
    try {
      const response = await api.get('/auth/me');
      
      // Load saved avatar if exists
      const savedAvatar = await SecureStore.getItemAsync('user_avatar');
      if (savedAvatar) {
        response.data.avatar = savedAvatar;
      }
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Get user error:', error.response?.data || error.message);
      throw error;
    }
  },

  // ✅ UPDATED: Update Profile with Avatar Support
  async updateProfile(data: { 
    first_name?: string; 
    last_name?: string; 
    phone?: string;
    avatar?: string;
  }): Promise<any> {
    try {
      console.log('📝 Updating profile:', data);
      
      // Save avatar to SecureStore if provided
      if (data.avatar) {
        await SecureStore.setItemAsync('user_avatar', data.avatar);
      }
      
      // Only send text fields to backend
      const updateData: any = {};
      if (data.first_name) updateData.first_name = data.first_name;
      if (data.last_name) updateData.last_name = data.last_name;
      if (data.phone) updateData.phone = data.phone;
      
      const response = await api.put('/auth/me', updateData);
      
      // Update stored user data with avatar
      const storedUser = await SecureStore.getItemAsync('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        const updatedUser = { ...user, ...response.data };
        if (data.avatar) {
          updatedUser.avatar = data.avatar;
        }
        await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
      }
      
      console.log('✅ Profile updated successfully:', response.data);
      return { ...response.data, avatar: data.avatar };
    } catch (error: any) {
      console.error('❌ Update profile error:', error.response?.data || error.message);
      throw error;
    }
  },

  // ✅ NEW: Save Avatar
  async saveAvatar(avatarUri: string): Promise<void> {
    try {
      await SecureStore.setItemAsync('user_avatar', avatarUri);
      console.log('✅ Avatar saved successfully');
    } catch (error) {
      console.error('❌ Save avatar error:', error);
    }
  },

  // ✅ NEW: Get Avatar
  async getAvatar(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync('user_avatar');
    } catch (error) {
      console.error('❌ Get avatar error:', error);
      return null;
    }
  },

  // ✅ NEW: Delete Avatar
  async deleteAvatar(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync('user_avatar');
      console.log('✅ Avatar deleted successfully');
    } catch (error) {
      console.error('❌ Delete avatar error:', error);
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