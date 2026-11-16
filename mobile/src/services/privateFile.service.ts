import { isAxiosError } from "axios";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { API_URL } from "../config/env";
import api from "./api";

const extensions: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "image/heic": "heic",
  "image/webp": "webp",
};

function fileType(contentType?: string) {
  const mimeType = contentType?.split(";")[0].trim().toLowerCase() || "";
  const extension = Object.hasOwn(extensions, mimeType) ? extensions[mimeType] : null;
  if (!extension) throw new Error("This file type can’t be opened.");
  return { mimeType, extension };
}

export async function openPrivateFile(path: string, name: "document" | "journal") {
  if (Platform.OS === "web") {
    const { data } = await api.get<Blob>(path, { responseType: "blob" }).catch((error) => {
      if (isAxiosError(error) && error.response?.status === 503) {
        throw new Error("File storage is temporarily unavailable. Please try again shortly.");
      }
      throw new Error("Couldn’t download the file. Refresh and try again.");
    });
    const { extension } = fileType(data.type);
    const url = URL.createObjectURL(data);
    try {
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `${name}.${extension}`;
      link.click();
    } finally {
      // Give the browser time to start reading the download.
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
    return;
  }

  const token = await SecureStore.getItemAsync("access_token");
  if (!token) throw new Error("Session expired. Please sign in again.");
  if (!FileSystem.cacheDirectory || !await Sharing.isAvailableAsync()) {
    throw new Error("Opening files is unavailable on this device.");
  }

  const folder = `${FileSystem.cacheDirectory}aims-preview-${Crypto.randomUUID()}/`;
  const temporaryFile = `${folder}download`;
  try {
    const result = await (async () => {
      await FileSystem.makeDirectoryAsync(folder);
      return FileSystem.downloadAsync(`${API_URL}${path}`, temporaryFile, {
        headers: { Authorization: `Bearer ${token}` },
        sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
      });
    })().catch(() => {
      throw new Error("Couldn’t download the file. Check your connection and try again.");
    });
    if (result.status === 401 || await SecureStore.getItemAsync("access_token") !== token) {
      throw new Error("Session expired. Please sign in again.");
    }
    if (result.status === 503) {
      throw new Error("File storage is temporarily unavailable. Please try again shortly.");
    }
    if (result.status !== 200) {
      throw new Error("Couldn’t download the file. Refresh and try again.");
    }
    const contentType = Object.entries(result.headers).find(([key]) => key.toLowerCase() === "content-type")?.[1];
    const { mimeType, extension } = fileType(contentType);
    const uri = `${folder}${name}.${extension}`;
    await FileSystem.moveAsync({ from: temporaryFile, to: uri });
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: "Open file" });
  } finally {
    await FileSystem.deleteAsync(folder, { idempotent: true }).catch(() => {});
  }
}
