"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";

export function WishlistActions({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const t = useTranslations("listNavigation");
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 769px)");
    const sync = () => {
      if (ref.current) ref.current.open = desktop.matches;
    };
    sync();
    desktop.addEventListener("change", sync);
    const dismiss = (event: PointerEvent) => {
      if (
        !desktop.matches &&
        event.target instanceof Node &&
        !ref.current?.contains(event.target) &&
        ref.current
      )
        ref.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !desktop.matches && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      desktop.removeEventListener("change", sync);
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <details ref={ref} className="wishlist-actions" open>
      <summary>{t("manageList")}</summary>
      <div
        className="wishlist-actions-content"
        onClick={(event) => {
          if (
            window.matchMedia("(max-width: 768px)").matches &&
            event.target instanceof Element &&
            event.target.closest("a, button") &&
            ref.current
          ) {
            ref.current.open = false;
            ref.current.querySelector("summary")?.focus();
          }
        }}
      >
        {children}
      </div>
    </details>
  );
}
