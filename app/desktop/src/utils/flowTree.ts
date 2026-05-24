import { getFlowUrl } from "./flow";
import type { MitmFlow } from "../types";

export type FlowTreeNodeType = "client" | "host" | "folder" | "flow";

function getClientLabel(flow: MitmFlow): string {
  const peername = flow.client_conn?.peername;
  if (peername && peername.length > 0) {
    return peername[0];
  }
  return "Unknown client";
}

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
    const typeOrder: Record<FlowTreeNodeType, number> = {
      client: 0,
      host: 1,
      folder: 2,
      flow: 3,
    };
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

function getOrCreateHost(parent: FlowTreeNode, host: string): FlowTreeNode {
  const existing = parent.children.find((child) => child.type === "host" && child.label === host);
  if (existing) {
    return existing;
  }
  const hostNode: FlowTreeNode = {
    id: `host:${parent.id}:${host}`,
    label: host,
    type: "host",
    children: [],
    count: 0,
  };
  parent.children.push(hostNode);
  return hostNode;
}

export function buildFlowTree(flows: MitmFlow[], pinnedClientIps: string[] = []): FlowTreeNode[] {
  const clientMap = new Map<string, FlowTreeNode>();
  for (const clientIp of pinnedClientIps) {
    if (!clientIp || clientMap.has(clientIp)) {
      continue;
    }
    clientMap.set(clientIp, {
      id: `client:${clientIp}`,
      label: clientIp,
      type: "client",
      children: [],
      count: 0,
    });
  }
  flows.forEach((flow) => {
    const clientLabel = getClientLabel(flow);
    const host = flow.request.host || "unknown";
    const path = flow.request.path || "/";
    const segments = path.split("/").filter((segment) => segment.length > 0);
    if (!clientMap.has(clientLabel)) {
      clientMap.set(clientLabel, {
        id: `client:${clientLabel}`,
        label: clientLabel,
        type: "client",
        children: [],
        count: 0,
      });
    }
    const clientNode = clientMap.get(clientLabel);
    if (!clientNode) {
      return;
    }
    incrementCount(clientNode);
    const hostNode = getOrCreateHost(clientNode, host);
    incrementCount(hostNode);
    let currentNode: FlowTreeNode = hostNode;
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
      const folderNode = getOrCreateFolder(
        currentNode,
        folderLabel,
        `folder:${clientLabel}:${host}${builtPath}`
      );
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
  const roots = Array.from(clientMap.values());
  sortTreeNodes(roots);
  return roots;
}

export function findTreeNode(nodes: FlowTreeNode[], nodeId: string): FlowTreeNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }
    const childMatch = findTreeNode(node.children, nodeId);
    if (childMatch) {
      return childMatch;
    }
  }
  return null;
}

export function collectFlowsUnderNode(node: FlowTreeNode): MitmFlow[] {
  if (node.type === "flow" && node.flow) {
    return [node.flow];
  }
  const flows: MitmFlow[] = [];
  node.children.forEach((child) => {
    flows.push(...collectFlowsUnderNode(child));
  });
  return flows;
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

export function collectAncestorIdsForFlow(nodes: FlowTreeNode[], flowId: string): string[] {
  const ancestors: string[] = [];
  const walk = (node: FlowTreeNode, path: string[]): boolean => {
    if (node.type === "flow" && node.id === flowId) {
      ancestors.push(...path);
      return true;
    }
    for (const child of node.children) {
      const childPath = node.type === "flow" ? path : [...path, node.id];
      if (walk(child, childPath)) {
        return true;
      }
    }
    return false;
  };
  nodes.forEach((node) => walk(node, []));
  return ancestors;
}

export function collectDefaultExpandedIds(nodes: FlowTreeNode[]): string[] {
  const ids: string[] = [];
  const walk = (node: FlowTreeNode, depth: number): void => {
    if (node.type === "client" || node.type === "host" || node.type === "folder") {
      ids.push(node.id);
      if (depth < 3) {
        node.children.forEach((child) => walk(child, depth + 1));
      }
    }
  };
  nodes.forEach((node) => walk(node, 0));
  return ids;
}
