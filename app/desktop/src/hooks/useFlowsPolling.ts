import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFlowsSnapshot } from "../api/client";
import { areConnectedClientsEqual, mergeConnectedClients } from "../utils/connectedClients";
import { extractAllClientsFromFlows } from "../utils/knownDevices";
import { mergeFlowLists } from "../utils/flowMerge";
import type { AppSection, ConnectedClient, MitmFlow } from "../types";

const POLL_ACTIVE_MS = 450;
const POLL_IDLE_MS = 2000;
const POLL_HIDDEN_MS = 4000;

interface UseFlowsPollingResult {
  flows: MitmFlow[];
  flowsError: string | null;
  flowsVersion: number;
  polledClients: ConnectedClient[];
  resetFlows: () => void;
  clearFlowsList: () => void;
}

function resolvePollIntervalMs(activeSection: AppSection, isDocumentVisible: boolean): number {
  if (!isDocumentVisible) {
    return POLL_HIDDEN_MS;
  }
  if (activeSection === "traffic") {
    return POLL_ACTIVE_MS;
  }
  return POLL_IDLE_MS;
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
  const isDocumentVisibleRef = useRef<boolean>(
    typeof document === "undefined" ? true : document.visibilityState === "visible"
  );

  const resetFlows = useCallback((): void => {
    versionRef.current = 0;
    flowsRef.current = [];
    setFlowsVersion(0);
    setFlows([]);
    setFlowsError(null);
    setPolledClients([]);
  }, []);

  const clearFlowsList = useCallback((): void => {
    versionRef.current = 0;
    flowsRef.current = [];
    setFlowsVersion(0);
    setFlows([]);
    setFlowsError(null);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const handleVisibilityChange = (): void => {
      isDocumentVisibleRef.current = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!isProxyRunning) {
      resetFlows();
      return;
    }
    let cancelled = false;

    const pollOnce = async (): Promise<void> => {
      if (inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;
      try {
        const snapshot = await fetchFlowsSnapshot(versionRef.current);
        if (cancelled) {
          return;
        }
        versionRef.current = snapshot.version;
        setFlowsVersion(snapshot.version);
        const snapshotClients = snapshot.connected_clients ?? [];
        if (snapshot.unchanged) {
          const fromFlows = extractAllClientsFromFlows(flowsRef.current);
          setPolledClients((previous) => {
            const merged = mergeConnectedClients(
              mergeConnectedClients(snapshotClients, fromFlows),
              previous
            );
            return areConnectedClientsEqual(previous, merged) ? previous : merged;
          });
          setFlowsError(null);
          return;
        }
        const nextFlows = mergeFlowLists(flowsRef.current, snapshot.flows);
        flowsRef.current = nextFlows;
        setFlows(nextFlows);
        const fromFlows = extractAllClientsFromFlows(nextFlows);
        setPolledClients((previousClients) => {
          const merged = mergeConnectedClients(
            mergeConnectedClients(snapshotClients, fromFlows),
            previousClients
          );
          return areConnectedClientsEqual(previousClients, merged) ? previousClients : merged;
        });
        setFlowsError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        const message = loadError instanceof Error ? loadError.message : "Failed to load flows";
        setFlowsError(message);
      } finally {
        inFlightRef.current = false;
      }
    };

    let timeoutId = 0;
    const scheduleNextPoll = (): void => {
      const delayMs = resolvePollIntervalMs(activeSection, isDocumentVisibleRef.current);
      timeoutId = window.setTimeout(async () => {
        await pollOnce();
        if (!cancelled) {
          scheduleNextPoll();
        }
      }, delayMs);
    };
    pollOnce();
    scheduleNextPoll();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isProxyRunning, activeSection, resetFlows]);

  return { flows, flowsError, flowsVersion, polledClients, resetFlows, clearFlowsList };
}
