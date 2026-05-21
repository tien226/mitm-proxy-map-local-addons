import { useEffect, useMemo, useState } from "react";
import { fetchFlowContent } from "../api/client";
import { FlowInspector } from "./FlowInspector";
import { ResizableHorizontalSplit } from "./ResizableHorizontalSplit";
import { ResizableVerticalSplit } from "./ResizableVerticalSplit";
import { TrafficListTable } from "./TrafficListTable";
import { TrafficTreeView } from "./TrafficTreeView";
import { getFlowUrl } from "../utils/flow";
import {
  buildFlowTree,
  collectFlowsUnderNode,
  filterFlowTree,
  findTreeNode,
} from "../utils/flowTree";
import { buildMapLocalSeed } from "../utils/mapLocal";
import type { MapLocalSeed, MitmFlow } from "../types";

interface TrafficPanelProps {
  flows: MitmFlow[];
  isProxyRunning: boolean;
  onMapLocal: (seed: MapLocalSeed) => void;
}

export function TrafficPanel({ flows, isProxyRunning, onMapLocal }: TrafficPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(null);
  const [tableListMode, setTableListMode] = useState<"scope" | "single">("scope");
  const [requestBody, setRequestBody] = useState<string>("");
  const [responseBody, setResponseBody] = useState<string>("");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    if (!isProxyRunning) {
      setSelectedId(null);
      setSelectedScopeId(null);
      setTableListMode("scope");
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

  const flowIdsKey = useMemo(() => flows.map((flow) => flow.id).join(","), [flows]);

  const treeNodes = useMemo(() => {
    const tree = buildFlowTree(flows);
    return filterFlowTree(tree, filter);
  }, [flowIdsKey, flows, filter]);

  const tableFlows = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const matchesFilter = (flow: MitmFlow): boolean =>
      !query || getFlowUrl(flow).toLowerCase().includes(query);
    if (tableListMode === "single" && selectedId) {
      const selected = flows.find((flow) => flow.id === selectedId);
      if (selected && matchesFilter(selected)) {
        return [selected];
      }
      return [];
    }
    let baseFlows = flows;
    if (selectedScopeId) {
      const scopeNode = findTreeNode(treeNodes, selectedScopeId);
      if (scopeNode) {
        baseFlows = collectFlowsUnderNode(scopeNode);
      }
    }
    return baseFlows.filter(matchesFilter);
  }, [flows, filter, selectedScopeId, selectedId, tableListMode, treeNodes]);

  const selectedFlow = flows.find((flow) => flow.id === selectedId) ?? null;

  const handleSelectScope = (nodeId: string): void => {
    setSelectedScopeId(nodeId);
    setSelectedId(null);
    setTableListMode("scope");
  };

  const handleSelectFlowFromTree = (flowId: string): void => {
    setSelectedId(flowId);
    setTableListMode("single");
  };

  const handleSelectFlowFromTable = (flowId: string): void => {
    setSelectedId(flowId);
  };

  if (!isProxyRunning) {
    return (
      <div className="traffic-main-empty">
        <div className="empty">Start proxy to capture traffic from your device.</div>
      </div>
    );
  }

  const treePane = (
    <div className="traffic-tree-pane">
      <div className="traffic-pane-header">
        <span className="traffic-pane-title">Structure</span>
      </div>
      <div className="traffic-tree-scroll">
        <TrafficTreeView
          nodes={treeNodes}
          selectedFlowId={selectedId}
          selectedScopeId={selectedScopeId}
          onSelectScope={handleSelectScope}
          onSelectFlow={handleSelectFlowFromTree}
        />
      </div>
    </div>
  );

  const listPane = (
    <div className="traffic-list-pane">
      <div className="filter-bar">
        <input
          placeholder="Filter URL..."
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <span className="traffic-count-label">{tableFlows.length} requests</span>
      </div>
      <div className="traffic-table-wrap">
        <TrafficListTable
          flows={tableFlows}
          selectedId={selectedId}
          onSelectFlow={handleSelectFlowFromTable}
        />
      </div>
      {selectedFlow && (
        <div className="traffic-status-bar">
          <span className={`traffic-status-method method-${selectedFlow.request.method}`}>
            {selectedFlow.request.method}
          </span>
          <span className="traffic-status-code">{selectedFlow.response?.status_code ?? "—"}</span>
          <span className="traffic-status-url">{getFlowUrl(selectedFlow)}</span>
        </div>
      )}
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

  const rightPane = (
    <ResizableVerticalSplit
      top={listPane}
      bottom={inspectorPane}
      initialTopPercent={48}
      storageKey="tft-proxy-traffic-detail-split"
    />
  );

  return (
    <div className="traffic-main">
      <ResizableHorizontalSplit
        left={treePane}
        right={rightPane}
        initialLeftPercent={28}
        minLeftPercent={18}
        maxLeftPercent={45}
        storageKey="tft-proxy-traffic-tree-split"
      />
    </div>
  );
}
