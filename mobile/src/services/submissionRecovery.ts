import { isAxiosError, type AxiosRequestConfig } from "axios";
import { randomUUID } from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Alert } from "react-native";
import api from "./api";
import { feedbackMessage, type StudentDocumentFeedback } from "../utils/documentFeedback";

function outcomeUnknown(error: unknown) {
  if (!isAxiosError(error)) return false;
  const status = error.response?.status;
  return !status || status === 408 || status === 500 || status === 502 || status === 504;
}

export class SubmissionUnconfirmedError extends Error {
  readonly retry: () => Promise<{ data: unknown }>;

  constructor(retry: () => Promise<{ data: unknown }>) {
    super("Couldn’t confirm whether this submission was saved. Retry the same submission or refresh your records.");
    this.retry = retry;
  }
}

export async function submitWithRecovery<T>(path: string, form: FormData, config: AxiosRequestConfig = {}) {
  const token = await SecureStore.getItemAsync("access_token");
  const retryUntil = Date.now() + 86_400_000;
  const headers = {
    ...config.headers,
    "Content-Type": "multipart/form-data",
    "Idempotency-Key": randomUUID(),
  };
  const send = () => api.post<T>(path, form, { ...config, headers });
  const retry = async () => {
    if (!token || await SecureStore.getItemAsync("access_token") !== token || Date.now() >= retryUntil) {
      throw new Error("Refresh your records before starting a new submission.");
    }
    try {
      return await send();
    } catch (error) {
      if (!outcomeUnknown(error) && isAxiosError(error) && error.response?.status !== 401) throw error;
      throw new SubmissionUnconfirmedError(retry);
    }
  };

  try {
    return await send();
  } catch (error) {
    if (!outcomeUnknown(error)) throw error;
    return retry();
  }
}

export function showSubmissionRecovery(error: unknown, openRecords: () => void, message?: string) {
  if (!(error instanceof SubmissionUnconfirmedError)) return false;
  Alert.alert("Submission unconfirmed", message ?? error.message, [
    { text: "View records", style: "cancel", onPress: openRecords },
    {
      text: "Retry submission",
      onPress: () => {
        void error.retry().then(({ data }) => {
          const rejected = typeof data === "object" && data !== null && "status" in data && data.status === "rejected";
          const feedback = typeof data === "object" && data !== null && "student_feedback" in data
            ? data.student_feedback as StudentDocumentFeedback | undefined : undefined;
          Alert.alert(feedback?.status_label ?? (rejected ? "Document rejected" : "Submission recorded"),
            feedback ? feedbackMessage(feedback) : rejected ? "Check Documents for the review result." : "AIMS has saved this submission.",
            [{ text: "View records", onPress: openRecords }]);
        }).catch(nextError => {
          if (!showSubmissionRecovery(nextError, openRecords, message)) {
            Alert.alert("Couldn’t retry submission", submissionErrorMessage(nextError, "Refresh your records before trying again."),
              [{ text: "View records", onPress: openRecords }]);
          }
        });
      },
    },
  ], { cancelable: false });
  return true;
}

export function submissionErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError(error) && typeof error.response?.data?.detail === "string") {
    return error.response.data.detail;
  }
  return error instanceof Error && !isAxiosError(error) ? error.message : fallback;
}
