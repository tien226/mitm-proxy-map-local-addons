import { memo, useCallback, useState, type ClipboardEvent, type MouseEvent } from "react";

interface CollapsibleJsonTreeProps {
  data: unknown;
  defaultExpanded?: boolean;
}

type JsonNodeKind = "object" | "array" | "primitive";

function getNodeKind(value: unknown): JsonNodeKind {
  if (Array.isArray(value)) {
    return "array";
  }
  if (value !== null && typeof value === "object") {
    return "object";
  }
  return "primitive";
}

function renderPrimitive(value: unknown): JSX.Element {
  if (value === null) {
    return <span className="json-null">null</span>;
  }
  if (typeof value === "boolean") {
    return <span className="json-boolean">{value ? "true" : "false"}</span>;
  }
  if (typeof value === "number") {
    return <span className="json-number">{value}</span>;
  }
  if (typeof value === "string") {
    return <span className="json-string">{JSON.stringify(value)}</span>;
  }
  return <span className="json-text">{String(value)}</span>;
}

function renderKeyPrefix(nodeKey: string | null): JSX.Element | null {
  if (nodeKey === null) {
    return null;
  }
  return <><span className="json-key">{`"${nodeKey}"`}</span><span className="json-punctuation">{": "}</span></>;
}

function selectionHasCollapsedContent(text: string): boolean {
  return /\.{3}|\{\s*\}|\[\s*\]/.test(text);
}

function collectJsonFromSelection(range: Range, root: HTMLElement): string | null {
  const allJsonEls = root.querySelectorAll("[data-json]");
  const intersecting: HTMLElement[] = [];
  for (const el of allJsonEls) {
    if (el instanceof HTMLElement && el.dataset.json && range.intersectsNode(el)) {
      intersecting.push(el);
    }
  }
  if (intersecting.length === 0) {
    return null;
  }
  const innermost = intersecting.filter(
    (el) => !intersecting.some((other) => other !== el && el.contains(other))
  );
  if (innermost.length === 1) {
    return innermost[0].dataset.json!;
  }
  return innermost.map((el) => el.dataset.json!).join(",\n");
}

interface JsonNodeProps {
  nodeKey: string | null;
  value: unknown;
  depth: number;
  isLast: boolean;
  defaultExpanded: boolean;
}

function JsonNodeInner({ nodeKey, value, depth, isLast, defaultExpanded }: JsonNodeProps) {
  const kind = getNodeKind(value);
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const indent = depth * 16;
  const comma = isLast ? "" : ",";

  const handleArrowClick = useCallback((event: MouseEvent) => {
    event.stopPropagation();
    setIsExpanded((prev) => !prev);
  }, []);

  if (kind === "primitive") {
    return (
      <div className="json-tree-line" style={{ paddingLeft: indent }}>
        <span className="json-tree-arrow-spacer" />{renderKeyPrefix(nodeKey)}{renderPrimitive(value)}<span className="json-punctuation">{comma}</span>
      </div>
    );
  }

  const isArray = kind === "array";
  const open = isArray ? "[" : "{";
  const close = isArray ? "]" : "}";
  const jsonAttr = JSON.stringify(value, null, 2);
  const entries = isArray
    ? (value as unknown[]).map((item, i) => ({ key: null as string | null, reactKey: String(i), value: item }))
    : Object.entries(value as Record<string, unknown>).map(([k, v]) => ({ key: k, reactKey: k, value: v }));

  if (entries.length === 0) {
    return (
      <div className="json-tree-line" style={{ paddingLeft: indent }}>
        <span className="json-tree-arrow-spacer" />{renderKeyPrefix(nodeKey)}<span className="json-punctuation">{`${open}${close}${comma}`}</span>
      </div>
    );
  }

  if (!isExpanded) {
    return (
      <div className="json-tree-line" style={{ paddingLeft: indent }} data-json={jsonAttr}>
        <span className="json-tree-arrow" onClick={handleArrowClick}>{"▸"}</span>{renderKeyPrefix(nodeKey)}<span className="json-punctuation">{open}</span><span className="json-tree-collapsed-preview">{"..."}</span><span className="json-punctuation">{`${close}${comma}`}</span>
      </div>
    );
  }

  return (
    <div className="json-tree-node" data-json={jsonAttr}>
      <div className="json-tree-line" style={{ paddingLeft: indent }}>
        <span className="json-tree-arrow" onClick={handleArrowClick}>{"▾"}</span>{renderKeyPrefix(nodeKey)}<span className="json-punctuation">{open}</span>
      </div>
      {entries.map((entry, i) => (
        <JsonNode
          key={entry.reactKey}
          nodeKey={entry.key}
          value={entry.value}
          depth={depth + 1}
          isLast={i === entries.length - 1}
          defaultExpanded={defaultExpanded}
        />
      ))}
      <div className="json-tree-line" style={{ paddingLeft: indent }}>
        <span className="json-tree-arrow-spacer" /><span className="json-punctuation">{`${close}${comma}`}</span>
      </div>
    </div>
  );
}

const JsonNode = memo(JsonNodeInner);

function CollapsibleJsonTreeInner({ data, defaultExpanded = true }: CollapsibleJsonTreeProps) {
  const handleCopy = useCallback((event: ClipboardEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }
    const text = selection.toString();
    if (!selectionHasCollapsedContent(text)) {
      return;
    }
    event.preventDefault();
    const range = selection.getRangeAt(0);
    const json = collectJsonFromSelection(range, event.currentTarget);
    event.clipboardData.setData("text/plain", json ?? JSON.stringify(data, null, 2));
  }, [data]);

  return (
    <div className="json-highlight json-tree" onCopy={handleCopy}>
      <JsonNode nodeKey={null} value={data} depth={0} isLast={true} defaultExpanded={defaultExpanded} />
    </div>
  );
}

export const CollapsibleJsonTree = memo(CollapsibleJsonTreeInner);
