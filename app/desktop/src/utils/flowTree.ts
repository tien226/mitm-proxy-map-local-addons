import { getFlowUrl } from "./flow";
import type { MitmFlow } from "../types";

export type FlowTreeNodeType = "host" | "folder" | "flow";

export interface FlowTreeNode {
  id: string;
  label: string;
  type: FlowTreeNodeType;
  children: FlowTreeNode[];
  flow?: MitmFlow;
  count: number;
}

function getOrCreateFolder(parent: FlowTreeNode, folderLabel: string, folderId: string): FlowTreeNode {
  const existing = parent.children.find(
    (child) => child.type === "folder" && child.label === folderLabel
  );
  if (existing) {
    return existing;
  }
  const folder: FlowTreeNode = {
    id: folderId,
    label: folderLabel,
    type: "folder",
    children: [],
    count: 0,
  };
  parent.children.push(folder);
  return folder;
}

function incrementCount(node: FlowTreeNode): void {
  node.count += 1;
}

function sortTreeNodes(nodes: FlowTreeNode[]): void {
  nodes.sort((left, right) => {
    const typeOrder: Record<FlowTreeNodeType, number> = { host: 0, folder: 1, flow: 2 };
    if (left.type !== right.type) {
      return typeOrder[left.type] - typeOrder[right.type];
    }
    return left.label.localeCompare(right.label);
  });
  nodes.forEach((node) => {
    if (node.children.length > 0) {
      sortTreeNodes(node.children);
    }
  });
}

export function buildFlowTree(flows: MitmFlow[]): FlowTreeNode[] {
  const hostMap = new Map<string, FlowTreeNode>();
  flows.forEach((flow) => {
    const host = flow.request.host || "unknown";
    const path = flow.request.path || "/";
    const segments = path.split("/").filter((segment) => segment.length > 0);
    if (!hostMap.has(host)) {
      hostMap.set(host, {
        id: `host:${host}`,
        label: host,
        type: "host",
        children: [],
        count: 0,
      });
    }
    const hostNode = hostMap.get(host);
    if (!hostNode) {
      return;
    }
    incrementCount(hostNode);
    let currentNode = hostNode;
    let builtPath = "";
    if (segments.length <= 1) {
      const leafLabel =
        segments.length === 1
          ? `${flow.request.method} /${segments[0]}`
          : `${flow.request.method} ${path}`;
      currentNode.children.push({
        id: flow.id,
        label: leafLabel,
        type: "flow",
        children: [],
        flow,
        count: 1,
      });
      return;
    }
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index];
      builtPath = `${builtPath}/${segment}`;
      const folderLabel = `/${segment}`;
      const folderNode = getOrCreateFolder(currentNode, folderLabel, `folder:${host}${builtPath}`);
      incrementCount(folderNode);
      currentNode = folderNode;
    }
    const lastSegment = segments[segments.length - 1];
    currentNode.children.push({
      id: flow.id,
      label: `${flow.request.method} ${lastSegment}`,
      type: "flow",
      children: [],
      flow,
      count: 1,
    });
  });
  const roots = Array.from(hostMap.values());
  sortTreeNodes(roots);
  return roots;
}

export function filterFlowTree(nodes: FlowTreeNode[], query: string): FlowTreeNode[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return nodes;
  }
  const filterNode = (node: FlowTreeNode): FlowTreeNode | null => {
    if (node.type === "flow" && node.flow) {
      const url = getFlowUrl(node.flow).toLowerCase();
      const label = node.label.toLowerCase();
      if (url.includes(normalizedQuery) || label.includes(normalizedQuery)) {
        return node;
      }
      return null;
    }
    const filteredChildren = node.children
      .map((child) => filterNode(child))
      .filter((child): child is FlowTreeNode => child !== null);
    if (filteredChildren.length === 0) {
      if (node.label.toLowerCase().includes(normalizedQuery)) {
        return { ...node, children: [], count: 0 };
      }
      return null;
    }
    const totalCount = filteredChildren.reduce((sum, child) => sum + child.count, 0);
    return { ...node, children: filteredChildren, count: totalCount };
  };
  return nodes
    .map((node) => filterNode(node))
    .filter((node): node is FlowTreeNode => node !== null);
}

export function collectDefaultExpandedIds(nodes: FlowTreeNode[]): string[] {
  const ids: string[] = [];
  const walk = (node: FlowTreeNode, depth: number): void => {
    if (node.type === "host" || node.type === "folder") {
      ids.push(node.id);
      if (depth < 2) {
        node.children.forEach((child) => walk(child, depth + 1));
      }
    }
  };
  nodes.forEach((node) => walk(node, 0));
  return ids;
}
