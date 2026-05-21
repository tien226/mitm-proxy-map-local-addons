export function formatDurationMs(durationMs: number | undefined): string {
  if (durationMs === undefined || Number.isNaN(durationMs)) {
    return "—";
  }
  if (durationMs < 1000) {
    return `${Math.round(durationMs)} ms`;
  }
  if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(2)} s`;
  }
  return `${(durationMs / 60000).toFixed(1)} min`;
}
