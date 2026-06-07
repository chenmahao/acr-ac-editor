import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Upload } from "lucide-react";
import { api } from "../lib/api";
import type { ImportRun, SheetPreview } from "../types";

const FIELDS = [
  "panel",
  "topic",
  "variant",
  "scenario",
  "scenario_id",
  "procedure",
  "adult_rrl",
  "peds_rrl",
  "appropriateness_category"
];

export function ImportDialog({
  open,
  onClose,
  onImported
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [path, setPath] = useState("../gravitas_excel_database/gravitas_local_search_database.xlsx");
  const [sourcePath, setSourcePath] = useState("");
  const [sheets, setSheets] = useState<SheetPreview[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (open) {
      api.importRuns().then(setRuns).catch(() => undefined);
    }
  }, [open]);

  const selected = useMemo(() => sheets.find((sheet) => sheet.name === selectedSheet), [sheets, selectedSheet]);

  if (!open) return null;

  async function previewByPath() {
    setMessage("Reading workbook...");
    const result = await api.previewPath(path);
    setSourcePath(result.sourcePath);
    setSheets(result.sheets);
    const best = result.sheets[0];
    setSelectedSheet(best?.name ?? "");
    setMapping(best?.suggestedMapping ?? {});
    setMessage(`Workbook loaded: ${result.sheets.length} sheets.`);
  }

  async function previewUpload(file?: File) {
    if (!file) return;
    setMessage("Uploading workbook...");
    const result = await api.previewUpload(file);
    setSourcePath(result.sourcePath);
    setSheets(result.sheets);
    const best = result.sheets[0];
    setSelectedSheet(best?.name ?? "");
    setMapping(best?.suggestedMapping ?? {});
    setMessage(`Workbook uploaded: ${result.sourceName}`);
  }

  async function commit() {
    setMessage("Importing...");
    const result = await api.commitImport(sourcePath, selectedSheet, mapping);
    setMessage(`Inserted ${result.inserted}; duplicates ${result.duplicates}; failed ${result.failed}.`);
    const nextRuns = await api.importRuns();
    setRuns(nextRuns);
    onImported();
  }

  return (
    <div className="modal-backdrop">
      <div className="import-modal">
        <div className="modal-head">
          <div>
            <h2>Import Excel</h2>
            <p>Read all sheets, choose a source sheet, map fields, and import to SQLite.</p>
          </div>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="import-controls">
          <label>
            Local path
            <input value={path} onChange={(event) => setPath(event.target.value)} />
          </label>
          <button onClick={previewByPath}>Preview path</button>
          <label className="upload-button">
            <Upload size={16} /> Upload
            <input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => previewUpload(event.target.files?.[0])} />
          </label>
        </div>
        {message && <div className="import-message">{message}</div>}
        {sheets.length > 0 && (
          <div className="import-body">
            <div className="sheet-list">
              {sheets.map((sheet) => (
                <button
                  key={sheet.name}
                  className={selectedSheet === sheet.name ? "selected" : ""}
                  onClick={() => {
                    setSelectedSheet(sheet.name);
                    setMapping(sheet.suggestedMapping);
                  }}
                >
                  <strong>{sheet.name}</strong>
                  <span>{sheet.rowCount} rows</span>
                  <span>match score {sheet.score}</span>
                </button>
              ))}
            </div>
            <div className="mapping-panel">
              <h3>Field mapping</h3>
              <div className="mapping-grid">
                {FIELDS.map((field) => (
                  <label key={field}>
                    {field}
                    <select
                      value={mapping[field] ?? ""}
                      onChange={(event) => setMapping((current) => ({ ...current, [field]: event.target.value }))}
                    >
                      <option value="">(blank)</option>
                      {selected?.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <button className="primary" disabled={!sourcePath || !selectedSheet} onClick={commit}>
                Import selected sheet
              </button>
              <div className="sample-table">
                <table>
                  <thead>
                    <tr>{selected?.headers.slice(0, 8).map((header) => <th key={header}>{header}</th>)}</tr>
                  </thead>
                  <tbody>
                    {selected?.sampleRows.map((row, index) => (
                      <tr key={index}>
                        {selected.headers.slice(0, 8).map((header) => (
                          <td key={header}>{String(row[header] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        <div className="log-panel">
          <h3>Import log</h3>
          {runs.length === 0 ? (
            <p className="muted">
              <AlertCircle size={14} /> No imports yet.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Source</th>
                  <th>Sheet</th>
                  <th>Inserted</th>
                  <th>Duplicates</th>
                  <th>Failed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>{run.id}</td>
                    <td>{run.source_name}</td>
                    <td>{run.selected_sheet}</td>
                    <td>{run.inserted_count}</td>
                    <td>{run.duplicate_count}</td>
                    <td>{run.failed_count}</td>
                    <td>{run.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
