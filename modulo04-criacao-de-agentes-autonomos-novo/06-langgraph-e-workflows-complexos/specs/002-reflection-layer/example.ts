export function createModel() {
  const primary = baseModel(process.env.OPENROUTER_MODEL!).withRetry({
    stopAfterAttempt: 2,
  });
  const backup = baseModel(process.env.OPENROUTER_MODEL_FALLBACK!).withRetry({
    stopAfterAttempt: 2,
  });
  return primary.withFallback(backup);
}
