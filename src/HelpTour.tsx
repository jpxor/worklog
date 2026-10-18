import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

export type TourStep = {
  id: string;
  target: string;
  title: string;
  text: string;
};

export default function HelpTour({
  steps,
  onClose,
  onStep,
  onShortcuts,
}: {
  steps: TourStep[];
  onClose: () => void;
  onStep: (id: string) => void;
  onShortcuts: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onStep, onClose });
  callbacks.current = { onStep, onClose };
  const step = steps[index];
  useEffect(() => {
    callbacks.current.onStep(step.id);
  }, [step.id]);
  useEffect(() => {
    const measure = () => {
      const target = document.querySelector(step.target);
      setRect(target?.getBoundingClientRect() || null);
    };
    const frame = requestAnimationFrame(() => {
      document
        .querySelector(step.target)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
      measure();
    });
    const observer = new ResizeObserver(measure);
    const target = document.querySelector(step.target);
    if (target) observer.observe(target);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") callbacks.current.onClose();
    };
    window.addEventListener("keydown", key);
    tooltip.current?.focus();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("keydown", key);
    };
  }, [step.target]);
  const width = Math.min(290, window.innerWidth - 32);
  const height = tooltip.current?.offsetHeight || 230;
  const gap = 16;
  let left = (window.innerWidth - width) / 2;
  let top = (window.innerHeight - height) / 2;
  let side = "none";
  if (rect) {
    if (rect.right + gap + width <= window.innerWidth - 16) {
      left = rect.right + gap;
      top = rect.top;
      side = "left";
    } else if (rect.left - gap - width >= 16) {
      left = rect.left - gap - width;
      top = rect.top;
      side = "right";
    } else if (rect.bottom + gap + height <= window.innerHeight - 16) {
      left = rect.left;
      top = rect.bottom + gap;
      side = "top";
    } else {
      left = rect.left;
      top = Math.max(16, rect.top - gap - height);
      side = "bottom";
    }
  }
  left = Math.max(16, Math.min(left, window.innerWidth - width - 16));
  top = Math.max(16, Math.min(top, window.innerHeight - height - 16));
  const arrow = rect
    ? side === "left" || side === "right"
      ? Math.max(
          20,
          Math.min(rect.top + Math.min(rect.height / 2, 35) - top, height - 20),
        )
      : Math.max(20, Math.min(rect.left + rect.width / 2 - left, width - 20))
    : 24;
  return (
    <>
      {rect && (
        <div
          className="tour-spotlight"
          style={{
            left: rect.left - 5,
            top: rect.top - 5,
            width: rect.width + 10,
            height: rect.height + 10,
          }}
        />
      )}
      <div
        className="tour-popover"
        role="dialog"
        aria-modal="false"
        aria-label="WorkLog guided tour"
        tabIndex={-1}
        ref={tooltip}
        style={{ width, left, top }}
      >
        <span
          className={`tour-arrow ${side}`}
          style={
            side === "left" || side === "right"
              ? { top: arrow }
              : { left: arrow }
          }
        />
        <div className="tour-heading">
          <span>
            WORKLOG · {index + 1} OF {steps.length}
          </span>
          <button className="icon" title="Close guided tour" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        {step.id === "shortcuts" && (
          <button className="tour-shortcuts" onClick={onShortcuts}>
            Keyboard shortcuts
          </button>
        )}
        <div className="tour-controls">
          <button className="text-button" onClick={onClose}>
            Skip tour
          </button>
          <div>
            <button
              disabled={index === 0}
              title="Previous tip"
              onClick={() => setIndex((i) => i - 1)}
            >
              <ArrowLeft size={14} />
            </button>
            <button
              className="primary"
              onClick={() =>
                index === steps.length - 1 ? onClose() : setIndex((i) => i + 1)
              }
            >
              {index === steps.length - 1 ? "Done" : "Next"}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
