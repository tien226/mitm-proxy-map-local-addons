import { useCallback, useEffect, useState } from "react";
import { clearFlows, fetchFlows, fetchProxyStatus, startProxy, stopProxy } from "./api/client";
import { AppSidebar } from "./components/AppSidebar";
import { MapLocalPanel } from "./components/MapLocalPanel";
import { SetupPanel } from "./components/SetupPanel";
import { Toolbar } from "./components/Toolbar";
import { TrafficPanel } from "./components/TrafficPanel";
import { ResizableHorizontalSplit } from "./components/ResizableHorizontalSplit";
import { buildDomainGroups } from "./utils/domains";
import type { AppSection, MapLocalSeed, MitmFlow, ProxyStatus } from "./types";

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
  const [flows, setFlows] = useState<MitmFlow[]>([]);
  const [selectedHost, setSelectedHost] = useState<string | null>(null);

  const handleMapLocalFromTraffic = (seed: MapLocalSeed): void => {
    setMapLocalSeed(seed);
    setActiveSection("map-local");
  };

  const refreshStatus = useCallback(async (): Promise<void> => {
    const proxyStatus = await fetchProxyStatus();
    setStatus(proxyStatus);
  }, []);

  useEffect(() => {
    refreshStatus().catch((statusError: Error) => setError(statusError.message));
  }, [refreshStatus]);

  useEffect(() => {
    if (!status.is_running) {
      setFlows([]);
      return;
    }
    const loadFlows = async (): Promise<void> => {
      try {
        const data = await fetchFlows();
        setFlows(data);
      } catch {
        setFlows([]);
      }
    };
    loadFlows();
    const intervalId = window.setInterval(loadFlows, 3000);
    return () => window.clearInterval(intervalId);
  }, [status.is_running]);

  const domains = buildDomainGroups(flows);

  const handleStart = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const proxyStatus = await startProxy(status.proxy_port, status.web_port);
      setStatus(proxyStatus);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Failed to start proxy");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearFlows = async (): Promise<void> => {
    if (!status.is_running || flows.length === 0) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await clearFlows();
      setFlows([]);
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Failed to clear list");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const proxyStatus = await stopProxy();
      setStatus(proxyStatus);
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : "Failed to stop proxy");
    } finally {
      setIsLoading(false);
    }
  };

  const mainContent = (): JSX.Element => {
    if (activeSection === "map-local") {
      return (
        <div className="main-panel-right">
          <MapLocalPanel seed={mapLocalSeed} onSeedConsumed={() => setMapLocalSeed(null)} />
        </div>
      );
    }
    if (activeSection === "setup") {
      return (
        <div className="main-panel-right">
          <SetupPanel status={status} />
        </div>
      );
    }
    return (
      <TrafficPanel
        flows={flows}
        isProxyRunning={status.is_running}
        onMapLocal={handleMapLocalFromTraffic}
        selectedHost={selectedHost}
      />
    );
  };

  const sidebar = (
    <AppSidebar
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      domains={domains}
      selectedHost={selectedHost}
      onSelectHost={setSelectedHost}
      totalFlowCount={flows.length}
      localIp={status.local_ip}
      proxyPort={status.proxy_port}
      emulatorHost={status.emulator_host}
    />
  );

  return (
    <div className="app">
      <Toolbar
        status={status}
        isLoading={isLoading}
        onStart={handleStart}
        onStop={handleStop}
        onClearFlows={handleClearFlows}
      />
      {error && <div className="error-banner">{error}</div>}
      <div className="app-body">
        <ResizableHorizontalSplit
          left={sidebar}
          right={mainContent()}
          initialLeftPercent={22}
          minLeftPercent={16}
          maxLeftPercent={40}
          storageKey="tft-proxy-sidebar-split"
        />
      </div>
    </div>
  );
}
