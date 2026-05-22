import type { MitmFlow } from "../types";

export function sortFlowsByTime(flows: MitmFlow[]): MitmFlow[] {
  return [...flows].sort((left, right) => {
    const leftTime = left.timestamp_created ?? 0;
    const rightTime = right.timestamp_created ?? 0;
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }
    return left.id.localeCompare(right.id);
  });
}
