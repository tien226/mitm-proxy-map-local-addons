const SKIPPED_HEADER_NAMES: Set<string> = new Set([
  "content-length",
  "connection",
  "proxy-connection",
  "transfer-encoding",
]);

function escapeSingleQuotes(value: string): string {
  return value.replace(/'/g, "'\\''");
}

function shouldSkipHeader(name: string): boolean {
  const lowerName = name.toLowerCase();
  if (lowerName.startsWith(":")) {
    return true;
  }
  return SKIPPED_HEADER_NAMES.has(lowerName);
}

export function buildCurlCommand(
  method: string,
  url: string,
  headers: Array<[string, string]>,
  body: string
): string {
  const parts: string[] = ["curl"];
  const upperMethod = method.toUpperCase();
  if (upperMethod !== "GET") {
    parts.push("-X", upperMethod);
  }
  parts.push(`'${escapeSingleQuotes(url)}'`);
  for (const [name, value] of headers) {
    if (!name || shouldSkipHeader(name)) {
      continue;
    }
    const headerLine = `${name}: ${value}`;
    parts.push("-H", `'${escapeSingleQuotes(headerLine)}'`);
  }
  const trimmedBody = body.trim();
  if (trimmedBody && upperMethod !== "GET" && upperMethod !== "HEAD") {
    parts.push("--data-raw", `'${escapeSingleQuotes(trimmedBody)}'`);
  }
  return parts.join(" \\\n  ");
}
