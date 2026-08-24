import { describe, expect, it } from "vitest";
import { VITE_BASE } from "./base";
import { joinBase } from "./api/client";

describe("base path and joinBase", () => {
  it("uses /opspilot/ vite base", () => {
    expect(VITE_BASE).toBe("/opspilot/");
  });

  it("avoids double slashes when joining", () => {
    expect(joinBase("http://localhost:3000/", "/chat")).toBe(
      "http://localhost:3000/chat",
    );
  });
});
