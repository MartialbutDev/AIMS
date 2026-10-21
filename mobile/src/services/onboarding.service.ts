
import * as SecureStore from "expo-secure-store";

// ============================================================
// API CONFIGURATION
// ============================================================

// Supports both:
// EXPO_PUBLIC_API_URL=http://192.168.1.45:8000
// EXPO_PUBLIC_API_URL=http://192.168.1.45:8000/api/v1

const RAW_API_URL = (
  process.env.EXPO_PUBLIC_API_URL || ""
)
  .trim()
  .replace(/\/+$/, "");

const API_BASE_URL = RAW_API_URL.endsWith("/api/v1")
  ? RAW_API_URL
  : `${RAW_API_URL}/api/v1`;

const ONBOARDING_ENDPOINT = "/onboarding";

// ============================================================
// TYPES
// ============================================================

export type ReviewStatus =
  | "pending_review"
  | "verified"
  | "rejected";

export type OnboardingStep =
  | "upload_orientation"
  | "upload_cor"
  | "awaiting_review"
  | "resubmit_rejected"
  | "completed";

export type CoordinatorAssignmentStatus =
  | "assigned"
  | "pending_assignment"
  | "not_eligible";

export interface CoordinatorAssignment {
  status: CoordinatorAssignmentStatus;
  coordinator_id?: string;
  coordinator_name?: string;
}

export interface OnboardingSubmission {
  id: string;
  document_kind: "orientation" | "cor";
  original_filename: string;
  review_status: ReviewStatus;

  validation_result: {
    automatic_result?: string;
    checks?: Record<string, boolean | null>;
    details?: Record<string, unknown>;
    requires_manual_review?: boolean;
    ocr_warning?: string;
  } | null;

  review_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
}

export interface OnboardingStatus {
  student_id: string;
  eligible: boolean;
  next_step: OnboardingStep;

  orientation: OnboardingSubmission | null;
  cor: OnboardingSubmission | null;

  // Returned by GET /api/v1/onboarding/me
  coordinator_assignment: CoordinatorAssignment;
}

export interface SelectedDocument {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number;
}

// ============================================================
// CUSTOM API ERROR
// ============================================================

export class OnboardingApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "OnboardingApiError";
  }
}

// ============================================================
// AUTHENTICATED API REQUEST
// ============================================================

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (!RAW_API_URL) {
    throw new Error(
      "EXPO_PUBLIC_API_URL is not configured. " +
        "Set it to your FastAPI server address."
    );
  }

  const token = await SecureStore.getItemAsync(
    "access_token"
  );

  if (!token) {
    throw new OnboardingApiError(
      "Your session has expired. Please log in again.",
      401
    );
  }

  const url =
    `${API_BASE_URL}${ONBOARDING_ENDPOINT}${path}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      let message =
        `Request failed (${response.status})`;

      try {
        const errorData = await response.json();

        if (typeof errorData.detail === "string") {
          message = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          message = errorData.detail
            .map((item: { msg?: string }) =>
              item.msg || "Validation error"
            )
            .join(", ");
        }
      } catch {
        // Keep original HTTP error message.
      }

      throw new OnboardingApiError(
        message,
        response.status
      );
    }

    return (await response.json()) as T;
  } catch (error: unknown) {
    if (error instanceof OnboardingApiError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new Error(
        "Unable to connect to the onboarding server: " +
          error.message
      );
    }

    throw new Error(
      "Unable to connect to the onboarding server."
    );
  }
}

// ============================================================
// DOCUMENT UPLOAD
// ============================================================

async function uploadDocument(
  endpoint: "/orientation" | "/cor",
  document: SelectedDocument
): Promise<OnboardingStatus> {
  const formData = new FormData();

  const extension = document.name
    .split(".")
    .pop()
    ?.toLowerCase();

  let mimeType = document.mimeType;

  if (!mimeType) {
    switch (extension) {
      case "pdf":
        mimeType = "application/pdf";
        break;

      case "png":
        mimeType = "image/png";
        break;

      case "jpg":
      case "jpeg":
        mimeType = "image/jpeg";
        break;

      default:
        mimeType = "application/octet-stream";
    }
  }

  formData.append(
    "file",
    {
      uri: document.uri,
      name: document.name,
      type: mimeType,
    } as any
  );

  return request<OnboardingStatus>(endpoint, {
    method: "POST",
    body: formData,

    // React Native generates the multipart boundary.
    // Do not set Content-Type manually.
  });
}

// ============================================================
// ONBOARDING SERVICE
// ============================================================

export const onboardingService = {
  // ----------------------------------------------------------
  // GET CURRENT STUDENT ONBOARDING STATUS
  // GET /api/v1/onboarding/me
  // ----------------------------------------------------------

  getStatus(): Promise<OnboardingStatus> {
    return request<OnboardingStatus>("/me");
  },

  // ----------------------------------------------------------
  // UPLOAD ORIENTATION CERTIFICATE
  // POST /api/v1/onboarding/orientation
  // ----------------------------------------------------------

  uploadOrientation(
    document: SelectedDocument
  ): Promise<OnboardingStatus> {
    return uploadDocument(
      "/orientation",
      document
    );
  },

  // ----------------------------------------------------------
  // UPLOAD CERTIFICATE OF REGISTRATION
  // POST /api/v1/onboarding/cor
  // ----------------------------------------------------------

  uploadCOR(
    document: SelectedDocument
  ): Promise<OnboardingStatus> {
    return uploadDocument(
      "/cor",
      document
    );
  },
};
