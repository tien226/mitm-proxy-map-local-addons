import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFlowBodyCache } from "../hooks/useFlowBodyCache";
import { FlowInspector } from "./FlowInspector";
import { ResizableHorizontalSplit } from "./ResizableHorizontalSplit";
import { ResizableVerticalSplit } from "./ResizableVerticalSplit";
import { TrafficListTable } from "./TrafficListTable";
import { TrafficTreeView } from "./TrafficTreeView";
import { getFlowUrl } from "../utils/flow";
import { buildFlowTree, collectFlowsUnderNode, findTreeNode } from "../utils/flowTree";
import { buildMapLocalSeed } from "../utils/mapLocal";
import { sortFlowsByTime } from "../utils/sortFlows";
import type { MapLocalRule, MapLocalSeed, MitmFlow } from "../types";

interface TrafficPanelProps {
  flows: MitmFlow[];
  flowsError: string | null;
  mapLocalRules: MapLocalRule[];
  isProxyRunning: boolean;
  isProxyStarting: boolean;
  onMapLocal: (seed: MapLocalSeed) => void;
}

function TrafficPanelInner({
  flows,
  flowsError,
  mapLocalRules,
  isProxyRunning,
  isProxyStarting,
  onMapLocal,
}: TrafficPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(null);
  const [tableListMode, setTableListMode] = useState<"scope" | "single">("scope");
  const [isTableSelectionPrimary, setIsTableSelectionPrimary] = useState<boolean>(false);
  const [filter, setFilter] = useState<string>("");
  const { requestBody, responseBody, detailError, isLoadingDetail } = useFlowBodyCache(
    selectedId,
    isProxyRunning
  );

  useEffect(() => {
    if (!isProxyRunning) {
      setSelectedId(null);
      setSelectedScopeId(null);
      setTableListMode("scope");
      setIsTableSelectionPrimary(false);
      return;
    }
    if (selectedId && !flows.some((flow) => flow.id === selectedId)) {
      setSelectedId(null);
    }
  }, [isProxyRunning, flows, selectedId]);

  const flowIdsKey = useMemo(() => flows.map((flow) => flow.id).join(","), [flows]);

  const structureTreeNodes = useMemo(() => buildFlowTree(flows), [flowIdsKey, flows]);

  const tableFlowsCacheRef = useRef<{ signature: string; flows: MitmFlow[] }>({
    signature: "",
    flows: [],
  });
  const tableFlows = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const matchesFilter = (flow: MitmFlow): boolean =>
      !query || getFlowUrl(flow).toLowerCase().includes(query);
    let nextFlows: MitmFlow[] = [];
    if (tableListMode === "single" && selectedId) {
      const selected = flows.find((flow) => flow.id === selectedId);
      if (selected && matchesFilter(selected)) {
        nextFlows = [selected];
      }
    } else {
      let baseFlows = flows;
      if (selectedScopeId) {
        const scopeNode = findTreeNode(structureTreeNodes, selectedScopeId);
        if (scopeNode) {
          baseFlows = collectFlowsUnderNode(scopeNode);
        }
      }
      nextFlows = sortFlowsByTime(baseFlows.filter(matchesFilter));
    }
    const signature = `${tableListMode}|${selectedScopeId ?? ""}|${filter}|${nextFlows
      .map((flow) => flow.id)
      .join(",")}`;
    if (signature === tableFlowsCacheRef.current.signature) {
      return tableFlowsCacheRef.current.flows;
    }
    tableFlowsCacheRef.current = { signature, flows: nextFlows };
    return nextFlows;
  }, [flows, filter, selectedScopeId, selectedId, tableListMode, structureTreeNodes]);

  const selectedFlow = flows.find((flow) => flow.id === selectedId) ?? null;

  const handleSelectScope = (nodeId: string): void => {
    setSelectedScopeId(nodeId);
    setTableListMode("scope");
    setIsTableSelectionPrimary(false);
    const scopeNode = findTreeNode(structureTreeNodes, nodeId);
    if (!scopeNode) {
      setSelectedId(null);
      return;
    }
    const scopedFlows = collectFlowsUnderNode(scopeNode);
    setSelectedId(scopedFlows[0]?.id ?? null);
  };

  const handleSelectFlowFromTree = (flowId: string): void => {
    setSelectedId(flowId);
    setTableListMode("single");
    setIsTableSelectionPrimary(true);
  };

  const handleSelectFlowFromTable = (flowId: string): void => {
    setSelectedId(flowId);
    setIsTableSelectionPrimary(true);
  };

  const isScopeSelectionActive = tableListMode === "scope" && selectedScopeId !== null;
  const tableSelectionVariant: "primary" | "subtle" =
    isScopeSelectionActive && !isTableSelectionPrimary ? "subtle" : "primary";

  if (!isProxyRunning) {
    return (
      <div className="traffic-main-empty">
        <div className="empty">
          {isProxyStarting ? "Starting proxy..." : "Proxy is not running. Restart the app."}
        </div>
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
          nodes={structureTreeNodes}
          flowsCount={flows.length}
          flowsError={flowsError}
          selectedFlowId={selectedId}
          selectedScopeId={selectedScopeId}
          isScopeSelectionActive={isScopeSelectionActive}
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
        {tableFlows.length === 0 && flows.length > 0 && filter.trim() ? (
          <div className="empty traffic-filter-empty">
            No requests match &quot;{filter.trim()}&quot;. Clear the filter or pick another folder in
            Structure.
          </div>
        ) : (
          <TrafficListTable
            flows={tableFlows}
            mapLocalRules={mapLocalRules}
            selectedId={selectedId}
            selectionVariant={tableSelectionVariant}
            onSelectFlow={handleSelectFlowFromTable}
          />
        )}
      </div>
      <div className="traffic-status-bar">
        {selectedFlow ? (
          <>
            <span className={`traffic-status-method method-${selectedFlow.request.method}`}>
              {selectedFlow.request.method}
            </span>
            <span className="traffic-status-code">{selectedFlow.response?.status_code ?? "—"}</span>
            <span className="traffic-status-url" title={getFlowUrl(selectedFlow)}>
              {getFlowUrl(selectedFlow)}
            </span>
          </>
        ) : (
          <span className="traffic-status-placeholder">Select a request to see summary</span>
        )}
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

function mapLocalRulesKey(rules: MapLocalRule[]): string {
  return rules.map((rule) => `${rule.method}|${rule.url}`).join("\n");
}

function areTrafficPanelPropsEqual(
  left: TrafficPanelProps,
  right: TrafficPanelProps
): boolean {
  return (
    left.flows === right.flows &&
    left.flowsError === right.flowsError &&
    mapLocalRulesKey(left.mapLocalRules) === mapLocalRulesKey(right.mapLocalRules) &&
    left.isProxyRunning === right.isProxyRunning &&
    left.isProxyStarting === right.isProxyStarting &&
    left.onMapLocal === right.onMapLocal
  );
}

export const TrafficPanel = memo(TrafficPanelInner, areTrafficPanelPropsEqual);
