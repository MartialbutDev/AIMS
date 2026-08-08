// src/components/documents/DocumentPreview.tsx
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
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
} from "react-native";
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { WebView } from 'react-native-webview';  // ✅ Use WebView instead

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
  const [pdfPages, setPdfPages] = useState(0);

  const isPDF = imageUri?.toLowerCase().includes('.pdf') || documentType?.toLowerCase() === 'pdf';

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
      
      const documentDir = (FileSystem as any).documentDirectory;
      const fileExtension = isPDF ? 'pdf' : 'jpg';
      const fileUri = documentDir + `document_${Date.now()}.${fileExtension}`;
      
      const cleanUri = imageUri.split('?')[0];
      
      const downloadResult = await FileSystem.downloadAsync(cleanUri, fileUri, {
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
    if (isPDF) {
      // ✅ Use WebView for PDF
      const pdfUri = imageUri.split('?')[0];
      return (
        <WebView
          source={{ uri: pdfUri }}
          style={styles.webview}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>Loading PDF...</Text>
            </View>
          )}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      );
    }

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
              {isPDF ? 'PDF Document' : documentType?.replace(/_/g, ' ').toUpperCase() || "Document"}
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
          
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
              <Text style={styles.errorText}>Failed to load document</Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => {
                  setError(false);
                  setLoading(true);
                }}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            renderContent()
          )}
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
  image: {
    width: width,
    height: height - 180,
  },
  webview: {
    width: width - 32,
    height: height - 200,
    backgroundColor: '#FFFFFF',
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