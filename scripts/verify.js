#!/usr/bin/env node

const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { resolveFrontendDir, syncFrontendProxyAssets } = require("./sync-frontend-proxy-assets.js");

const backendDir = path.resolve(__dirname, "..");
const filesToCheck = [
  path.join(backendDir, "apps.js"),
  path.join(backendDir, "server.js"),
  path.join(backendDir, "scripts", "ensure-runtime-deps.js"),
  path.join(backendDir, "scripts", "migrate-community-to-supabase.js"),
  path.join(backendDir, "scripts", "sync-frontend-proxy-assets.js"),
  path.join(backendDir, "services", "community-migration.js"),
  path.join(backendDir, "services", "community-sqlite-store.js"),
  path.join(backendDir, "services", "community-supabase-store.js")
];

for (const filePath of filesToCheck) {
  execFileSync(process.execPath, ["--check", filePath], {
    cwd: backendDir,
    stdio: "inherit"
  });
}

(async () => {
  try {
    const frontendDir = resolveFrontendDir(backendDir);
    await syncFrontendProxyAssets({ backendDir, frontendDir, check: true });
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    if (/Could not find a sibling frontend checkout\./.test(message)) {
      return;
    }
    throw error;
  }
})().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
