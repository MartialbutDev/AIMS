// src/components/common/CachedImage.tsx
import { Image, ImageProps } from 'expo-image';
import { useState, useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { ImageCache } from '../../utils/imageCache';

// ✅ Use a different name to avoid conflict with ImageProps
type ImageContentFit = 'cover' | 'contain' | 'fill' | 'scale-down';

interface CachedImageProps extends Omit<ImageProps, 'source' | 'contentFit'> {
  uri: string;
  cacheKey?: string;
  placeholderBlurhash?: string;
  showLoading?: boolean;
  contentFit?: ImageContentFit;  // ✅ Use contentFit instead of resizeMode
}

export default function CachedImage({
  uri,
  cacheKey,
  placeholderBlurhash,
  showLoading = true,
  contentFit = 'cover',  // ✅ Renamed from resizeMode
  style,
  ...props
}: CachedImageProps) {
  const { colors } = useTheme();
  const [imageUri, setImageUri] = useState<string>(uri);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadImage();
  }, [uri]);

  const loadImage = async () => {
    setIsLoading(true);
    setError(false);

    try {
      const cache = ImageCache.getInstance();
      
      const cachedUri = await cache.getCachedImageUri(uri);
      
      if (cachedUri) {
        setImageUri(cachedUri);
        setIsLoading(false);
      } else {
        setImageUri(uri);
        
        cache.cacheImage(uri).then((cached) => {
          if (cached) {
            setImageUri(cached);
          }
        });
      }
    } catch (error) {
      console.error('Failed to load cached image:', error);
      setImageUri(uri);
    } finally {
      setIsLoading(false);
    }
  };

  const handleError = () => {
    setError(true);
    setIsLoading(false);
  };

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (isLoading && showLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUri }}
      style={style}
      contentFit={contentFit}
      placeholder={placeholderBlurhash}
      placeholderContentFit="cover"
      onError={handleError}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
});