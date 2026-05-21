import type { MapLocalRule, MitmFlow, ProxyStatus } from "../types";

const API_BASE = import.meta.env.DEV ? "http://127.0.0.1:9876" : "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const rawMessage = await response.text();
    let message = rawMessage || `Request failed: ${response.status}`;
    try {
      const parsed = JSON.parse(rawMessage) as { detail?: string };
      if (parsed.detail) {
        message = parsed.detail;
      }
    } catch {
      // keep raw message
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function fetchProxyStatus(): Promise<ProxyStatus> {
  return request<ProxyStatus>("/api/proxy/status");
}

export async function startProxy(proxyPort: number, webPort: number): Promise<ProxyStatus> {
  return request<ProxyStatus>("/api/proxy/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proxy_port: proxyPort, web_port: webPort }),
  });
}

export async function stopProxy(): Promise<ProxyStatus> {
  return request<ProxyStatus>("/api/proxy/stop", { method: "POST" });
}

export async function fetchFlows(): Promise<MitmFlow[]> {
  return request<MitmFlow[]>("/api/flows");
}

export async function clearFlows(): Promise<void> {
  await request<{ status: string }>("/api/flows/clear", { method: "POST" });
}

export async function fetchFlowContent(
  flowId: string,
  message: "request" | "response"
): Promise<string> {
  const result = await request<{ content: string }>(`/api/flows/${flowId}/content/${message}`);
  return result.content;
}

export async function fetchRules(): Promise<MapLocalRule[]> {
  return request<MapLocalRule[]>("/api/map-local/rules");
}

export async function createRule(rule: MapLocalRule): Promise<MapLocalRule[]> {
  return request<MapLocalRule[]>("/api/map-local/rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rule),
  });
}

export async function updateRule(index: number, rule: MapLocalRule): Promise<MapLocalRule[]> {
  return request<MapLocalRule[]>(`/api/map-local/rules/${index}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rule),
  });
}

export async function deleteRule(index: number): Promise<MapLocalRule[]> {
  return request<MapLocalRule[]>(`/api/map-local/rules/${index}`, { method: "DELETE" });
}

export async function fetchLocalFiles(): Promise<string[]> {
  return request<string[]>("/api/map-local/files");
}

export async function readLocalFile(filename: string): Promise<string> {
  const result = await request<{ content: string }>(`/api/map-local/files/${filename}`);
  return result.content;
}

export async function writeLocalFile(filename: string, content: string): Promise<void> {
  await request(`/api/map-local/files/${filename}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}
