import path from "node:path";
import fs from "node:fs";
import express from "express";
import cors from "cors";
import multer from "multer";
import * as XLSX from "@e965/xlsx";
import { openDb, uploadDir, exportDir } from "./db";
import { DB_FIELDS, importExcelToDb, previewWorkbook, type FieldMapping } from "./excel";

const app = express();
const db = openDb();
const upload = multer({ dest: uploadDir });
const PORT = Number(process.env.PORT ?? 8787);
const BLANK_FILTER = "__blank__";

app.use(cors());
app.use(express.json({ limit: "20mb" }));

function addExactFilter(
  where: string[],
  params: Record<string, unknown>,
  field: string,
  value: unknown
) {
  if (value === undefined) return;
  const raw = String(value);
  if (!raw) return;
  if (raw === BLANK_FILTER || /^\(Unassigned .+\)$/.test(raw)) {
    where.push(`${field} = ''`);
    return;
  }
  where.push(`${field} = @${field}`);
  params[field] = raw;
}

function listQuery(req: express.Request) {
  const allowedSort = new Set([...DB_FIELDS, "id", "updated_at"]);
  const sort = allowedSort.has(String(req.query.sort ?? "")) ? String(req.query.sort) : "scenario";
  const order = String(req.query.order ?? "asc").toLowerCase() === "desc" ? "desc" : "asc";
  const limit = Math.min(Number(req.query.limit ?? 200), 1000);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);
  const where: string[] = [];
  const params: Record<string, unknown> = { limit, offset };

  for (const field of ["panel", "topic", "variant", "scenario", "scenario_id"] as const) {
    addExactFilter(where, params, field, req.query[field]);
  }
  if (req.query.search) {
    where.push(`(
      panel || ' ' || topic || ' ' || variant || ' ' || scenario || ' ' ||
      scenario_id || ' ' || procedure || ' ' || adult_rrl || ' ' || peds_rrl || ' ' ||
      appropriateness_category
    ) like @search`);
    params.search = `%${String(req.query.search)}%`;
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  return { whereSql, params, sort, order };
}

app.get("/api/health", (_req, res) => {
  const count = db.prepare("select count(*) as count from criteria_records").get() as { count: number };
  res.json({ ok: true, records: count.count });
});

app.get("/api/tree", (_req, res) => {
  const rows = db
    .prepare(
      `select
         coalesce(nullif(panel,''), '(Unassigned Panel)') as panel,
         coalesce(nullif(topic,''), '(Unassigned Topic)') as topic,
         count(distinct scenario || '|' || scenario_id) as scenarios,
         count(*) as procedures
       from criteria_records
       group by panel, topic
       order by panel, topic`
    )
    .all();
  const panels = new Map<string, { panel: string; scenarios: number; procedures: number; topics: unknown[] }>();
  for (const row of rows as Array<{ panel: string; topic: string; scenarios: number; procedures: number }>) {
    if (!panels.has(row.panel)) {
      panels.set(row.panel, { panel: row.panel, scenarios: 0, procedures: 0, topics: [] });
    }
    const panel = panels.get(row.panel)!;
    panel.scenarios += row.scenarios;
    panel.procedures += row.procedures;
    panel.topics.push({ topic: row.topic, scenarios: row.scenarios, procedures: row.procedures });
  }
  res.json([...panels.values()]);
});

app.get("/api/scenarios", (req, res) => {
  const where: string[] = [];
  const params: Record<string, string> = {};
  for (const field of ["panel", "topic"] as const) {
    addExactFilter(where, params, field, req.query[field]);
  }
  if (req.query.search) {
    where.push("(scenario like @search or scenario_id like @search or variant like @search)");
    params.search = `%${String(req.query.search)}%`;
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  const rows = db
    .prepare(
      `select
         panel, topic, variant, scenario, scenario_id,
         count(*) as procedure_count,
         group_concat(distinct appropriateness_category) as categories
       from criteria_records
       ${whereSql}
       group by panel, topic, variant, scenario, scenario_id
       order by scenario
       limit 500`
    )
    .all(params);
  res.json(rows);
});

app.get("/api/records", (req, res) => {
  const { whereSql, params, sort, order } = listQuery(req);
  const total = db.prepare(`select count(*) as count from criteria_records ${whereSql}`).get(params) as {
    count: number;
  };
  const records = db
    .prepare(`select * from criteria_records ${whereSql} order by ${sort} ${order} limit @limit offset @offset`)
    .all(params);
  res.json({ total: total.count, records });
});

app.post("/api/records", (req, res) => {
  const payload = Object.fromEntries(DB_FIELDS.map((field) => [field, String(req.body[field] ?? "")]));
  const result = db
    .prepare(
      `insert into criteria_records
       (${DB_FIELDS.join(", ")}, source_sheet)
       values (${DB_FIELDS.map((field) => `@${field}`).join(", ")}, 'manual')`
    )
    .run(payload);
  res.status(201).json(db.prepare("select * from criteria_records where id=?").get(result.lastInsertRowid));
});

app.patch("/api/records/:id", (req, res) => {
  const id = Number(req.params.id);
  const entries = DB_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(req.body, field));
  if (!entries.length) return res.status(400).json({ error: "No editable fields supplied." });
  const assignments = entries.map((field) => `${field}=@${field}`).join(", ");
  const params = Object.fromEntries(entries.map((field) => [field, String(req.body[field] ?? "")]));
  db.prepare(`update criteria_records set ${assignments}, updated_at=datetime('now') where id=@id`).run({
    ...params,
    id
  });
  res.json(db.prepare("select * from criteria_records where id=?").get(id));
});

app.delete("/api/records/:id", (req, res) => {
  db.prepare("delete from criteria_records where id=?").run(Number(req.params.id));
  res.status(204).end();
});

app.post("/api/records/:id/duplicate", (req, res) => {
  const source = db.prepare("select * from criteria_records where id=?").get(Number(req.params.id)) as
    | Record<string, unknown>
    | undefined;
  if (!source) return res.status(404).json({ error: "Record not found." });
  const payload = Object.fromEntries(DB_FIELDS.map((field) => [field, String(source[field] ?? "")]));
  payload.procedure = `${payload.procedure} (copy)`;
  const result = db
    .prepare(
      `insert into criteria_records
       (${DB_FIELDS.join(", ")}, source_sheet)
       values (${DB_FIELDS.map((field) => `@${field}`).join(", ")}, 'manual-copy')`
    )
    .run(payload);
  res.status(201).json(db.prepare("select * from criteria_records where id=?").get(result.lastInsertRowid));
});

app.post("/api/import/preview", upload.single("file"), async (req, res) => {
  try {
    const sourcePath = req.file?.path ?? String(req.body.path ?? "");
    if (!sourcePath) return res.status(400).json({ error: "Upload a file or provide a path." });
    const previews = previewWorkbook(sourcePath);
    res.json({
      sourcePath,
      sourceName: req.file?.originalname ?? path.basename(sourcePath),
      sheets: previews,
      fields: DB_FIELDS
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/import/commit", async (req, res) => {
  try {
    const sourcePath = String(req.body.sourcePath ?? "");
    const sheetName = req.body.sheetName ? String(req.body.sheetName) : undefined;
    const mapping = (req.body.mapping ?? {}) as FieldMapping;
    if (!sourcePath) return res.status(400).json({ error: "sourcePath is required." });
    const result = importExcelToDb(db, { sourcePath, sheetName, mapping });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/import-runs", (_req, res) => {
  res.json(
    db
      .prepare(
        `select id, source_name, selected_sheet, total_rows, inserted_count, duplicate_count,
                failed_count, missing_fields, status, message, started_at, finished_at
         from import_runs
         order by id desc
         limit 50`
      )
      .all()
  );
});

app.get("/api/export/:format", (req, res) => {
  const format = req.params.format;
  const rows = db.prepare("select * from criteria_records order by panel, topic, scenario, procedure").all();
  if (format === "json") {
    res.setHeader("Content-Disposition", "attachment; filename=acr_ac_records.json");
    return res.json(rows);
  }
  if (format === "csv") {
    const headers = ["id", ...DB_FIELDS, "source_sheet", "source_row", "created_at", "updated_at"];
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => escape((row as any)[header])).join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=acr_ac_records.csv");
    return res.send(csv);
  }
  if (format === "xlsx") {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "ACR_AC_Records");
    const outPath = path.join(exportDir, "acr_ac_records.xlsx");
    fs.writeFileSync(outPath, XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }));
    return res.download(outPath);
  }
  return res.status(400).json({ error: "Unsupported export format." });
});

app.listen(PORT, () => {
  console.log(`ACR AC Editor API listening on http://127.0.0.1:${PORT}`);
});
