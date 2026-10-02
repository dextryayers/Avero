import type { ReactNode } from "react";
import clsx from "clsx";

// Shared chrome atoms: one keyboard-chip, section-heading and empty-state
// language for menus, palette, settings and panels. Keeps the whole studio
// visually consistent without copy-pasted class strings.

/** Keyboard shortcut chip, e.g. <Kbd>Ctrl+Z</Kbd>. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={clsx(
        "inline-flex shrink-0 items-center rounded-md border border-white/10 bg-black/40 px-1.5 py-px",
        "font-mono text-[10px] leading-relaxed text-[#8e8e98]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/** Micro section heading, Photoshop-style: uppercase, tracked, neutral. */
export function SectionHead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("avero-micro", className)}>
      {children}
    </div>
  );
}

/**
 * Elegant dock slider: label, fluid track with blue fill, mono value badge.
 * One component for every slider in the right dock so nothing looks stock.
 */
export function DockSlider({
  label,
  value,
  min,
  max,
  onChange,
  suffix = "",
  title,
  disabled,
  compact,
}: {
  label?: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
  title?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const pct = max === min ? 100 : ((value - min) / (max - min)) * 100;
  return (
    <label
      className={`group flex items-center gap-2 ${disabled ? "opacity-40" : ""}`}
      title={title}
    >
      {label && (
        <span className={`shrink-0 text-[#8e8e98] transition-colors group-hover:text-[#c9c9d1] ${compact ? "w-8 text-[10px]" : "w-14 text-[11px] font-medium"}`}>
          {label}
        </span>
      )}
      <input
        type="range"
        aria-label={label ?? "value"}
        className="avero-slider min-w-0 flex-1"
        style={{ ["--avero-fill" as string]: `${Math.max(0, Math.min(100, pct))}%` }}
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span
        className={`shrink-0 rounded-md bg-white/5 text-right font-mono tabular-nums text-white transition-colors group-hover:bg-[#2f7cf6]/30 ${
          compact ? "min-w-9 px-1 py-px text-[10px]" : "min-w-11 px-1.5 py-0.5 text-[11px]"
        }`}
      >
        {value}
        {suffix}
      </span>
    </label>
  );
}

/** Friendly placeholder for empty lists (recents, layers, results). */
export function EmptyState({
  title,
  hint,
  icon,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-8 text-center">
      {icon && <span className="mb-1 text-[#3a3a41]">{icon}</span>}
      <div className="text-[12px] font-semibold text-[#c9c9d1]">{title}</div>
      {hint && <div className="max-w-[260px] text-[11px] leading-relaxed text-[#6e6e78]">{hint}</div>}
    </div>
  );
}
