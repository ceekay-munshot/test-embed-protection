// src/components/ChatPanel.tsx — presentational chat surface for the llm_chat
// datasource. All state lives in Dashboard so the host snapshot can read it.
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import type { LlmType } from "../lib/api";
import type { ChatMessage } from "../lib/types";
import { formatClock, truncate } from "../lib/format";
import { IconSend, IconSparkles, IconStop } from "./icons";
import { EmptyState, ErrorState, WaitingForSession } from "./states";

const MODEL_LABEL: Record<LlmType, string> = {
  hosted_llm: "Hosted",
  local_llm: "Local",
};

/** Minimal, injection-free inline formatter: **bold** and `code`. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let cursor = 0;
  let index = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    if (match[1] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-b${index}`} style={{ fontWeight: 600, color: "#111827" }}>
          {match[1]}
        </strong>,
      );
    } else {
      nodes.push(
        <code
          key={`${keyPrefix}-c${index}`}
          style={{
            padding: "1px 5px",
            fontSize: 12,
            borderRadius: 5,
            background: "#f3f4f6",
            color: "#4338ca",
          }}
        >
          {match[2]}
        </code>,
      );
    }
    cursor = pattern.lastIndex;
    index += 1;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function MessageBody({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, lineIndex) => {
        if (line.trim() === "") return <div key={lineIndex} style={{ height: 6 }} />;

        const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
        if (heading) {
          return (
            <div
              key={lineIndex}
              style={{ fontWeight: 600, color: "#111827", margin: "6px 0 2px" }}
            >
              {renderInline(heading[1], `h${lineIndex}`)}
            </div>
          );
        }

        const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
        if (bullet) {
          return (
            <div key={lineIndex} style={{ display: "flex", gap: 8, padding: "1px 0" }}>
              <span style={{ color: "#4f46e5", lineHeight: 1.55 }}>•</span>
              <span style={{ flex: 1 }}>{renderInline(bullet[1], `u${lineIndex}`)}</span>
            </div>
          );
        }

        return <div key={lineIndex}>{renderInline(line, `p${lineIndex}`)}</div>;
      })}
    </>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        gap: 3,
      }}
    >
      <div
        style={{
          maxWidth: "88%",
          padding: "9px 12px",
          fontSize: 13,
          lineHeight: 1.55,
          color: isUser ? "#4338ca" : "#374151",
          background: isUser ? "#eef2ff" : "#ffffff",
          border: `1px solid ${isUser ? "#e0e7ff" : "rgba(229,231,235,0.8)"}`,
          borderRadius: 12,
          borderTopRightRadius: isUser ? 4 : 12,
          borderTopLeftRadius: isUser ? 12 : 4,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        <MessageBody text={message.text} />
        {message.streaming && (
          <span
            className="stream-caret"
            style={{
              display: "inline-block",
              width: 7,
              height: 14,
              marginLeft: 2,
              verticalAlign: "-2px",
              background: "#4f46e5",
              borderRadius: 1,
            }}
          />
        )}
        {message.error && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#ef4444" }}>{message.error}</div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, fontSize: 10.5, color: "#9ca3af" }}>
        <span>{formatClock(message.at)}</span>
        {!isUser && message.model && <span>{MODEL_LABEL[message.model]} LLM</span>}
        {!isUser && message.groundedAt && (
          <span title="The prompt carried the live quote below">
            grounded @ {formatClock(message.groundedAt)}
            {message.groundedPrice ? ` · ${message.groundedPrice}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

interface ChatPanelProps {
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  error: string | null;
  onDismissError: () => void;
  hasSession: boolean;
  ticker: string | null;
  suggestions: string[];
  onSuggestion: (prompt: string) => void;
  llmType: LlmType;
}

export function ChatPanel({
  messages,
  input,
  onInputChange,
  onSend,
  onStop,
  busy,
  error,
  onDismissError,
  hasSession,
  ticker,
  suggestions,
  onSuggestion,
  llmType,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const pinnedRef = useRef(true);

  // Follow the stream only while the reader is already at the bottom.
  const handleScroll = () => {
    const node = scrollRef.current;
    if (!node) return;
    pinnedRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
  };

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (node && pinnedRef.current) node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 120)}px`;
  }, [input]);

  if (!hasSession) {
    return (
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
        <WaitingForSession />
      </div>
    );
  }

  const canSend = input.trim().length > 0 && !busy;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="scroll-area"
        style={{ flex: 1, minHeight: 0, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}
      >
        {messages.length === 0 && !error && (
          <EmptyState
            icon={<IconSparkles size={20} color="#4f46e5" />}
            message={ticker ? `Ask anything about ${ticker}` : "Ask the analyst anything"}
            hint={
              ticker
                ? "Every question is sent with the live quote above, so answers reference the current price."
                : "Select a stock in the host to ground answers in live market data."
            }
          />
        )}

        {error && messages.length === 0 && (
          <ErrorState message={error} onRetry={onDismissError} />
        )}

        {messages.map((message) => (
          <Bubble key={message.id} message={message} />
        ))}
      </div>

      {error && messages.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "7px 16px",
            fontSize: 12,
            color: "#ef4444",
            background: "#fef2f2",
            borderTop: "1px solid rgba(229,231,235,0.8)",
          }}
          role="alert"
        >
          <span>{truncate(error, 140)}</span>
          <button type="button" className="ghost-button" onClick={onDismissError}>
            Dismiss
          </button>
        </div>
      )}

      {messages.length === 0 && suggestions.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            padding: "0 16px 12px",
          }}
        >
          {suggestions.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="chip"
              disabled={busy}
              onClick={() => onSuggestion(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          padding: 12,
          borderTop: "1px solid rgba(229,231,235,0.8)",
          background: "rgba(255,255,255,0.95)",
        }}
      >
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          rows={1}
          placeholder={ticker ? `Ask about ${ticker}…` : "Ask the analyst…"}
          aria-label="Message the AI analyst"
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (canSend) onSend();
            }
          }}
        />
        {busy ? (
          <button type="button" className="ghost-button" onClick={onStop} style={{ padding: "9px 12px" }}>
            <IconStop size={14} />
            Stop
          </button>
        ) : (
          <button type="button" className="send-button" disabled={!canSend} onClick={onSend}>
            <IconSend size={14} />
            Send
          </button>
        )}
      </div>

      <div
        style={{
          padding: "6px 14px 8px",
          fontSize: 10.5,
          color: "#9ca3af",
          borderTop: "1px solid rgba(229,231,235,0.8)",
        }}
      >
        AI-generated · {MODEL_LABEL[llmType]} LLM via <code style={{ fontSize: 10.5 }}>llm_chat</code> ·
        Enter to send, Shift+Enter for a new line. Verify before acting on it.
      </div>
    </div>
  );
}
