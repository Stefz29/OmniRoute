import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("hot-reload sqlite watcher handles async watch errors and keeps polling fallback", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-hot-reload-watch-error-"));
  process.env.DATA_DIR = dataDir;
  process.env.OMNIROUTE_CONFIG_HOT_RELOAD_MS = "60000";

  const originalWatch = fs.watch;
  let fakeWatcher: (EventEmitter & { close: () => void }) | null = null;
  let closed = false;

  fs.watch = (() => {
    fakeWatcher = Object.assign(new EventEmitter(), {
      close: () => {
        closed = true;
      },
    });
    return fakeWatcher;
  }) as typeof fs.watch;

  try {
    const { startRuntimeConfigHotReload, stopRuntimeConfigHotReloadForTests } = await import(
      "../../src/lib/config/hotReload.ts"
    );

    startRuntimeConfigHotReload({ pollIntervalMs: 60000 });

    assert.ok(fakeWatcher, "expected sqlite watcher to be created");
    assert.ok(fakeWatcher.listenerCount("error") > 0, "watcher should handle async errors");

    fakeWatcher.emit("error", new Error("EMFILE: too many open files, watch"));
    assert.equal(closed, true, "watcher should close after async watch error");

    stopRuntimeConfigHotReloadForTests();
  } finally {
    fs.watch = originalWatch;
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
