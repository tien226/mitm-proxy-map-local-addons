import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearFlows, fetchProxyStatus, startProxy, stopProxy } from "./api/client";
import { useFlowsPolling } from "./hooks/useFlowsPolling";
import { AppSidebar } from "./components/AppSidebar";
import { MapLocalPanel } from "./components/MapLocalPanel";
import { SetupPanel } from "./components/SetupPanel";
import { Toolbar } from "./components/Toolbar";
import { TrafficPanel } from "./components/TrafficPanel";
import { ResizableHorizontalSplit } from "./components/ResizableHorizontalSplit";
import { areConnectedClientsEqual, mergeConnectedClients } from "./utils/connectedClients";
import type { AppSection, ConnectedClient, MapLocalSeed, ProxyStatus } from "./types";

const DEFAULT_STATUS: ProxyStatus = {
  is_running: false,
  proxy_port: 8080,
  web_port: 8081,
  pid: null,
  local_ip: "127.0.0.1",
  emulator_host: "10.0.2.2",
};

export default function App() {
  const [activeSection, setActiveSection] = useState<AppSection>("traffic");
  const [status, setStatus] = useState<ProxyStatus>(DEFAULT_STATUS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mapLocalSeed, setMapLocalSeed] = useState<MapLocalSeed | null>(null);
  const didAutoStartRef = useRef<boolean>(false);
  const { flows, flowsError, polledClients, resetFlows } = useFlowsPolling(
    status.is_running,
    activeSection
  );
  const connectedClientsRef = useRef<ConnectedClient[]>([]);
  const connectedClients = useMemo((): ConnectedClient[] => {
    const merged = mergeConnectedClients(status.connected_clients, polledClients);
    if (areConnectedClientsEqual(connectedClientsRef.current, merged)) {
      return connectedClientsRef.current;
    }
    connectedClientsRef.current = merged;
    return merged;
  }, [status.connected_clients, polledClients]);

  const handleMapLocalFromTraffic = useCallback((seed: MapLocalSeed): void => {
    setMapLocalSeed(seed);
    setActiveSection("map-local");
  }, []);

  const refreshStatus = useCallback(async (): Promise<void> => {
    const proxyStatus = await fetchProxyStatus();
    setStatus(proxyStatus);
  }, []);

  const ensureProxyRunning = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const currentStatus = await fetchProxyStatus();
      if (currentStatus.is_running) {
        setStatus(currentStatus);
        return;
      }
      const startedStatus = await startProxy(currentStatus.proxy_port, currentStatus.web_port);
      setStatus(startedStatus);
      if (!startedStatus.is_running) {
        setError(startedStatus.error ?? "Failed to start proxy");
      }
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : "Failed to start proxy";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (didAutoStartRef.current) {
      return;
    }
    didAutoStartRef.current = true;
    ensureProxyRunning();
    return () => {
      stopProxy().catch(() => undefined);
    };
  }, [ensureProxyRunning]);

  useEffect(() => {
    refreshStatus().catch(() => undefined);
    const statusIntervalId = window.setInterval(() => {
      refreshStatus().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(statusIntervalId);
  }, [refreshStatus]);

  const handleClearFlows = async (): Promise<void> => {
    if (!status.is_running || flows.length === 0) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await clearFlows();
      resetFlows();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Failed to clear list");
    } finally {
      setIsLoading(false);
    }
  };

  const sidebar = (
    <AppSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
  );

  const mainPanels = (
    <div className="main-panels">
      <div
        className={`main-panel-slot main-panel-right ${activeSection === "traffic" ? "is-active" : ""}`}
        aria-hidden={activeSection !== "traffic"}
      >
        <TrafficPanel
          flows={flows}
          flowsError={flowsError}
          isProxyRunning={status.is_running}
          isProxyStarting={isLoading && !status.is_running}
          onMapLocal={handleMapLocalFromTraffic}
        />
      </div>
      <div
        className={`main-panel-slot main-panel-right ${activeSection === "map-local" ? "is-active" : ""}`}
        aria-hidden={activeSection !== "map-local"}
      >
        <MapLocalPanel seed={mapLocalSeed} onSeedConsumed={() => setMapLocalSeed(null)} />
      </div>
      <div
        className={`main-panel-slot main-panel-right ${activeSection === "setup" ? "is-active" : ""}`}
        aria-hidden={activeSection !== "setup"}
      >
        <SetupPanel status={status} connectedClients={connectedClients} />
      </div>
    </div>
  );

  return (
    <div className="app">
      <Toolbar
        status={status}
        connectedClients={connectedClients}
        isLoading={isLoading}
        onClearFlows={handleClearFlows}
      />
      {error && <div className="error-banner">{error}</div>}
      <div className="app-body">
        <ResizableHorizontalSplit
          left={sidebar}
          right={mainPanels}
          initialLeftPercent={14}
          minLeftPercent={12}
          maxLeftPercent={22}
          storageKey="tft-proxy-sidebar-split"
        />
      </div>
    </div>
  );
}
