import { z } from "zod";

export type FetchLike = typeof globalThis.fetch;

export const PROVIDER_URLS = {
  github: "https://www.githubstatus.com/api/v2/status.json",
  cloudflare: "https://www.cloudflarestatus.com/api/v2/status.json",
} as const;

export type ProviderId = keyof typeof PROVIDER_URLS;

export const statusPageStatusSchema = z
  .object({
    status: z.object({
      indicator: z.string(),
      description: z.string(),
    }),
  })
  .passthrough();

export type FetchProviderStatusOptions = {
  /** Injectable fetch for tests; defaults to globalThis.fetch */
  fetch?: FetchLike;
};

export function formatProviderStatus(
  provider: ProviderId,
  indicator: string,
  description: string,
): string {
  return `${provider} está ${indicator} - ${description}`;
}

function failureMessage(provider: ProviderId, detail: string): string {
  return (
    `não consegui consultar o status de ${provider} (${detail}). ` +
    "Responda com base nos alertas internos e avise o plantonista da limitação"
  );
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  if (error.name === "AbortError" || error.name === "TimeoutError") return true;
  if (error.message.startsWith("upstream ")) return true;
  // Network failures from fetch typically have TypeError
  if (error instanceof TypeError) return true;
  return false;
}

/**
 * Consulta a statuspage pública do provedor (sem chave).
 * Sempre resolve com string (sucesso compacto ou erro legível) — nunca rejeita por falha operacional.
 */
export async function fetchProviderStatus(
  provider: ProviderId,
  options?: FetchProviderStatusOptions,
): Promise<string> {
  const doFetch = options?.fetch ?? globalThis.fetch;
  const url = PROVIDER_URLS[provider];
  let lastDetail = "unknown error";

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await doFetch(url, { signal: AbortSignal.timeout(5000) });

      if (response.status >= 500) {
        throw new Error(`upstream ${response.status}`);
      }

      if (!response.ok) {
        return `status page de ${provider} respondeu HTTP ${response.status}`;
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch (error) {
        return failureMessage(
          provider,
          `invalid JSON: ${(error as Error).message}`,
        );
      }

      const parsed = statusPageStatusSchema.safeParse(json);
      if (!parsed.success) {
        return failureMessage(provider, "invalid statuspage response");
      }

      const { indicator, description } = parsed.data.status;
      return formatProviderStatus(provider, indicator, description);
    } catch (error) {
      lastDetail = (error as Error).message;
      if (attempt === 2 || !isRetryableError(error)) {
        return failureMessage(provider, lastDetail);
      }
    }
  }

  return failureMessage(provider, lastDetail);
}
