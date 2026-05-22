import { useEffect, useState } from "react";
import {
  createRule,
  deleteRule,
  fetchRules,
  readLocalFile,
  updateRule,
  writeLocalFile,
} from "../api/client";
import { HTTP_STATUS_OPTIONS } from "../constants/httpStatus";
import { suggestLocalFileName } from "../utils/mapLocal";
import { MapLocalJsonSection } from "./MapLocalJsonSection";
import { ResizableHorizontalSplit } from "./ResizableHorizontalSplit";
import type { MapLocalRule, MapLocalSeed } from "../types";

interface MapLocalPanelProps {
  seed: MapLocalSeed | null;
  onSeedConsumed: () => void;
}

const EMPTY_RULE: MapLocalRule = {
  method: "GET",
  url: "https://api.example.com/v1/items",
  local_file: "example.json",
  status_code: 200,
  delay_ms: 0,
};

function buildRulePayload(draft: MapLocalRule): MapLocalRule {
  return {
    ...draft,
    local_file: suggestLocalFileName(draft.url),
    delay_ms: 0,
  };
}

export function MapLocalPanel({ seed, onSeedConsumed }: MapLocalPanelProps) {
  const [rules, setRules] = useState<MapLocalRule[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<MapLocalRule>(EMPTY_RULE);
  const [fileContent, setFileContent] = useState<string>("{}");
  const [message, setMessage] = useState<string | null>(null);

  const loadData = async (): Promise<void> => {
    const rulesData = await fetchRules();
    setRules(rulesData);
  };

  useEffect(() => {
    loadData().catch((error: Error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (seed === null) {
      return;
    }
    setEditingIndex(-1);
    setDraft({ ...seed.rule });
    setFileContent(seed.content);
    setMessage("Filled from selected request — click Save to enable Map Local");
    onSeedConsumed();
  }, [seed, onSeedConsumed]);

  const startCreate = (): void => {
    setEditingIndex(-1);
    setDraft({ ...EMPTY_RULE });
    setFileContent('{\n  "message": "Hello from local file"\n}\n');
  };

  const applyEditAtIndex = async (rulesList: MapLocalRule[], index: number): Promise<void> => {
    const rule = rulesList[index];
    if (!rule) {
      setEditingIndex(null);
      return;
    }
    setEditingIndex(index);
    setDraft({ ...rule });
    try {
      const content = await readLocalFile(rule.local_file);
      setFileContent(content);
    } catch {
      setFileContent("{}");
    }
  };

  const startEdit = async (index: number): Promise<void> => {
    await applyEditAtIndex(rules, index);
  };

  const saveRule = async (): Promise<void> => {
    const rulePayload = buildRulePayload(draft);
    await writeLocalFile(rulePayload.local_file, fileContent);
    if (editingIndex === null || editingIndex < 0) {
      await createRule(rulePayload);
      setMessage("Rule created");
    } else {
      await updateRule(editingIndex, rulePayload);
      setMessage("Rule updated");
    }
    setEditingIndex(null);
    await loadData();
  };

  const removeRule = async (index: number): Promise<void> => {
    const currentEditingIndex = editingIndex;
    try {
      await deleteRule(index);
      const rulesData = await fetchRules();
      setRules(rulesData);
      setMessage("Rule deleted");
      if (currentEditingIndex === null) {
        return;
      }
      if (rulesData.length === 0) {
        setEditingIndex(null);
        return;
      }
      if (currentEditingIndex < 0) {
        return;
      }
      if (currentEditingIndex === index) {
        const nextIndex = Math.min(index, rulesData.length - 1);
        await applyEditAtIndex(rulesData, nextIndex);
        return;
      }
      if (currentEditingIndex > index) {
        await applyEditAtIndex(rulesData, currentEditingIndex - 1);
        return;
      }
      await applyEditAtIndex(rulesData, currentEditingIndex);
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Failed to delete rule";
      setMessage(message);
    }
  };

  const rulesPane = (
    <div className="rules-table">
      <div className="rules-table-toolbar">
        <button className="btn btn-primary" type="button" onClick={startCreate}>
          + Add Map Local
        </button>
        {message && <span className="rules-table-message">{message}</span>}
      </div>
      <div className="rules-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th>URL</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, index) => (
              <tr
                key={`${rule.url}-${index}`}
                className={`rules-table-row ${editingIndex === index ? "selected" : ""}`}
                onClick={() => {
                  void startEdit(index);
                }}
              >
                <td>{rule.method}</td>
                <td className="rules-table-url">{rule.url}</td>
                <td>{rule.status_code}</td>
                <td
                  className="rules-table-actions"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    className="btn btn-danger"
                    type="button"
                    onClick={() => removeRule(index)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rules.length === 0 && (
          <div className="empty">No Map Local rules. Add one to mock API responses.</div>
        )}
      </div>
    </div>
  );

  const ruleFormPane =
    editingIndex !== null ? (
      <div className="rule-form">
        <h3>{editingIndex < 0 ? "New Rule" : "Edit Rule"}</h3>
        <div className="rule-form-fields">
          <label>
            Method
            <select
              value={draft.method}
              onChange={(event) => setDraft({ ...draft, method: event.target.value })}
            >
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>PATCH</option>
              <option>DELETE</option>
            </select>
          </label>
          <label>
            URL (exact match)
            <input
              value={draft.url}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  url: event.target.value,
                  local_file: suggestLocalFileName(event.target.value),
                })
              }
            />
          </label>
          <label>
            Status code
            <select
              value={draft.status_code}
              onChange={(event) =>
                setDraft({ ...draft, status_code: Number(event.target.value) })
              }
            >
              {HTTP_STATUS_OPTIONS.includes(draft.status_code) ? null : (
                <option value={draft.status_code}>{draft.status_code}</option>
              )}
              {HTTP_STATUS_OPTIONS.map((statusCode) => (
                <option key={statusCode} value={statusCode}>
                  {statusCode}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="rule-form-json-pane">
          <span className="rule-form-json-title">Response JSON</span>
          <MapLocalJsonSection value={fileContent} onChange={setFileContent} />
        </div>
        <div className="form-actions rule-form-actions">
          <button className="btn btn-primary" type="button" onClick={saveRule}>
            Save
          </button>
          <button className="btn" type="button" onClick={() => setEditingIndex(null)}>
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <div className="rule-form rule-form-empty">
        <div className="empty">Select a rule from the list or add a new Map Local rule.</div>
      </div>
    );

  return (
    <div className="map-local-panel">
      {rules.length > 0 || editingIndex !== null ? (
        <ResizableHorizontalSplit
          storageKey="tft-proxy-map-local-split"
          initialLeftPercent={55}
          minLeftPercent={28}
          maxLeftPercent={78}
          left={rulesPane}
          right={ruleFormPane}
        />
      ) : (
        rulesPane
      )}
    </div>
  );
}
