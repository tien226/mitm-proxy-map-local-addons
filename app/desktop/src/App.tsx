import { useCallback, useEffect, useRef, useState } from "react";
import { clearFlows, ensureProxy, fetchProxyStatus, fetchRules, stopProxy } from "./api/client";
import { useFlowsPolling } from "./hooks/useFlowsPolling";
import { AppSidebar } from "./components/AppSidebar";
import { MapLocalPanel } from "./components/MapLocalPanel";
import { SetupPanel } from "./components/SetupPanel";
import { Toolbar } from "./components/Toolbar";
import { TrafficPanel } from "./components/TrafficPanel";
import { ResizableHorizontalSplit } from "./components/ResizableHorizontalSplit";
import { mergeConnectedClients } from "./utils/connectedClients";
import { useKnownDeviceClients } from "./hooks/useKnownDeviceClients";
import type { AppSection, MapLocalRule, MapLocalSeed, ProxyStatus } from "./types";

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
  const [mapLocalRules, setMapLocalRules] = useState<MapLocalRule[]>([]);
  const [trafficListResetKey, setTrafficListResetKey] = useState<number>(0);
  const didAutoStartRef = useRef<boolean>(false);
  const { flows, flowsError, polledClients, resetFlows, clearFlowsList } = useFlowsPolling(
    status.is_running,
    activeSection
  );
  const resetFlowsRef = useRef(resetFlows);
  resetFlowsRef.current = resetFlows;
  const { knownDeviceClients, snapshotDevicesBeforeClear } = useKnownDeviceClients(
    status.connected_clients,
    polledClients
  );
  const connectedClients = knownDeviceClients;

  const refreshMapLocalRules = useCallback(async (): Promise<void> => {
    try {
      const rules = await fetchRules();
      setMapLocalRules((previous) => {
        const previousKey = previous.map((rule) => `${rule.method}|${rule.url}`).join("\n");
        const nextKey = rules.map((rule) => `${rule.method}|${rule.url}`).join("\n");
        if (previousKey === nextKey && previous.length === rules.length) {
          return previous;
        }
        return rules;
      });
    } catch {
      setMapLocalRules([]);
    }
  }, []);

  const handleMapLocalFromTraffic = useCallback((seed: MapLocalSeed): void => {
    setMapLocalSeed(seed);
    setActiveSection("map-local");
  }, []);

  const handleMapLocalRulesChanged = useCallback((): void => {
    refreshMapLocalRules().catch(() => undefined);
  }, [refreshMapLocalRules]);

  const refreshStatus = useCallback(async (): Promise<void> => {
    const proxyStatus = await fetchProxyStatus();
    setStatus(proxyStatus);
  }, []);

  const ensureProxyRunning = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const proxyStatus = await ensureProxy(DEFAULT_STATUS.proxy_port, DEFAULT_STATUS.web_port);
      setStatus(proxyStatus);
      if (proxyStatus.reused_existing) {
        resetFlowsRef.current();
        setTrafficListResetKey((value) => value + 1);
      }
      if (!proxyStatus.is_running) {
        setError(proxyStatus.error ?? "Failed to start proxy");
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
    refreshMapLocalRules().catch(() => undefined);
    const statusIntervalId = window.setInterval(() => {
      refreshStatus().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(statusIntervalId);
  }, [refreshStatus, refreshMapLocalRules]);

  useEffect(() => {
    if (activeSection === "traffic") {
      refreshMapLocalRules().catch(() => undefined);
    }
  }, [activeSection, refreshMapLocalRules]);

  const handleClearFlows = async (): Promise<void> => {
    if (!status.is_running || flows.length === 0) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const liveClients = mergeConnectedClients(status.connected_clients, polledClients);
      snapshotDevicesBeforeClear(flows, liveClients);
      await clearFlows();
      clearFlowsList();
      setTrafficListResetKey((value) => value + 1);
      await refreshStatus();
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
          mapLocalRules={mapLocalRules}
          knownDeviceClients={knownDeviceClients}
          listResetKey={trafficListResetKey}
          isProxyRunning={status.is_running}
          isProxyStarting={isLoading && !status.is_running}
          onMapLocal={handleMapLocalFromTraffic}
        />
      </div>
      <div
        className={`main-panel-slot main-panel-right ${activeSection === "map-local" ? "is-active" : ""}`}
        aria-hidden={activeSection !== "map-local"}
      >
        <MapLocalPanel
          seed={mapLocalSeed}
          onSeedConsumed={() => setMapLocalSeed(null)}
          onRulesChanged={handleMapLocalRulesChanged}
        />
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
