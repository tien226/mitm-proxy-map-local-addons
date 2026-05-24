import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFlowsSnapshot } from "../api/client";
import { areConnectedClientsEqual, mergeConnectedClients } from "../utils/connectedClients";
import { extractAllClientsFromFlows } from "../utils/knownDevices";
import { applyFlowsSnapshot } from "../utils/flowMerge";
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
  const pollGenerationRef = useRef<number>(0);
  const inFlightRef = useRef<boolean>(false);
  const isDocumentVisibleRef = useRef<boolean>(
    typeof document === "undefined" ? true : document.visibilityState === "visible"
  );

  const resetFlows = useCallback((): void => {
    versionRef.current = 0;
    setFlowsVersion(0);
    flowsRef.current = [];
    setFlows([]);
    setFlowsError(null);
    setPolledClients([]);
  }, []);

  const clearFlowsList = useCallback((): void => {
    versionRef.current = 0;
    setFlowsVersion(0);
    flowsRef.current = [];
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
      const pollGeneration = pollGenerationRef.current + 1;
      pollGenerationRef.current = pollGeneration;
      const sinceVersion = versionRef.current;
      try {
        const snapshot = await fetchFlowsSnapshot(sinceVersion);
        if (cancelled || pollGeneration !== pollGenerationRef.current) {
          return;
        }
        if (snapshot.version < versionRef.current) {
          versionRef.current = 0;
        }
        versionRef.current = snapshot.version;
        setFlowsVersion(snapshot.version);
        const snapshotClients = snapshot.connected_clients ?? [];
        const mergePolledClients = (flowList: MitmFlow[], previousClients: ConnectedClient[]): ConnectedClient[] => {
          const fromFlows = extractAllClientsFromFlows(flowList);
          return mergeConnectedClients(
            mergeConnectedClients(snapshotClients, fromFlows),
            previousClients
          );
        };
        if (snapshot.unchanged) {
          setPolledClients((previous) => {
            const merged = mergePolledClients(flowsRef.current, previous);
            return areConnectedClientsEqual(previous, merged) ? previous : merged;
          });
          setFlowsError(null);
          return;
        }
        const nextFlows = applyFlowsSnapshot(flowsRef.current, snapshot.flows, {
          partial: snapshot.partial,
          reset: snapshot.reset,
          removedFlowIds: snapshot.removed_flow_ids,
        });
        flowsRef.current = nextFlows;
        setFlows(nextFlows);
        setPolledClients((previousClients) => {
          const merged = mergePolledClients(nextFlows, previousClients);
          return areConnectedClientsEqual(previousClients, merged) ? previousClients : merged;
        });
        setFlowsError(null);
      } catch (loadError) {
        if (cancelled || pollGeneration !== pollGenerationRef.current) {
          return;
        }
        setFlows([]);
        flowsRef.current = [];
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
      pollGenerationRef.current += 1;
    };
  }, [isProxyRunning, activeSection, resetFlows]);

  return { flows, flowsError, flowsVersion, polledClients, resetFlows, clearFlowsList };

}
