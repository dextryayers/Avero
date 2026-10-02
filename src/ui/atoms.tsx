import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
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

export type PagerJumpItem = {
  id: string;
  label: string;
  icon?: (props: { size?: number | string; className?: string }) => ReactNode;
  active?: boolean;
  badge?: string | number;
};

/**
 * Elegant horizontal pager: edge fades plus frosted-glass prev/next buttons
 * that appear only when there is overflow to travel, smooth animated paging,
 * and an "all options" jump menu so long strips stay one click away.
 * Replaces every basic native scrollbar on tab rows.
 */
export function ScrollPager({
  children,
  ariaLabel,
  className,
  jumpLabel = "All",
  jumpItems = [],
  onJumpPick,
}: {
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
  jumpLabel?: string;
  jumpItems?: PagerJumpItem[];
  onJumpPick?: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setCanLeft((v) => (v === left ? v : left));
    setCanRight((v) => (v === right ? v : right));
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  // Re-measure after every commit: tab badges and labels change width.
  useEffect(() => {
    update();
  });

  useEffect(() => {
    if (!jumpOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setJumpOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jumpOpen]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * Math.max(140, el.clientWidth * 0.7), behavior: "smooth" });
  };

  const pagerBtn =
    "absolute top-1/2 z-10 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/60 text-white opacity-0 backdrop-blur-md transition-all duration-150 hover:border-[#2f7cf6] hover:bg-[#2f7cf6] focus-visible:opacity-100 group-hover:opacity-100";

  return (
    <div className={clsx("group relative flex items-stretch", className)}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-6 bg-gradient-to-r from-[#161618] to-transparent opacity-0 transition-opacity" style={{ opacity: canLeft ? 1 : 0 }} />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-8 bg-gradient-to-l from-[#161618] to-transparent opacity-0 transition-opacity" style={{ opacity: jumpItems.length > 0 || canRight ? 1 : 0 }} />
      {canLeft && (
        <button
          onClick={() => page(-1)}
          title="Scroll left"
          aria-label="Scroll tabs left"
          tabIndex={canLeft ? 0 : -1}
          className={clsx(pagerBtn, "left-1")}
        >
          <ChevronLeft size={13} />
        </button>
      )}
      {canRight && (
        <button
          onClick={() => page(1)}
          title="Scroll right"
          aria-label="Scroll tabs right"
          tabIndex={canRight ? 0 : -1}
          className={clsx(pagerBtn, jumpItems.length > 0 ? "right-9" : "right-1")}
        >
          <ChevronRight size={13} />
        </button>
      )}
      <div
        ref={ref}
        role="tablist"
        aria-label={ariaLabel}
        className="flex min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto scroll-smooth px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {jumpItems.length > 0 && (
        <div className="relative z-20 flex shrink-0 items-center pr-1.5">
          <button
            onClick={() => setJumpOpen((v) => !v)}
            title={`${jumpLabel} (jump to any panel)`}
            aria-label={`${jumpLabel} (jump to any panel)`}
            aria-expanded={jumpOpen}
            className={clsx(
              "grid h-7 w-7 place-items-center rounded-lg transition-colors",
              jumpOpen ? "bg-[#2f7cf6] text-white" : "text-[#8e8e98] hover:bg-white/5 hover:text-white",
            )}
          >
            <LayoutGrid size={13} />
          </button>
          {jumpOpen && (
            <>
              <button aria-label="Close panel menu" tabIndex={-1} onClick={() => setJumpOpen(false)} className="fixed inset-0 z-40 cursor-default bg-black/40" />
              <div className="avero-popover-in absolute right-0 top-full z-50 mt-1.5 max-h-[320px] w-[212px] overflow-y-auto rounded-xl border border-white/10 bg-[#1b1b1f]/95 p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                <div className="avero-micro px-2 pb-1 pt-1">{jumpLabel}</div>
                {jumpItems.map((j) => {
                  const Icon = j.icon;
                  return (
                    <button
                      key={j.id}
                      onClick={() => {
                        onJumpPick?.(j.id);
                        setJumpOpen(false);
                      }}
                      className={clsx(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors",
                        j.active ? "bg-[#2f7cf6] font-semibold text-white" : "text-[#c9c9d1] hover:bg-white/5 hover:text-white",
                      )}
                    >
                      {Icon && <Icon size={13} className="shrink-0" />}
                      <span className="flex-1 truncate">{j.label}</span>
                      {j.badge !== undefined && (
                        <span className={clsx("rounded px-1 font-mono text-[9px]", j.active ? "bg-white/20 text-white" : "bg-white/5 text-[#8e8e98]")}>
                          {j.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Elegant collapse chevron for dock sections (replaces basic - / + text). */
export function CollapseChevron({ open, title }: { open: boolean; title?: string }) {
  return (
    <span
      title={title ?? (open ? "Collapse section" : "Expand section")}
      className="grid h-5 w-5 place-items-center rounded-md text-[#6e6e78] transition-colors hover:bg-white/5 hover:text-white"
    >
      <ChevronDown size={13} className={clsx("transition-transform duration-200", !open && "-rotate-90")} />
    </span>
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
