from pathlib import Path

path = Path("packages/site-validators/src/legacy-visual-performance-cli.ts")
text = path.read_text(encoding="utf-8")
marker = "\n} finally {\n"
start = text.rfind(marker)
if start < 0:
    raise SystemExit("final finally block not found")
replacement = r'''
} finally {
  cdp?.close();
  if (chrome) {
    const browser = chrome;
    browser.process.kill("SIGTERM");
    await new Promise<void>((resolveExit) => {
      if (browser.process.exitCode !== null) {
        resolveExit();
        return;
      }
      const timer = setTimeout(() => {
        browser.process.kill("SIGKILL");
        resolveExit();
      }, 2_000);
      browser.process.once("exit", () => {
        clearTimeout(timer);
        resolveExit();
      });
    });
    await rm(browser.userDataDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
  if (staticServer) {
    const server = staticServer;
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  }
  if (worktreeAdded) {
    try { git(["worktree", "remove", "--force", legacyWorktree]); } catch { /* cleanup below */ }
  }
  await rm(tempRoot, { recursive: true, force: true });
}
'''
path.write_text(text[:start] + replacement, encoding="utf-8", newline="\n")
