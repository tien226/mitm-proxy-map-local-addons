import { isFlowMappedByRules } from "./mapLocalMatch";
import type { MapLocalRule, MitmFlow } from "../types";

export function getFlowUrl(flow: MitmFlow): string {
  if (flow.request.pretty_url) {
    return flow.request.pretty_url;
  }
  const scheme = flow.request.scheme || "https";
  const host = flow.request.host || "";
  const port = flow.request.port;
  const path = flow.request.path || "/";
  let url = `${scheme}://${host}`;
  if (port && port !== 80 && port !== 443) {
    url = `${url}:${port}`;
  }
  return `${url}${path.startsWith("/") ? path : `/${path}`}`;
}

export function isMapLocalFlow(flow: MitmFlow, mapLocalRules: MapLocalRule[] = []): boolean {
  if (mapLocalRules.length === 0) {
    return false;
  }
  return isFlowMappedByRules(flow, mapLocalRules);
}

export function getFlowDurationMs(flow: MitmFlow): number | undefined {
  if (flow.duration_ms !== undefined) {
    return flow.duration_ms;
  }
  const request = flow.request as MitmFlow["request"] & {
    timestamp_start?: number;
  };
  const response = flow.response as
    | (NonNullable<MitmFlow["response"]> & { timestamp_end?: number })
    | null
    | undefined;
  if (response === null || response === undefined) {
    return undefined;
  }
  const requestStart = request.timestamp_start;
  const responseEnd = response.timestamp_end;
  if (requestStart === undefined || responseEnd === undefined) {
    return undefined;
  }
  return (responseEnd - requestStart) * 1000;
}
