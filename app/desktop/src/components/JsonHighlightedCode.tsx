import type { SearchableFindProps } from "./SearchablePaneContent";
import { findLineMatchRanges, type TextMatchRange } from "../utils/textSearch";

type JsonTokenType = "key" | "string" | "number" | "boolean" | "null" | "punctuation" | "text";

interface JsonToken {
  type: JsonTokenType;
  value: string;
}

interface TokenSpan {
  token: JsonToken;
  start: number;
  end: number;
}

function tokenizeJsonLine(line: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let index = 0;
  while (index < line.length) {
    const char = line[index];
    if (char === " " || char === "\t") {
      let end = index + 1;
      while (end < line.length && (line[end] === " " || line[end] === "\t")) {
        end += 1;
      }
      tokens.push({ type: "text", value: line.slice(index, end) });
      index = end;
      continue;
    }
    if (char === '"') {
      let end = index + 1;
      while (end < line.length) {
        if (line[end] === "\\") {
          end += 2;
          continue;
        }
        if (line[end] === '"') {
          end += 1;
          break;
        }
        end += 1;
      }
      const stringToken = line.slice(index, end);
      let colonIndex = end;
      while (colonIndex < line.length && (line[colonIndex] === " " || line[colonIndex] === "\t")) {
        colonIndex += 1;
      }
      const tokenType: JsonTokenType = line[colonIndex] === ":" ? "key" : "string";
      tokens.push({ type: tokenType, value: stringToken });
      index = end;
      continue;
    }
    if (char === "-" || (char >= "0" && char <= "9")) {
      let end = index + 1;
      while (end < line.length && /[0-9.eE+-]/.test(line[end])) {
        end += 1;
      }
      tokens.push({ type: "number", value: line.slice(index, end) });
      index = end;
      continue;
    }
    if (line.startsWith("true", index)) {
      tokens.push({ type: "boolean", value: "true" });
      index += 4;
      continue;
    }
    if (line.startsWith("false", index)) {
      tokens.push({ type: "boolean", value: "false" });
      index += 5;
      continue;
    }
    if (line.startsWith("null", index)) {
      tokens.push({ type: "null", value: "null" });
      index += 4;
      continue;
    }
    if ("{}[],:".includes(char)) {
      tokens.push({ type: "punctuation", value: char });
      index += 1;
      continue;
    }
    tokens.push({ type: "text", value: char });
    index += 1;
  }
  return tokens;
}

function buildTokenSpans(line: string): TokenSpan[] {
  const tokens = tokenizeJsonLine(line);
  let position = 0;
  return tokens.map((token) => {
    const start = position;
    const end = position + token.value.length;
    position = end;
    return { token, start, end };
  });
}

function rangeOverlapsToken(range: TextMatchRange, start: number, end: number): boolean {
  return range.start < end && range.end > start;
}

function tokenClassName(token: JsonToken, plainText: boolean): string {
  return plainText ? "json-plain" : `json-${token.type}`;
}

function renderJsonTokenSpan(
  token: JsonToken,
  lineIndex: number,
  keyPrefix: string,
  plainText: boolean
): JSX.Element {
  return (
    <span
      key={`${keyPrefix}-${lineIndex}-${token.type}-${token.value}`}
      className={tokenClassName(token, plainText)}
    >
      {token.value}
    </span>
  );
}

function renderTokenSpanWithFind(
  span: TokenSpan,
  lineIndex: number,
  keyPrefix: string,
  ranges: TextMatchRange[],
  find: SearchableFindProps,
  matchOffsetRef: { value: number },
  plainText: boolean
): JSX.Element[] {
  const overlappingRanges = ranges
    .filter((range) => rangeOverlapsToken(range, span.start, span.end))
    .sort((left, right) => left.start - right.start);
  if (overlappingRanges.length === 0) {
    return [renderJsonTokenSpan(span.token, lineIndex, keyPrefix, plainText)];
  }
  const parts: JSX.Element[] = [];
  let relativeCursor = 0;
  overlappingRanges.forEach((range, rangeIndex) => {
    const relativeStart = Math.max(relativeCursor, range.start - span.start);
    const relativeEnd = Math.min(span.token.value.length, range.end - span.start);
    if (relativeEnd <= relativeStart) {
      return;
    }
    if (relativeStart > relativeCursor) {
      const beforeText = span.token.value.slice(relativeCursor, relativeStart);
      parts.push(
        <span
          key={`${keyPrefix}-before-${lineIndex}-${rangeIndex}`}
          className={tokenClassName(span.token, plainText)}
        >
          {beforeText}
        </span>
      );
    }
    if (relativeEnd > relativeStart) {
      const matchText = span.token.value.slice(relativeStart, relativeEnd);
      const isActive = matchOffsetRef.value === find.activeMatchIndex;
      parts.push(
        <mark
          key={`${keyPrefix}-match-${lineIndex}-${rangeIndex}`}
          className={`find-match ${isActive ? "active" : ""}`}
          data-find-match-index={matchOffsetRef.value}
        >
          <span className={tokenClassName(span.token, plainText)}>{matchText}</span>
        </mark>
      );
      matchOffsetRef.value += 1;
      relativeCursor = relativeEnd;
    }
  });
  if (relativeCursor < span.token.value.length) {
    parts.push(
      <span key={`${keyPrefix}-after-${lineIndex}`} className={tokenClassName(span.token, plainText)}>
        {span.token.value.slice(relativeCursor)}
      </span>
    );
  }
  return parts;
}

function renderLine(
  line: string,
  lineIndex: number,
  find: SearchableFindProps | undefined,
  matchOffsetRef: { value: number },
  plainText: boolean
): JSX.Element {
  const tokenSpans = buildTokenSpans(line);
  const ranges =
    find && find.query ? findLineMatchRanges(line, find.query, find.options) : [];
  if (ranges.length === 0) {
    return (
      <div key={`line-${lineIndex}`} className="json-line">
        {tokenSpans.map((span, spanIndex) =>
          renderJsonTokenSpan(span.token, lineIndex, `plain-${spanIndex}`, plainText)
        )}
      </div>
    );
  }
  const parts: JSX.Element[] = [];
  tokenSpans.forEach((span, spanIndex) => {
    parts.push(
      ...renderTokenSpanWithFind(
        span,
        lineIndex,
        `span-${spanIndex}`,
        ranges,
        find!,
        matchOffsetRef,
        plainText
      )
    );
  });
  return (
    <div key={`line-${lineIndex}`} className="json-line">
      {parts}
    </div>
  );
}

interface JsonHighlightedCodeProps {
  text: string;
  find?: SearchableFindProps;
  plainText?: boolean;
}

export function JsonHighlightedCode({ text, find, plainText = false }: JsonHighlightedCodeProps) {
  const lines = text.split("\n");
  const matchOffsetRef = { value: 0 };
  const highlightClass = plainText ? "json-highlight json-highlight--plain" : "json-highlight";
  return (
    <pre className={highlightClass}>
      {lines.map((line, lineIndex) => renderLine(line, lineIndex, find, matchOffsetRef, plainText))}
    </pre>
  );
}
