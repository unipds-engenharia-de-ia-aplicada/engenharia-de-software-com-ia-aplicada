import { EmbeddingError } from "../domain/errors.js";
import type { Embedder } from "../domain/types.js";

export const EMBEDDING_DIM = 384;
export const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

type FeatureExtractionPipeline = (
  text: string,
  options: { pooling: "mean"; normalize: true },
) => Promise<{ data: Float32Array | number[] }>;

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

async function loadPipeline(): Promise<FeatureExtractionPipeline> {
  try {
    const { pipeline } = await import("@huggingface/transformers");
    return (await pipeline("feature-extraction", MODEL_ID)) as FeatureExtractionPipeline;
  } catch (cause) {
    throw new EmbeddingError(`Failed to load embedding model ${MODEL_ID}`, { cause });
  }
}

function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = loadPipeline();
  }
  return pipelinePromise;
}

class TransformersEmbedder implements Embedder {
  async embed(text: string): Promise<Float32Array> {
    try {
      const extractor = await getPipeline();
      const output = await extractor(text, { pooling: "mean", normalize: true });
      const data = output.data instanceof Float32Array ? output.data : Float32Array.from(output.data);
      if (data.length !== EMBEDDING_DIM) {
        throw new EmbeddingError(
          `Unexpected embedding dimension ${data.length}; expected ${EMBEDDING_DIM}`,
        );
      }
      return new Float32Array(data);
    } catch (cause) {
      if (cause instanceof EmbeddingError) {
        throw cause;
      }
      throw new EmbeddingError("Failed to embed text", { cause });
    }
  }
}

let defaultEmbedder: Embedder | null = null;

/** Lazy singleton Embedder backed by all-MiniLM-L6-v2. */
export function getDefaultEmbedder(): Embedder {
  if (!defaultEmbedder) {
    defaultEmbedder = new TransformersEmbedder();
  }
  return defaultEmbedder;
}

/** @internal Reset singleton (tests only). */
export function resetDefaultEmbedderForTests(): void {
  defaultEmbedder = null;
  pipelinePromise = null;
}
