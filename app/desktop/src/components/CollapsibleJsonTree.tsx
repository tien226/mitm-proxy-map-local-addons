import { createContext, memo, useCallback, useContext, useEffect, useRef, useState, type ClipboardEvent, type MouseEvent, type ReactNode } from "react";

interface CollapsibleJsonTreeProps {
  data: unknown;
  defaultExpanded?: boolean;
  editable?: boolean;
  onEdit?: (json: string) => void;
}

type JsonNodeKind = "object" | "array" | "primitive";

type JsonTreeRowAction = "none" | "sibling" | "child";

interface EditContextValue {
  editable: boolean;
  selectedPath: string[] | null;
  setSelectedPath: (path: string[] | null) => void;
  editValue: (path: string[], newValue: unknown) => void;
  renameKey: (path: string[], newKey: string) => void;
  addSibling: (path: string[]) => void;
  addChild: (path: string[]) => void;
  deleteAtPath: (path: string[]) => void;
}

const EditCtx = createContext<EditContextValue>({
  editable: false,
  selectedPath: null,
  setSelectedPath: () => {},
  editValue: () => {},
  renameKey: () => {},
  addSibling: () => {},
  addChild: () => {},
  deleteAtPath: () => {},
});

function getNodeKind(value: unknown): JsonNodeKind {
  if (Array.isArray(value)) {
    return "array";
  }
  if (value !== null && typeof value === "object") {
    return "object";
  }
  return "primitive";
}

function setNestedValue(root: unknown, path: string[], newValue: unknown): unknown {
  if (path.length === 0) {
    return newValue;
  }
  const [head, ...rest] = path;
  if (Array.isArray(root)) {
    const copy = [...root];
    copy[Number(head)] = setNestedValue(copy[Number(head)], rest, newValue);
    return copy;
  }
  if (root !== null && typeof root === "object") {
    return { ...(root as Record<string, unknown>), [head]: setNestedValue((root as Record<string, unknown>)[head], rest, newValue) };
  }
  return root;
}

function deleteNestedAtPath(root: unknown, path: string[]): unknown {
  if (path.length === 0) {
    return root;
  }
  if (path.length === 1) {
    const key = path[0];
    if (Array.isArray(root)) {
      const copy = [...root];
      copy.splice(Number(key), 1);
      return copy;
    }
    if (root !== null && typeof root === "object") {
      const copy = { ...(root as Record<string, unknown>) };
      delete copy[key];
      return copy;
    }
    return root;
  }
  const [head, ...rest] = path;
  if (Array.isArray(root)) {
    const copy = [...root];
    copy[Number(head)] = deleteNestedAtPath(copy[Number(head)], rest);
    return copy;
  }
  if (root !== null && typeof root === "object") {
    return {
      ...(root as Record<string, unknown>),
      [head]: deleteNestedAtPath((root as Record<string, unknown>)[head], rest),
    };
  }
  return root;
}

function pathEquals(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index]);
}

function getValueAt(root: unknown, path: string[]): unknown {
  let current: unknown = root;
  for (const segment of path) {
    if (Array.isArray(current)) {
      current = current[Number(segment)];
      continue;
    }
    if (current !== null && typeof current === "object") {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }
    return undefined;
  }
  return current;
}

function renameKeyAtPath(root: unknown, path: string[], newKey: string): unknown {
  const trimmedKey: string = newKey.trim();
  if (path.length === 0 || trimmedKey === "") {
    return root;
  }
  const oldKey: string = path[path.length - 1];
  if (oldKey === trimmedKey) {
    return root;
  }
  const parentPath: string[] = path.slice(0, -1);
  const parent: unknown = parentPath.length === 0 ? root : getValueAt(root, parentPath);
  if (parent === null || typeof parent !== "object" || Array.isArray(parent)) {
    return root;
  }
  const objectValue: Record<string, unknown> = parent as Record<string, unknown>;
  if (!(oldKey in objectValue)) {
    return root;
  }
  if (trimmedKey in objectValue && trimmedKey !== oldKey) {
    return root;
  }
  const renamedObject: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(objectValue)) {
    renamedObject[key === oldKey ? trimmedKey : key] = entryValue;
  }
  if (parentPath.length === 0) {
    return renamedObject;
  }
  return setNestedValue(root, parentPath, renamedObject);
}

function addFieldAtPath(root: unknown, containerPath: string[], asArray: boolean): unknown {
  const container: unknown = containerPath.length === 0 ? root : getValueAt(root, containerPath);
  if (asArray) {
    const nextArray: unknown[] = Array.isArray(container) ? [...container] : [];
    nextArray.push(null);
    if (containerPath.length === 0) {
      return nextArray;
    }
    return setNestedValue(root, containerPath, nextArray);
  }
  const nextObject: Record<string, unknown> =
    container !== null && typeof container === "object" && !Array.isArray(container)
      ? { ...(container as Record<string, unknown>) }
      : {};
  let candidateKey: string = "newKey";
  let counter: number = 1;
  while (candidateKey in nextObject) {
    candidateKey = `newKey${counter}`;
    counter += 1;
  }
  nextObject[candidateKey] = null;
  if (containerPath.length === 0) {
    return nextObject;
  }
  return setNestedValue(root, containerPath, nextObject);
}

function parseKeyInput(text: string): string {
  const trimmed: string = text.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return typeof parsed === "string" ? parsed : trimmed.slice(1, -1);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function isContainerValue(value: unknown): boolean {
  return value !== null && typeof value === "object";
}

function parseEditInput(text: string, originalValue: unknown): unknown {
  const trimmed = text.trim();
  if (trimmed === "") {
    if (typeof originalValue === "string") {
      return "";
    }
    return null;
  }
  if (trimmed === "null") {
    return null;
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (!isNaN(Number(trimmed)) && typeof originalValue === "number") {
    return Number(trimmed);
  }
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      /* fall through */
    }
  }
  if (typeof originalValue === "string") {
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed.slice(1, -1);
      }
    }
    return trimmed;
  }
  return trimmed;
}

interface KeyPrefixProps {
  nodeKey: string;
  path: string[];
}

function KeyPrefix({ nodeKey, path }: KeyPrefixProps) {
  const { editable } = useContext(EditCtx);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const handleKeyClick = useCallback(
    (event: MouseEvent) => {
      if (!editable) {
        return;
      }
      const selection = window.getSelection();
      if (selection !== null && selection.toString().length > 0) {
        return;
      }
      event.stopPropagation();
      setIsEditing(true);
    },
    [editable]
  );
  if (isEditing) {
    return (
      <InlineKeyEditor
        nodeKey={nodeKey}
        path={path}
        onDone={() => setIsEditing(false)}
      />
    );
  }
  return (
    <>
      <span
        className={`json-key json-tree-key${editable ? " json-tree-key--editable" : ""}`}
        onClick={handleKeyClick}
        title={editable ? "Click to rename field" : undefined}
      >
        {`"${nodeKey}"`}
      </span>
      <span className="json-punctuation">{": "}</span>
    </>
  );
}

interface InlineKeyEditorProps {
  nodeKey: string;
  path: string[];
  onDone: () => void;
}

function InlineKeyEditor({ nodeKey, path, onDone }: InlineKeyEditorProps) {
  const { renameKey } = useContext(EditCtx);
  const [text, setText] = useState<string>(nodeKey);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmedRef = useRef<boolean>(false);
  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    input.focus();
    input.select();
  }, []);
  const handleConfirm = useCallback(() => {
    if (confirmedRef.current) {
      return;
    }
    confirmedRef.current = true;
    const parsedKey: string = parseKeyInput(text);
    if (parsedKey !== "") {
      renameKey(path, parsedKey);
    }
    onDone();
  }, [text, path, renameKey, onDone]);
  const handleCancel = useCallback(() => {
    if (confirmedRef.current) {
      return;
    }
    confirmedRef.current = true;
    onDone();
  }, [onDone]);
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleConfirm();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        handleCancel();
      }
    },
    [handleConfirm, handleCancel]
  );
  const stopMouseEvent = useCallback((event: MouseEvent) => {
    event.stopPropagation();
  }, []);
  return (
    <>
      <input
        ref={inputRef}
        className="json-tree-inline-input json-tree-inline-input--key"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={handleConfirm}
        onKeyDown={handleKeyDown}
        onMouseDown={stopMouseEvent}
        onClick={stopMouseEvent}
        spellCheck={false}
      />
      <span className="json-punctuation">{": "}</span>
    </>
  );
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

interface InlineEditorProps {
  value: unknown;
  path: string[];
  onDone: () => void;
}

function formatEditableDisplay(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function InlineEditor({ value, path, onDone }: InlineEditorProps) {
  const { editValue } = useContext(EditCtx);
  const displayValue = formatEditableDisplay(value);
  const [text, setText] = useState<string>(displayValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmedRef = useRef<boolean>(false);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    input.focus();
    const length = input.value.length;
    input.setSelectionRange(length, length);
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmedRef.current) {
      return;
    }
    confirmedRef.current = true;
    const parsed = parseEditInput(text, value);
    editValue(path, parsed);
    onDone();
  }, [text, value, path, editValue, onDone]);

  const handleCancel = useCallback(() => {
    if (confirmedRef.current) {
      return;
    }
    confirmedRef.current = true;
    onDone();
  }, [onDone]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleConfirm();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      handleCancel();
    }
  }, [handleConfirm, handleCancel]);

  const stopMouseEvent = useCallback((event: MouseEvent) => {
    event.stopPropagation();
  }, []);

  return (
    <input
      ref={inputRef}
      className="json-tree-inline-input"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={handleConfirm}
      onKeyDown={handleKeyDown}
      onMouseDown={stopMouseEvent}
      onClick={stopMouseEvent}
      spellCheck={false}
    />
  );
}

interface JsonTreeRowProps {
  path: string[];
  indent: number;
  dataJson?: string;
  rowAction?: JsonTreeRowAction;
  children: ReactNode;
}

function JsonTreeRow({ path, indent, dataJson, rowAction = "none", children }: JsonTreeRowProps) {
  const { editable, selectedPath, setSelectedPath, deleteAtPath, addSibling, addChild } = useContext(EditCtx);
  const canDelete: boolean = editable && path.length > 0;
  const canAdd: boolean = editable && rowAction !== "none";
  const isSelected: boolean =
    selectedPath !== null && pathEquals(selectedPath, path);
  const handleLineClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!editable) {
        return;
      }
      const target = event.target as HTMLElement;
      if (
        target.closest(".json-tree-value") !== null ||
        target.closest(".json-tree-key") !== null ||
        target.closest(".json-tree-arrow") !== null ||
        target.closest(".json-tree-inline-input") !== null ||
        target.closest(".json-tree-delete") !== null ||
        target.closest(".json-tree-add") !== null
      ) {
        return;
      }
      setSelectedPath(path);
    },
    [editable, path, setSelectedPath]
  );
  const handleDeleteClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      deleteAtPath(path);
      setSelectedPath(null);
    },
    [path, deleteAtPath, setSelectedPath]
  );
  const handleAddClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (rowAction === "child") {
        addChild(path);
      } else if (rowAction === "sibling") {
        addSibling(path);
      }
      setSelectedPath(path);
    },
    [path, rowAction, addChild, addSibling, setSelectedPath]
  );
  const rowTitle: string | undefined = editable
    ? "Click key/value to edit · + add field · Del delete · Ins insert"
    : undefined;
  return (
    <div
      className={`json-tree-line${canDelete || canAdd ? " json-tree-line--deletable" : ""}${isSelected ? " json-tree-line--selected" : ""}`}
      style={{ paddingLeft: indent }}
      data-json={dataJson}
      onClick={handleLineClick}
      title={rowTitle}
    >
      <span className="json-tree-line-content">{children}</span>
      {canAdd ? (
        <button
          type="button"
          className="json-tree-add"
          onClick={handleAddClick}
          title={rowAction === "child" ? "Add field inside" : "Add field"}
          aria-label={rowAction === "child" ? "Add field inside" : "Add field"}
        >
          +
        </button>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          className="json-tree-delete"
          onClick={handleDeleteClick}
          title="Delete field"
          aria-label="Delete field"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

interface JsonNodeProps {
  nodeKey: string | null;
  value: unknown;
  path: string[];
  depth: number;
  isLast: boolean;
  defaultExpanded: boolean;
}

function JsonNodeInner({ nodeKey, value, path, depth, isLast, defaultExpanded }: JsonNodeProps) {
  const kind = getNodeKind(value);
  const { editable } = useContext(EditCtx);
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [isInlineEditing, setIsInlineEditing] = useState<boolean>(false);
  const indent = depth * 16;
  const comma = isLast ? "" : ",";

  const handleArrowClick = useCallback((event: MouseEvent) => {
    event.stopPropagation();
    setIsExpanded((prev) => !prev);
  }, []);

  const handleValueClick = useCallback((event: MouseEvent) => {
    if (!editable) {
      return;
    }
    const selection = window.getSelection();
    if (selection !== null && selection.toString().length > 0) {
      return;
    }
    event.stopPropagation();
    setIsInlineEditing(true);
  }, [editable]);

  if (kind === "primitive") {
    const valueClassName =
      value === null ? "json-null" : `json-${typeof value}`;
    const primitiveEl = isInlineEditing ? (
      <InlineEditor value={value} path={path} onDone={() => setIsInlineEditing(false)} />
    ) : (
      <span
        className={`${valueClassName} json-tree-value${editable ? " json-tree-value--editable" : ""}`}
        onClick={handleValueClick}
        title={editable ? "Click to edit" : undefined}
      >
        {value === null ? "null" : typeof value === "string" ? JSON.stringify(value) : String(value)}
      </span>
    );

    return (
      <JsonTreeRow path={path} indent={indent} rowAction={nodeKey !== null ? "sibling" : "none"}>
        <span className="json-tree-arrow-spacer" />
        {nodeKey !== null ? <KeyPrefix nodeKey={nodeKey} path={path} /> : null}
        {primitiveEl}
        <span className="json-punctuation">{comma}</span>
      </JsonTreeRow>
    );
  }

  const isArray = kind === "array";
  const open = isArray ? "[" : "{";
  const close = isArray ? "]" : "}";
  const jsonAttr = JSON.stringify(value, null, 2);
  const entries = isArray
    ? (value as unknown[]).map((item, i) => ({ key: null as string | null, reactKey: String(i), pathKey: String(i), value: item }))
    : Object.entries(value as Record<string, unknown>).map(([k, v]) => ({ key: k, reactKey: k, pathKey: k, value: v }));

  if (entries.length === 0) {
    return (
      <JsonTreeRow path={path} indent={indent} rowAction="child">
        <span className="json-tree-arrow-spacer" />
        {nodeKey !== null ? <KeyPrefix nodeKey={nodeKey} path={path} /> : null}
        <span className="json-punctuation">{`${open}${close}${comma}`}</span>
      </JsonTreeRow>
    );
  }

  if (!isExpanded) {
    return (
      <JsonTreeRow path={path} indent={indent} dataJson={jsonAttr} rowAction="child">
        <span className="json-tree-arrow" onClick={handleArrowClick}>{"▸"}</span>
        {nodeKey !== null ? <KeyPrefix nodeKey={nodeKey} path={path} /> : null}
        <span className="json-punctuation">{open}</span>
        <span className="json-tree-collapsed-preview">{"..."}</span>
        <span className="json-punctuation">{`${close}${comma}`}</span>
      </JsonTreeRow>
    );
  }

  return (
    <div className="json-tree-node" data-json={jsonAttr}>
      <JsonTreeRow path={path} indent={indent} rowAction="child">
        <span className="json-tree-arrow" onClick={handleArrowClick}>{"▾"}</span>
        {nodeKey !== null ? <KeyPrefix nodeKey={nodeKey} path={path} /> : null}
        <span className="json-punctuation">{open}</span>
      </JsonTreeRow>
      {entries.map((entry, i) => (
        <JsonNode
          key={entry.reactKey}
          nodeKey={entry.key}
          value={entry.value}
          path={[...path, entry.pathKey]}
          depth={depth + 1}
          isLast={i === entries.length - 1}
          defaultExpanded={defaultExpanded}
        />
      ))}
      <JsonTreeRow path={path} indent={indent}>
        <span className="json-tree-arrow-spacer" /><span className="json-punctuation">{`${close}${comma}`}</span>
      </JsonTreeRow>
    </div>
  );
}

const JsonNode = memo(JsonNodeInner);

function CollapsibleJsonTreeInner({ data, defaultExpanded = true, editable = false, onEdit }: CollapsibleJsonTreeProps) {
  const [selectedPath, setSelectedPath] = useState<string[] | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);

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

  const editValue = useCallback((path: string[], newValue: unknown) => {
    if (!onEdit) {
      return;
    }
    const updated = setNestedValue(data, path, newValue);
    onEdit(JSON.stringify(updated, null, 2));
  }, [data, onEdit]);

  const deleteAtPath = useCallback((path: string[]) => {
    if (!onEdit || path.length === 0) {
      return;
    }
    const updated = deleteNestedAtPath(data, path);
    onEdit(JSON.stringify(updated, null, 2));
    setSelectedPath(null);
  }, [data, onEdit]);

  const renameKey = useCallback((path: string[], newKey: string) => {
    if (!onEdit) {
      return;
    }
    const updated = renameKeyAtPath(data, path, newKey);
    onEdit(JSON.stringify(updated, null, 2));
  }, [data, onEdit]);

  const addSibling = useCallback((path: string[]) => {
    if (!onEdit || path.length === 0) {
      return;
    }
    const parentPath: string[] = path.slice(0, -1);
    const parent: unknown = parentPath.length === 0 ? data : getValueAt(data, parentPath);
    const updated = addFieldAtPath(data, parentPath, Array.isArray(parent));
    onEdit(JSON.stringify(updated, null, 2));
  }, [data, onEdit]);

  const addChild = useCallback((path: string[]) => {
    if (!onEdit) {
      return;
    }
    const container: unknown = path.length === 0 ? data : getValueAt(data, path);
    const updated = addFieldAtPath(data, path, Array.isArray(container));
    onEdit(JSON.stringify(updated, null, 2));
  }, [data, onEdit]);

  const addFromSelectedPath = useCallback((path: string[]): void => {
    const selectedValue: unknown = getValueAt(data, path);
    if (isContainerValue(selectedValue)) {
      addChild(path);
      return;
    }
    addSibling(path);
  }, [data, addChild, addSibling]);

  useEffect(() => {
    if (!editable) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedPath === null || selectedPath.length === 0) {
          return;
        }
        event.preventDefault();
        deleteAtPath(selectedPath);
        return;
      }
      if (event.key === "Insert") {
        if (selectedPath === null) {
          return;
        }
        event.preventDefault();
        addFromSelectedPath(selectedPath);
        return;
      }
      if (event.key === "Enter") {
        if (selectedPath === null) {
          return;
        }
        event.preventDefault();
        addFromSelectedPath(selectedPath);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editable, selectedPath, deleteAtPath, addFromSelectedPath]);

  const ctxValue: EditContextValue = {
    editable,
    selectedPath,
    setSelectedPath,
    editValue,
    renameKey,
    addSibling,
    addChild,
    deleteAtPath,
  };

  return (
    <EditCtx.Provider value={ctxValue}>
      <div ref={treeRef} className="json-highlight json-tree" onCopy={handleCopy} tabIndex={editable ? 0 : undefined}>
        <JsonNode nodeKey={null} value={data} path={[]} depth={0} isLast={true} defaultExpanded={defaultExpanded} />
      </div>
    </EditCtx.Provider>
  );
}

export const CollapsibleJsonTree = memo(CollapsibleJsonTreeInner);
