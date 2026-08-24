export const API_BASE_STORAGE_KEY = "opspilot.warRoom.apiBaseUrl";
export const DEFAULT_API_BASE_URL = "http://localhost:3000";

export function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

export function isValidApiBaseUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function loadApiBaseUrl(
  storage: Pick<Storage, "getItem"> = localStorage,
): string {
  const stored = storage.getItem(API_BASE_STORAGE_KEY);
  if (stored && isValidApiBaseUrl(stored)) {
    return normalizeBaseUrl(stored);
  }
  return DEFAULT_API_BASE_URL;
}

export function saveApiBaseUrl(
  raw: string,
  storage: Pick<Storage, "setItem"> = localStorage,
): string {
  if (!isValidApiBaseUrl(raw)) {
    throw new Error("URL inválida");
  }
  const normalized = normalizeBaseUrl(raw);
  storage.setItem(API_BASE_STORAGE_KEY, normalized);
  return normalized;
}
