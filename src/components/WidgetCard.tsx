// src/components/WidgetCard.tsx — the single card shell every data widget uses.
import type { CSSProperties, ReactNode } from "react";

/** Category badge palette — reference/ui-standards.md. */
const CATEGORY_COLORS = {
  markets: { background: "#eff6ff", color: "#2563eb", border: "#dbeafe" },
  crypto: { background: "#fff7ed", color: "#ea580c", border: "#fed7aa" },
  analytics: { background: "#f5f3ff", color: "#7c3aed", border: "#ede9fe" },
  tools: { background: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  india: { background: "#fffbeb", color: "#d97706", border: "#fde68a" },
  heatmaps: { background: "#fff1f2", color: "#e11d48", border: "#fecdd3" },
  sector: { background: "#f0fdfa", color: "#0d9488", border: "#99f6e4" },
} as const;

export type Category = keyof typeof CATEGORY_COLORS;

export function CategoryBadge({ category }: { category: Category }) {
  const tone = CATEGORY_COLORS[category];
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        padding: "2px 8px",
        borderRadius: 6,
        border: `1px solid ${tone.border}`,
        background: tone.background,
        color: tone.color,
        whiteSpace: "nowrap",
      }}
    >
      {category}
    </span>
  );
}

interface WidgetCardProps {
  title: string;
  subtitle?: string;
  category?: Category;
  /** Rendered at the right of the header, before the badge. */
  actions?: ReactNode;
  children: ReactNode;
  /** Span two grid columns once the viewport is wide enough for two. */
  wide?: boolean;
  /** Suppress the hover lift (used by the chat card, which holds focus). */
  stationary?: boolean;
  bodyStyle?: CSSProperties;
  style?: CSSProperties;
}

export function WidgetCard({
  title,
  subtitle,
  category,
  actions,
  children,
  wide,
  stationary,
  bodyStyle,
  style,
}: WidgetCardProps) {
  return (
    <div
      className={[
        "widget-card",
        stationary ? "widget-card--static" : "",
        wide ? "span-2" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 16px",
          borderBottom: "1px solid rgba(229, 231, 235, 0.8)",
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(8px)",
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>{title}</h3>
          {subtitle && (
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af", lineHeight: 1.3 }}>
              {subtitle}
            </p>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {actions}
          {category && <CategoryBadge category={category} />}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          background: "rgba(249,250,251,0.5)",
          ...bodyStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}
