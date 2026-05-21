import type { MitmFlow } from "../types";

export interface DomainGroup {
  host: string;
  count: number;
}

export function buildDomainGroups(flows: MitmFlow[]): DomainGroup[] {
  const countMap = new Map<string, number>();
  flows.forEach((flow) => {
    const host = flow.request.host || "unknown";
    countMap.set(host, (countMap.get(host) ?? 0) + 1);
  });
  return Array.from(countMap.entries())
    .map(([host, count]) => ({ host, count }))
    .sort((left, right) => left.host.localeCompare(right.host));
}

export function filterFlowsByHost(flows: MitmFlow[], host: string | null): MitmFlow[] {
  if (host === null) {
    return flows;
  }
  return flows.filter((flow) => (flow.request.host || "unknown") === host);
}
