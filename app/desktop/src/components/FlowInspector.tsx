import { useState } from "react";
import { MessagePane } from "./MessagePane";
import { ResizableHorizontalSplit } from "./ResizableHorizontalSplit";
import { buildCurlCommand } from "../utils/curl";
import { getFlowUrl } from "../utils/flow";
import type { MitmFlow } from "../types";

interface FlowInspectorProps {
  flow: MitmFlow;
  requestBody: string;
  responseBody: string;
  isLoading: boolean;
  loadError: string | null;
  onMapLocal: () => void;
}

function normalizeHeaders(headers: unknown): Array<[string, string]> {
  if (!Array.isArray(headers)) {
    return [];
  }
  return headers.map((header) => {
    if (Array.isArray(header) && header.length >= 2) {
      return [String(header[0]), String(header[1])];
    }
    return ["", ""];
  });
}

export function FlowInspector({
  flow,
  requestBody,
  responseBody,
  isLoading,
  loadError,
  onMapLocal,
}: FlowInspectorProps) {
  const [copyCurlLabel, setCopyCurlLabel] = useState<string>("Copy cURL");
  const url = getFlowUrl(flow);
  const requestHeaders = normalizeHeaders(flow.request.headers);
  const responseHeaders = normalizeHeaders(flow.response?.headers);
  const statusCode = flow.response?.status_code;
  const statusReason = (flow.response as { reason?: string } | undefined)?.reason;

  const handleCopyCurl = async (): Promise<void> => {
    const command = buildCurlCommand(flow.request.method, url, requestHeaders, requestBody);
    try {
      await navigator.clipboard.writeText(command);
      setCopyCurlLabel("Copied!");
      window.setTimeout(() => setCopyCurlLabel("Copy cURL"), 2000);
    } catch {
      setCopyCurlLabel("Copy failed");
      window.setTimeout(() => setCopyCurlLabel("Copy cURL"), 2000);
    }
  };

  return (
    <div className="flow-inspector">
      <div className="flow-summary">
        <div className="flow-summary-row">
          <div className="flow-summary-url">{url}</div>
          <div className="flow-summary-actions">
            <button
              className="btn btn-copy-curl"
              type="button"
              onClick={handleCopyCurl}
              title="Copy request as cURL command"
            >
              {copyCurlLabel}
            </button>
            <button
              className="btn btn-map-local"
              type="button"
              onClick={onMapLocal}
              title="Map this API to a local JSON file"
            >
              Map Local
            </button>
          </div>
        </div>
      </div>
      {loadError && <div className="error-banner">{loadError}</div>}
      <div className="flow-panes">
        <ResizableHorizontalSplit
          storageKey="tft-proxy-request-response-split"
          left={
            <MessagePane
              title="Request"
              url={url}
              method={flow.request.method}
              headers={requestHeaders}
              body={requestBody}
              isLoading={isLoading}
              showQuery={true}
            />
          }
          right={
            <MessagePane
              title="Response"
              url={url}
              statusCode={statusCode}
              statusReason={statusReason}
              headers={responseHeaders}
              body={responseBody}
              isLoading={isLoading}
              showQuery={false}
            />
          }
        />
      </div>
    </div>
  );
}
