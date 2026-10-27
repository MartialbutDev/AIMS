import { useNotificationRefresh } from '../../src/hooks/useNotificationRefresh';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  router,
} from "expo-router";

import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";

import * as DocumentPicker from "expo-document-picker";
import * as SecureStore from "expo-secure-store";

import { useTheme } from "../../src/context/ThemeContext";

import {
  onboardingService,
  OnboardingApiError,
} from "../../src/services/onboarding.service";

import type {
  OnboardingStatus,
  OnboardingSubmission,
  SelectedDocument,
} from "../../src/services/onboarding.service";

type DocumentKind = "orientation" | "cor";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function getStatusLabel(
  submission: OnboardingSubmission | null
): string {
  if (!submission) {
    return "Not Uploaded";
  }

  switch (submission.review_status) {
    case "verified":
      return "Approved";

    case "rejected":
      return "Rejected";

    case "pending_review":
      return "Pending Review";

    default:
      return "Pending Review";
  }
}

function getStatusColor(
  submission: OnboardingSubmission | null
): string {
  if (!submission) {
    return "#64748B";
  }

  switch (submission.review_status) {
    case "verified":
      return "#16A34A";

    case "rejected":
      return "#DC2626";

    default:
      return "#D97706";
  }
}

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

export default function StudentOnboardingScreen() {
  const { colors, isDark } = useTheme();

  const [status, setStatus] =
    useState<OnboardingStatus | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [uploading, setUploading] =
    useState<DocumentKind | null>(null);

  const [errorMessage, setErrorMessage] = useState("");

  const [loggingOut, setLoggingOut] = useState(false);

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const uploadingRef = useRef(false);

  // ============================================================
  // CHECK ONBOARDING STATUS
  // ============================================================

  const loadStatus = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      setErrorMessage("");

      const token = await SecureStore.getItemAsync(
        "access_token"
      );

      if (
        !mountedRef.current ||
        requestId !== requestIdRef.current
      ) {
        return;
      }

      if (!token) {
        router.replace("/(auth)/login");
        return;
      }

      const result = await onboardingService.getStatus();

      if (
        !mountedRef.current ||
        requestId !== requestIdRef.current
      ) {
        return;
      }

      setStatus(result);

      // Only the backend can confirm eligibility.
      if (result.eligible === true) {
        router.replace("/(student)/dashboard");
      }
    } catch (error: unknown) {
      if (
        !mountedRef.current ||
        requestId !== requestIdRef.current
      ) {
        return;
      }

      if (
        error instanceof OnboardingApiError &&
        error.status === 401
      ) {
        router.replace("/(auth)/login");
        return;
      }

      setErrorMessage(
        getErrorMessage(
          error,
          "Unable to check onboarding status."
        )
      );
    } finally {
      if (
        mountedRef.current &&
        requestId === requestIdRef.current
      ) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // ============================================================
  // LIFECYCLE
  // ============================================================

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  // Review decisions refresh while the app is active, including foreground push events.
  useNotificationRefresh(async () => { if (!uploadingRef.current) await loadStatus(); });

  // ============================================================
  // REFRESH STATUS
  // ============================================================

  const refreshStatus = async () => {
    if (refreshing || uploadingRef.current) {
      return;
    }

    setRefreshing(true);

    await loadStatus();
  };

  // ============================================================
  // SELECT AND UPLOAD DOCUMENT
  // ============================================================

  const selectAndUpload = async (
    kind: DocumentKind
  ) => {
    if (uploadingRef.current) {
      return;
    }

    uploadingRef.current = true;

    try {
      const result =
        await DocumentPicker.getDocumentAsync({
          type: [
            "application/pdf",
            "image/jpeg",
            "image/png",
          ],
          copyToCacheDirectory: true,
          multiple: false,
        });

      if (result.canceled || !result.assets.length) {
        return;
      }

      const asset = result.assets[0];

      if (
        asset.size !== undefined &&
        asset.size > MAX_FILE_SIZE
      ) {
        Alert.alert(
          "File Too Large",
          "Please select a file smaller than 10 MB."
        );

        return;
      }

      const document: SelectedDocument = {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
      };

      setUploading(kind);
      setErrorMessage("");

      // Upload to the existing FastAPI onboarding API.
      const updated =
        kind === "orientation"
          ? await onboardingService.uploadOrientation(
              document
            )
          : await onboardingService.uploadCOR(
              document
            );

      if (!mountedRef.current) {
        return;
      }

      setStatus(updated);

      // In normal operation, manual review is still required.
      if (updated.eligible === true) {
        router.replace("/(student)/dashboard");
        return;
      }

      Alert.alert(
        "Upload Successful",
        "Your document was submitted for verification."
      );
    } catch (error: unknown) {
      if (!mountedRef.current) {
        return;
      }

      if (
        error instanceof OnboardingApiError &&
        error.status === 401
      ) {
        router.replace("/(auth)/login");
        return;
      }

      Alert.alert(
        "Upload Failed",
        getErrorMessage(
          error,
          "Unable to upload your document."
        )
      );
    } finally {
      uploadingRef.current = false;

      if (mountedRef.current) {
        setUploading(null);
      }
    }
  };

  // ============================================================
  // LOGOUT
  // ============================================================

  const logout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      // Invalidate outstanding status requests.
      requestIdRef.current += 1;

      await SecureStore.deleteItemAsync(
        "access_token"
      );

      await SecureStore.deleteItemAsync("user");

      router.replace("/(auth)/login");
    } catch (error) {
      Alert.alert(
        "Error",
        "Unable to sign out. Please try again."
      );
    } finally {
      if (mountedRef.current) {
        setLoggingOut(false);
      }
    }
  };

  const confirmLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => void logout(),
        },
      ]
    );
  };

  // ============================================================
  // DOCUMENT CARD
  // ============================================================

  const renderDocumentCard = (
    kind: DocumentKind,
    title: string,
    description: string,
    submission: OnboardingSubmission | null,
    disabled: boolean
  ) => {
    const statusColor = getStatusColor(submission);

    const canUpload =
      !disabled &&
      (!submission ||
        submission.review_status === "rejected");

    const isUploading = uploading === kind;

    return (
      <View
        style={[
          styles.documentCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        {/* Document header */}
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: colors.primary + "15",
              },
            ]}
          >
            <Ionicons
              name={
                kind === "orientation"
                  ? "ribbon-outline"
                  : "school-outline"
              }
              size={26}
              color={colors.accent}
            />
          </View>

          <View style={styles.cardTitleContainer}>
            <Text
              style={[
                styles.cardTitle,
                {
                  color: colors.textPrimary,
                },
              ]}
            >
              {title}
            </Text>

            <Text
              style={[
                styles.cardDescription,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              {description}
            </Text>
          </View>
        </View>

        {/* Review status */}
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: statusColor,
              },
            ]}
          />

          <Text
            style={[
              styles.statusText,
              {
                color: statusColor,
              },
            ]}
          >
            {getStatusLabel(submission)}
          </Text>
        </View>

        {/* Uploaded filename */}
        {submission && (
          <View
            style={[
              styles.fileDetails,
              {
                backgroundColor: colors.background,
              },
            ]}
          >
            <Ionicons
              name="document-text-outline"
              size={20}
              color={colors.accent}
            />

            <Text
              style={[
                styles.fileName,
                {
                  color: colors.textPrimary,
                },
              ]}
              numberOfLines={2}
            >
              {submission.original_filename}
            </Text>
          </View>
        )}

        {/* Rejection notes */}
        {submission?.review_status ===
          "rejected" && (
          <View style={styles.rejectionBox}>
            <Ionicons
              name="alert-circle-outline"
              size={20}
              color="#DC2626"
            />

            <Text style={styles.rejectionText}>
              {submission.review_notes ||
                "Your document was rejected. Please upload a corrected copy."}
            </Text>
          </View>
        )}

        {/* Pending review */}
        {submission?.review_status ===
          "pending_review" && (
          <Text
            style={[
              styles.helperText,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            Your document is awaiting review by an
            authorized Coordinator or Administrator.
          </Text>
        )}

        {/* Approved */}
        {submission?.review_status ===
          "verified" && (
          <View style={styles.approvedRow}>
            <Ionicons
              name="checkmark-circle"
              size={18}
              color="#16A34A"
            />

            <Text style={styles.approvedText}>
              This document has been approved.
            </Text>
          </View>
        )}

        {/* Upload button */}
        {canUpload && (
          <TouchableOpacity
            style={[
              styles.uploadButton,
              {
                backgroundColor: colors.primary,
              },
              isUploading && {
                opacity: 0.6,
              },
            ]}
            disabled={Boolean(uploading)}
            onPress={() =>
              void selectAndUpload(kind)
            }
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            {isUploading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="cloud-upload-outline"
                  size={20}
                  color="#FFFFFF"
                />

                <Text style={styles.uploadButtonText}>
                  {submission
                    ? "Upload Corrected Document"
                    : "Choose & Upload File"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* COR prerequisite */}
        {disabled && (
          <Text
            style={[
              styles.helperText,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            Upload your Orientation Certificate
            before submitting your COR.
          </Text>
        )}
      </View>
    );
  };

  // ============================================================
  // INITIAL LOADING
  // ============================================================

  if (loading) {
    return (
      <View
        style={[
          styles.centered,
          {
            backgroundColor: colors.background,
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={colors.accent}
        />

        <Text
          style={[
            styles.loadingText,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          Checking your onboarding status...
        </Text>
      </View>
    );
  }

  // ============================================================
  // MAIN SCREEN
  // ============================================================

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <StatusBar
        style={isDark ? "light" : "dark"}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View
          style={[
            styles.hero,
            {
              backgroundColor: "#000080",
            },
          ]}
        >
          <View style={styles.heroTop}>
            <Text style={styles.heroBrand}>
              AIMS
            </Text>

            <TouchableOpacity
              onPress={confirmLogout}
              style={styles.logoutButton}
              disabled={loggingOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              {loggingOut ? (
                <ActivityIndicator
                  color="#FFFFFF"
                  size="small"
                />
              ) : (
                <Ionicons
                  name="log-out-outline"
                  size={21}
                  color="#FFFFFF"
                />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.heroIcon}>
            <Ionicons
              name="shield-checkmark-outline"
              size={32}
              color="#FFFFFF"
            />
          </View>

          <Text style={styles.heroTitle}>
            Student Verification
          </Text>

          <Text style={styles.heroSubtitle}>
            Complete your required documents
            before accessing internship services.
          </Text>
        </View>

        {/* Main content */}
        <View style={styles.content}>
          {/* Information card */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              name="information-circle-outline"
              size={23}
              color={colors.accent}
            />

            <Text
              style={[
                styles.infoText,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              Submit both requirements. Your
              Coordinator or Administrator must
              approve them before your internship
              dashboard becomes available.
            </Text>
          </View>

          {/* Network error */}
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color="#B91C1C"
              />

              <View style={{ flex: 1 }}>
                <Text style={styles.errorText}>
                  {errorMessage}
                </Text>

                <TouchableOpacity
                  onPress={() => void refreshStatus()}
                  style={styles.errorRetryButton}
                  disabled={refreshing}
                >
                  <Text style={styles.errorRetryText}>
                    Try Again
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.textPrimary,
              },
            ]}
          >
            Required Documents
          </Text>

          {/* Orientation certificate */}
          {renderDocumentCard(
            "orientation",
            "Orientation Certificate",
            "Proof of internship orientation attendance.",
            status?.orientation || null,
            false
          )}

          {/* PRISM COR */}
          {renderDocumentCard(
            "cor",
            "PRISM Certificate of Registration",
            "Proof of enrollment in the required Practicum subject.",
            status?.cor || null,
            !status?.orientation
          )}

          {/* Verification status */}
          <View
            style={[
              styles.verificationCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              name={
                status?.eligible
                  ? "checkmark-circle-outline"
                  : "time-outline"
              }
              size={26}
              color={
                status?.eligible
                  ? "#16A34A"
                  : colors.primary
              }
            />

            <Text
              style={[
                styles.verificationTitle,
                {
                  color: colors.textPrimary,
                },
              ]}
            >
              {status?.eligible
                ? "Verification Complete"
                : "Verification Status"}
            </Text>

            <Text
              style={[
                styles.verificationDescription,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              {status?.eligible
                ? "Both requirements are approved."
                : "Your documents must be approved before you can continue."}
            </Text>

            <TouchableOpacity
              style={[
                styles.refreshButton,
                {
                  borderColor: colors.accent,
                },
              ]}
              disabled={
                refreshing ||
                Boolean(uploading)
              }
              onPress={() => void refreshStatus()}
              activeOpacity={0.8}
            >
              {refreshing ? (
                <ActivityIndicator
                  color={colors.accent}
                />
              ) : (
                <>
                  <Ionicons
                    name="refresh-outline"
                    size={19}
                    color={colors.accent}
                  />

                  <Text
                    style={[
                      styles.refreshText,
                      {
                        color: colors.accent,
                      },
                    ]}
                  >
                    Refresh Status
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  loadingText: {
    fontSize: 14,
  },

  scrollContent: {
    paddingBottom: 45,
  },

  hero: {
    paddingTop: 58,
    paddingHorizontal: 24,
    paddingBottom: 35,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  heroBrand: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 2,
  },

  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },

  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.13)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  heroTitle: {
    fontSize: 27,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
  },

  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.85)",
  },

  content: {
    padding: 20,
    gap: 18,
  },

  infoCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 15,
    borderWidth: 1,
    padding: 16,
  },

  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    marginTop: 5,
  },

  documentCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 15,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  cardTitleContainer: {
    flex: 1,
    gap: 4,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },

  cardDescription: {
    fontSize: 12,
    lineHeight: 18,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },

  statusText: {
    fontSize: 13,
    fontWeight: "700",
  },

  fileDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
  },

  fileName: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
  },

  uploadButton: {
    height: 49,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },

  uploadButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  helperText: {
    fontSize: 12,
    lineHeight: 18,
  },

  rejectionBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  rejectionText: {
    color: "#991B1B",
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },

  approvedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  approvedText: {
    color: "#16A34A",
    fontSize: 12,
    fontWeight: "600",
  },

  verificationCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 10,
  },

  verificationTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  verificationDescription: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },

  refreshButton: {
    marginTop: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    height: 45,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  refreshText: {
    fontSize: 13,
    fontWeight: "700",
  },

  errorBox: {
    backgroundColor: "#FEF2F2",
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    lineHeight: 19,
  },

  errorRetryButton: {
    marginTop: 8,
    alignSelf: "flex-start",
  },

  errorRetryText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
