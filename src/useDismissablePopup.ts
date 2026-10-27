import { useEffect, useRef } from "react";

export function useDismissablePopup(open: boolean, onClose: () => void) {
  const host = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!host.current?.contains(event.target as Node)) close.current();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close.current();
        host.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    const dismiss = () => close.current();
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", key);
    window.addEventListener("worklog:close-context-menus", dismiss);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("keydown", key);
      window.removeEventListener("worklog:close-context-menus", dismiss);
    };
  }, [open]);
  return host;
}
