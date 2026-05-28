import { useCallback, useEffect, useMemo, useReducer, useRef, type MouseEvent } from "react";
import { JsonEditor, type JsonData } from "json-edit-react";
import { tftMapLocalJsonTheme } from "../themes/mapLocalJsonEditorTheme";

interface MapLocalJsonSectionProps {
  value: string;
  onChange: (value: string) => void;
  historyKey?: string;
}

interface JsonHistoryState {
  entries: string[];
  index: number;
}

type JsonHistoryAction =
  | { type: "reset"; value: string }
  | { type: "commit"; value: string }
  | { type: "undo" }
  | { type: "redo" };

function jsonHistoryReducer(state: JsonHistoryState, action: JsonHistoryAction): JsonHistoryState {
  switch (action.type) {
    case "reset":
      return { entries: [action.value], index: 0 };
    case "commit": {
      const current: string = state.entries[state.index] ?? "";
      if (action.value === current) {
        return state;
      }
      const entries: string[] = [...state.entries.slice(0, state.index + 1), action.value];
      return { entries, index: entries.length - 1 };
    }
    case "undo":
      if (state.index <= 0) {
        return state;
      }
      return { ...state, index: state.index - 1 };
    case "redo":
      if (state.index >= state.entries.length - 1) {
        return state;
      }
      return { ...state, index: state.index + 1 };
    default:
      return state;
  }
}

function tryParseJson(text: string): unknown | null {
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isJsonEditorData(value: unknown): value is JsonData {
  return value !== null && typeof value === "object";
}

function isFocusInSection(section: HTMLElement): boolean {
  const activeElement: Element | null = document.activeElement;
  if (activeElement instanceof HTMLElement && section.contains(activeElement)) {
    return true;
  }
  const selection: Selection | null = window.getSelection();
  if (selection === null || selection.rangeCount === 0) {
    return false;
  }
  const anchorNode: Node | null = selection.anchorNode;
  if (anchorNode === null) {
    return false;
  }
  const anchorElement: HTMLElement | null =
    anchorNode instanceof HTMLElement ? anchorNode : anchorNode.parentElement;
  return anchorElement !== null && section.contains(anchorElement);
}

export function MapLocalJsonSection({ value, onChange, historyKey }: MapLocalJsonSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [history, dispatchHistory] = useReducer(jsonHistoryReducer, {
    entries: [value],
    index: 0,
  });
  const skipValueSyncRef = useRef<boolean>(false);
  const historyKeyRef = useRef<string | undefined>(historyKey);

  useEffect(() => {
    if (historyKey !== historyKeyRef.current) {
      historyKeyRef.current = historyKey;
      dispatchHistory({ type: "reset", value });
      return;
    }
    if (skipValueSyncRef.current) {
      skipValueSyncRef.current = false;
      return;
    }
    const currentEntry: string = history.entries[history.index] ?? "";
    if (value !== currentEntry) {
      dispatchHistory({ type: "reset", value });
    }
  }, [value, historyKey, history.entries, history.index]);

  const commitChange = useCallback(
    (nextValue: string) => {
      dispatchHistory({ type: "commit", value: nextValue });
      skipValueSyncRef.current = true;
      onChange(nextValue);
    },
    [onChange]
  );

  const undo = useCallback(() => {
    if (history.index <= 0) {
      return;
    }
    const targetIndex: number = history.index - 1;
    const entry: string | undefined = history.entries[targetIndex];
    if (entry === undefined) {
      return;
    }
    skipValueSyncRef.current = true;
    onChange(entry);
    dispatchHistory({ type: "undo" });
  }, [history.index, history.entries, onChange]);

  const redo = useCallback(() => {
    if (history.index >= history.entries.length - 1) {
      return;
    }
    const targetIndex: number = history.index + 1;
    const entry: string | undefined = history.entries[targetIndex];
    if (entry === undefined) {
      return;
    }
    skipValueSyncRef.current = true;
    onChange(entry);
    dispatchHistory({ type: "redo" });
  }, [history.index, history.entries, onChange]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }
      if (event.key.toLowerCase() !== "z") {
        return;
      }
      const section: HTMLDivElement | null = sectionRef.current;
      if (section === null || !isFocusInSection(section)) {
        return;
      }
      event.preventDefault();
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const parsedJson = useMemo(() => tryParseJson(value), [value]);
  const editorData = useMemo(() => {
    if (!isJsonEditorData(parsedJson)) {
      return null;
    }
    return parsedJson;
  }, [parsedJson]);

  const handleSetData = useCallback(
    (data: JsonData) => {
      commitChange(JSON.stringify(data, null, 2));
    },
    [commitChange]
  );

  const handleTextareaChange = useCallback(
    (nextValue: string) => {
      commitChange(nextValue);
    },
    [commitChange]
  );

  const handleSectionMouseDown = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea") !== null) {
      return;
    }
    sectionRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      ref={sectionRef}
      className="map-local-json-section"
      tabIndex={-1}
      onMouseDown={handleSectionMouseDown}
    >
      <div className="map-local-json-body map-local-json-body--jer">
        {editorData !== null ? (
          <JsonEditor
            data={editorData}
            setData={handleSetData}
            theme={tftMapLocalJsonTheme}
            rootName=""
            indent={2}
            collapse={false}
            showCollectionCount={false}
            enableClipboard={true}
            showIconTooltips={true}
            rootFontSize="13px"
            className="map-local-json-jer"
          />
        ) : (
          <textarea
            className="map-local-json-textarea"
            value={value}
            onChange={(event) => handleTextareaChange(event.target.value)}
            spellCheck={false}
            placeholder="Paste or type valid JSON..."
          />
        )}
      </div>
    </div>
  );
}
