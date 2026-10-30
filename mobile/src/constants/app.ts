import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const APP_NAME = 'Academic Internship Management System';
export const APP_VERSION = `Version ${Constants.expoConfig?.version ?? 'unavailable'}`;
const build = Platform.OS === 'android' ? Constants.expoConfig?.android?.versionCode : Constants.expoConfig?.ios?.buildNumber;
export const APP_BUILD = build == null ? 'Not available in this runtime' : String(build);
