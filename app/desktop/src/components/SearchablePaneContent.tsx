import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PaneFindBar } from "./PaneFindBar";
import { findTextMatches, type TextSearchOptions } from "../utils/textSearch";

interface SearchablePaneContentProps {
  searchText: string;
  enabled: boolean;
  findOpenRequest?: number;
  enableFindShortcut?: boolean;
  autoFocusContainer?: boolean;
  highlightScroll?: boolean;
  children: (findProps: SearchableFindProps | undefined) => ReactNode;
}

export interface SearchableFindProps {
  query: string;
  options: TextSearchOptions;
  matchCount: number;
  activeMatchIndex: number;
}

export function SearchablePaneContent({
  searchText,
  enabled,
  findOpenRequest = 0,
  enableFindShortcut = false,
  autoFocusContainer = true,
  highlightScroll = true,
  children,
}: SearchablePaneContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const prevFindOpenRequestRef = useRef<number>(0);
  const prevSearchTextRef = useRef<string>(searchText);
  const [isFindOpen, setIsFindOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");
  const [caseSensitive, setCaseSensitive] = useState<boolean>(false);
  const [wholeWord, setWholeWord] = useState<boolean>(false);
  const [useRegex, setUseRegex] = useState<boolean>(false);
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(0);
  const searchOptions = useMemo<TextSearchOptions>(
    () => ({ caseSensitive, wholeWord, useRegex }),
    [caseSensitive, wholeWord, useRegex]
  );
  const matches = useMemo(
    () => findTextMatches(searchText, query.trim(), searchOptions),
    [searchText, query, searchOptions]
  );
  const matchCount = matches.length;
  const openFind = useCallback((): void => {
    if (!enabled) {
      return;
    }
    setIsFindOpen(true);
  }, [enabled]);
  const closeFind = useCallback((): void => {
    setIsFindOpen(false);
    setQuery("");
    setActiveMatchIndex(0);
  }, []);
  const goToNextMatch = useCallback((): void => {
    if (matchCount === 0) {
      return;
    }
    setActiveMatchIndex((currentIndex) => (currentIndex + 1) % matchCount);
  }, [matchCount]);
  const goToPreviousMatch = useCallback((): void => {
    if (matchCount === 0) {
      return;
    }
    setActiveMatchIndex((currentIndex) => (currentIndex - 1 + matchCount) % matchCount);
  }, [matchCount]);
  useEffect(() => {
    setActiveMatchIndex(0);
  }, [query, caseSensitive, wholeWord, useRegex]);
  useEffect(() => {
    if (!enabled) {
      setIsFindOpen(false);
    }
  }, [enabled]);
  useEffect(() => {
    if (prevSearchTextRef.current !== searchText) {
      prevSearchTextRef.current = searchText;
      closeFind();
    }
  }, [searchText, closeFind]);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (findOpenRequest <= prevFindOpenRequestRef.current) {
      return;
    }
    prevFindOpenRequestRef.current = findOpenRequest;
    openFind();
  }, [enabled, findOpenRequest, openFind]);
  useEffect(() => {
    if (!enableFindShortcut || !enabled) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      const isFindShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f";
      if (!isFindShortcut) {
        return;
      }
      event.preventDefault();
      openFind();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableFindShortcut, enabled, openFind]);
  useEffect(() => {
    if (!highlightScroll || !isFindOpen || matchCount === 0 || !query.trim()) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      const activeElement = bodyRef.current?.querySelector(
        `[data-find-match-index="${activeMatchIndex}"]`
      );
      if (!activeElement) {
        return;
      }
      activeElement.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [highlightScroll, isFindOpen, activeMatchIndex, matchCount, query]);
  const activeFind: SearchableFindProps | undefined =
    isFindOpen && query.trim().length > 0
      ? {
          query: query.trim(),
          options: searchOptions,
          matchCount,
          activeMatchIndex,
        }
      : undefined;
  return (
    <div
      ref={containerRef}
      className={`pane-content pane-content--searchable ${isFindOpen ? "pane-content--find-open" : ""}`}
      tabIndex={autoFocusContainer && enabled ? 0 : -1}
      onMouseDown={
        autoFocusContainer
          ? () => {
              containerRef.current?.focus({ preventScroll: true });
            }
          : undefined
      }
    >
      {isFindOpen && (
        <PaneFindBar
          query={query}
          matchCount={matchCount}
          activeMatchIndex={activeMatchIndex}
          caseSensitive={caseSensitive}
          wholeWord={wholeWord}
          useRegex={useRegex}
          onQueryChange={setQuery}
          onCaseSensitiveChange={setCaseSensitive}
          onWholeWordChange={setWholeWord}
          onUseRegexChange={setUseRegex}
          onPrevious={goToPreviousMatch}
          onNext={goToNextMatch}
          onClose={closeFind}
        />
      )}
      <div ref={bodyRef} className="pane-content-body">
        {children(activeFind)}
      </div>
    </div>
  );
}
