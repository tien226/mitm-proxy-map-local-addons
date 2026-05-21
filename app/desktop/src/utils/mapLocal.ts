import { getFlowUrl } from "./flow";
import type { MapLocalSeed, MitmFlow } from "../types";

export function suggestLocalFileName(url: string): string {
  try {
    const parsed = new URL(url);
    const pathPart = parsed.pathname.replace(/^\//, "").replace(/\//g, "_");
    const baseName = pathPart || "mapped";
    const safeName = baseName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
    return `${safeName || "mapped"}.json`;
  } catch {
    return "mapped.json";
  }
}

export function formatJsonContent(raw: string): string {
  if (!raw.trim()) {
    return '{\n  "message": "Mapped from captured response"\n}\n';
  }
  try {
    return `${JSON.stringify(JSON.parse(raw), null, 2)}\n`;
  } catch {
    return raw;
  }
}

export function buildMapLocalSeed(
  flow: MitmFlow,
  responseBody: string
): MapLocalSeed {
  const url = getFlowUrl(flow);
  return {
    rule: {
      method: flow.request.method,
      url,
      local_file: suggestLocalFileName(url),
      status_code: flow.response?.status_code ?? 200,
      delay_ms: 0,
    },
    content: formatJsonContent(responseBody),
  };
}
