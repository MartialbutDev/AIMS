// src/services/profile.service.ts
import api from './api';
import * as SecureStore from 'expo-secure-store';

export interface UserProfile {
  id: string;
  email: string;
  student_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  phone?: string;
  student_id?: string;
}

export const profileService = {
  // Get current user profile
  async getProfile(): Promise<UserProfile> {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error: any) {
      console.error('❌ Get profile error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Update profile
  async updateProfile(data: UpdateProfileData): Promise<UserProfile> {
    try {
      const response = await api.put('/auth/me', data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Update profile error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Change password
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
    } catch (error: any) {
      console.error('❌ Change password error:', error.response?.data || error.message);
      throw error;
    }
  },
};