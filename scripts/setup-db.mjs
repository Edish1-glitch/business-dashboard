import { execSync } from "child_process";

console.log("Setting up database...");

try {
  console.log("Pushing schema...");
  execSync("npx prisma db push --skip-generate", {
    stdio: "inherit",
  });
  console.log("Schema pushed successfully");
} catch (e) {
  console.error("Schema push failed, trying to continue anyway...");
}
