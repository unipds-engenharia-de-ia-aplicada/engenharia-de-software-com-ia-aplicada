import type { NextFunction, Request, Response } from "express";

/** Sentinel: reflect any browser Origin (dev/demo default). */
export const CORS_ALLOW_ALL = "*";

function parseOrigins(raw: string | undefined): string[] | typeof CORS_ALLOW_ALL {
  if (raw === undefined || raw.trim() === "" || raw.trim() === "*") {
    return CORS_ALLOW_ALL;
  }
  return raw
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

/**
 * Default: allow all origins (`*`).
 * Set `OPSPILOT_CORS_ORIGINS` to a comma-separated allowlist to restrict
 * (e.g. `http://localhost:5173,http://127.0.0.1:5173`).
 */
export function resolveCorsOrigins(
  envValue: string | undefined = process.env.OPSPILOT_CORS_ORIGINS,
): string[] | typeof CORS_ALLOW_ALL {
  return parseOrigins(envValue);
}

function applyCorsHeaders(res: Response, origin: string | undefined, allowAll: boolean): void {
  if (allowAll) {
    // Reflect request Origin when present (works with non-credentialed fetches);
    // fall back to * for non-browser / no-Origin clients.
    res.setHeader("Access-Control-Allow-Origin", origin ?? "*");
  } else if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    return;
  }
  if (origin) {
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Request-Id");
  res.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
  res.setHeader("Access-Control-Max-Age", "86400");
}

/**
 * CORS middleware. Default: allow all origins.
 * Pass an allowlist array to restrict; omit / use resolveCorsOrigins() for env default.
 */
export function createCorsMiddleware(
  origins?: string[] | typeof CORS_ALLOW_ALL,
) {
  const resolved = origins ?? resolveCorsOrigins();
  const allowAll = resolved === CORS_ALLOW_ALL;
  const allowlist = allowAll ? null : new Set(resolved);

  return function corsMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const originHeader = req.headers.origin;
    const origin =
      typeof originHeader === "string" ? originHeader.replace(/\/$/, "") : undefined;

    const allowed =
      allowAll || (origin !== undefined && allowlist !== null && allowlist.has(origin));

    if (allowed) {
      applyCorsHeaders(res, origin, allowAll);
    }

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  };
}
