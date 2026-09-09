// src/components/states.tsx — the six widget states every card must be able to show:
// loading, refreshing, empty, no-ticker, waiting-for-session, partial, error.
import type { CSSProperties, ReactNode } from "react";
import { IconAlert, IconLock, IconSearch } from "./icons";

const centered: CSSProperties = {
  minHeight: 160,
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "24px 20px",
  textAlign: "center",
};

/** A single shimmering placeholder block. */
export function Shimmer({
  width = "100%",
  height = 12,
  radius = 6,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
}) {
  return <div className="shimmer" style={{ width, height, borderRadius: radius }} />;
}

/** Loading skeleton shaped like the widget it stands in for. */
export function LoadingState({ rows = 3, lead }: { rows?: number; lead?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        minHeight: 160,
        justifyContent: "center",
      }}
    >
      {lead && <Shimmer width="52%" height={28} radius={8} />}
      {Array.from({ length: rows }, (_, index) => (
        <Shimmer key={index} width={`${92 - index * 14}%`} height={12} />
      ))}
      <span
        style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}
        role="status"
        aria-live="polite"
      >
        Loading…
      </span>
    </div>
  );
}

function IconWell({ children, tone }: { children: ReactNode; tone: "primary" | "error" }) {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        background: tone === "error" ? "#fef2f2" : "#eef2ff",
      }}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  message,
  hint,
  icon,
}: {
  message: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div style={centered}>
      <IconWell tone="primary">{icon ?? <IconSearch size={20} color="#4f46e5" />}</IconWell>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#374151" }}>{message}</p>
      {hint && <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", maxWidth: 280 }}>{hint}</p>}
    </div>
  );
}

/** No ticker selected in the host — never call ticker-bound APIs in this state. */
export function NoTickerState({ what }: { what: string }) {
  return (
    <EmptyState
      message="No stock selected"
      hint={`Pick a stock in the Munshot portfolio panel to load ${what}.`}
    />
  );
}

/**
 * `session.token === null` is transient while the host boots. It is always an
 * in-widget notice, never a full-page error (auth-standards §7).
 */
export function WaitingForSession({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div
        style={{ padding: 16, textAlign: "center", color: "#9ca3af", fontSize: 13 }}
        role="status"
        aria-live="polite"
      >
        Waiting for session…
      </div>
    );
  }
  return (
    <div style={centered} role="status" aria-live="polite">
      <IconWell tone="primary">
        <IconLock size={20} color="#4f46e5" />
      </IconWell>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#374151" }}>
        Waiting for session…
      </p>
      <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", maxWidth: 280 }}>
        The Munshot host is still handing over your secure session.
      </p>
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <Shimmer width={64} height={8} />
        <Shimmer width={40} height={8} />
      </div>
    </div>
  );
}

export function ErrorState({
  message,
  hint = "Please try again in a moment.",
  onRetry,
}: {
  message: string;
  hint?: string;
  onRetry?: () => void;
}) {
  return (
    <div style={centered} role="alert">
      <IconWell tone="error">
        <IconAlert size={20} color="#ef4444" />
      </IconWell>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#ef4444" }}>{message}</p>
      <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", maxWidth: 280 }}>{hint}</p>
      {onRetry && (
        <button type="button" className="ghost-button" onClick={onRetry} style={{ marginTop: 4 }}>
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * Partial data: the widget rendered, but one field or feed is missing. Shown
 * inline so the rest of the dashboard stays usable.
 */
export function PartialNotice({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 12px",
        margin: "0 0 12px",
        fontSize: 11.5,
        lineHeight: 1.35,
        color: "#b45309",
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: 10,
      }}
    >
      <IconAlert size={14} color="#d97706" />
      <span>{message}</span>
    </div>
  );
}

/** A single unavailable value inside an otherwise healthy widget. */
export function UnavailableValue({ label = "Not reported" }: { label?: string }) {
  return <span style={{ fontSize: 13, color: "#9ca3af" }}>{label}</span>;
}
