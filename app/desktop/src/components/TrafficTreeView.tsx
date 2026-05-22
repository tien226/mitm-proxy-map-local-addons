import { useCallback, useState } from "react";
import type { FlowTreeNode } from "../utils/flowTree";

const TREE_EXPANDED_STORAGE_KEY = "tft-proxy-tree-expanded";

interface TrafficTreeViewProps {
  nodes: FlowTreeNode[];
  flowsCount: number;
  flowsError: string | null;
  selectedFlowId: string | null;
  selectedScopeId: string | null;
  isScopeSelectionActive: boolean;
  onSelectScope: (nodeId: string) => void;
  onSelectFlow: (flowId: string) => void;
}

function loadExpandedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(TREE_EXPANDED_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function saveExpandedIds(expandedIds: Set<string>): void {
  sessionStorage.setItem(TREE_EXPANDED_STORAGE_KEY, JSON.stringify([...expandedIds]));
}

export function TrafficTreeView({
  nodes,
  flowsCount,
  flowsError,
  selectedFlowId,
  selectedScopeId,
  isScopeSelectionActive,
  onSelectScope,
  onSelectFlow,
}: TrafficTreeViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(loadExpandedIds);

  const toggleExpanded = useCallback((nodeId: string): void => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      saveExpandedIds(next);
      return next;
    });
  }, []);

  const handleGroupLabelClick = (nodeId: string): void => {
    onSelectScope(nodeId);
  };

  const handleGroupLabelDoubleClick = (nodeId: string): void => {
    toggleExpanded(nodeId);
  };

  const getFlowLabel = (node: FlowTreeNode): string => {
    if (!node.flow) {
      return node.label;
    }
    const methodPrefix = `${node.flow.request.method} `;
    if (node.label.startsWith(methodPrefix)) {
      return node.label.slice(methodPrefix.length);
    }
    return node.label;
  };

  const renderNodeIcon = (node: FlowTreeNode): string => {
    if (node.type === "client") {
      return "📱";
    }
    if (node.type === "host") {
      return "◉";
    }
    return "📁";
  };

  const renderNode = (node: FlowTreeNode, depth: number): JSX.Element => {
    const isExpanded = expandedIds.has(node.id);
    const hasChildren = node.children.length > 0;
    const isFlowSelected =
      node.type === "flow" && node.id === selectedFlowId && !isScopeSelectionActive;
    const isScopeSelected =
      node.type !== "flow" && node.id === selectedScopeId && isScopeSelectionActive;
    if (node.type === "flow" && node.flow) {
      return (
        <div
          key={node.id}
          className={`tree-row tree-flow ${isFlowSelected ? "selected" : ""}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => onSelectFlow(node.id)}
        >
          <span className="tree-spacer" />
          <span className="tree-flow-label">{getFlowLabel(node)}</span>
        </div>
      );
    }
    return (
      <div key={node.id} className={`tree-branch ${isExpanded ? "is-expanded" : ""}`}>
        <div
          className={`tree-row tree-group ${isScopeSelected ? "selected" : ""}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <button
            type="button"
            className="tree-chevron-btn"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            onClick={() => toggleExpanded(node.id)}
          >
            {isExpanded ? "▾" : "▸"}
          </button>
          <div
            className="tree-group-body"
            onClick={() => handleGroupLabelClick(node.id)}
            onDoubleClick={() => handleGroupLabelDoubleClick(node.id)}
          >
            <span className={`tree-icon tree-icon-${node.type}`}>{renderNodeIcon(node)}</span>
            <span className="tree-group-label">{node.label}</span>
            {node.type === "client" && (
              <span className="tree-count">{node.children.length}</span>
            )}
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div className="tree-children">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (flowsError) {
    return <div className="empty tree-empty tree-empty-error">{flowsError}</div>;
  }
  if (flowsCount === 0 || nodes.length === 0) {
    return (
      <div className="empty tree-empty">
        <p>No requests captured yet.</p>
        <p className="tree-empty-hint">Send traffic from your device (see Setup tab).</p>
      </div>
    );
  }

  return <div className="traffic-tree">{nodes.map((node) => renderNode(node, 0))}</div>;
}
