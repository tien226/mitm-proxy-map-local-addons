export interface TextSearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

export interface TextMatchRange {
  start: number;
  end: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSearchPattern(query: string, options: TextSearchOptions): RegExp | null {
  if (!query) {
    return null;
  }
  try {
    if (options.useRegex) {
      const flags = options.caseSensitive ? "g" : "gi";
      return new RegExp(query, flags);
    }
    const escapedQuery = escapeRegExp(query);
    const wordPattern = options.wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
    const flags = options.caseSensitive ? "g" : "gi";
    return new RegExp(wordPattern, flags);
  } catch {
    return null;
  }
}

export function findTextMatches(text: string, query: string, options: TextSearchOptions): TextMatchRange[] {
  const pattern = buildSearchPattern(query, options);
  if (!pattern) {
    return [];
  }
  const matches: TextMatchRange[] = [];
  let match = pattern.exec(text);
  while (match !== null) {
    if (match.index === undefined) {
      break;
    }
    matches.push({ start: match.index, end: match.index + match[0].length });
    if (match[0].length === 0) {
      pattern.lastIndex += 1;
    }
    match = pattern.exec(text);
  }
  return matches;
}

export function findLineMatchRanges(
  line: string,
  query: string,
  options: TextSearchOptions
): TextMatchRange[] {
  return findTextMatches(line, query, options);
}
