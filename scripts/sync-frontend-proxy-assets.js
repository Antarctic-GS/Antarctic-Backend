#!/usr/bin/env node

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const BACKEND_DIR = path.resolve(__dirname, "..");
const ASSET_TARGETS = [
  {
    sourcePath: path.join("node_modules", "@mercuryworkshop", "scramjet", "dist", "scramjet.all.js"),
    targetPath: path.join("scram", "scramjet.all.js")
  },
  {
    sourcePath: path.join("node_modules", "@mercuryworkshop", "scramjet", "dist", "scramjet.sync.js"),
    targetPath: path.join("scram", "scramjet.sync.js")
  },
  {
    sourcePath: path.join("node_modules", "@mercuryworkshop", "scramjet", "dist", "scramjet.wasm.wasm"),
    targetPath: path.join("scram", "scramjet.wasm.wasm")
  },
  {
    sourcePath: path.join("node_modules", "@mercuryworkshop", "bare-mux", "dist", "index.js"),
    targetPath: path.join("baremux", "index.js")
  },
  {
    sourcePath: path.join("node_modules", "@mercuryworkshop", "bare-mux", "dist", "worker.js"),
    targetPath: path.join("baremux", "worker.js")
  },
  {
    sourcePath: path.join("node_modules", "@mercuryworkshop", "libcurl-transport", "dist", "index.mjs"),
    targetPath: path.join("libcurl", "index.mjs")
  }
];

async function main() {
  const frontendDir = resolveFrontendDir();

  for (const target of ASSET_TARGETS) {
    const sourcePath = path.join(BACKEND_DIR, target.sourcePath);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(
        `Missing proxy asset ${sourcePath}. Run npm install in ${BACKEND_DIR} before syncing frontend proxy assets.`
      );
    }

    const targetPath = path.join(frontendDir, target.targetPath);
    await fsp.mkdir(path.dirname(targetPath), { recursive: true });
    await fsp.copyFile(sourcePath, targetPath);
  }

  console.log("Synced %d Scramjet proxy assets into %s", ASSET_TARGETS.length, frontendDir);
}

function resolveFrontendDir() {
  const candidates = [
    path.resolve(BACKEND_DIR, "..", "palladium-frontend"),
    path.resolve(BACKEND_DIR, "..", "frontend")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }

  throw new Error(
    "Could not find a sibling frontend checkout. Expected index.html under ../palladium-frontend or ../frontend."
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
