
const DEFAULT_BASE_URL = "http://192.168.1.46:8000";

export const BASE_URL = (
  process.env.EXPO_PUBLIC_BASE_URL || DEFAULT_BASE_URL
).replace(/\/+$/, "");

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || `${BASE_URL}/api/v1`
).replace(/\/+$/, "");
