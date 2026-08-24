import { describe, expect, it } from "vitest";
import {
  API_BASE_STORAGE_KEY,
  loadApiBaseUrl,
  normalizeBaseUrl,
  saveApiBaseUrl,
} from "./config";

describe("api config", () => {
  it("normalizes trailing slash and persists valid URL", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };

    const saved = saveApiBaseUrl("http://localhost:3000/", storage);
    expect(saved).toBe("http://localhost:3000");
    expect(store.get(API_BASE_STORAGE_KEY)).toBe("http://localhost:3000");
    expect(loadApiBaseUrl(storage)).toBe("http://localhost:3000");
    expect(normalizeBaseUrl("http://x/")).toBe("http://x");
  });
});
