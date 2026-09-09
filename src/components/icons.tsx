// src/components/icons.tsx — inline SVG icons (no icon dependency, no webfonts).
import type { CSSProperties } from "react";

interface IconProps {
  size?: number;
  color?: string;
  style?: CSSProperties;
}

function base(size: number, color: string, style?: CSSProperties) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style,
    "aria-hidden": true,
  };
}

export function IconSparkles({ size = 16, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <path d="M12 3v4M12 17v4M4.9 7.5l2.8 2.8M16.3 13.7l2.8 2.8M3 14h4M17 10h4M7.7 16.5l-2.8 2.8M19.1 4.7l-2.8 2.8" />
    </svg>
  );
}

export function IconAlert({ size = 16, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 2.4 17.4A2 2 0 0 0 4.1 20.4h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

export function IconChart({ size = 16, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="m7 14 3.5-3.5 3 3L20 7" />
    </svg>
  );
}

export function IconRefresh({ size = 16, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <path d="M21 12a9 9 0 1 1-3.4-7.1" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}

export function IconSend({ size = 16, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <path d="M21.5 12 3 4.5l3 7.5-3 7.5Z" />
      <path d="M6 12h15.5" />
    </svg>
  );
}

export function IconStop({ size = 16, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export function IconDatabase({ size = 16, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <ellipse cx="12" cy="5.5" rx="8" ry="3" />
      <path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </svg>
  );
}

export function IconBuilding({ size = 16, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <path d="M4 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15" />
      <path d="M14 10h4a2 2 0 0 1 2 2v9" />
      <path d="M8 8h2M8 12h2M8 16h2M17 14h1M17 18h1M2 21h20" />
    </svg>
  );
}

export function IconClock({ size = 16, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.5l3.5 2" />
    </svg>
  );
}

export function IconSearch({ size = 16, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.9-3.9" />
    </svg>
  );
}

export function IconLock({ size = 16, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 1 1 8 0v3" />
    </svg>
  );
}
