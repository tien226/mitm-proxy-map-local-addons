import { useMemo } from "react";
import type { SearchableFindProps } from "./SearchablePaneContent";
import { findLineMatchRanges } from "../utils/textSearch";

interface SearchablePreProps {
  text: string;
  find: SearchableFindProps;
  className?: string;
}

function renderHighlightedLine(
  line: string,
  lineIndex: number,
  globalMatchOffset: number,
  find: SearchableFindProps
): { node: JSX.Element; nextOffset: number } {
  const ranges = findLineMatchRanges(line, find.query, find.options);
  if (ranges.length === 0 || !find.query) {
    return {
      node: (
        <div key={`line-${lineIndex}`} className="searchable-line">
          {line || "\u00a0"}
        </div>
      ),
      nextOffset: globalMatchOffset,
    };
  }
  const parts: JSX.Element[] = [];
  let cursor = 0;
  let matchOffset = globalMatchOffset;
  ranges.forEach((range, rangeIndex) => {
    if (range.start > cursor) {
      parts.push(
        <span key={`text-${lineIndex}-${rangeIndex}`}>{line.slice(cursor, range.start)}</span>
      );
    }
    const isActive = matchOffset === find.activeMatchIndex;
    parts.push(
      <mark
        key={`match-${lineIndex}-${rangeIndex}`}
        className={`find-match ${isActive ? "active" : ""}`}
        data-find-match-index={matchOffset}
      >
        {line.slice(range.start, range.end)}
      </mark>
    );
    matchOffset += 1;
    cursor = range.end;
  });
  if (cursor < line.length) {
    parts.push(<span key={`tail-${lineIndex}`}>{line.slice(cursor)}</span>);
  }
  return {
    node: (
      <div key={`line-${lineIndex}`} className="searchable-line">
        {parts}
      </div>
    ),
    nextOffset: matchOffset,
  };
}

export function SearchablePre({ text, find, className }: SearchablePreProps) {
  const lines = useMemo(() => text.split("\n"), [text]);
  let globalMatchOffset = 0;
  const renderedLines = lines.map((line, lineIndex) => {
    const result = renderHighlightedLine(line, lineIndex, globalMatchOffset, find);
    globalMatchOffset = result.nextOffset;
    return result.node;
  });
  const preClassName = className
    ? `${className} pane-pre--searchable`
    : "pane-pre pane-pre--searchable";
  return <pre className={preClassName}>{renderedLines}</pre>;
}
