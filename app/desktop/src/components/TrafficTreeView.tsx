import { useEffect, useMemo, useState } from "react";
import { collectDefaultExpandedIds, type FlowTreeNode } from "../utils/flowTree";
import { isMapLocalFlow } from "../utils/flow";

interface TrafficTreeViewProps {
  nodes: FlowTreeNode[];
  selectedId: string | null;
  onSelectFlow: (flowId: string) => void;
}

export function TrafficTreeView({ nodes, selectedId, onSelectFlow }: TrafficTreeViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const defaultExpandedKey = useMemo(
    () => nodes.map((node) => node.id).join("|"),
    [nodes]
  );

  useEffect(() => {
    setExpandedIds(new Set(collectDefaultExpandedIds(nodes)));
  }, [defaultExpandedKey, nodes]);

  const toggleExpanded = (nodeId: string): void => {
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

  const renderNode = (node: FlowTreeNode, depth: number): JSX.Element => {
    const isExpanded = expandedIds.has(node.id);
    const hasChildren = node.children.length > 0;
    const isSelected = node.type === "flow" && node.id === selectedId;
    if (node.type === "flow" && node.flow) {
      return (
        <div
          key={node.id}
          className={`tree-row tree-flow ${isSelected ? "selected" : ""}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => onSelectFlow(node.id)}
        >
          <span className="tree-spacer" />
          <span className={`method method-${node.flow.request.method}`}>{node.flow.request.method}</span>
          <span className="tree-flow-label">{node.label.replace(`${node.flow.request.method} `, "")}</span>
          <span className="tree-flow-status">{node.flow.response?.status_code ?? "—"}</span>
          {isMapLocalFlow(node.flow) && <span className="badge-mapped">MAP</span>}
        </div>
      );
    }
    return (
      <div key={node.id} className="tree-branch">
        <div
          className={`tree-row tree-group ${isSelected ? "" : ""}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => toggleExpanded(node.id)}
        >
          <span className={`tree-chevron ${isExpanded ? "expanded" : ""}`}>›</span>
          <span className={`tree-icon tree-icon-${node.type}`}>{node.type === "host" ? "◉" : "📁"}</span>
          <span className="tree-group-label">{node.label}</span>
          <span className="tree-count">{node.count}</span>
        </div>
        {isExpanded &&
          hasChildren &&
          node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  if (nodes.length === 0) {
    return <div className="empty">No requests yet. Point device proxy here.</div>;
  }

  return <div className="traffic-tree">{nodes.map((node) => renderNode(node, 0))}</div>;
}
