import { useMemo, useState } from "react";
import { CollapsibleJsonTree } from "./CollapsibleJsonTree";
import { JsonHighlightedCode } from "./JsonHighlightedCode";
import { MapLocalJsonEditor } from "./MapLocalJsonEditor";
import { SearchablePaneContent } from "./SearchablePaneContent";
import { SearchablePre } from "./SearchablePre";

type JsonViewTab = "edit" | "preview";

interface MapLocalJsonSectionProps {
  value: string;
  onChange: (value: string) => void;
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

export function MapLocalJsonSection({ value, onChange }: MapLocalJsonSectionProps) {
  const [activeTab, setActiveTab] = useState<JsonViewTab>("edit");
  const parsedJson = useMemo(() => tryParseJson(value), [value]);
  const formattedJson = useMemo(() => {
    if (parsedJson === null) {
      return "";
    }
    return `${JSON.stringify(parsedJson, null, 2)}\n`;
  }, [parsedJson]);
  const isEditTab = activeTab === "edit";
  const searchText = isEditTab ? value : formattedJson || value;

  return (
    <div className="map-local-json-section">
      <div className="pane-tabs map-local-json-tabs">
        <button
          type="button"
          className={`pane-tab ${isEditTab ? "active" : ""}`}
          onClick={() => setActiveTab("edit")}
        >
          Edit
        </button>
        <button
          type="button"
          className={`pane-tab ${!isEditTab ? "active" : ""}`}
          onClick={() => setActiveTab("preview")}
        >
          Preview
        </button>
        <span className="map-local-json-hint">
          {isEditTab ? "Edit JSON · Cmd+F to find" : "Preview · Cmd+F highlights matches"}
        </span>
      </div>
      <SearchablePaneContent
        searchText={searchText}
        enabled={searchText.length > 0}
        enableFindShortcut={true}
        autoFocusContainer={false}
        highlightScroll={true}
      >
        {(find) => {
          if (isEditTab) {
            return <MapLocalJsonEditor value={value} onChange={onChange} find={find} />;
          }
          if (parsedJson === null) {
            if (!value.trim()) {
              return <div className="pane-empty">Invalid JSON — fix in Edit tab</div>;
            }
            if (find) {
              return <SearchablePre text={value} find={find} />;
            }
            return <pre className="pane-pre map-local-json-preview-raw">{value}</pre>;
          }
          if (!find || !find.query) {
            return <CollapsibleJsonTree data={parsedJson} defaultExpanded={true} />;
          }
          return <JsonHighlightedCode text={formattedJson} find={find} plainText />;
        }}
      </SearchablePaneContent>
    </div>
  );
}
