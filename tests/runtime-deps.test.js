const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fsp = require("node:fs/promises");

const BACKEND_DIR = path.resolve(__dirname, "..");
const {
  REQUIRED_RUNTIME_MODULES,
  ensureRuntimeDependencies,
  getMissingRuntimeModules
} = require("../scripts/ensure-runtime-deps.js");

test("getMissingRuntimeModules reports only unresolved runtime modules", () => {
  const missing = getMissingRuntimeModules(
    BACKEND_DIR,
    ["present-module", "missing-module"],
    (_rootDir, specifier) => {
      if (specifier === "present-module") {
        return "/tmp/present-module.js";
      }
      throw new Error(`Cannot resolve ${specifier}`);
    }
  );

  assert.deepEqual(missing, ["missing-module"]);
});

test("ensureRuntimeDependencies skips installation when all runtime modules resolve", () => {
  const installCalls = [];
  const result = ensureRuntimeDependencies(BACKEND_DIR, {
    resolver: () => "/tmp/resolved-module.js",
    installer: (rootDir) => installCalls.push(rootDir),
    logger: { log() {} }
  });

  assert.deepEqual(result, { installed: false, missing: [] });
  assert.deepEqual(installCalls, []);
});

test("ensureRuntimeDependencies installs missing runtime modules once", () => {
  const resolutionAttempts = new Map();
  const installCalls = [];
  const result = ensureRuntimeDependencies(BACKEND_DIR, {
    resolver: (_rootDir, specifier) => {
      const attempts = resolutionAttempts.get(specifier) ?? 0;
      resolutionAttempts.set(specifier, attempts + 1);
      if (attempts === 0) {
        throw new Error(`Missing ${specifier}`);
      }
      return `/tmp/${specifier}.js`;
    },
    installer: (rootDir) => installCalls.push(rootDir),
    logger: { log() {} }
  });

  assert.equal(result.installed, true);
  assert.deepEqual(result.missing, REQUIRED_RUNTIME_MODULES);
  assert.deepEqual(installCalls, [BACKEND_DIR]);
});

test("ensureRuntimeDependencies throws when install does not repair missing modules", () => {
  assert.throws(
    () =>
      ensureRuntimeDependencies(BACKEND_DIR, {
        resolver: () => {
          throw new Error("still missing");
        },
        installer: () => {},
        logger: { log() {} }
      }),
    /Runtime dependencies are still missing after install/
  );
});

test("start.sh bootstraps runtime dependencies before launching the backend", async () => {
  const script = await fsp.readFile(path.join(BACKEND_DIR, "start.sh"), "utf8");

  assert.match(script, /node scripts\/ensure-runtime-deps\.js/);
});
