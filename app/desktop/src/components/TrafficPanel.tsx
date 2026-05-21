import { useEffect, useMemo, useState } from "react";
import { fetchFlowContent } from "../api/client";
import { FlowInspector } from "./FlowInspector";
import { ResizableVerticalSplit } from "./ResizableVerticalSplit";
import { TrafficListTable } from "./TrafficListTable";
import { getFlowUrl } from "../utils/flow";
import { filterFlowsByHost } from "../utils/domains";
import { buildMapLocalSeed } from "../utils/mapLocal";
import type { MapLocalSeed, MitmFlow } from "../types";

interface TrafficPanelProps {
  flows: MitmFlow[];
  isProxyRunning: boolean;
  onMapLocal: (seed: MapLocalSeed) => void;
  selectedHost: string | null;
}

export function TrafficPanel({
  flows,
  isProxyRunning,
  onMapLocal,
  selectedHost,
}: TrafficPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requestBody, setRequestBody] = useState<string>("");
  const [responseBody, setResponseBody] = useState<string>("");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    if (!isProxyRunning) {
      setSelectedId(null);
      return;
    }
    if (selectedId && !flows.some((flow) => flow.id === selectedId)) {
      setSelectedId(null);
    }
  }, [isProxyRunning, flows, selectedId]);

  useEffect(() => {
    if (!selectedId || !isProxyRunning) {
      setRequestBody("");
      setResponseBody("");
      setDetailError(null);
      return;
    }
    const loadDetail = async (): Promise<void> => {
      setIsLoadingDetail(true);
      setDetailError(null);
      try {
        const [requestContent, responseContent] = await Promise.all([
          fetchFlowContent(selectedId, "request"),
          fetchFlowContent(selectedId, "response"),
        ]);
        setRequestBody(requestContent);
        setResponseBody(responseContent);
        if (!responseContent && !requestContent) {
          setDetailError("Body is empty. Try another request or reload the flow list.");
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to load body";
        setDetailError(message);
        setRequestBody("");
        setResponseBody("");
      } finally {
        setIsLoadingDetail(false);
      }
    };
    loadDetail();
  }, [selectedId, isProxyRunning]);

  const filteredFlows = useMemo(() => {
    const byHost = filterFlowsByHost(flows, selectedHost);
    const query = filter.trim().toLowerCase();
    if (!query) {
      return byHost;
    }
    return byHost.filter((flow) => getFlowUrl(flow).toLowerCase().includes(query));
  }, [flows, filter, selectedHost]);

  const selectedFlow = flows.find((flow) => flow.id === selectedId) ?? null;

  if (!isProxyRunning) {
    return (
      <div className="traffic-main-empty">
        <div className="empty">Start proxy to capture traffic from your device.</div>
      </div>
    );
  }

  const listPane = (
    <div className="traffic-list-pane">
      <div className="filter-bar">
        <input
          placeholder="Filter URL..."
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <span className="traffic-count-label">{filteredFlows.length} requests</span>
      </div>
      <div className="traffic-table-wrap">
        <TrafficListTable
          flows={filteredFlows}
          selectedId={selectedId}
          onSelectFlow={setSelectedId}
        />
      </div>
    </div>
  );

  const inspectorPane = (
    <div className="traffic-inspector">
      {selectedFlow ? (
        <FlowInspector
          flow={selectedFlow}
          requestBody={requestBody}
          responseBody={responseBody}
          isLoading={isLoadingDetail}
          loadError={detailError}
          onMapLocal={() => onMapLocal(buildMapLocalSeed(selectedFlow, responseBody))}
        />
      ) : (
        <div className="empty">Select a request to inspect headers and body</div>
      )}
    </div>
  );

  return (
    <div className="traffic-main">
      <ResizableVerticalSplit
        top={listPane}
        bottom={inspectorPane}
        initialTopPercent={42}
        storageKey="tft-proxy-traffic-split"
      />
    </div>
  );
}
