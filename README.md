# ACR Appropriateness Criteria Editor

A local, editable ACR Appropriateness Criteria database editor.

This app does **not** crawl or access the ACR AC Portal. It imports data from a local Excel workbook, maps Excel columns to database fields, stores records in SQLite, and provides a registry/database-editor style UI.

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express
- Database: SQLite via `better-sqlite3`
- Excel import/export: `xlsx`

## One-command local run

If you are using the portable Node/npm installed in this project folder, run:

```bash
./run-local-dev.sh
```

Or enable the local Node/npm first:

```bash
source ./use-local-node.sh
```

Then run the normal commands:

```bash
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:5173
```

The API runs on:

```text
http://127.0.0.1:8787
```

## Recommended first import

Use the previously generated local Excel file:

```text
../gravitas_excel_database/gravitas_local_search_database.xlsx
```

In the app:

1. Click `Import Excel`.
2. Keep or edit the path above, then click `Preview path`.
3. Select `Search_Index` or `Procedures`.
4. Review the field mapping.
5. Click `Import selected sheet`.

The app automatically reads all workbook sheets and headers. If Excel column names do not exactly match the SQLite fields, use the mapping panel before import.

## Data model

Main table: `criteria_records`

Required editor fields:

- `panel`
- `topic`
- `variant`
- `scenario`
- `scenario_id`
- `procedure`
- `adult_rrl`
- `peds_rrl`
- `appropriateness_category`

Additional metadata:

- `source_sheet`
- `source_row`
- `source_hash`
- `created_at`
- `updated_at`

Import audit tables:

- `import_runs`
- `import_errors`

Schema file:

```text
server/schema.sql
```

SQLite file after first run:

```text
data/acr_ac_editor.sqlite3
```

## Excel import flow

1. User uploads a workbook or provides a local path.
2. Backend reads every sheet.
3. Backend extracts headers and sample rows from every sheet.
4. Backend suggests field mappings using common aliases.
5. User selects the sheet and can revise mappings.
6. Backend imports mapped rows into SQLite.
7. Duplicate records are counted through a unique index.
8. Missing or invalid rows are written to `import_errors`.
9. Import summary is written to `import_runs`.

## UI layout

The editor follows a registry/database editor layout:

```text
Panel / Topic tree  →  Variants / Scenario list  →  Procedure detail grid
```

Features:

- Search across fields
- Filter by Panel / Topic
- Sort columns
- Edit fields inline
- Save changed rows
- Add record
- Duplicate record
- Delete record
- Export CSV / Excel / JSON
- Import logs

## CLI import

Preview:

```bash
npm run import:excel -- preview ../gravitas_excel_database/gravitas_local_search_database.xlsx
```

Import:

```bash
npm run import:excel -- import ../gravitas_excel_database/gravitas_local_search_database.xlsx Search_Index
```

## GitHub initialization

This repository has already been prepared as a local git project. If you use GitHub Desktop:

1. Open GitHub Desktop.
2. Choose `File` -> `Add Local Repository`.
3. Select this folder.
4. Click `Fetch origin` or `Push origin` when GitHub Desktop shows local commits waiting to upload.

Equivalent command-line setup for a brand-new copy:

```bash
git init
git add .
git commit -m "Initial ACR AC editor MVP"
```

Then connect it to your GitHub repository:

```bash
git remote add origin https://github.com/chenmahao/acr-ac-editor.git
git push -u origin main
```

## Important non-goals

- No crawler
- No ACR website access
- No login automation
- No scraping
- No cloud database requirement

All app data must come from local Excel files.
