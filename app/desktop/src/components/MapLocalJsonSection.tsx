import { useMemo, useState } from "react";
import { JsonHighlightedCode } from "./JsonHighlightedCode";

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

  const renderPreview = (): JSX.Element => {
    if (parsedJson === null) {
      return <div className="pane-empty">Not valid JSON — fix in Edit tab</div>;
    }
    return <JsonHighlightedCode text={formattedJson} />;
  };

  return (
    <div className="map-local-json-section">
      <div className="pane-tabs">
        <button
          type="button"
          className={`pane-tab ${activeTab === "edit" ? "active" : ""}`}
          onClick={() => setActiveTab("edit")}
        >
          Edit
        </button>
        <button
          type="button"
          className={`pane-tab ${activeTab === "preview" ? "active" : ""}`}
          onClick={() => setActiveTab("preview")}
        >
          Preview
        </button>
      </div>
      <div className="map-local-json-body pane-content">
        {activeTab === "edit" ? (
          <textarea
            className="map-local-json-textarea"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            spellCheck={false}
          />
        ) : (
          renderPreview()
        )}
      </div>
    </div>
  );
}
