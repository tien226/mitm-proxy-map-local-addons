import { useEffect, useMemo, useState } from "react";
import { CollapsibleJsonTree } from "./CollapsibleJsonTree";
import { JsonHighlightedCode } from "./JsonHighlightedCode";
import { SearchablePaneContent, type SearchableFindProps } from "./SearchablePaneContent";
import { SearchablePre } from "./SearchablePre";

type TabId = "header" | "query" | "body" | "json" | "raw";

interface MessagePaneProps {
  title: string;
  url: string;
  headers: Array<[string, string]>;
  body: string;
  isLoading: boolean;
  showQuery: boolean;
}

function parseQueryString(url: string): Array<[string, string]> {
  try {
    const queryIndex = url.indexOf("?");
    if (queryIndex < 0) {
      return [];
    }
    const params = new URLSearchParams(url.slice(queryIndex + 1));
    const entries: Array<[string, string]> = [];
    params.forEach((value, key) => entries.push([key, value]));
    return entries;
  } catch {
    return [];
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

function isSearchableTab(tab: TabId): boolean {
  return tab === "body" || tab === "json" || tab === "raw";
}

export function MessagePane({
  title,
  url,
  headers,
  body,
  isLoading,
  showQuery,
}: MessagePaneProps) {
  const tabs: TabId[] = showQuery
    ? ["header", "query", "body", "json", "raw"]
    : ["header", "body", "json", "raw"];
  const [activeTab, setActiveTab] = useState<TabId>("header");
  const [findOpenRequest, setFindOpenRequest] = useState<number>(0);
  const queryParams = useMemo(() => parseQueryString(url), [url]);
  const jsonValue = useMemo(() => tryParseJson(body), [body]);
  const formattedJson = useMemo(() => {
    if (jsonValue === null) {
      return "";
    }
    return `${JSON.stringify(jsonValue, null, 2)}\n`;
  }, [jsonValue]);
  const isSearchable = isSearchableTab(activeTab);
  const searchText = useMemo(() => {
    if (activeTab === "json" || (activeTab === "body" && jsonValue !== null)) {
      return formattedJson;
    }
    return body;
  }, [activeTab, body, formattedJson, jsonValue]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!isSearchable || isLoading) {
        return;
      }
      const isFindShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f";
      if (isFindShortcut) {
        event.preventDefault();
        setFindOpenRequest((count) => count + 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchable, isLoading]);

  const renderJsonBody = (find?: SearchableFindProps): JSX.Element => {
    if (!find || !find.query) {
      return <CollapsibleJsonTree data={jsonValue} defaultExpanded={true} />;
    }
    return <JsonHighlightedCode text={formattedJson} find={find} />;
  };

  const renderPlainBody = (find?: SearchableFindProps): JSX.Element => {
    if (find && find.query) {
      return <SearchablePre text={body} find={find} />;
    }
    return <pre className="pane-pre">{body}</pre>;
  };

  const renderContent = (find?: SearchableFindProps): JSX.Element => {
    if (isLoading) {
      return <div className="pane-empty">Loading...</div>;
    }
    if (activeTab === "header") {
      if (headers.length === 0) {
        return <div className="pane-empty">No headers</div>;
      }
      return (
        <table className="kv-table">
          <tbody>
            {headers.map(([name, value]) => (
              <tr key={`${name}-${value}`}>
                <th>{name}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (activeTab === "query") {
      if (queryParams.length === 0) {
        return <div className="pane-empty">No query parameters</div>;
      }
      return (
        <table className="kv-table">
          <tbody>
            {queryParams.map(([name, value]) => (
              <tr key={`${name}-${value}`}>
                <th>{name}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (activeTab === "json") {
      if (jsonValue === null) {
        return <div className="pane-empty">Not valid JSON — use Body or Raw tab</div>;
      }
      return renderJsonBody(find);
    }
    if (activeTab === "body") {
      if (!body) {
        return <div className="pane-empty">(empty)</div>;
      }
      if (jsonValue !== null) {
        return renderJsonBody(find);
      }
      return renderPlainBody(find);
    }
    if (activeTab === "raw") {
      if (!body) {
        return <div className="pane-empty">(empty)</div>;
      }
      return renderPlainBody(find);
    }
    return <div className="pane-empty">(empty)</div>;
  };

  return (
    <div className="message-pane">
      <div className="message-pane-title">
        <span>{title}</span>
      </div>
      <div className="pane-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`pane-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      {isSearchable ? (
        <SearchablePaneContent
          searchText={searchText}
          enabled={!isLoading}
          findOpenRequest={findOpenRequest}
        >
          {(find) => renderContent(find)}
        </SearchablePaneContent>
      ) : (
        <div className="pane-content">{renderContent()}</div>
      )}
    </div>
  );
}
