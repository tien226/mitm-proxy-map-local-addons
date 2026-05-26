import type { MitmFlow } from "../types";

function flowEntrySignature(flow: MitmFlow): string {
  const statusCode = flow.response?.status_code ?? "";
  const duration = flow.duration_ms ?? "";
  const timestamp = flow.timestamp_created ?? "";
  return `${flow.id}:${statusCode}:${duration}:${timestamp}`;
}

export function mergeFlowLists(previous: MitmFlow[], next: MitmFlow[]): MitmFlow[] {
  if (previous.length === 0) {
    return next;
  }
  if (next.length === 0) {
    return previous;
  }
  const previousById = new Map<string, MitmFlow>();
  const previousSigs = new Map<string, string>();
  for (const flow of previous) {
    previousById.set(flow.id, flow);
    previousSigs.set(flow.id, flowEntrySignature(flow));
  }
  let allSame = previous.length === next.length;
  const merged: MitmFlow[] = [];
  for (let index = 0; index < next.length; index += 1) {
    const flow = next[index];
    const existing = previousById.get(flow.id);
    if (existing && previousSigs.get(flow.id) === flowEntrySignature(flow)) {
      merged.push(existing);
      if (allSame && (index >= previous.length || previous[index] !== existing)) {
        allSame = false;
      }
    } else {
      merged.push(flow);
      allSame = false;
    }
  }
  if (allSame) {
    return previous;
  }
  return merged;
}
