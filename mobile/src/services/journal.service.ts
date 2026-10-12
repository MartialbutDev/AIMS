// src/services/journal.service.ts
import api from "./api";
import { BASE_URL } from "../config/env";

export interface Journal {
  id: string;
  week: number;
  title: string;
  summary?: string;
  file_path: string;
  status: "draft" | "submitted" | "reviewing" | "approved" | "rejected";
  feedback?: string;
  submitted_date?: string;
  approved_date?: string;
  created_at: string;
}

export interface JournalSummary {
  total: number;
  draft: number;
  submitted: number;
  reviewing: number;
  approved: number;
  rejected: number;
}

export interface CreateJournalPayload {
  week: number;
  title: string;
  summary?: string;
  fileUri: string;
  fileName: string;
  mimeType?: string;
  submit?: boolean;
}

export const journalService = {
  async getJournalSummary(): Promise<JournalSummary> {
    try {
      const res = await api.get("/journals/summary");
      return res.data;
    } catch (err) {
      console.error("❌ getJournalSummary error:", err);
      return {
        total: 0,
        draft: 0,
        submitted: 0,
        reviewing: 0,
        approved: 0,
        rejected: 0,
      };
    }
  },

  async createJournal(payload: CreateJournalPayload): Promise<Journal> {
    const formData = new FormData();

    formData.append("week", String(payload.week));
    formData.append("title", payload.title.trim());
    if (payload.summary?.trim()) {
      formData.append("summary", payload.summary.trim());
    }
    formData.append("submit", payload.submit ? "true" : "false");

    formData.append("file", {
      uri: payload.fileUri,
      name: payload.fileName,
      type: payload.mimeType || "application/pdf",
    } as any);

    const res = await api.post("/journals/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  async getJournalById(id: string): Promise<Journal> {
    const res = await api.get(`/journals/${id}`);
    return res.data;
  },

  async updateJournal(id: string, data: Partial<Journal>): Promise<Journal> {
    const res = await api.put(`/journals/${id}`, data);
    return res.data;
  },

  async replaceFile(
    id: string,
    fileUri: string,
    fileName: string,
    mimeType = "application/pdf"
  ): Promise<Journal> {
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as any);

    const res = await api.put(`/journals/${id}/file`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  async deleteJournal(id: string): Promise<void> {
    await api.delete(`/journals/${id}`);
  },

  getFileUrl(journalId: string, token: string): string {
    return `${BASE_URL}/api/v1/journals/${journalId}/file?token=${encodeURIComponent(
      token
    )}`;
  },
};