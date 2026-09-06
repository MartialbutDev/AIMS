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

// ✅ Paginated Response Interface
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ✅ Helper for paginated requests
export const apiHelpers = {
  async getPaginated<T>(
    endpoint: string,
    page: number = 1,
    limit: number = 10,
    params: Record<string, any> = {}
  ): Promise<PaginatedResponse<T>> {
    const response = await api.get(endpoint, {
      params: {
        ...params,
        page,
        limit,
      },
    });
    // If response is already paginated, return it
    if (response.data.items !== undefined) {
      return response.data;
    }
    // If response is a plain array, wrap it
    if (Array.isArray(response.data)) {
      return {
        items: response.data,
        total: response.data.length,
        page,
        limit,
        totalPages: Math.ceil(response.data.length / limit),
      };
    }
    return response.data;
  },
};

export default api;