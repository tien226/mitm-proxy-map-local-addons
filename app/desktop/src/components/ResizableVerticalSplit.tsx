import { useCallback, useEffect, useRef, useState } from "react";

interface ResizableVerticalSplitProps {
  top: React.ReactNode;
  bottom: React.ReactNode;
  initialTopPercent?: number;
  minTopPercent?: number;
  maxTopPercent?: number;
  storageKey?: string;
}

const DEFAULT_TOP_PERCENT = 38;
const MIN_TOP_PERCENT = 18;
const MAX_TOP_PERCENT = 78;

export function ResizableVerticalSplit({
  top,
  bottom,
  initialTopPercent = DEFAULT_TOP_PERCENT,
  minTopPercent = MIN_TOP_PERCENT,
  maxTopPercent = MAX_TOP_PERCENT,
  storageKey,
}: ResizableVerticalSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [topPercent, setTopPercent] = useState<number>(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const value = Number(saved);
        if (!Number.isNaN(value)) {
          return Math.min(maxTopPercent, Math.max(minTopPercent, value));
        }
      }
    }
    return initialTopPercent;
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const clampPercent = useCallback(
    (value: number): number => Math.min(maxTopPercent, Math.max(minTopPercent, value)),
    [maxTopPercent, minTopPercent]
  );

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) {
      return;
    }
    const handleMouseMove = (event: MouseEvent): void => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const nextPercent = ((event.clientY - rect.top) / rect.height) * 100;
      setTopPercent(clampPercent(nextPercent));
    };
    const handleMouseUp = (): void => {
      setIsDragging(false);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, clampPercent, storageKey, topPercent]);

  useEffect(() => {
    if (!isDragging && storageKey) {
      localStorage.setItem(storageKey, String(topPercent));
    }
  }, [isDragging, storageKey, topPercent]);

  return (
    <div
      ref={containerRef}
      className={`resizable-vertical-split ${isDragging ? "is-dragging" : ""}`}
    >
      <div className="split-pane-top" style={{ height: `${topPercent}%` }}>
        {top}
      </div>
      <div
        className="split-resizer"
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize panels"
        title="Drag to resize"
      />
      <div className="split-pane-bottom">{bottom}</div>
    </div>
  );
}
