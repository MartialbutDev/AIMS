// src/components/documents/DocumentPreview.tsx
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Linking,
} from "react-native";
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { WebView } from 'react-native-webview';
import axios from 'axios';
import { BASE_URL } from '../../config/env';

const { width, height } = Dimensions.get("window");

interface DocumentPreviewProps {
  visible: boolean;
  imageUri: string;
  documentType: string;
  documentName?: string;
  onClose: () => void;
  onDownload?: () => void;
}

export default function DocumentPreview({
  visible,
  imageUri,
  documentType,
  documentName,
  onClose,
  onDownload,
}: DocumentPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPDF, setIsPDF] = useState(false);
  const [fileExt, setFileExt] = useState<string>('');

  // ✅ Detect file type by checking the actual file
  useEffect(() => {
    if (visible && imageUri) {
      detectFileType();
    }
  }, [visible, imageUri]);

  const detectFileType = async () => {
    setLoading(true);
    setError(false);

    try {
      // ✅ Try to get file info from the document endpoint
      const token = await SecureStore.getItemAsync('access_token');
      
      // ✅ Get the document ID from the URL
      const docIdMatch = imageUri.match(/\/documents\/([^\/\?]+)/);
      const docId = docIdMatch ? docIdMatch[1] : null;
      
      if (docId) {
        // ✅ Fetch document details to check file extension
        const response = await axios.get(`${BASE_URL}/api/v1/documents/${docId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const filePath = response.data.file_path || '';
        const ext = filePath.split('.').pop()?.toLowerCase() || '';
        setFileExt(ext);
        
        // ✅ Check if it's a PDF based on file extension
        const isPdf = ext === 'pdf' || 
                      ext === 'application/pdf' ||
                      documentType?.toLowerCase() === 'pdf' ||
                      documentType?.toLowerCase() === 'application_pdf';
        
        setIsPDF(isPdf);
        console.log('🔍 File detection:', { ext, isPdf, filePath, documentType });
      } else {
        // ✅ Fallback: check URL and document type
        const uriLower = imageUri.toLowerCase();
        const typeLower = documentType?.toLowerCase() || '';
        
        const isPdf = uriLower.includes('.pdf') ||
                      uriLower.includes('%2Epdf') ||
                      typeLower === 'pdf' ||
                      typeLower === 'application_pdf' ||
                      typeLower === 'application/pdf' ||
                      typeLower.includes('pdf');
        
        setIsPDF(isPdf);
        console.log('🔍 Fallback detection:', { isPdf, documentType, imageUri: imageUri.substring(0, 100) });
      }
    } catch (error) {
      console.error('❌ Error detecting file type:', error);
      // ✅ Fallback: check URL
      const isPdf = imageUri.toLowerCase().includes('.pdf') ||
                    documentType?.toLowerCase().includes('pdf');
      setIsPDF(isPdf);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (onDownload) {
      onDownload();
      return;
    }

    try {
      const token = await SecureStore.getItemAsync('access_token');
      
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      const documentDir = FileSystem.documentDirectory;
      const fileExtension = isPDF ? 'pdf' : (fileExt || 'jpg');
      const fileUri = documentDir + `document_${Date.now()}.${fileExtension}`;
      
      const downloadResult = await FileSystem.downloadAsync(imageUri, fileUri, {
        headers,
      });
      
      if (downloadResult.status === 200) {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(downloadResult.uri);
        } else {
          alert('Sharing is not available on this device');
        }
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download document. Please try again.');
    }
  };

  const renderContent = () => {
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.errorText}>Failed to load document</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setError(false);
              detectFileType();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (isPDF) {
      // ✅ Use direct PDF URL in WebView
      return (
        <WebView
          source={{ uri: imageUri }}
          style={styles.webview}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>Loading PDF...</Text>
            </View>
          )}
          onLoad={() => {
            console.log('✅ PDF loaded successfully');
            setLoading(false);
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('❌ WebView error:', nativeEvent);
            setLoading(false);
            setError(true);
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scalesPageToFit={true}
          renderError={(errorName) => {
            console.log('📄 WebView error name:', errorName);
            return (
              <View style={styles.errorContainer}>
                <Ionicons name="document-outline" size={64} color="#EF4444" />
                <Text style={styles.errorText}>Cannot preview PDF</Text>
                <TouchableOpacity 
                  style={styles.openBrowserButton}
                  onPress={() => {
                    Linking.openURL(imageUri);
                  }}
                >
                  <Text style={styles.openBrowserButtonText}>Open in Browser</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      );
    }

    // ✅ Image preview
    return (
      <Image
        source={{ uri: imageUri }}
        style={styles.image}
        resizeMode="contain"
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
      />
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <SafeAreaView style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
            <Ionicons name="close-outline" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {documentName || documentType || "Document"}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isPDF ? '📄 PDF Document' : `🖼️ ${fileExt.toUpperCase() || 'Image'}`}
            </Text>
          </View>

          <TouchableOpacity onPress={handleDownload} style={styles.downloadButton} activeOpacity={0.7}>
            <Ionicons name="download-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {loading && !error && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>
                {isPDF ? 'Loading PDF...' : 'Loading document...'}
              </Text>
            </View>
          )}
          
          {renderContent()}
        </View>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.footerButton} onPress={onClose}>
            <Ionicons name="close-outline" size={22} color="#FFFFFF" />
            <Text style={styles.footerButtonText}>Close</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.footerButton, styles.footerButtonPrimary]} onPress={handleDownload}>
            <Ionicons name="download-outline" size={22} color="#FFFFFF" />
            <Text style={styles.footerButtonText}>Download</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 40,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  closeButton: {
    padding: 8,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    textAlign: 'center',
  },
  downloadButton: {
    padding: 8,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  openBrowserButton: {
    marginTop: 12,
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  openBrowserButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  image: {
    width: width,
    height: height - 180,
  },
  webview: {
    width: width - 32,
    height: height - 200,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 12,
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    gap: 8,
  },
  footerButtonPrimary: {
    backgroundColor: '#2563EB',
  },
  footerButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});