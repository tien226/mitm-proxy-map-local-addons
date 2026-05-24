import type { MitmFlow } from "../types";

function flowEntrySignature(flow: MitmFlow): string {
  const statusCode = flow.response?.status_code ?? "";
  const duration = flow.duration_ms ?? "";
  const timestamp = flow.timestamp_created ?? "";
  return `${flow.id}:${statusCode}:${duration}:${timestamp}`;
}

function flowListSignature(flows: MitmFlow[]): string {
  return flows.map((flow) => flowEntrySignature(flow)).join("|");
}

export function areFlowListsEqual(left: MitmFlow[], right: MitmFlow[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return flowListSignature(left) === flowListSignature(right);
}

export interface ApplyFlowsSnapshotOptions {
  partial?: boolean;
  reset?: boolean;
  removedFlowIds?: string[];
}

function mergePartialFlowDelta(previous: MitmFlow[], delta: MitmFlow[]): MitmFlow[] {
  if (delta.length === 0) {
    return previous;
  }
  const updatesById = new Map<string, MitmFlow>();
  for (const flow of delta) {
    updatesById.set(flow.id, flow);
  }
  const existingIds = new Set<string>();
  const merged: MitmFlow[] = [];
  for (const flow of previous) {
    existingIds.add(flow.id);
    const updated = updatesById.get(flow.id);
    if (updated) {
      const existing = flow;
      merged.push(areFlowListsEqual([existing], [updated]) ? existing : updated);
      updatesById.delete(flow.id);
    } else {
      merged.push(flow);
    }
  }
  for (const flow of delta) {
    if (!existingIds.has(flow.id)) {
      merged.push(flow);
    }
  }
  if (areFlowListsEqual(previous, merged)) {
    return previous;
  }
  return merged;
}

export function applyFlowsSnapshot(
  previous: MitmFlow[],
  incoming: MitmFlow[],
  options: ApplyFlowsSnapshotOptions
): MitmFlow[] {
  if (options.reset) {
    return incoming;
  }
  let base = previous;
  if (options.removedFlowIds && options.removedFlowIds.length > 0) {
    const removedIds = new Set(options.removedFlowIds);
    base = previous.filter((flow) => !removedIds.has(flow.id));
  }
  if (incoming.length === 0) {
    return base;
  }
  if (options.partial) {
    return mergePartialFlowDelta(base, incoming);
  }
  if (areFlowListsEqual(base, incoming)) {
    return base;
  }
  return incoming;
}

export function mergeFlowLists(previous: MitmFlow[], next: MitmFlow[]): MitmFlow[] {
  if (areFlowListsEqual(previous, next)) {
    return previous;
  }
  if (previous.length === 0) {
    return next;
  }
  return mergePartialFlowDelta(previous, next);
}
