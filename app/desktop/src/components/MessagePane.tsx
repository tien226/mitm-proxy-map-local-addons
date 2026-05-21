import { useMemo, useState } from "react";
import { JsonHighlightedCode } from "./JsonHighlightedCode";

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
  const queryParams = useMemo(() => parseQueryString(url), [url]);
  const jsonValue = useMemo(() => tryParseJson(body), [body]);
  const formattedJson = useMemo(() => {
    if (jsonValue === null) {
      return "";
    }
    return `${JSON.stringify(jsonValue, null, 2)}\n`;
  }, [jsonValue]);

  const renderJsonBody = (): JSX.Element => {
    return <JsonHighlightedCode text={formattedJson} />;
  };

  const renderContent = (): JSX.Element => {
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
      return renderJsonBody();
    }
    if (activeTab === "body") {
      if (!body) {
        return <div className="pane-empty">(empty)</div>;
      }
      if (jsonValue !== null) {
        return renderJsonBody();
      }
      return <pre className="pane-pre">{body}</pre>;
    }
    if (activeTab === "raw") {
      if (!body) {
        return <div className="pane-empty">(empty)</div>;
      }
      return <pre className="pane-pre">{body}</pre>;
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
      <div className="pane-content">{renderContent()}</div>
    </div>
  );
}
