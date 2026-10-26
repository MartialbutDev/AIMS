
const DEFAULT_BASE_URL = "http://16.178.134.140:8000";

export const BASE_URL = (
  process.env.EXPO_PUBLIC_BASE_URL || DEFAULT_BASE_URL
).replace(/\/+$/, "");

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || `${BASE_URL}/api/v1`
).replace(/\/+$/, "");
