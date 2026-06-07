import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as XLSX from "xlsx";
import type Database from "better-sqlite3";

export const DB_FIELDS = [
  "panel",
  "topic",
  "variant",
  "scenario",
  "scenario_id",
  "procedure",
  "adult_rrl",
  "peds_rrl",
  "appropriateness_category"
] as const;

export type DbField = (typeof DB_FIELDS)[number];
export type FieldMapping = Partial<Record<DbField, string>>;

export type SheetPreview = {
  name: string;
  rowCount: number;
  headers: string[];
  sampleRows: Record<string, unknown>[];
  suggestedMapping: FieldMapping;
  score: number;
};

const FIELD_ALIASES: Record<DbField, string[]> = {
  panel: ["panel", "modality panel", "acr panel"],
  topic: ["topic", "topic title", "title", "narrative title"],
  variant: ["variant", "variants", "variant description"],
  scenario: ["scenario", "scenario text", "clinical scenario", "scenario.1"],
  scenario_id: ["scenario id", "scenario_id", "scenarioid", "id"],
  procedure: ["procedure", "exam", "imaging procedure", "procedure name"],
  adult_rrl: ["adult rrl", "adult_rrl", "relative radiation level", "rrl", "radiation level"],
  peds_rrl: ["peds rrl", "pediatric rrl", "peds_rrl", "peds radiation"],
  appropriateness_category: [
    "appropriateness category",
    "appropriateness",
    "category",
    "rating",
    "recommendation"
  ]
};

function normalizeHeader(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function safeJson(value: unknown) {
  return JSON.stringify(value ?? {});
}

function recordHash(record: Record<DbField, string>) {
  return crypto
    .createHash("sha256")
    .update(DB_FIELDS.map((field) => record[field] || "").join("\u241f"))
    .digest("hex");
}

export function readWorkbook(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel file not found: ${filePath}`);
  }
  return XLSX.readFile(filePath, { cellDates: false });
}

function rowsForSheet(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false
  });
}

export function suggestMapping(headers: string[]): { mapping: FieldMapping; score: number } {
  const normalizedHeaders = headers.map((header) => ({
    raw: header,
    normalized: normalizeHeader(header)
  }));
  const mapping: FieldMapping = {};
  let score = 0;

  for (const field of DB_FIELDS) {
    const aliases = FIELD_ALIASES[field].map(normalizeHeader);
    const exact = normalizedHeaders.find((header) => aliases.includes(header.normalized));
    if (exact) {
      mapping[field] = exact.raw;
      score += 3;
      continue;
    }
    const contains = normalizedHeaders.find((header) =>
      aliases.some((alias) => header.normalized.includes(alias) || alias.includes(header.normalized))
    );
    if (contains) {
      mapping[field] = contains.raw;
      score += 1;
    }
  }

  return { mapping, score };
}

export function previewWorkbook(filePath: string): SheetPreview[] {
  const workbook = readWorkbook(filePath);
  return workbook.SheetNames.map((name) => {
    const rows = rowsForSheet(workbook, name);
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const { mapping, score } = suggestMapping(headers);
    return {
      name,
      rowCount: rows.length,
      headers,
      sampleRows: rows.slice(0, 5),
      suggestedMapping: mapping,
      score
    };
  }).sort((a, b) => b.score - a.score || b.rowCount - a.rowCount);
}

function mappedRecord(row: Record<string, unknown>, mapping: FieldMapping): Record<DbField, string> {
  const record = {} as Record<DbField, string>;
  for (const field of DB_FIELDS) {
    const header = mapping[field];
    record[field] = header ? normalizeCell(row[header]) : "";
  }
  return record;
}

export function bestSheet(previews: SheetPreview[]) {
  return previews.find((sheet) => sheet.score > 0 && sheet.rowCount > 0) ?? previews[0];
}

export function importExcelToDb(
  db: Database.Database,
  options: {
    sourcePath: string;
    sourceName?: string;
    sheetName?: string;
    mapping?: FieldMapping;
  }
) {
  const sourcePath = path.resolve(options.sourcePath);
  const previews = previewWorkbook(sourcePath);
  const selected = options.sheetName
    ? previews.find((sheet) => sheet.name === options.sheetName)
    : bestSheet(previews);
  if (!selected) {
    throw new Error("Workbook has no readable sheets.");
  }
  const mapping = { ...selected.suggestedMapping, ...(options.mapping ?? {}) };
  const missingRequired = ["scenario", "procedure"].filter((field) => !mapping[field as DbField]);

  const run = db
    .prepare(
      `insert into import_runs
       (source_name, source_path, selected_sheet, missing_fields, mapping_json, sheet_summary_json, status, message)
       values (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      options.sourceName ?? path.basename(sourcePath),
      sourcePath,
      selected.name,
      missingRequired.join(","),
      JSON.stringify(mapping),
      JSON.stringify(previews.map(({ sampleRows, ...rest }) => rest)),
      missingRequired.length ? "warning" : "running",
      missingRequired.length ? `Missing recommended fields: ${missingRequired.join(", ")}` : ""
    );
  const runId = Number(run.lastInsertRowid);

  const workbook = readWorkbook(sourcePath);
  const rows = rowsForSheet(workbook, selected.name);
  const insert = db.prepare(
    `insert into criteria_records
     (panel, topic, variant, scenario, scenario_id, procedure, adult_rrl, peds_rrl,
      appropriateness_category, source_sheet, source_row, source_hash)
     values
     (@panel, @topic, @variant, @scenario, @scenario_id, @procedure, @adult_rrl, @peds_rrl,
      @appropriateness_category, @source_sheet, @source_row, @source_hash)`
  );
  const insertError = db.prepare(
    "insert into import_errors(run_id, row_number, reason, raw_json) values (?, ?, ?, ?)"
  );

  let inserted = 0;
  let duplicates = 0;
  let failed = 0;
  const tx = db.transaction(() => {
    rows.forEach((row, index) => {
      const sourceRow = index + 2;
      const record = mappedRecord(row, mapping);
      if (!record.scenario && !record.procedure) {
        failed += 1;
        insertError.run(runId, sourceRow, "Row has neither scenario nor procedure after mapping.", safeJson(row));
        return;
      }
      const payload = {
        ...record,
        source_sheet: selected.name,
        source_row: sourceRow,
        source_hash: recordHash(record)
      };
      try {
        insert.run(payload);
        inserted += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("UNIQUE")) {
          duplicates += 1;
        } else {
          failed += 1;
          insertError.run(runId, sourceRow, message, safeJson(row));
        }
      }
    });
    db.prepare(
      `update import_runs
       set total_rows=?, inserted_count=?, duplicate_count=?, failed_count=?,
           status=?, message=?, finished_at=datetime('now')
       where id=?`
    ).run(
      rows.length,
      inserted,
      duplicates,
      failed,
      failed ? "completed_with_errors" : "completed",
      `Imported ${inserted}; duplicates ${duplicates}; failed ${failed}.`,
      runId
    );
  });
  tx();

  return {
    runId,
    sourcePath,
    selectedSheet: selected.name,
    totalRows: rows.length,
    inserted,
    duplicates,
    failed,
    missingFields: missingRequired,
    mapping,
    previews
  };
}
