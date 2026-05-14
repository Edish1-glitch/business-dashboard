import { execSync } from "child_process";

console.log("Checking database...");

try {
  execSync("npx prisma db push", { stdio: "inherit", timeout: 30000 });
  console.log("Database ready");
} catch {
  console.log("DB push skipped (may already be synced)");
}
