import { useEffect, useRef } from "react";

interface PaneFindBarProps {
  query: string;
  matchCount: number;
  activeMatchIndex: number;
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
  onQueryChange: (value: string) => void;
  onCaseSensitiveChange: (value: boolean) => void;
  onWholeWordChange: (value: boolean) => void;
  onUseRegexChange: (value: boolean) => void;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function PaneFindBar({
  query,
  matchCount,
  activeMatchIndex,
  caseSensitive,
  wholeWord,
  useRegex,
  onQueryChange,
  onCaseSensitiveChange,
  onWholeWordChange,
  onUseRegexChange,
  onPrevious,
  onNext,
  onClose,
}: PaneFindBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  const resultLabel =
    query.trim().length === 0
      ? ""
      : matchCount === 0
        ? "No results"
        : `${activeMatchIndex + 1} of ${matchCount}`;
  return (
    <div className="pane-find-bar" role="search">
      <input
        ref={inputRef}
        className="pane-find-input"
        type="search"
        placeholder="Find"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (event.shiftKey) {
              onPrevious();
            } else {
              onNext();
            }
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
      />
      <div className="pane-find-actions">
        <button
          type="button"
          className={`pane-find-toggle ${caseSensitive ? "active" : ""}`}
          title="Case sensitive"
          onClick={() => onCaseSensitiveChange(!caseSensitive)}
        >
          Aa
        </button>
        <button
          type="button"
          className={`pane-find-toggle ${wholeWord ? "active" : ""}`}
          title="Whole word"
          onClick={() => onWholeWordChange(!wholeWord)}
        >
          ab
        </button>
        <button
          type="button"
          className={`pane-find-toggle ${useRegex ? "active" : ""}`}
          title="Regex"
          onClick={() => onUseRegexChange(!useRegex)}
        >
          .*
        </button>
        <span className="pane-find-results">{resultLabel}</span>
        <button type="button" className="pane-find-nav" title="Previous" onClick={onPrevious}>
          ↑
        </button>
        <button type="button" className="pane-find-nav" title="Next" onClick={onNext}>
          ↓
        </button>
        <button type="button" className="pane-find-close" title="Close" onClick={onClose}>
          ×
        </button>
      </div>
    </div>
  );
}
