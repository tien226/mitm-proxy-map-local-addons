import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { areConnectedClientsEqual, mergeConnectedClients } from "../utils/connectedClients";
import {
  extractAllClientsFromFlows,
  loadKnownDevices,
  rememberKnownDevices,
} from "../utils/knownDevices";
import type { ConnectedClient, MitmFlow } from "../types";

interface UseKnownDeviceClientsResult {
  knownDeviceClients: ConnectedClient[];
  rememberFromSources: (...sources: ConnectedClient[][]) => void;
  snapshotDevicesBeforeClear: (flows: MitmFlow[], liveClients: ConnectedClient[]) => void;
}

export function useKnownDeviceClients(
  statusClients: ConnectedClient[] | undefined,
  polledClients: ConnectedClient[]
): UseKnownDeviceClientsResult {
  const [knownTick, setKnownTick] = useState<number>(0);
  const knownRef = useRef<ConnectedClient[]>(loadKnownDevices());

  const rememberFromSources = useCallback((...sources: ConnectedClient[][]): void => {
    const merged = rememberKnownDevices(...sources);
    if (!areConnectedClientsEqual(knownRef.current, merged)) {
      knownRef.current = merged;
      setKnownTick((value) => value + 1);
    }
  }, []);

  useEffect(() => {
    const liveClients = mergeConnectedClients(statusClients, polledClients);
    if (liveClients.length === 0) {
      return;
    }
    rememberFromSources(liveClients);
  }, [statusClients, polledClients, rememberFromSources]);

  const snapshotDevicesBeforeClear = useCallback(
    (flows: MitmFlow[], liveClients: ConnectedClient[]): void => {
      const fromFlows = extractAllClientsFromFlows(flows);
      rememberFromSources(liveClients, fromFlows);
    },
    [rememberFromSources]
  );

  const knownDeviceClients = useMemo((): ConnectedClient[] => {
    const liveClients = mergeConnectedClients(statusClients, polledClients);
    return mergeConnectedClients(knownRef.current, liveClients);
  }, [statusClients, polledClients, knownTick]);

  return { knownDeviceClients, rememberFromSources, snapshotDevicesBeforeClear };
}
