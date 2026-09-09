// src/components/SourceTrail.tsx — provenance for every feed on the dashboard.
// Required whenever a dashboard shows extracted, web, document or AI data.
import type { ReactNode } from "react";

export interface SourceEntry {
  title: string;
  detail: string;
  status: "live" | "ok" | "idle" | "error";
  icon?: ReactNode;
}

const STATUS_TONE: Record<SourceEntry["status"], { dot: string; label: string; color: string }> = {
  live: { dot: "#16a34a", label: "Live", color: "#16a34a" },
  ok: { dot: "#4f46e5", label: "Loaded", color: "#4338ca" },
  idle: { dot: "#9ca3af", label: "Idle", color: "#6b7280" },
  error: { dot: "#ef4444", label: "Failed", color: "#ef4444" },
};

export function SourceTrail({ entries }: { entries: SourceEntry[] }) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 12, display: "grid", gap: 8 }}>
      {entries.map((entry) => {
        const tone = STATUS_TONE[entry.status];
        return (
          <li
            key={entry.title}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "9px 11px",
              background: "rgba(255,255,255,0.9)",
              border: "1px solid rgba(229,231,235,0.8)",
              borderRadius: 10,
            }}
          >
            <span
              className={entry.status === "live" ? "live-dot" : undefined}
              style={{
                width: 7,
                height: 7,
                marginTop: 5,
                flexShrink: 0,
                borderRadius: "50%",
                background: tone.dot,
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {entry.icon}
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#374151" }}>
                  {entry.title}
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, color: tone.color }}>
                  {tone.label}
                </span>
              </div>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 11.5,
                  lineHeight: 1.4,
                  color: "#9ca3af",
                  wordBreak: "break-word",
                }}
              >
                {entry.detail}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
