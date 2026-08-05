import { useEffect } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

type Dir = "up" | "down" | "left" | "right";

function visible(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function center(r: DOMRect) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Pick the nearest focusable element in a given direction (D-pad style). */
function nextInDirection(current: HTMLElement, dir: Dir): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el !== current && visible(el),
  );
  const from = center(current.getBoundingClientRect());

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of all) {
    const to = center(el.getBoundingClientRect());
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    const primary =
      dir === "left" ? -dx : dir === "right" ? dx : dir === "up" ? -dy : dy;
    if (primary <= 8) continue; // wrong side

    const cross = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    // Heavily penalise drift off the travel axis so rows/columns feel predictable.
    const score = primary + cross * 3;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

/**
 * Global TV-remote / arrow-key focus movement across rows, grids and cards.
 * Skipped while typing in a text field or when a media element has focus.
 */
export function useSpatialNavigation(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const dir: Dir | null =
        e.key === "ArrowUp"
          ? "up"
          : e.key === "ArrowDown"
            ? "down"
            : e.key === "ArrowLeft"
              ? "left"
              : e.key === "ArrowRight"
                ? "right"
                : null;
      if (!dir || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;

      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        tag === "video" ||
        active?.isContentEditable
      ) {
        return;
      }

      let origin = active && visible(active) && active !== document.body ? active : null;
      if (!origin) {
        origin = document.querySelector<HTMLElement>(FOCUSABLE);
        if (origin) {
          e.preventDefault();
          origin.focus();
          origin.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
        }
        return;
      }

      const target = nextInDirection(origin, dir);
      if (!target) return;

      e.preventDefault();
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
