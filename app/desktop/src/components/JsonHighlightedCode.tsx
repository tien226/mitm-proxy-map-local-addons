type JsonTokenType = "key" | "string" | "number" | "boolean" | "null" | "punctuation" | "text";

interface JsonToken {
  type: JsonTokenType;
  value: string;
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

interface JsonHighlightedCodeProps {
  text: string;
}

export function JsonHighlightedCode({ text }: JsonHighlightedCodeProps) {
  const lines = text.split("\n");
  return (
    <pre className="json-highlight">
      {lines.map((line, lineIndex) => (
        <div key={`line-${lineIndex}`} className="json-line">
          {tokenizeJsonLine(line).map((token, tokenIndex) => (
            <span key={`token-${lineIndex}-${tokenIndex}`} className={`json-${token.type}`}>
              {token.value}
            </span>
          ))}
        </div>
      ))}
    </pre>
  );
}
