// src/lib/types.ts — shared shapes between the dashboard and its widgets.
import type { LlmType } from "./api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: number;
  /** Which model answered (assistant messages only) — shown as provenance. */
  model?: LlmType;
  /** Quote timestamp the prompt was grounded with, if any. */
  groundedAt?: number | null;
  groundedPrice?: string | null;
  streaming?: boolean;
  error?: string | null;
}

export interface PriceSample {
  t: number;
  price: number;
}
