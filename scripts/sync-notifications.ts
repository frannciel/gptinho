import "dotenv/config";
import { createDb } from "../src/lib/db-client";
import { synchronizeNotifications } from "../src/server/notifications";
const url = process.env.DATABASE_URL;
if (!url) throw Error("Configure DATABASE_URL no ambiente.");
const db = createDb(url);
try {
  const result = await synchronizeNotifications(db, { force: true });
  console.log(
    JSON.stringify({ skipped: result.skipped, created: result.created }),
  );
} catch {
  console.error("govnex.notifications_sync_failed");
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
