// src/utils/imageCache.ts
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';

// Cache configuration
const CACHE_DIR = FileSystem.cacheDirectory + 'aims_images/';
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const CACHE_MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export interface CacheOptions {
  maxAge?: number;
  maxSize?: number;
}

export class ImageCache {
  private static instance: ImageCache;
  private cacheDir: string;
  private options: CacheOptions;

  private constructor() {
    this.cacheDir = CACHE_DIR;
    this.options = {
      maxAge: CACHE_MAX_AGE,
      maxSize: CACHE_MAX_SIZE,
    };
    this.initCache();
  }

  public static getInstance(): ImageCache {
    if (!ImageCache.instance) {
      ImageCache.instance = new ImageCache();
    }
    return ImageCache.instance;
  }

  private async initCache(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.cacheDir, { intermediates: true });
        console.log('📁 Image cache directory created');
      }
    } catch (error) {
      console.error('❌ Failed to create image cache:', error);
    }
  }

  private async getCacheKey(url: string): Promise<string> {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      url
    );
    return hash;
  }

  private getCachePath(key: string): string {
    return `${this.cacheDir}${key}.jpg`;
  }

  public async getCachedImageUri(url: string): Promise<string | null> {
    try {
      const key = await this.getCacheKey(url);
      const cachePath = this.getCachePath(key);
      
      const info = await FileSystem.getInfoAsync(cachePath);
      if (info.exists) {
        const stats = await FileSystem.getInfoAsync(cachePath);
        if (stats.exists && stats.modificationTime) {
          const age = Date.now() - new Date(stats.modificationTime).getTime();
          if (age < (this.options.maxAge || CACHE_MAX_AGE)) {
            return cachePath;
          }
        }
        await FileSystem.deleteAsync(cachePath);
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to get cached image:', error);
      return null;
    }
  }

  public async cacheImage(url: string): Promise<string | null> {
    try {
      const key = await this.getCacheKey(url);
      const cachePath = this.getCachePath(key);

      const existing = await this.getCachedImageUri(url);
      if (existing) {
        return existing;
      }

      const result = await FileSystem.downloadAsync(url, cachePath);
      if (result.status === 200) {
        await this.cleanupCache();
        return cachePath;
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to cache image:', error);
      return null;
    }
  }

  public async prefetchImages(urls: string[]): Promise<void> {
    const batchSize = 5;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map((url) => this.cacheImage(url))
      );
    }
  }

  private async cleanupCache(): Promise<void> {
    try {
      const files = await FileSystem.readDirectoryAsync(this.cacheDir);
      let totalSize = 0;
      const fileInfos = [];

      for (const file of files) {
        const filePath = `${this.cacheDir}${file}`;
        const info = await FileSystem.getInfoAsync(filePath);
        if (info.exists && info.size) {
          totalSize += info.size;
          fileInfos.push({
            path: filePath,
            size: info.size,
            modificationTime: info.modificationTime || new Date().getTime(),
          });
        }
      }

      if (totalSize > (this.options.maxSize || CACHE_MAX_SIZE)) {
        fileInfos.sort((a, b) => a.modificationTime - b.modificationTime);
        let removedSize = 0;
        for (const fileInfo of fileInfos) {
          if (removedSize > totalSize * 0.3) break;
          await FileSystem.deleteAsync(fileInfo.path);
          removedSize += fileInfo.size;
        }
      }
    } catch (error) {
      console.error('❌ Failed to cleanup cache:', error);
    }
  }

  public async clearCache(): Promise<void> {
    try {
      const files = await FileSystem.readDirectoryAsync(this.cacheDir);
      for (const file of files) {
        await FileSystem.deleteAsync(`${this.cacheDir}${file}`);
      }
      console.log('🗑️ Image cache cleared');
    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
    }
  }

  public async getCacheSize(): Promise<number> {
    try {
      const files = await FileSystem.readDirectoryAsync(this.cacheDir);
      let totalSize = 0;
      for (const file of files) {
        const info = await FileSystem.getInfoAsync(`${this.cacheDir}${file}`);
        if (info.exists && info.size) {
          totalSize += info.size;
        }
      }
      return totalSize;
    } catch (error) {
      console.error('❌ Failed to get cache size:', error);
      return 0;
    }
  }
}

// ✅ Cached Image Component
export const CachedImage = Image;