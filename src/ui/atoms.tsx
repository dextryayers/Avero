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
