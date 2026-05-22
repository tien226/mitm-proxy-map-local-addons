import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFlowsSnapshot } from "../api/client";
import {
  areConnectedClientsEqual,
  extractClientsFromFlows,
  mergeConnectedClients,
} from "../utils/connectedClients";
import { mergeFlowLists } from "../utils/flowMerge";
import type { AppSection, ConnectedClient, MitmFlow } from "../types";

const POLL_ACTIVE_MS = 1200;
const POLL_IDLE_MS = 5000;

interface UseFlowsPollingResult {
  flows: MitmFlow[];
  flowsError: string | null;
  flowsVersion: number;
  polledClients: ConnectedClient[];
  resetFlows: () => void;
}

export function useFlowsPolling(
  isProxyRunning: boolean,
  activeSection: AppSection
): UseFlowsPollingResult {
  const [flows, setFlows] = useState<MitmFlow[]>([]);
  const [flowsError, setFlowsError] = useState<string | null>(null);
  const [flowsVersion, setFlowsVersion] = useState<number>(0);
  const [polledClients, setPolledClients] = useState<ConnectedClient[]>([]);
  const versionRef = useRef<number>(0);
  const flowsRef = useRef<MitmFlow[]>([]);
  const inFlightRef = useRef<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);

  const resetFlows = useCallback((): void => {
    versionRef.current = 0;
    setFlowsVersion(0);
    flowsRef.current = [];
    setFlows([]);
    setFlowsError(null);
    setPolledClients([]);
  }, []);

  useEffect(() => {
    if (!isProxyRunning) {
      resetFlows();
      return;
    }
    let cancelled = false;
    const pollIntervalMs = activeSection === "traffic" ? POLL_ACTIVE_MS : POLL_IDLE_MS;

    const pollOnce = async (): Promise<void> => {
      if (inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const snapshot = await fetchFlowsSnapshot(versionRef.current, controller.signal);
        if (cancelled) {
          return;
        }
        versionRef.current = snapshot.version;
        setFlowsVersion(snapshot.version);
        if (snapshot.unchanged) {
          const mergedClients = mergeConnectedClients(
            snapshot.connected_clients ?? [],
            extractClientsFromFlows(flowsRef.current)
          );
          setPolledClients((previous) =>
            areConnectedClientsEqual(previous, mergedClients) ? previous : mergedClients
          );
          setFlowsError(null);
          return;
        }
        setFlows((previous) => {
          const nextFlows = mergeFlowLists(previous, snapshot.flows);
          flowsRef.current = nextFlows;
          const mergedClients = mergeConnectedClients(
            snapshot.connected_clients ?? [],
            extractClientsFromFlows(nextFlows)
          );
          setPolledClients((previousClients) =>
            areConnectedClientsEqual(previousClients, mergedClients)
              ? previousClients
              : mergedClients
          );
          return nextFlows;
        });
        setFlowsError(null);
      } catch (loadError) {
        if (cancelled || (loadError instanceof DOMException && loadError.name === "AbortError")) {
          return;
        }
        setFlows([]);
        const message = loadError instanceof Error ? loadError.message : "Failed to load flows";
        setFlowsError(message);
      } finally {
        inFlightRef.current = false;
      }
    };

    pollOnce();
    const intervalId = window.setInterval(pollOnce, pollIntervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      abortRef.current?.abort();
      inFlightRef.current = false;
    };
  }, [isProxyRunning, activeSection, resetFlows]);

  return { flows, flowsError, flowsVersion, polledClients, resetFlows };
}
