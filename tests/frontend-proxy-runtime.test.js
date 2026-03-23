const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fsp = require("node:fs/promises");

const {
  ASSET_TARGETS,
  getProxyRuntimePackageSpecs,
  reinstallBackendProxyPackages,
  syncFrontendProxyAssets
} = require("../scripts/sync-frontend-proxy-assets.js");

async function createProxyAssetFixture() {
  const rootDir = await fsp.mkdtemp(path.join(os.tmpdir(), "antarctic-proxy-runtime-"));
  const backendDir = path.join(rootDir, "backend");
  const frontendDir = path.join(rootDir, "frontend");

  await fsp.mkdir(backendDir, { recursive: true });
  await fsp.mkdir(frontendDir, { recursive: true });
  await fsp.writeFile(path.join(frontendDir, "index.html"), "<!doctype html><title>frontend</title>\n");

  for (const [index, target] of ASSET_TARGETS.entries()) {
    const sourcePath = path.join(backendDir, target.sourcePath);
    await fsp.mkdir(path.dirname(sourcePath), { recursive: true });
    await fsp.writeFile(sourcePath, `asset-${index}:${target.targetPath}\n`);
  }

  return { rootDir, backendDir, frontendDir };
}

test("syncFrontendProxyAssets refreshes frontend proxy assets from backend packages", async (t) => {
  const fixture = await createProxyAssetFixture();
  t.after(async () => {
    await fsp.rm(fixture.rootDir, { recursive: true, force: true });
  });

  await fsp.mkdir(path.join(fixture.frontendDir, "scram"), { recursive: true });
  await fsp.writeFile(path.join(fixture.frontendDir, "scram", "stale.txt"), "stale runtime\n");

  const result = await syncFrontendProxyAssets({
    backendDir: fixture.backendDir,
    frontendDir: fixture.frontendDir,
    clean: true
  });

  assert.equal(result.cleaned, true);
  await assert.rejects(
    fsp.readFile(path.join(fixture.frontendDir, "scram", "stale.txt"), "utf8"),
    /ENOENT/
  );

  for (const [index, target] of ASSET_TARGETS.entries()) {
    const targetPath = path.join(fixture.frontendDir, target.targetPath);
    const content = await fsp.readFile(targetPath, "utf8");
    assert.equal(content, `asset-${index}:${target.targetPath}\n`);
  }
});

test("syncFrontendProxyAssets check mode reports vendored proxy drift", async (t) => {
  const fixture = await createProxyAssetFixture();
  t.after(async () => {
    await fsp.rm(fixture.rootDir, { recursive: true, force: true });
  });

  await syncFrontendProxyAssets({
    backendDir: fixture.backendDir,
    frontendDir: fixture.frontendDir
  });

  await fsp.writeFile(
    path.join(fixture.frontendDir, ASSET_TARGETS[0].targetPath),
    "drifted runtime\n"
  );

  await assert.rejects(
    syncFrontendProxyAssets({
      backendDir: fixture.backendDir,
      frontendDir: fixture.frontendDir,
      check: true
    }),
    /Frontend proxy assets are out of sync: scram\/scramjet\.all\.js/
  );

  const verified = await syncFrontendProxyAssets({
    backendDir: fixture.backendDir,
    frontendDir: fixture.frontendDir
  }).then(() =>
    syncFrontendProxyAssets({
      backendDir: fixture.backendDir,
      frontendDir: fixture.frontendDir,
      check: true
    })
  );

  assert.equal(verified.verified, true);
  assert.equal(verified.count, ASSET_TARGETS.length);
});

test("getProxyRuntimePackageSpecs reads the MercuryWorkshop runtime package specs from package.json", async (t) => {
  const fixture = await createProxyAssetFixture();
  t.after(async () => {
    await fsp.rm(fixture.rootDir, { recursive: true, force: true });
  });

  await fsp.writeFile(
    path.join(fixture.backendDir, "package.json"),
    JSON.stringify({
      dependencies: {
        "@mercuryworkshop/scramjet": "https://example.invalid/scramjet.tgz",
        "@mercuryworkshop/bare-mux": "^2.1.8",
        "@mercuryworkshop/libcurl-transport": "^1.5.2"
      }
    })
  );

  const specs = getProxyRuntimePackageSpecs(fixture.backendDir);
  assert.deepEqual(specs, [
    {
      name: "@mercuryworkshop/scramjet",
      spec: "https://example.invalid/scramjet.tgz"
    },
    {
      name: "@mercuryworkshop/bare-mux",
      spec: "^2.1.8"
    },
    {
      name: "@mercuryworkshop/libcurl-transport",
      spec: "^1.5.2"
    }
  ]);
});

test("reinstallBackendProxyPackages removes vendored runtime packages and runs npm install for them again", async (t) => {
  const fixture = await createProxyAssetFixture();
  t.after(async () => {
    await fsp.rm(fixture.rootDir, { recursive: true, force: true });
  });

  await fsp.writeFile(
    path.join(fixture.backendDir, "package.json"),
    JSON.stringify({
      dependencies: {
        "@mercuryworkshop/scramjet": "https://example.invalid/scramjet.tgz",
        "@mercuryworkshop/bare-mux": "^2.1.8",
        "@mercuryworkshop/libcurl-transport": "^1.5.2"
      }
    })
  );

  await fsp.mkdir(
    path.join(fixture.backendDir, "node_modules", "@mercuryworkshop", "scramjet"),
    { recursive: true }
  );
  await fsp.writeFile(
    path.join(fixture.backendDir, "node_modules", "@mercuryworkshop", "scramjet", "stale.txt"),
    "stale package\n"
  );

  let installContext = null;
  const result = await reinstallBackendProxyPackages({
    backendDir: fixture.backendDir,
    runInstall: async function mockRunInstall(context) {
      installContext = context;
    }
  });

  await assert.rejects(
    fsp.readFile(
      path.join(fixture.backendDir, "node_modules", "@mercuryworkshop", "scramjet", "stale.txt"),
      "utf8"
    ),
    /ENOENT/
  );
  assert.equal(result.command, "npm");
  assert.ok(installContext);
  assert.equal(installContext.env.npm_config_cache, path.join(fixture.backendDir, ".npm-cache"));
  assert.deepEqual(installContext.args, [
    "install",
    "--no-save",
    "@mercuryworkshop/scramjet@https://example.invalid/scramjet.tgz",
    "@mercuryworkshop/bare-mux@^2.1.8",
    "@mercuryworkshop/libcurl-transport@^1.5.2"
  ]);
});

test("syncFrontendProxyAssets can reinstall backend proxy packages before wiping and resyncing the frontend runtime", async (t) => {
  const fixture = await createProxyAssetFixture();
  t.after(async () => {
    await fsp.rm(fixture.rootDir, { recursive: true, force: true });
  });

  await fsp.writeFile(
    path.join(fixture.backendDir, "package.json"),
    JSON.stringify({
      dependencies: {
        "@mercuryworkshop/scramjet": "https://example.invalid/scramjet.tgz",
        "@mercuryworkshop/bare-mux": "^2.1.8",
        "@mercuryworkshop/libcurl-transport": "^1.5.2"
      }
    })
  );

  let installContext = null;
  const result = await syncFrontendProxyAssets({
    backendDir: fixture.backendDir,
    frontendDir: fixture.frontendDir,
    clean: true,
    reinstall: true,
    runInstall: async function mockRunInstall(context) {
      installContext = context;
      for (const [index, target] of ASSET_TARGETS.entries()) {
        const sourcePath = path.join(fixture.backendDir, target.sourcePath);
        await fsp.mkdir(path.dirname(sourcePath), { recursive: true });
        await fsp.writeFile(sourcePath, `reinstalled-${index}:${target.targetPath}\n`);
      }
    }
  });

  assert.equal(result.cleaned, true);
  assert.equal(result.reinstalled, true);
  assert.ok(installContext);
  const firstTargetContent = await fsp.readFile(
    path.join(fixture.frontendDir, ASSET_TARGETS[0].targetPath),
    "utf8"
  );
  assert.equal(firstTargetContent, `reinstalled-0:${ASSET_TARGETS[0].targetPath}\n`);
});
