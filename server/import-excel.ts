import path from "node:path";
import { openDb } from "./db";
import { importExcelToDb, previewWorkbook } from "./excel";

const [, , command, excelPath, sheetName] = process.argv;

if (!command || !excelPath || !["preview", "import"].includes(command)) {
  console.log("Usage:");
  console.log("  npm run import:excel -- preview /path/to/file.xlsx");
  console.log("  npm run import:excel -- import /path/to/file.xlsx [sheetName]");
  process.exit(1);
}

const resolved = path.resolve(excelPath);
async function main() {
  if (command === "preview") {
    console.log(JSON.stringify(previewWorkbook(resolved), null, 2));
  } else {
    const db = openDb();
    const result = importExcelToDb(db, { sourcePath: resolved, sheetName });
    db.close();
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
