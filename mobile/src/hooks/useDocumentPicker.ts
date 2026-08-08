// mobile/src/hooks/useDocumentPicker.ts
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Alert, Platform } from 'react-native';

interface PickedFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
  mimeType?: string;
}

export const useDocumentPicker = () => {
  const [selectedFile, setSelectedFile] = useState<PickedFile | null>(null);
  const [loading, setLoading] = useState(false);

  // ✅ Pick image WITHOUT crop (simple selection)
  const pickImage = async (): Promise<PickedFile | null> => {
    try {
      setLoading(true);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library');
        setLoading(false);
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,  // ✅ NO CROP
        quality: 0.8,
      });

      setLoading(false);

      if (!result.canceled) {
        const asset = result.assets[0];
        const file: PickedFile = {
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
          size: asset.fileSize,
          mimeType: asset.mimeType || 'image/jpeg',
        };
        setSelectedFile(file);
        return file;
      }
      return null;
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
      setLoading(false);
      return null;
    }
  };

  // ✅ Take photo WITHOUT crop
  const takePhoto = async (): Promise<PickedFile | null> => {
    try {
      setLoading(true);
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your camera');
        setLoading(false);
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,  // ✅ NO CROP
        quality: 0.8,
      });

      setLoading(false);

      if (!result.canceled) {
        const asset = result.assets[0];
        const file: PickedFile = {
          uri: asset.uri,
          name: `photo_${Date.now()}.jpg`,
          type: 'image/jpeg',
          size: asset.fileSize,
          mimeType: 'image/jpeg',
        };
        setSelectedFile(file);
        return file;
      }
      return null;
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
      setLoading(false);
      return null;
    }
  };

  // ✅ Pick Any File (Images + PDFs)
  const pickAnyFile = async (): Promise<PickedFile | null> => {
    try {
      setLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      setLoading(false);

      if (!result.canceled) {
        const asset = result.assets?.[0];
        if (asset) {
          const file: PickedFile = {
            uri: asset.uri,
            name: asset.name || 'document',
            type: asset.mimeType || 'application/octet-stream',
            size: asset.size,
            mimeType: asset.mimeType || 'application/octet-stream',
          };
          setSelectedFile(file);
          return file;
        }
      }
      return null;
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file');
      setLoading(false);
      return null;
    }
  };

  const resetFile = () => {
    setSelectedFile(null);
  };

  const isImage = (file: PickedFile | null): boolean => {
    if (!file) return false;
    return file.type?.startsWith('image/') || false;
  };

  const isPDF = (file: PickedFile | null): boolean => {
    if (!file) return false;
    return file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
  };

  const getFileIcon = (file: PickedFile | null): string => {
    if (!file) return 'document-outline';
    if (isPDF(file)) return 'document-text-outline';
    if (isImage(file)) return 'image-outline';
    return 'document-outline';
  };

  const getFileTypeLabel = (file: PickedFile | null): string => {
    if (!file) return 'No file selected';
    if (isImage(file)) return 'Image';
    if (isPDF(file)) return 'PDF Document';
    return 'File';
  };

  return {
    selectedFile,
    loading,
    setLoading,
    pickImage,      // ✅ No crop
    takePhoto,      // ✅ No crop
    pickAnyFile,
    resetFile,
    isImage,
    isPDF,
    getFileIcon,
    getFileTypeLabel,
  };
};