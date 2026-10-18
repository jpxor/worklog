import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface MenuAction {
  label: string;
  run: () => void;
  disabled?: boolean;
}
export default function ContextMenu({
  x,
  y,
  label,
  actions,
  onClose,
}: {
  x: number;
  y: number;
  label: string;
  actions: MenuAction[];
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const previousFocus = useRef(document.activeElement);
  const [position, setPosition] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const rect = host.current!.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
    });
    host.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
  }, [x, y]);
  useEffect(() => {
    const close = () => onClose();
    const scroll = (event: Event) => {
      if (!host.current?.contains(event.target as Node)) onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        (previousFocus.current as HTMLElement)?.focus?.();
      }
    };
    window.addEventListener("click", close);
    window.addEventListener("worknotes:close-context-menus", close);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", scroll, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("worknotes:close-context-menus", close);
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [onClose]);
  return (
    <div
      ref={host}
      role="menu"
      aria-label={label}
      className="note-context-menu"
      style={position}
      onKeyDown={(event) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        const buttons = [
          ...host.current!.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ),
        ];
        const index = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? buttons.length - 1
              : (index +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  buttons.length) %
                buttons.length;
        buttons[next]?.focus();
      }}
    >
      {actions.map((action) => (
        <button
          key={action.label}
          role="menuitem"
          disabled={action.disabled}
          onClick={() => {
            onClose();
            action.run();
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
