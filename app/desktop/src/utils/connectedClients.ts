import type { ConnectedClient, MitmFlow, ProxyStatus } from "../types";

function getClientIpFromFlow(flow: MitmFlow): string | null {
  const peername = flow.client_conn?.peername;
  if (peername && peername.length > 0) {
    const ip = peername[0];
    if (ip && ip !== "127.0.0.1" && ip !== "::1") {
      return ip;
    }
  }
  return null;
}

export function extractClientsFromFlows(flows: MitmFlow[]): ConnectedClient[] {
  const byIp = new Map<string, number>();
  const now = Date.now() / 1000;
  for (const flow of flows) {
    const ip = getClientIpFromFlow(flow);
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

export function mergeConnectedClients(
  fromStatus: ConnectedClient[] | undefined,
  fromFlows: ConnectedClient[]
): ConnectedClient[] {
  const byIp = new Map<string, number>();
  for (const client of fromStatus ?? []) {
    byIp.set(client.ip, client.last_seen);
  }
  for (const client of fromFlows) {
    const previous = byIp.get(client.ip);
    if (previous === undefined || client.last_seen > previous) {
      byIp.set(client.ip, client.last_seen);
    }
  }
  return Array.from(byIp.entries())
    .map(([ip, last_seen]) => ({ ip, last_seen }))
    .sort((left, right) => right.last_seen - left.last_seen);
}

export function getPrimaryConnectedClient(clients: ConnectedClient[]): ConnectedClient | null {
  if (clients.length === 0) {
    return null;
  }
  const emulatorGateway = "10.0.2.2";
  const physical = clients.find(
    (client) => client.ip !== emulatorGateway && !client.ip.startsWith("127.")
  );
  return physical ?? clients[0];
}

export function areConnectedClientsEqual(
  left: ConnectedClient[],
  right: ConnectedClient[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index].ip !== right[index].ip || left[index].last_seen !== right[index].last_seen) {
      return false;
    }
  }
  return true;
}

export function formatConnectedClientsLabel(status: ProxyStatus, clients: ConnectedClient[]): string {
  const primary = getPrimaryConnectedClient(clients);
  if (primary) {
    return primary.ip;
  }
  if (status.is_running && status.local_ip && status.local_ip !== "127.0.0.1") {
    return `waiting… (proxy ${status.local_ip}:${status.proxy_port})`;
  }
  return "no device yet";
}
