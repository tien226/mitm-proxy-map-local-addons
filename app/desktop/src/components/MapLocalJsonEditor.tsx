import { useRef } from "react";
import type { SearchableFindProps } from "./SearchablePaneContent";
import { SearchablePre } from "./SearchablePre";

interface MapLocalJsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  find?: SearchableFindProps;
}

export function MapLocalJsonEditor({ value, onChange, find }: MapLocalJsonEditorProps) {
  const stackRef = useRef<HTMLDivElement>(null);
  const handleWheel = (event: React.WheelEvent<HTMLTextAreaElement>): void => {
    const scrollParent = stackRef.current?.closest(".pane-content-body");
    if (!scrollParent) {
      return;
    }
    scrollParent.scrollTop += event.deltaY;
    event.preventDefault();
  };
  return (
    <div ref={stackRef} className="map-local-editor-stack">
      <div className="map-local-editor-backdrop" aria-hidden="true">
        {find ? (
          <SearchablePre text={value} find={find} className="map-local-editor-backdrop-pre" />
        ) : (
          <pre className="map-local-editor-backdrop-pre">{value}</pre>
        )}
      </div>
      <textarea
        className="map-local-editor-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onWheel={handleWheel}
        spellCheck={false}
      />
    </div>
  );
}
