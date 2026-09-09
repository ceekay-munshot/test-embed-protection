// src/components/KpiCard.tsx — one compact metric per grid cell.
import type { ReactNode } from "react";
import { WidgetCard } from "./WidgetCard";
import { LoadingState, UnavailableValue } from "./states";

interface KpiCardProps {
  label: string;
  scope: string;
  value: string | null;
  /** Secondary line: trend, comparison or context. */
  detail?: ReactNode;
  detailColor?: string;
  loading?: boolean;
  icon?: ReactNode;
}

export function KpiCard({
  label,
  scope,
  value,
  detail,
  detailColor = "#6b7280",
  loading,
  icon,
}: KpiCardProps) {
  return (
    <WidgetCard title={label} subtitle={scope} actions={icon}>
      {loading ? (
        <LoadingState rows={1} lead />
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: "16px 16px 18px",
            minHeight: 92,
            justifyContent: "center",
          }}
        >
          {value === null ? (
            <UnavailableValue label="Not reported" />
          ) : (
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#111827",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              {value}
            </span>
          )}
          {detail && <span style={{ fontSize: 12, color: detailColor }}>{detail}</span>}
        </div>
      )}
    </WidgetCard>
  );
}
