/**
 * Auto-update system for recs.
 *
 * After each invocation, a detached background process checks for updates
 * (at most once per 24 hours). If a newer version is available, a notice
 * is printed on the next run.
 *
 * State is stored in ~/.config/recs/ (or $XDG_CONFIG_HOME/recs/).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, chmodSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync, spawn } from "node:child_process";

const REPO = "benbernard/RecordStream";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Config directory ────────────────────────────────────────────

export function getConfigDir(): string {
  const xdg = process.env["XDG_CONFIG_HOME"];
  const home = process.env["HOME"] ?? process.env["USERPROFILE"] ?? "";
  const base = xdg || join(home, ".config");
  return join(base, "recs");
}

export function ensureConfigDir(): string {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ── Version helpers ─────────────────────────────────────────────

export function getCurrentVersion(): string {
  try {
    const pkgPath = join(dirname(import.meta.dir), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

/**
 * Compare two semver strings. Returns:
 *   -1 if a < b
 *    0 if a === b
 *    1 if a > b
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);

  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

// ── Update check state ──────────────────────────────────────────

export function getLastCheckTime(configDir: string): number {
  const checkFile = join(configDir, "last-update-check");
  try {
    const content = readFileSync(checkFile, "utf-8").trim();
    return parseInt(content, 10) || 0;
  } catch {
    return 0;
  }
}

export function shouldCheck(configDir: string): boolean {
  const lastCheck = getLastCheckTime(configDir);
  return Date.now() - lastCheck > CHECK_INTERVAL_MS;
}

export function setLastCheckTime(configDir: string, time: number): void {
  const checkFile = join(configDir, "last-update-check");
  writeFileSync(checkFile, String(time), "utf-8");
}

export interface UpdateInfo {
  version: string;
  checkedAt: number;
}

export function getAvailableUpdate(configDir: string): UpdateInfo | null {
  const updateFile = join(configDir, "update-available");
  try {
    const content = readFileSync(updateFile, "utf-8");
    return JSON.parse(content) as UpdateInfo;
  } catch {
    return null;
  }
}

export function setAvailableUpdate(configDir: string, info: UpdateInfo | null): void {
  const updateFile = join(configDir, "update-available");
  if (info === null) {
    try {
      unlinkSync(updateFile);
    } catch {
      // File didn't exist
    }
  } else {
    writeFileSync(updateFile, JSON.stringify(info), "utf-8");
  }
}

export function clearAvailableUpdate(configDir: string): void {
  setAvailableUpdate(configDir, null);
}

// ── Network check ───────────────────────────────────────────────

export interface LatestReleaseInfo {
  tagName: string;
  version: string;
}

/**
 * Fetch the latest release version from GitHub.
 * Returns null on any network or parsing error (silent failure is intentional
 * for a background update check).
 */
export async function fetchLatestRelease(): Promise<LatestReleaseInfo | null> {
  try {
    const url = `https://api.github.com/repos/${REPO}/releases/latest`;
    const response = await fetch(url, {
      headers: { "Accept": "application/vnd.github.v3+json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;

    const data = await response.json() as { tag_name?: string };
    const tagName = data.tag_name;
    if (!tagName) return null;

    return {
      tagName,
      version: tagName.replace(/^v/, ""),
    };
  } catch {
    return null;
  }
}

// ── Background check logic ──────────────────────────────────────

/**
 * Perform the background update check. Called in a detached subprocess.
 * Checks if enough time has passed, fetches latest release, writes state.
 */
export async function performUpdateCheck(): Promise<void> {
  const configDir = ensureConfigDir();
  const now = Date.now();

  const lastCheck = getLastCheckTime(configDir);
  if (now - lastCheck < CHECK_INTERVAL_MS) {
    return; // Checked recently
  }

  // Record that we checked
  setLastCheckTime(configDir, now);

  const latest = await fetchLatestRelease();
  if (!latest) return;

  const current = getCurrentVersion();
  if (compareVersions(latest.version, current) > 0) {
    setAvailableUpdate(configDir, {
      version: latest.version,
      checkedAt: now,
    });
  } else {
    // Current version is up to date; clear any stale notice
    clearAvailableUpdate(configDir);
  }
}

// ── Startup notice ──────────────────────────────────────────────

/**
 * Check for a pending update notice and print to stderr if found.
 * Returns the update info if an update is available.
 */
export function printUpdateNotice(): UpdateInfo | null {
  try {
    const configDir = getConfigDir();
    const update = getAvailableUpdate(configDir);
    if (!update) return null;

    const current = getCurrentVersion();
    process.stderr.write(
      `recs v${update.version} available (current: v${current}). Run: recs --update\n`
    );
    return update;
  } catch {
    return null;
  }
}

// ── Self-update ─────────────────────────────────────────────────

function detectPlatform(): string {
  const os = process.platform === "darwin" ? "darwin" : "linux";
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  return `${os}-${arch}`;
}

/**
 * Download and install the latest version.
 */
export async function selfUpdate(): Promise<void> {
  const latest = await fetchLatestRelease();
  if (!latest) {
    console.error("Error: Could not fetch latest release information.");
    process.exit(1);
  }

  const current = getCurrentVersion();
  if (compareVersions(latest.version, current) <= 0) {
    console.log(`Already up to date (v${current}).`);
    return;
  }

  const platform = detectPlatform();
  const assetName = `recs-${platform}`;
  const downloadUrl = `https://github.com/${REPO}/releases/download/${latest.tagName}/${assetName}`;

  console.log(`Updating recs v${current} -> v${latest.version}...`);

  try {
    const response = await fetch(downloadUrl, {
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) {
      console.error(`Error: Download failed (HTTP ${response.status}).`);
      console.error(`URL: ${downloadUrl}`);
      process.exit(1);
    }

    const binary = new Uint8Array(await response.arrayBuffer());

    // Write to temp file, then atomic rename
    const currentPath = process.argv[0]!;
    const tmpPath = `${currentPath}.update-tmp`;

    writeFileSync(tmpPath, binary);
    chmodSync(tmpPath, 0o755);

    // Verify the new binary
    const check = spawnSync(tmpPath, ["--version"], { timeout: 5000 });
    if (check.status !== 0) {
      try { unlinkSync(tmpPath); } catch { /* best effort cleanup */ }
      console.error("Error: Downloaded binary failed verification.");
      process.exit(1);
    }

    // Atomic replace
    renameSync(tmpPath, currentPath);

    // Clear update notice
    const configDir = getConfigDir();
    clearAvailableUpdate(configDir);

    console.log(`Updated to v${latest.version}.`);
  } catch (e) {
    console.error(`Error: Update failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}

// ── Spawn background check ──────────────────────────────────────

/**
 * Spawn a detached background process to check for updates.
 * The process is fully detached so it doesn't block the parent.
 */
export function spawnUpdateCheck(): void {
  try {
    const child = spawn(
      process.execPath,
      [join(import.meta.dir, "..", "bin", "recs.ts"), "--check-update-internal"],
      {
        detached: true,
        stdio: "ignore",
      },
    );
    child.unref();
  } catch {
    // Silently ignore spawn failures
  }
}
