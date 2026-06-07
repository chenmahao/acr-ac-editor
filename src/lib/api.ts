import type { CriteriaRecord, ImportRun, ScenarioSummary, SheetPreview, TreePanel } from "../types";

const jsonHeaders = { "Content-Type": "application/json" };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean; records: number }>("/api/health"),
  tree: () => request<TreePanel[]>("/api/tree"),
  scenarios: (params: URLSearchParams) => request<ScenarioSummary[]>(`/api/scenarios?${params}`),
  records: (params: URLSearchParams) =>
    request<{ total: number; records: CriteriaRecord[] }>(`/api/records?${params}`),
  createRecord: (record: Partial<CriteriaRecord>) =>
    request<CriteriaRecord>("/api/records", { method: "POST", headers: jsonHeaders, body: JSON.stringify(record) }),
  updateRecord: (id: number, patch: Partial<CriteriaRecord>) =>
    request<CriteriaRecord>(`/api/records/${id}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify(patch)
    }),
  deleteRecord: (id: number) => request<void>(`/api/records/${id}`, { method: "DELETE" }),
  duplicateRecord: (id: number) => request<CriteriaRecord>(`/api/records/${id}/duplicate`, { method: "POST" }),
  importRuns: () => request<ImportRun[]>("/api/import-runs"),
  previewUpload: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ sourcePath: string; sourceName: string; sheets: SheetPreview[]; fields: string[] }>(
      "/api/import/preview",
      { method: "POST", body: form }
    );
  },
  previewPath: (path: string) => {
    const form = new FormData();
    form.append("path", path);
    return request<{ sourcePath: string; sourceName: string; sheets: SheetPreview[]; fields: string[] }>(
      "/api/import/preview",
      { method: "POST", body: form }
    );
  },
  commitImport: (sourcePath: string, sheetName: string, mapping: Record<string, string>) =>
    request<{
      runId: number;
      totalRows: number;
      inserted: number;
      duplicates: number;
      failed: number;
      missingFields: string[];
    }>("/api/import/commit", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ sourcePath, sheetName, mapping })
    })
};
