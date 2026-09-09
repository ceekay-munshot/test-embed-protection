// src/lib/api.ts
//
// Thin client over the two registered datasources this dashboard uses
// (see reference/datasource-registry.md):
//
//   stock_data  POST https://fastapi.muns.io/stock-data    60 rpm
//   llm_chat    POST https://fastapi.muns.io/query-router  30 rpm
//
// Every call is authenticated with the host-provided JWT
// (`Authorization: Bearer ${session.token}`). No other API is contacted.

export const FASTAPI_BASE = "https://fastapi.muns.io";

/** Provenance metadata rendered by the source-trail widget. */
export const DATASOURCES = {
  stock_data: {
    id: "stock_data",
    name: "Stock Data",
    service: "fastapi",
    endpoint: "POST /stock-data",
    rpm: 60,
    note: "Real-time quote and company profile.",
  },
  llm_chat: {
    id: "llm_chat",
    name: "LLM Chat",
    service: "fastapi",
    endpoint: "POST /query-router",
    rpm: 30,
    note: "AI completions, streamed as NDJSON.",
  },
} as const;

/** stock_data allows 60 rpm; the registry asks for a 3s floor. 5s is safe. */
export const QUOTE_POLL_MS = 5000;

export class ApiError extends Error {
  status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Friendly, non-technical message for an HTTP failure. Never a stack trace. */
function httpMessage(status: number): string {
  if (status === 401 || status === 403) return "This session is not authorized for that data.";
  if (status === 404) return "No data found for this ticker.";
  if (status === 429) return "Rate limit reached — easing off and retrying.";
  if (status >= 500) return "The data service is temporarily unavailable.";
  return `Request failed (${status}).`;
}

/** Turn any thrown value into a short, user-safe sentence. */
export function toMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof DOMException && err.name === "AbortError") return "Request cancelled.";
  if (err instanceof TypeError) return "Could not reach the data service. Check your connection.";
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong.";
}

/* -------------------------------------------------------------------------- */
/* stock_data — responses are plain text "key=value" pairs, not JSON           */
/* -------------------------------------------------------------------------- */

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Parse `Current Price=214.29, Market Cap=3.2T, PE Ratio=32.6` into a record.
 * Values may themselves contain commas ("3,204,000"), so a pair ends only
 * where the next `Key=` begins.
 */
export function parseKeyValueText(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const text = (raw ?? "").trim();
  if (!text) return out;

  // Keys may start with a digit ("52 Week High="), and the character class
  // excludes commas so a comma inside a value ("164,000") cannot be mistaken
  // for the start of the next key.
  const pair = /([A-Za-z0-9][A-Za-z0-9 ._%()/&'-]*?)\s*=\s*([\s\S]*?)(?=,\s*[A-Za-z0-9][A-Za-z0-9 ._%()/&'-]*?\s*=|$)/g;
  let match: RegExpExecArray | null;
  while ((match = pair.exec(text)) !== null) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/,+$/, "").trim();
    if (key) out[key] = value;
  }
  return out;
}

function flattenJson(
  value: unknown,
  prefix: string,
  out: Record<string, string>,
): Record<string, string> {
  if (value === null || value === undefined) return out;
  if (Array.isArray(value)) {
    out[prefix || "value"] = JSON.stringify(value).slice(0, 400);
    return out;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const path = prefix ? `${prefix} ${key}` : key;
      if (child !== null && typeof child === "object" && !Array.isArray(child)) {
        flattenJson(child, path, out);
      } else if (Array.isArray(child)) {
        out[path] = JSON.stringify(child).slice(0, 400);
      } else {
        out[path] = child === null || child === undefined ? "" : String(child);
      }
    }
    return out;
  }
  out[prefix || "value"] = String(value);
  return out;
}

/** Tolerant of the documented text shape and of a JSON body, if one appears. */
export function parseStockPayload(raw: string): Record<string, string> {
  const text = (raw ?? "").trim();
  if (!text) return {};

  if (text.startsWith("{") || text.startsWith("[") || text.startsWith('"')) {
    try {
      const json: unknown = JSON.parse(text);
      if (typeof json === "string") return parseKeyValueText(json);
      const flat = flattenJson(json, "", {});
      if (Object.keys(flat).length > 0) return flat;
    } catch {
      /* not JSON after all — fall through to the documented text parser */
    }
  }
  return parseKeyValueText(text);
}

const lookupCache = new WeakMap<object, Map<string, string>>();

function indexed(map: Record<string, string>): Map<string, string> {
  let cached = lookupCache.get(map);
  if (!cached) {
    cached = new Map<string, string>();
    for (const [key, value] of Object.entries(map)) cached.set(normalizeKey(key), value);
    lookupCache.set(map, cached);
  }
  return cached;
}

function isUsable(value: string | undefined): value is string {
  if (value === undefined) return false;
  const v = value.trim().toLowerCase();
  return v !== "" && v !== "none" && v !== "null" && v !== "n/a" && v !== "undefined";
}

/** Look a value up by any of several field spellings, exact match first. */
export function pick(map: Record<string, string>, ...aliases: string[]): string | null {
  const index = indexed(map);
  for (const alias of aliases) {
    const hit = index.get(normalizeKey(alias));
    if (isUsable(hit)) return hit.trim();
  }
  // Loose matching only for long, distinctive aliases — short ones like
  // "High" or "Open" would happily match "52 Week High" / "Open Interest".
  for (const alias of aliases) {
    const needle = normalizeKey(alias);
    if (needle.length < 6) continue;
    for (const [key, value] of index) {
      if (key.includes(needle) && isUsable(value)) return value.trim();
    }
  }
  return null;
}

/** "3.2T" / "1,204.55" / "-1.8%" -> number. */
export function parseNumeric(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[,$₹€£\s]/g, "").replace(/%$/, "");
  const scaled = cleaned.match(/^(-?\d*\.?\d+)([TBMKtbmk])$/);
  if (scaled) {
    const base = Number(scaled[1]);
    if (!Number.isFinite(base)) return null;
    const factor: Record<string, number> = { T: 1e12, B: 1e9, M: 1e6, K: 1e3 };
    return base * (factor[scaled[2].toUpperCase()] ?? 1);
  }
  const direct = Number(cleaned);
  return Number.isFinite(direct) && cleaned !== "" ? direct : null;
}

export type StockDataType = "stockquote" | "detailquote";

export interface StockDataParams {
  ticker: string;
  type: StockDataType;
  /** "India" enables the .NS / .BO exchange fallback. */
  country?: string | null;
}

/** Map the host's `selectedTickerCountry` onto the API's `country` field. */
export function countryForApi(tickerCountry: string | null): string | null {
  if (!tickerCountry) return null;
  const value = tickerCountry.trim().toUpperCase();
  return value === "IN" || value === "IND" || value === "INDIA" ? "India" : null;
}

export async function fetchStockData(
  params: StockDataParams,
  token: string,
  signal?: AbortSignal,
): Promise<Record<string, string>> {
  const body: Record<string, string> = {
    ticker_symbol: params.ticker,
    type: params.type,
  };
  if (params.country) body.country = params.country;

  const res = await fetch(`${FASTAPI_BASE}/stock-data`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) throw new ApiError(httpMessage(res.status), res.status);

  const parsed = parseStockPayload(await res.text());
  if (Object.keys(parsed).length === 0) {
    throw new ApiError("The data service returned no fields for this ticker.");
  }
  return parsed;
}

/* -------------------------------------------------------------------------- */
/* llm_chat — NDJSON stream of {"text": "..."} lines                          */
/* -------------------------------------------------------------------------- */

export type LlmType = "local_llm" | "hosted_llm";

export interface LlmChatParams {
  query: string;
  llmType: LlmType;
  temperature?: number;
  maxTokens?: number;
}

/** One NDJSON line -> a text delta. Throws on a `{"error": "..."}` line. */
function parseNdjsonLine(line: string): string | null {
  let trimmed = line.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) trimmed = trimmed.slice(5).trim();
  if (!trimmed || trimmed === "[DONE]") return null;

  if (!trimmed.startsWith("{") && !trimmed.startsWith("[") && !trimmed.startsWith('"')) {
    return trimmed; // plain text chunk
  }

  let payload: unknown;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    return null; // partial/garbled JSON line — skip it rather than leaking braces
  }

  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (typeof obj.error === "string" && obj.error) throw new ApiError(obj.error);
    for (const key of ["text", "delta", "content", "response", "message", "output"]) {
      const value = obj[key];
      if (typeof value === "string" && value) return value;
    }
  }
  return null;
}

/** Non-streaming body (single JSON object, or a whole NDJSON blob). */
function extractWholeBody(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const payload: unknown = JSON.parse(trimmed);
    if (typeof payload === "string") return [payload];
    if (payload && typeof payload === "object") {
      const obj = payload as Record<string, unknown>;
      if (typeof obj.error === "string" && obj.error) throw new ApiError(obj.error);
      for (const key of ["text", "response", "content", "message", "output"]) {
        const value = obj[key];
        if (typeof value === "string") return [value];
      }
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    /* not a single JSON object — treat as NDJSON below */
  }
  const pieces: string[] = [];
  for (const line of trimmed.split("\n")) {
    const piece = parseNdjsonLine(line);
    if (piece) pieces.push(piece);
  }
  return pieces;
}

/**
 * Send a prompt to the LLM and push text deltas to `onDelta` as they arrive.
 * Falls back to a single-shot read if the endpoint answers with plain JSON.
 */
export async function streamLlmChat(
  params: LlmChatParams,
  token: string,
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const body: Record<string, unknown> = {
    query: params.query,
    llm_type: params.llmType,
    stream: true,
  };
  if (params.temperature !== undefined) body.temperature = params.temperature;
  if (params.maxTokens !== undefined) body.max_tokens = params.maxTokens;

  const res = await fetch(`${FASTAPI_BASE}/query-router`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/x-ndjson, application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) throw new ApiError(httpMessage(res.status), res.status);

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  const isNdjson = contentType.includes("ndjson") || contentType.includes("text/event-stream");

  if (!res.body || (!isNdjson && contentType.includes("application/json"))) {
    for (const piece of extractWholeBody(await res.text())) onDelta(piece);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let emitted = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        const piece = parseNdjsonLine(line);
        if (piece) {
          emitted = true;
          onDelta(piece);
        }
        newline = buffer.indexOf("\n");
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  buffer += decoder.decode();
  const tail = parseNdjsonLine(buffer);
  if (tail) {
    emitted = true;
    onDelta(tail);
  }

  if (!emitted) throw new ApiError("The model returned an empty response.");
}
