export type TabId = "traffic" | "map-local" | "setup";
export type AppSection = TabId;

export interface ConnectedClient {
  ip: string;
  last_seen: number;
}

export interface ProxyStatus {
  is_running: boolean;
  proxy_port: number;
  web_port: number;
  pid: number | null;
  local_ip: string;
  emulator_host: string;
  connected_clients?: ConnectedClient[];
  error?: string;
}

export interface MapLocalRule {
  method: string;
  url: string;
  local_file: string;
  status_code: number;
  delay_ms: number;
}

export interface MapLocalSeed {
  rule: MapLocalRule;
  content: string;
}

export interface MitmFlow {
  id: string;
  timestamp_created?: number;
  duration_ms?: number;
  client_conn?: {
    peername?: [string, number];
  };
  request: {
    method: string;
    scheme?: string;
    host?: string;
    port?: number;
    path?: string;
    pretty_url?: string;
    headers: Array<[string, string]>;
    content?: string | null;
  };
  response?: {
    status_code: number;
    reason?: string;
    headers: Array<[string, string]>;
    contentLength?: number;
    content?: string | null;
  } | null;
  metadata?: Record<string, string>;
}
