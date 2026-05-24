import type { ConnectedClient, MitmFlow } from "../types";
import { areConnectedClientsEqual, mergeConnectedClients } from "./connectedClients";

const STORAGE_KEY = "tft-proxy-known-devices";

export function extractAllClientsFromFlows(flows: MitmFlow[]): ConnectedClient[] {
  const byIp = new Map<string, number>();
  const now = Date.now() / 1000;
  for (const flow of flows) {
    const peername = flow.client_conn?.peername;
    if (!peername || peername[0] === undefined || peername[0] === null) {
      continue;
    }
    const ip = String(peername[0]);
    if (!ip) {
      continue;
    }
    const seenAt = flow.timestamp_created ?? now;
    const previous = byIp.get(ip);
    if (previous === undefined || seenAt > previous) {
      byIp.set(ip, seenAt);
    }
  }
  return Array.from(byIp.entries())
    .map(([ip, last_seen]) => ({ ip, last_seen }))
    .sort((left, right) => right.last_seen - left.last_seen);
}

export function loadKnownDevices(): ConnectedClient[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as ConnectedClient[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (entry) => typeof entry?.ip === "string" && typeof entry?.last_seen === "number"
    );
  } catch {
    return [];
  }
}

export function saveKnownDevices(clients: ConnectedClient[]): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
}

export function rememberKnownDevices(...sources: ConnectedClient[][]): ConnectedClient[] {
  let merged: ConnectedClient[] = loadKnownDevices();
  for (const source of sources) {
    merged = mergeConnectedClients(merged, source);
  }
  if (!areConnectedClientsEqual(loadKnownDevices(), merged)) {
    saveKnownDevices(merged);
  }
  return merged;
}
