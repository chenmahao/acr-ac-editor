import { openDb, dbPath } from "./db";

const db = openDb();
const count = db.prepare("select count(*) as count from criteria_records").get() as { count: number };
db.close();
console.log(`SQLite ready: ${dbPath}`);
console.log(`criteria_records=${count.count}`);
