import type { MitmFlow } from "../types";

function flowListSignature(flows: MitmFlow[]): string {
  return flows
    .map((flow) => {
      const statusCode = flow.response?.status_code ?? "";
      const duration = flow.duration_ms ?? "";
      const timestamp = flow.timestamp_created ?? "";
      return `${flow.id}:${statusCode}:${duration}:${timestamp}`;
    })
    .join("|");
}

export function areFlowListsEqual(left: MitmFlow[], right: MitmFlow[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return flowListSignature(left) === flowListSignature(right);
}

export function mergeFlowLists(previous: MitmFlow[], next: MitmFlow[]): MitmFlow[] {
  if (areFlowListsEqual(previous, next)) {
    return previous;
  }
  if (previous.length === 0) {
    return next;
  }
  const previousById = new Map<string, MitmFlow>();
  for (const flow of previous) {
    previousById.set(flow.id, flow);
  }
  const merged: MitmFlow[] = [];
  let reusedCount = 0;
  for (const flow of next) {
    const existing = previousById.get(flow.id);
    if (existing && areFlowListsEqual([existing], [flow])) {
      merged.push(existing);
      reusedCount += 1;
    } else {
      merged.push(flow);
    }
  }
  if (reusedCount === next.length && merged.length === previous.length) {
    let sameOrder = true;
    for (let index = 0; index < merged.length; index += 1) {
      if (merged[index] !== previous[index]) {
        sameOrder = false;
        break;
      }
    }
    if (sameOrder) {
      return previous;
    }
  }
  return merged;
}
