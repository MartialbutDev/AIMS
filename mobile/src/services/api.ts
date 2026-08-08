// mobile/src/services/api.ts
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config/env';
import { router } from 'expo-router';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor - Add token to every request
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    } catch (error) {
      console.error('Error getting token:', error);
      return config;
    }
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage and redirect to login
      try {
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('user');
        // Navigate to login
        router.replace('/(auth)/login');
      } catch (e) {
        console.error('Error clearing session:', e);
      }
    }
    return Promise.reject(error);
  }
);

export default api;