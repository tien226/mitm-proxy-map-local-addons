import { useEffect, useRef, useState } from "react";
import {
  collectAncestorIdsForFlow,
  collectDefaultExpandedIds,
  type FlowTreeNode,
} from "../utils/flowTree";

interface TrafficTreeViewProps {
  nodes: FlowTreeNode[];
  selectedFlowId: string | null;
  selectedScopeId: string | null;
  onSelectScope: (nodeId: string) => void;
  onSelectFlow: (flowId: string) => void;
}

export function TrafficTreeView({
  nodes,
  selectedFlowId,
  selectedScopeId,
  onSelectScope,
  onSelectFlow,
}: TrafficTreeViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const didInitExpandRef = useRef<boolean>(false);
  const userToggledRef = useRef<boolean>(false);

  useEffect(() => {
    if (nodes.length === 0) {
      didInitExpandRef.current = false;
      userToggledRef.current = false;
      setExpandedIds(new Set());
      return;
    }
    if (!didInitExpandRef.current) {
      didInitExpandRef.current = true;
      setExpandedIds(new Set(collectDefaultExpandedIds(nodes)));
    }
  }, [nodes]);

  useEffect(() => {
    if (!selectedFlowId || userToggledRef.current) {
      return;
    }
    const ancestorIds = collectAncestorIdsForFlow(nodes, selectedFlowId);
    if (ancestorIds.length === 0) {
      return;
    }
    setExpandedIds((previous) => {
      const next = new Set(previous);
      ancestorIds.forEach((id) => next.add(id));
      return next;
    });
  }, [selectedFlowId, nodes]);

  const toggleExpanded = (nodeId: string): void => {
    userToggledRef.current = true;
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

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
    const isFlowSelected = node.type === "flow" && node.id === selectedFlowId;
    const isScopeSelected =
      node.type !== "flow" && node.id === selectedScopeId && selectedFlowId === null;
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

  if (nodes.length === 0) {
    return <div className="empty tree-empty">No requests yet.</div>;
  }

  return <div className="traffic-tree">{nodes.map((node) => renderNode(node, 0))}</div>;
}
