import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFlowContent } from "../api/client";

interface FlowBodyEntry {
  requestBody: string;
  responseBody: string;
}

interface UseFlowBodyCacheResult {
  requestBody: string;
  responseBody: string;
  detailError: string | null;
  isLoadingDetail: boolean;
}

export function useFlowBodyCache(
  selectedId: string | null,
  isProxyRunning: boolean
): UseFlowBodyCacheResult {
  const cacheRef = useRef<Map<string, FlowBodyEntry>>(new Map());
  const [requestBody, setRequestBody] = useState<string>("");
  const [responseBody, setResponseBody] = useState<string>("");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  const applyCachedEntry = useCallback((entry: FlowBodyEntry): void => {
    setRequestBody(entry.requestBody);
    setResponseBody(entry.responseBody);
    setDetailError(null);
  }, []);

  useEffect(() => {
    if (!selectedId || !isProxyRunning) {
      setRequestBody("");
      setResponseBody("");
      setDetailError(null);
      setIsLoadingDetail(false);
      return;
    }
    const cached = cacheRef.current.get(selectedId);
    if (cached) {
      applyCachedEntry(cached);
      setIsLoadingDetail(false);
      return;
    }
    let cancelled = false;
    const loadDetail = async (): Promise<void> => {
      setIsLoadingDetail(true);
      setDetailError(null);
      try {
        const [requestContent, responseContent] = await Promise.all([
          fetchFlowContent(selectedId, "request"),
          fetchFlowContent(selectedId, "response"),
        ]);
        if (cancelled) {
          return;
        }
        const entry: FlowBodyEntry = {
          requestBody: requestContent,
          responseBody: responseContent,
        };
        cacheRef.current.set(selectedId, entry);
        applyCachedEntry(entry);
        if (!responseContent && !requestContent) {
          setDetailError("Body is empty. Try another request or reload the flow list.");
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        const message = loadError instanceof Error ? loadError.message : "Failed to load body";
        setDetailError(message);
        setRequestBody("");
        setResponseBody("");
      } finally {
        if (!cancelled) {
          setIsLoadingDetail(false);
        }
      }
    };
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedId, isProxyRunning, applyCachedEntry]);

  return { requestBody, responseBody, detailError, isLoadingDetail };
}
