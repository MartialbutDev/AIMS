// app/(student)/documents/upload.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  Animated,
} from "react-native";

import { useTheme } from "../../../src/context/ThemeContext";
import { useDocumentPicker } from "../../../src/hooks/useDocumentPicker";
import api from "../../../src/services/api";

interface DocumentType {
  value: string;
  label: string;
}

const DOCUMENT_TYPES: DocumentType[] = [
  { value: "resume", label: "Resume/CV" },
  { value: "application_letter", label: "Application Letter" },
  { value: "endorsement_letter", label: "Endorsement Letter" },
  { value: "acceptance_letter", label: "Acceptance Letter" },
  { value: "certificate_of_completion", label: "Certificate of Completion" },
  { value: "requirements", label: "Requirements" },
];

export default function UploadDocumentScreen() {
  const { colors, isDark } = useTheme();
  const {
    selectedFile,
    pickImage,
    takePhoto,
    pickAnyFile,
    resetFile,
    isImage,
    isPDF,
  } = useDocumentPicker();

  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [ocrResult, setOcrResult] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  
  // ✅ New: Validation result state
  const [validationResult, setValidationResult] = useState<any>(null);
  
  // Dropdown state
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [isSelecting, setIsSelecting] = useState(false);
  const buttonRef = useRef<View>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const measureButton = () => {
    if (buttonRef.current) {
      buttonRef.current.measure(
        (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
          setDropdownPosition({
            top: pageY + height + 2,
            left: pageX,
            width: width,
          });
        }
      );
    }
  };

  const toggleDropdown = () => {
    if (dropdownVisible) {
      closeDropdown();
    } else {
      setTimeout(() => {
        measureButton();
        setDropdownVisible(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      }, 50);
    }
  };

  const closeDropdown = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setDropdownVisible(false);
    });
  };

  const handleOutsidePress = () => {
    if (dropdownVisible) {
      closeDropdown();
    }
  };

  const handleSelectOption = async (option: 'photos' | 'documents') => {
    closeDropdown();
    setIsSelecting(true);
    
    try {
      let file = null;
      if (option === 'photos') {
        file = await pickImage();
      } else {
        file = await pickAnyFile();
      }
      if (file) {
        console.log('✅ File selected:', file.name);
      } else {
        console.log('❌ User cancelled');
      }
    } catch (error) {
      console.error('Error selecting file:', error);
      Alert.alert('Error', 'Failed to select file');
    } finally {
      setIsSelecting(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      Alert.alert("Error", "Please select a document to upload");
      return;
    }

    if (!selectedType) {
      Alert.alert("Error", "Please select a document type");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setValidationResult(null);

    try {
      const formData = new FormData();
      
      const fileUri = selectedFile.uri;
      const fileName = selectedFile.name;
      const fileType = selectedFile.type || 'application/octet-stream';

      let fileToUpload: any = {
        uri: fileUri,
        name: fileName,
        type: fileType,
      };

      formData.append("file", fileToUpload);
      formData.append("document_type", selectedType);
      formData.append("description", description || "");

      const response = await api.post("/documents/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent: any) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          }
        },
      });

      if (response.data.extracted_text) {
        setOcrResult(response.data.extracted_text);
      }
      setVerificationStatus(response.data.status);
      
      // ✅ Set validation result
      if (response.data.validation) {
        setValidationResult(response.data.validation);
      }

      Alert.alert(
        "Upload Successful",
        `Document uploaded and verified!\nStatus: ${response.data.status}`,
        [
          {
            text: "View Document",
            onPress: () => router.push(`/(student)/documents/${response.data.document.id}` as any),
          },
          { text: "OK", style: "default" },
        ]
      );

      resetFile();
      setSelectedType("");
      setDescription("");
      setOcrResult(null);
      setVerificationStatus(null);
      setValidationResult(null);

    } catch (error: any) {
      console.error("Upload error:", error);
      Alert.alert(
        "Upload Failed",
        error.response?.data?.detail || "Failed to upload document. Please try again."
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const renderFilePreview = () => {
    if (!selectedFile) return null;

    if (isImage(selectedFile)) {
      return (
        <View style={[styles.imagePreview, { backgroundColor: colors.card }]}>
          <Image source={{ uri: selectedFile.uri }} style={styles.previewImage} />
          <TouchableOpacity
            style={[styles.removeFileButton, { backgroundColor: colors.card }]}
            onPress={resetFile}
          >
            <Ionicons name="close-circle" size={24} color={colors.error} />
          </TouchableOpacity>
        </View>
      );
    }

    if (isPDF(selectedFile)) {
      return (
        <View style={[styles.pdfPreview, { backgroundColor: colors.card }]}>
          <Ionicons name="document-text-outline" size={64} color={colors.primary} />
          <Text style={[styles.pdfName, { color: colors.textPrimary }]} numberOfLines={2}>
            {selectedFile.name}
          </Text>
          <Text style={[styles.pdfSize, { color: colors.textSecondary }]}>
            {((selectedFile.size || 0) / 1024).toFixed(2)} KB
          </Text>
          <TouchableOpacity
            style={[styles.removeFileButton, { backgroundColor: colors.card }]}
            onPress={resetFile}
          >
            <Ionicons name="close-circle" size={24} color={colors.error} />
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[styles.filePreview, { backgroundColor: colors.card }]}>
        <Ionicons name="document-outline" size={48} color={colors.primary} />
        <Text style={[styles.fileName, { color: colors.textPrimary }]} numberOfLines={2}>
          {selectedFile.name}
        </Text>
        <TouchableOpacity
          style={[styles.removeFileButton, { backgroundColor: colors.card }]}
          onPress={resetFile}
        >
          <Ionicons name="close-circle" size={24} color={colors.error} />
        </TouchableOpacity>
      </View>
    );
  };

  const DocumentTypeSelector = () => (
    <View style={styles.typeSelector}>
      {DOCUMENT_TYPES.map((type) => (
        <TouchableOpacity
          key={type.value}
          style={[
            styles.typeChip,
            { 
              backgroundColor: selectedType === type.value ? colors.primary : colors.card,
              borderColor: selectedType === type.value ? colors.primary : colors.border,
            }
          ]}
          onPress={() => setSelectedType(type.value)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.typeChipText,
              { 
                color: selectedType === type.value ? '#FFFFFF' : colors.textSecondary 
              }
            ]}
          >
            {type.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const Dropdown = () => {
    if (!dropdownVisible) return null;

    return (
      <>
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={handleOutsidePress}
        />
        
        <Animated.View
          style={[
            styles.dropdownContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width || 200,
              opacity: fadeAnim,
              shadowColor: isDark ? '#000' : '#000',
              transform: [
                {
                  scale: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1],
                  }),
                },
              ],
            }
          ]}
        >
          <TouchableOpacity
            style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
            onPress={() => handleSelectOption('photos')}
            activeOpacity={0.7}
            disabled={isSelecting}
          >
            <View style={[styles.dropdownIcon, { backgroundColor: `${colors.primary}15` }]}>
              <Ionicons name="images-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.dropdownTextContainer}>
              <Text style={[styles.dropdownItemText, { color: colors.textPrimary }]}>Photos</Text>
              <Text style={[styles.dropdownItemSubtext, { color: colors.textSecondary }]}>Gallery</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
            onPress={() => handleSelectOption('documents')}
            activeOpacity={0.7}
            disabled={isSelecting}
          >
            <View style={[styles.dropdownIcon, { backgroundColor: `${colors.primary}15` }]}>
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.dropdownTextContainer}>
              <Text style={[styles.dropdownItemText, { color: colors.textPrimary }]}>Documents</Text>
              <Text style={[styles.dropdownItemSubtext, { color: colors.textSecondary }]}>PDF</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </Animated.View>
      </>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Upload Document</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Select Document</Text>
          
          {selectedFile ? (
            renderFilePreview()
          ) : (
            <View style={[styles.pickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="cloud-upload-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.pickerTitle, { color: colors.textPrimary }]}>Choose a document</Text>
              <Text style={[styles.pickerSubtitle, { color: colors.textSecondary }]}>
                Supports: Images (JPG, PNG) and PDF
              </Text>
              <View style={styles.pickerButtons}>
                <TouchableOpacity 
                  style={[styles.pickerButton, { backgroundColor: colors.primary }]} 
                  onPress={takePhoto}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.pickerButtonText}>Camera</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  ref={buttonRef}
                  style={[styles.pickerButton, { backgroundColor: colors.primary }]} 
                  onPress={toggleDropdown}
                  activeOpacity={0.8}
                >
                  <Ionicons name="folder-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.pickerButtonText}>Choose File</Text>
                  <Ionicons 
                    name={dropdownVisible ? "chevron-up-outline" : "chevron-down-outline"} 
                    size={16} 
                    color="#FFFFFF" 
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Document Type</Text>
          <DocumentTypeSelector />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Description (Optional)</Text>
          <TextInput
            style={[styles.descriptionInput, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="Enter a brief description..."
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* ✅ Validation Result Display */}
        {validationResult && (
          <View style={styles.validationSection}>
            <View style={styles.validationHeader}>
              <Ionicons 
                name={validationResult.is_valid ? "checkmark-circle" : "alert-circle"} 
                size={24} 
                color={validationResult.is_valid ? colors.success : colors.warning} 
              />
              <Text style={[styles.validationTitle, { color: colors.textPrimary }]}>
                Document Validation
              </Text>
            </View>
            <View style={[styles.validationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.validationRow}>
                <Text style={[styles.validationLabel, { color: colors.textSecondary }]}>Confidence</Text>
                <Text style={[styles.validationValue, { color: validationResult.is_valid ? colors.success : colors.warning }]}>
                  {validationResult.confidence}%
                </Text>
              </View>
              <View style={styles.validationRow}>
                <Text style={[styles.validationLabel, { color: colors.textSecondary }]}>Status</Text>
                <Text style={[styles.validationValue, { color: validationResult.is_valid ? colors.success : colors.warning }]}>
                  {validationResult.is_valid ? "✅ Verified" : "⚠️ Needs Review"}
                </Text>
              </View>
              <Text style={[styles.validationMessage, { color: colors.textSecondary }]}>
                {validationResult.message}
              </Text>
            </View>
          </View>
        )}

        {ocrResult && (
          <View style={styles.ocrSection}>
            <View style={[styles.ocrHeader]}>
              <Ionicons
                name={verificationStatus === "verified" ? "checkmark-circle" : "alert-circle"}
                size={24}
                color={verificationStatus === "verified" ? colors.success : colors.warning}
              />
              <Text style={[styles.ocrTitle, { color: colors.textPrimary }]}>OCR Results</Text>
            </View>
            <View style={[styles.ocrCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.ocrText, { color: colors.textSecondary }]} numberOfLines={5}>
                {ocrResult}
              </Text>
              <View style={[styles.ocrStatus, { borderTopColor: colors.border }]}>
                <Text
                  style={[
                    styles.ocrStatusText,
                    verificationStatus === "verified"
                      ? [styles.verifiedText, { color: colors.success }]
                      : [styles.rejectedText, { color: colors.error }],
                  ]}
                >
                  {verificationStatus === "verified" ? "✅ Verified" : "⚠️ Review Needed"}
                </Text>
              </View>
            </View>
          </View>
        )}

        {uploading && uploadProgress > 0 && (
          <View style={styles.progressSection}>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${uploadProgress}%`, backgroundColor: colors.primary },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>{uploadProgress}% Uploaded</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.uploadButton,
            { backgroundColor: colors.primary },
            (!selectedFile || !selectedType || uploading) && styles.uploadButtonDisabled,
          ]}
          onPress={handleUpload}
          disabled={!selectedFile || !selectedType || uploading}
          activeOpacity={0.8}
        >
          {uploading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={24} color="#FFFFFF" />
              <Text style={styles.uploadButtonText}>Upload Document</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={[styles.infoNote, { backgroundColor: `${colors.primary}10` }]}>
          <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Supported formats: JPEG, PNG, HEIC, PDF. Max file size: 10MB
          </Text>
        </View>
      </ScrollView>

      <Dropdown />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  headerRight: {
    width: 32,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  pickerContainer: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 2,
    borderStyle: "dashed",
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  pickerSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  pickerButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  pickerButton: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  pickerButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  imagePreview: {
    position: "relative",
    width: "100%",
    alignItems: "center",
    borderRadius: 12,
    padding: 8,
  },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    resizeMode: "contain",
  },
  pdfPreview: {
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    minHeight: 150,
  },
  pdfName: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 8,
    textAlign: "center",
  },
  pdfSize: {
    fontSize: 12,
    marginTop: 4,
  },
  filePreview: {
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    minHeight: 120,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 8,
    textAlign: "center",
  },
  removeFileButton: {
    position: "absolute",
    top: -10,
    right: -10,
    borderRadius: 12,
  },
  typeSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  descriptionInput: {
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 80,
    borderWidth: 1,
    textAlignVertical: "top",
  },
  // ✅ Validation styles
  validationSection: {
    marginBottom: 20,
  },
  validationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  validationTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  validationCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  validationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  validationLabel: {
    fontSize: 13,
  },
  validationValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  validationMessage: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  ocrSection: {
    marginBottom: 20,
  },
  ocrHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  ocrTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  ocrCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  ocrText: {
    fontSize: 14,
    lineHeight: 20,
  },
  ocrStatus: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  ocrStatusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  verifiedText: {
    color: "#22C55E",
  },
  rejectedText: {
    color: "#EF4444",
  },
  progressSection: {
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
  uploadButton: {
    flexDirection: "row",
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  infoNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 12,
    flex: 1,
  },

  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 998,
  },
  dropdownContainer: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 1,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    overflow: 'hidden',
    zIndex: 999,
    paddingVertical: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 0.5,
  },
  dropdownIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownTextContainer: {
    flex: 1,
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownItemSubtext: {
    fontSize: 11,
    opacity: 0.6,
  },
});