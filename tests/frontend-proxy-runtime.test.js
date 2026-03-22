const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fsp = require("node:fs/promises");

const {
  ASSET_TARGETS,
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
