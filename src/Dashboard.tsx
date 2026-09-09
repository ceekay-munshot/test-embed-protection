// src/Dashboard.tsx — the dashboard IS the first screen. No landing page.
//
// Zone 1  sticky 48px header (title, ticker pill, freshness, refresh)
// Zone 2  scrollable content: live quote -> KPIs -> AI analyst -> profile -> sources
// Zone 3  sticky footer with datasource attribution
//
// Datasources (reference/datasource-registry.md): stock_data, llm_chat. Both are
// called with the host-issued bearer token from context.session.token.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";

import { sdk, DASHBOARD_ID, DASHBOARD_NAME } from "./lib/sdk";
import { useHostContext } from "./hooks/useHostContext";
import {
  DATASOURCES,
  QUOTE_POLL_MS,
  countryForApi,
  fetchStockData,
  parseNumeric,
  pick,
  streamLlmChat,
  toMessage,
  type LlmType,
} from "./lib/api";
import {
  formatAgo,
  formatClock,
  formatCompact,
  formatPercent,
  formatPrice,
  formatSigned,
  moveColor,
  truncate,
} from "./lib/format";
import type { ChatMessage, PriceSample } from "./lib/types";

import { WidgetCard } from "./components/WidgetCard";
import { KpiCard } from "./components/KpiCard";
import { ChatPanel } from "./components/ChatPanel";
import { SourceTrail, type SourceEntry } from "./components/SourceTrail";
import { Sparkline } from "./components/Sparkline";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  NoTickerState,
  PartialNotice,
  WaitingForSession,
} from "./components/states";
import {
  IconBuilding,
  IconChart,
  IconClock,
  IconDatabase,
  IconRefresh,
  IconSparkles,
} from "./components/icons";

/** Keep ~10 minutes of 5s samples in the live trace. */
const MAX_SAMPLES = 120;

/** Headroom under the SDK's 512 KB structured-clone cap. */
const MAX_VISUAL_BYTES = 480 * 1024;

const SUGGESTED_PROMPTS = [
  "Summarise today's move",
  "Key risks to watch",
  "Is the valuation stretched?",
  "What would change the thesis?",
];

type QuoteMap = Record<string, string>;

interface QuoteView {
  price: number | null;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  previousClose: number | null;
  dayLow: number | null;
  dayHigh: number | null;
  weekLow: number | null;
  weekHigh: number | null;
  marketCap: string | null;
  peRatio: string | null;
  volume: string | null;
  currency: string | null;
  exchange: string | null;
}

function readQuote(map: QuoteMap | null): QuoteView {
  const empty: QuoteView = {
    price: null, change: null, changePercent: null, open: null, previousClose: null,
    dayLow: null, dayHigh: null, weekLow: null, weekHigh: null,
    marketCap: null, peRatio: null, volume: null, currency: null, exchange: null,
  };
  if (!map) return empty;

  const price = parseNumeric(
    pick(map, "Current Price", "Price", "Regular Market Price", "Last Price", "Close"),
  );
  const previousClose = parseNumeric(pick(map, "Previous Close", "Prev Close"));
  let change = parseNumeric(pick(map, "Change", "Price Change", "Day Change", "Net Change"));
  let changePercent = parseNumeric(
    pick(map, "Change Percent", "Percent Change", "Change %", "Percentage Change", "Day Change Percent"),
  );

  if (change === null && price !== null && previousClose !== null) change = price - previousClose;
  if (changePercent === null && change !== null) {
    const base = previousClose ?? (price !== null ? price - change : null);
    if (base !== null && base !== 0) changePercent = (change / base) * 100;
  }

  return {
    price,
    change,
    changePercent,
    open: parseNumeric(pick(map, "Open", "Opening Price", "Regular Market Open")),
    previousClose,
    dayLow: parseNumeric(pick(map, "Day Low", "Low", "Regular Market Day Low")),
    dayHigh: parseNumeric(pick(map, "Day High", "High", "Regular Market Day High")),
    weekLow: parseNumeric(pick(map, "52 Week Low", "Fifty Two Week Low", "Year Low")),
    weekHigh: parseNumeric(pick(map, "52 Week High", "Fifty Two Week High", "Year High")),
    marketCap: pick(map, "Market Cap", "MarketCap", "Market Capitalization"),
    peRatio: pick(map, "PE Ratio", "P/E Ratio", "Trailing PE", "PE"),
    volume: pick(map, "Volume", "Regular Market Volume", "Total Volume"),
    currency: pick(map, "Currency", "Financial Currency"),
    exchange: pick(map, "Exchange", "Exchange Name", "Full Exchange Name"),
  };
}

interface ProfileView {
  name: string | null;
  sector: string | null;
  industry: string | null;
  employees: string | null;
  website: string | null;
  country: string | null;
  summary: string | null;
}

function readProfile(map: QuoteMap | null): ProfileView {
  if (!map) {
    return { name: null, sector: null, industry: null, employees: null, website: null, country: null, summary: null };
  }
  return {
    name: pick(map, "Company Name", "Name", "Long Name", "Short Name"),
    sector: pick(map, "Sector"),
    industry: pick(map, "Industry"),
    employees: pick(map, "Full Time Employees", "Employees", "Number of Employees"),
    website: pick(map, "Website", "Web Site"),
    country: pick(map, "Country"),
    summary: pick(map, "Long Business Summary", "Description", "Business Summary", "About"),
  };
}

const PRICE_KEYS = ["Current Price", "Price", "Regular Market Price", "Last Price", "Close"];

let messageSeq = 0;
function nextId(prefix: string): string {
  messageSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${messageSeq}`;
}

function formatRange(low: number | null, high: number | null): string | null {
  if (low === null && high === null) return null;
  return `${formatPrice(low)} – ${formatPrice(high)}`;
}

export function Dashboard() {
  const { session, ticker, tickerCompany, tickerCountry, selectedSymbol } = useHostContext();
  const token = session.token;
  const country = useMemo(() => countryForApi(tickerCountry), [tickerCountry]);

  const [quote, setQuote] = useState<QuoteMap | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteUpdatedAt, setQuoteUpdatedAt] = useState<number | null>(null);
  const [history, setHistory] = useState<PriceSample[]>([]);

  const [profile, setProfile] = useState<QuoteMap | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [llmType, setLlmType] = useState<LlmType>("hosted_llm");
  const [lastAnswerAt, setLastAnswerAt] = useState<number | null>(null);

  const [refreshNonce, setRefreshNonce] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const chatAbortRef = useRef<AbortController | null>(null);
  const quoteErrorReported = useRef(false);
  const snapshotRef = useRef<() => unknown>(() => ({}));

  const view = useMemo(() => readQuote(quote), [quote]);
  const company = useMemo(() => readProfile(profile), [profile]);

  /* ---------------------------------------------------------------- clock */

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  /* ------------------------------------------------- reset on ticker swap */

  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    setQuoteUpdatedAt(null);
    setHistory([]);
    setProfile(null);
    setProfileError(null);
    quoteErrorReported.current = false;
  }, [ticker]);

  /* ------------------------------------------- stock_data: live quote poll */

  useEffect(() => {
    if (!token || !ticker) return;

    let disposed = false;
    let inFlight: AbortController | null = null;

    const run = async () => {
      if (disposed) return;
      inFlight?.abort();
      const controller = new AbortController();
      inFlight = controller;
      try {
        const data = await fetchStockData(
          { ticker, type: "stockquote", country },
          token,
          controller.signal,
        );
        if (disposed) return;
        setQuote(data);
        setQuoteError(null);
        setQuoteUpdatedAt(Date.now());
        quoteErrorReported.current = false;

        const price = parseNumeric(pick(data, ...PRICE_KEYS));
        if (price !== null) {
          setHistory((prev) => [...prev, { t: Date.now(), price }].slice(-MAX_SAMPLES));
        }
      } catch (err) {
        if (disposed || (err instanceof DOMException && err.name === "AbortError")) return;
        setQuoteError(toMessage(err));
        if (!quoteErrorReported.current) {
          quoteErrorReported.current = true;
          sdk.sendError("Live quote refresh failed", "QUOTE_FETCH_FAILED", { ticker });
        }
      }
    };

    void run();
    const id = window.setInterval(() => void run(), QUOTE_POLL_MS);

    return () => {
      disposed = true;
      window.clearInterval(id);
      inFlight?.abort();
    };
  }, [ticker, token, country, refreshNonce]);

  /* --------------------------------------- stock_data: company profile x1 */

  useEffect(() => {
    if (!token || !ticker) return;
    const controller = new AbortController();
    let disposed = false;

    fetchStockData({ ticker, type: "detailquote", country }, token, controller.signal)
      .then((data) => {
        if (disposed) return;
        setProfile(data);
        setProfileError(null);
      })
      .catch((err: unknown) => {
        if (disposed || (err instanceof DOMException && err.name === "AbortError")) return;
        setProfileError(toMessage(err));
      });

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [ticker, token, country, refreshNonce]);

  /* ------------------------------------------------------ llm_chat: send */

  const buildPrompt = useCallback(
    (question: string) => {
      const facts: string[] = [];
      if (ticker) {
        const label = [tickerCompany, tickerCountry].filter(Boolean).join(", ");
        facts.push(`Ticker: ${ticker}${label ? ` (${label})` : ""}`);
      }
      if (view.price !== null) {
        facts.push(`Last price: ${formatPrice(view.price)}${view.currency ? ` ${view.currency}` : ""}`);
      }
      if (view.change !== null || view.changePercent !== null) {
        facts.push(`Change today: ${formatSigned(view.change)} (${formatPercent(view.changePercent)})`);
      }
      const dayRange = formatRange(view.dayLow, view.dayHigh);
      if (dayRange) facts.push(`Day range: ${dayRange}`);
      const yearRange = formatRange(view.weekLow, view.weekHigh);
      if (yearRange) facts.push(`52-week range: ${yearRange}`);
      if (view.marketCap) facts.push(`Market cap: ${view.marketCap}`);
      if (view.peRatio) facts.push(`P/E ratio: ${view.peRatio}`);
      if (view.volume) facts.push(`Volume: ${view.volume}`);
      if (company.sector) facts.push(`Sector: ${company.sector}`);
      if (company.industry) facts.push(`Industry: ${company.industry}`);

      if (facts.length === 0) return question;

      return [
        "You are an equity analyst answering inside the Munshot dashboard.",
        `Live quote context, fetched from the Munshot stock_data API at ${formatClock(quoteUpdatedAt ?? Date.now())}:`,
        facts.map((fact) => `- ${fact}`).join("\n"),
        "Answer the question using this data where it is relevant. Be concise (about 150 words),",
        "use bullet points for lists, and say explicitly when something is outside the data above.",
        "",
        `Question: ${question}`,
      ].join("\n");
    },
    [ticker, tickerCompany, tickerCountry, view, company, quoteUpdatedAt],
  );

  const sendMessage = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || !token || chatBusy) return;

      const askedAt = Date.now();
      const groundedAt = view.price !== null ? quoteUpdatedAt : null;
      const groundedPrice = view.price !== null ? formatPrice(view.price) : null;
      const assistantId = nextId("a");
      const model = llmType;

      setChatError(null);
      setInput("");
      setMessages((prev) => [
        ...prev,
        { id: nextId("u"), role: "user", text: question, at: askedAt },
        {
          id: assistantId,
          role: "assistant",
          text: "",
          at: askedAt,
          model,
          groundedAt,
          groundedPrice,
          streaming: true,
        },
      ]);
      setChatBusy(true);

      const controller = new AbortController();
      chatAbortRef.current = controller;
      sdk.publish("dashboard.metric", {
        widget: "ai-analyst",
        action: "chat-send",
        value: model,
        ticker,
      });

      try {
        await streamLlmChat(
          { query: buildPrompt(question), llmType: model },
          token,
          (delta) => {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId ? { ...message, text: message.text + delta } : message,
              ),
            );
          },
          controller.signal,
        );
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  streaming: false,
                  text: message.text.trim() || "The model returned an empty answer.",
                }
              : message,
          ),
        );
        setLastAnswerAt(Date.now());
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === "AbortError";
        const message = aborted ? null : toMessage(err);
        setMessages((prev) =>
          prev.map((entry) =>
            entry.id === assistantId
              ? {
                  ...entry,
                  streaming: false,
                  error: message,
                  text: entry.text.trim() || (aborted ? "Stopped." : ""),
                }
              : entry,
          ),
        );
        if (message) {
          setChatError(message);
          sdk.sendError("AI analyst request failed", "LLM_CHAT_FAILED", { ticker, llmType: model });
        }
      } finally {
        chatAbortRef.current = null;
        setChatBusy(false);
      }
    },
    [token, chatBusy, llmType, ticker, view.price, quoteUpdatedAt, buildPrompt],
  );

  const stopStreaming = useCallback(() => {
    chatAbortRef.current?.abort();
  }, []);

  useEffect(() => () => chatAbortRef.current?.abort(), []);

  /* ------------------------------------------------------ host snapshot */

  const lastQuestion = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "user") return messages[index].text;
    }
    return null;
  }, [messages]);

  snapshotRef.current = () => ({
    context: {
      dashboardId: DASHBOARD_ID,
      dashboardName: DASHBOARD_NAME,
      ticker,
      company: tickerCompany,
      country: tickerCountry,
      symbol: selectedSymbol,
      filters: [],
      model: llmType,
      pollIntervalMs: QUOTE_POLL_MS,
      quoteUpdatedAt: quoteUpdatedAt ? new Date(quoteUpdatedAt).toISOString() : null,
      states: {
        quote: quoteError ? (quote ? "stale" : "error") : quote ? "live" : ticker ? "loading" : "no-ticker",
        profile: profileError ? "error" : profile ? "loaded" : ticker ? "loading" : "no-ticker",
        chat: chatBusy ? "streaming" : "idle",
        session: token ? "ready" : "waiting",
      },
    },
    selection: {
      model: llmType,
      lastQuestion: lastQuestion ? truncate(lastQuestion, 300) : null,
      messageCount: messages.length,
    },
    data: {
      quote: {
        price: view.price,
        change: view.change,
        changePercent: view.changePercent,
        open: view.open,
        previousClose: view.previousClose,
        dayLow: view.dayLow,
        dayHigh: view.dayHigh,
        weekLow: view.weekLow,
        weekHigh: view.weekHigh,
        marketCap: view.marketCap,
        peRatio: view.peRatio,
        volume: view.volume,
        currency: view.currency,
        exchange: view.exchange,
      },
      priceHistory: history.slice(-60).map((sample) => ({
        at: new Date(sample.t).toISOString(),
        price: sample.price,
      })),
      profile: {
        name: company.name,
        sector: company.sector,
        industry: company.industry,
        employees: company.employees,
        country: company.country,
        website: company.website,
      },
      conversation: messages.slice(-8).map((message) => ({
        role: message.role,
        text: truncate(message.text, 400),
        at: new Date(message.at).toISOString(),
        model: message.model ?? null,
      })),
      sources: [
        { id: DATASOURCES.stock_data.id, endpoint: DATASOURCES.stock_data.endpoint },
        { id: DATASOURCES.llm_chat.id, endpoint: DATASOURCES.llm_chat.endpoint },
      ],
    },
  });

  useEffect(() => {
    // 1) Visual snapshot — return a PNG Blob of Zone 2.
    const offVisual = sdk.onRequest("dashboard.capture.visual", async () => {
      try {
        const el =
          document.querySelector("#dashboard-main") ||
          document.querySelector("[data-dashboard-capture-root='true']") ||
          document.querySelector("main");
        if (!el) throw new Error("capture root not found");
        // The SDK drops any response over 512 KB silently, so step the
        // resolution down until the PNG fits rather than time the host out.
        let blob = await toBlob(el as HTMLElement, { pixelRatio: 2 });
        for (const pixelRatio of [1.5, 1]) {
          if (blob && blob.size <= MAX_VISUAL_BYTES) break;
          blob = await toBlob(el as HTMLElement, { pixelRatio });
        }
        if (!blob) throw new Error("empty snapshot blob");
        if (blob.size > MAX_VISUAL_BYTES) {
          return { ok: false, error: "snapshot exceeds the 512 KB channel limit" };
        }
        return { visualSnapshot: blob, capturedAt: new Date().toISOString() };
      } catch (err) {
        // Never throw out of the handler; return a structured, cloneable error.
        return { ok: false, error: (err as Error).message };
      }
    });

    // 2) State snapshot — return the current JSON state of the dashboard.
    const offSnapshot = sdk.onRequest("dashboard.capture.snapshot", () => {
      try {
        return snapshotRef.current();
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    });

    // DO NOT call sdk.ready() here. The SDK auto-sends dashboard:ready on
    // host:init. Calling it manually races the handshake and breaks it.

    return () => {
      offVisual();
      offSnapshot();
    };
  }, []);

  /* ------------------------------------------------------------- derived */

  const direction = view.change ?? view.changePercent;
  const trendColor = moveColor(direction);
  const prices = useMemo(() => history.map((sample) => sample.price), [history]);
  const volumeNumeric = view.volume ? parseNumeric(view.volume) : null;
  const volumeDisplay = volumeNumeric !== null ? formatCompact(volumeNumeric) : view.volume;
  const hasQuote = quote !== null;
  const quoteStale = Boolean(quoteError && hasQuote);
  const ready = Boolean(token && ticker);
  const quoteLoading = ready && !hasQuote && !quoteError;
  const profileLoading = ready && profile === null && !profileError;

  const partialMessages: string[] = [];
  if (quoteStale) partialMessages.push(`live quote (showing the ${formatAgo(quoteUpdatedAt, now)} snapshot)`);
  if (profileError && hasQuote) partialMessages.push("company profile");

  const sources: SourceEntry[] = [
    {
      title: "Stock Data · stock_data",
      detail: !ticker
        ? "Waiting for a ticker selection in the host."
        : quoteError && !hasQuote
          ? `${DATASOURCES.stock_data.endpoint} · failed: ${truncate(quoteError, 90)}`
          : `${DATASOURCES.stock_data.endpoint} · quote ${formatAgo(quoteUpdatedAt, now)}, polling every ${QUOTE_POLL_MS / 1000}s (limit ${DATASOURCES.stock_data.rpm} rpm).`,
      status: !ticker ? "idle" : quoteError ? "error" : hasQuote ? "live" : "idle",
      icon: <IconDatabase size={13} color="#6b7280" />,
    },
    {
      title: "Company profile · stock_data",
      detail: !ticker
        ? "Waiting for a ticker selection in the host."
        : profileError
          ? `detailquote · failed: ${truncate(profileError, 90)}`
          : profile
            ? "detailquote · loaded once per ticker, not polled."
            : "detailquote · loading.",
      status: !ticker ? "idle" : profileError ? "error" : profile ? "ok" : "idle",
      icon: <IconBuilding size={13} color="#6b7280" />,
    },
    {
      title: "AI answers · llm_chat",
      detail: chatError
        ? `${DATASOURCES.llm_chat.endpoint} · failed: ${truncate(chatError, 90)}`
        : messages.length === 0
          ? `${DATASOURCES.llm_chat.endpoint} · no questions asked yet (limit ${DATASOURCES.llm_chat.rpm} rpm).`
          : `${DATASOURCES.llm_chat.endpoint} · ${messages.filter((m) => m.role === "assistant").length} AI answer(s)${lastAnswerAt ? `, last ${formatAgo(lastAnswerAt, now)}` : ""}. Prompts carry the live quote.`,
      status: chatError ? "error" : chatBusy ? "live" : messages.length > 0 ? "ok" : "idle",
      icon: <IconSparkles size={13} color="#6b7280" />,
    },
    {
      title: "Session · Munshot host",
      detail: token
        ? `Bearer token supplied by the host${session.orgName ? ` for ${session.orgName}` : ""}. Every API call is authenticated.`
        : "Waiting for the host to hand over the session token.",
      status: token ? "ok" : "idle",
      icon: <IconClock size={13} color="#6b7280" />,
    },
  ];

  /* -------------------------------------------------------------- render */

  const quoteBody = () => {
    if (!token) return <WaitingForSession />;
    if (!ticker) return <NoTickerState what="the live quote" />;
    if (quoteLoading) return <LoadingState lead rows={2} />;
    if (!hasQuote) {
      return (
        <ErrorState
          message={quoteError ?? "No quote available."}
          onRetry={() => setRefreshNonce((value) => value + 1)}
        />
      );
    }

    return (
      <div style={{ padding: 16 }}>
        {quoteStale && (
          <PartialNotice
            message={`Live refresh is failing (${truncate(quoteError ?? "", 70)}). Showing the last good quote from ${formatClock(quoteUpdatedAt)}.`}
          />
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#111827",
              lineHeight: 1,
            }}
          >
            {formatPrice(view.price)}
          </span>
          {view.currency && (
            <span style={{ fontSize: 13, color: "#6b7280", paddingBottom: 3 }}>{view.currency}</span>
          )}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 9px",
              fontSize: 13,
              fontWeight: 600,
              color: trendColor,
              background: `${trendColor}14`,
              border: `1px solid ${trendColor}33`,
              borderRadius: 999,
            }}
          >
            {formatSigned(view.change)} ({formatPercent(view.changePercent)})
          </span>
        </div>

        <div style={{ marginTop: 14 }}>
          {prices.length > 1 ? (
            <Sparkline values={prices} color={trendColor} height={88} />
          ) : (
            <div
              style={{
                height: 88,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                color: "#9ca3af",
                border: "1px dashed rgba(229,231,235,0.9)",
                borderRadius: 10,
              }}
            >
              Building the live trace — next sample in {QUOTE_POLL_MS / 1000}s
            </div>
          )}
          <p style={{ margin: "6px 0 0", fontSize: 10.5, color: "#9ca3af" }}>
            {prices.length} sample{prices.length === 1 ? "" : "s"} captured this session ·
            {" "}{QUOTE_POLL_MS / 1000}s interval · not historical data
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid rgba(229,231,235,0.8)",
          }}
        >
          {[
            { label: "Open", value: formatPrice(view.open) },
            { label: "Prev close", value: formatPrice(view.previousClose) },
            { label: "Day range", value: formatRange(view.dayLow, view.dayHigh) ?? "—" },
            { label: "52-week range", value: formatRange(view.weekLow, view.weekHigh) ?? "—" },
          ].map((item) => (
            <div key={item.label}>
              <div style={{ fontSize: 10.5, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {item.label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginTop: 2 }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const profileBody = () => {
    if (!token) return <WaitingForSession />;
    if (!ticker) return <NoTickerState what="the company profile" />;
    if (profileLoading) return <LoadingState rows={4} />;
    if (profileError && !profile) {
      return (
        <ErrorState
          message={profileError}
          hint="The live quote above is unaffected."
          onRetry={() => setRefreshNonce((value) => value + 1)}
        />
      );
    }
    if (!profile) return <EmptyState message="No company details" hint="This ticker has no profile record." />;

    const rows = [
      { label: "Company", value: company.name ?? tickerCompany },
      { label: "Sector", value: company.sector },
      { label: "Industry", value: company.industry },
      { label: "Country", value: company.country ?? tickerCountry },
      { label: "Exchange", value: view.exchange },
      { label: "Employees", value: company.employees },
    ].filter((row) => row.value);

    if (rows.length === 0 && !company.summary) {
      return <EmptyState message="No company details" hint="This ticker has no profile record." />;
    }

    return (
      <div className="scroll-area" style={{ padding: 14, maxHeight: 300 }}>
        <dl style={{ margin: 0, display: "grid", gap: 8 }}>
          {rows.map((row) => (
            <div key={row.label} style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
              <dt style={{ fontSize: 12, color: "#9ca3af", flexShrink: 0 }}>{row.label}</dt>
              <dd
                style={{
                  margin: 0,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#374151",
                  textAlign: "right",
                  wordBreak: "break-word",
                }}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        {company.summary && (
          <p style={{ margin: "12px 0 0", fontSize: 12, lineHeight: 1.5, color: "#6b7280" }}>
            {truncate(company.summary, 420)}
          </p>
        )}
      </div>
    );
  };

  const kpiLoading = quoteLoading;
  const kpiScope = !token ? "Waiting for session" : ticker ? `${ticker} · live` : "No ticker selected";
  const kpiValue = (value: string | null) => (ready ? value : null);

  return (
    <div className="dashboard-shell">
      {/* ------------------------------------------------ Zone 1: header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "0 24px",
          height: 48,
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid #e5e7eb",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, overflow: "hidden" }}>
          <h1
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#111827",
              margin: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            AI Analyst &amp; Live Quote
          </h1>
          {ticker && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "2px 10px",
                background: "#eef2ff",
                color: "#4338ca",
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 600,
                border: "1px solid #e0e7ff",
                maxWidth: 320,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                flexShrink: 0,
              }}
            >
              <span style={{ width: 6, height: 6, background: "#6366f1", borderRadius: "50%", flexShrink: 0 }} />
              {ticker}
              {tickerCompany && (
                <span style={{ color: "#818cf8", fontWeight: 400 }}>- {tickerCompany}</span>
              )}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11.5,
              color: "#9ca3af",
              whiteSpace: "nowrap",
            }}
          >
            {token && ticker && !quoteError && quoteUpdatedAt && (
              <span
                className="live-dot"
                style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a" }}
              />
            )}
            {!token
              ? "Waiting for session"
              : !ticker
                ? "No ticker selected"
                : quoteError && !hasQuote
                  ? "Quote unavailable"
                  : `Updated ${formatAgo(quoteUpdatedAt, now)}`}
          </span>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setRefreshNonce((value) => value + 1)}
            disabled={!token || !ticker}
            title="Refresh quote and profile now"
          >
            <IconRefresh size={13} />
            Refresh
          </button>
        </div>
      </header>

      {/* --------------------------------------- Zone 2: scrollable content */}
      <main
        id="dashboard-main"
        data-dashboard-capture-root="true"
        className="scroll-area"
        style={{ flex: 1, padding: "24px 32px" }}
      >
        {partialMessages.length > 0 && (
          <PartialNotice
            message={`Partial data: ${partialMessages.join(" and ")} could not be refreshed. Everything else is live.`}
          />
        )}

        <div
          style={{
            display: "grid",
            gap: 20,
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            alignItems: "start",
          }}
        >
          <WidgetCard
            title="Live price"
            subtitle={
              ticker
                ? `${ticker}${view.exchange ? ` · ${view.exchange}` : ""} · polled every ${QUOTE_POLL_MS / 1000}s`
                : "Select a stock in the host"
            }
            category="markets"
            wide
            actions={<IconChart size={14} color="#9ca3af" />}
          >
            {quoteBody()}
          </WidgetCard>

          <KpiCard
            label="Market cap"
            scope={kpiScope}
            value={kpiValue(view.marketCap)}
            detail={view.exchange ?? undefined}
            loading={kpiLoading}
          />
          <KpiCard
            label="P/E ratio"
            scope={kpiScope}
            value={kpiValue(view.peRatio)}
            detail={view.peRatio ? "Trailing, as reported by the feed" : undefined}
            loading={kpiLoading}
          />
          <KpiCard
            label="Volume"
            scope={kpiScope}
            value={kpiValue(volumeDisplay)}
            detail={
              view.volume && volumeDisplay !== view.volume
                ? `Reported: ${truncate(view.volume, 18)}`
                : "Shares traded today"
            }
            loading={kpiLoading}
          />
          <KpiCard
            label="Day move"
            scope={kpiScope}
            value={kpiValue(view.changePercent !== null ? formatPercent(view.changePercent) : null)}
            detail={view.change !== null ? `${formatSigned(view.change)} vs previous close` : undefined}
            detailColor={trendColor}
            loading={kpiLoading}
          />

          <WidgetCard
            title="AI analyst"
            subtitle="Grounded in the live quote above"
            category="analytics"
            wide
            stationary
            style={{ minHeight: 470 }}
            bodyStyle={{ display: "flex", flexDirection: "column", minHeight: 0 }}
            actions={
              <div className="segmented" role="group" aria-label="Model">
                {(["hosted_llm", "local_llm"] as LlmType[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={llmType === option}
                    disabled={chatBusy}
                    onClick={() => setLlmType(option)}
                  >
                    {option === "hosted_llm" ? "Hosted" : "Local"}
                  </button>
                ))}
              </div>
            }
          >
            <ChatPanel
              messages={messages}
              input={input}
              onInputChange={setInput}
              onSend={() => void sendMessage(input)}
              onStop={stopStreaming}
              busy={chatBusy}
              error={chatError}
              onDismissError={() => setChatError(null)}
              hasSession={Boolean(token)}
              ticker={ticker}
              suggestions={SUGGESTED_PROMPTS}
              onSuggestion={(prompt) => void sendMessage(prompt)}
              llmType={llmType}
            />
          </WidgetCard>

          <WidgetCard
            title="Company profile"
            subtitle="stock_data · detailquote"
            category="markets"
            actions={<IconBuilding size={14} color="#9ca3af" />}
          >
            {profileBody()}
          </WidgetCard>

          <WidgetCard
            title="Source trail"
            subtitle="Where every number and answer came from"
            category="tools"
            actions={<IconDatabase size={14} color="#9ca3af" />}
          >
            <SourceTrail entries={sources} />
          </WidgetCard>
        </div>
      </main>

      {/* ------------------------------------------------- Zone 3: footer */}
      <footer
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          height: 40,
          padding: "0 24px",
          flexShrink: 0,
          fontSize: 11,
          color: "#9ca3af",
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(8px)",
          borderTop: "1px solid #e5e7eb",
        }}
      >
        <span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          Sources: stock_data (quote &amp; profile) · llm_chat (AI answers) — both via fastapi.muns.io,
          authenticated with the Munshot host session.
        </span>
        <span style={{ whiteSpace: "nowrap" }}>
          {session.userName ? `${session.userName} · ` : ""}
          {token ? "session active" : "session pending"}
        </span>
      </footer>
    </div>
  );
}
