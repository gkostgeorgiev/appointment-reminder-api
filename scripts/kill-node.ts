import { execSync } from "node:child_process";

// Force-kills any lingering node.exe (Windows helper for stuck dev servers).
// Runs as a plain Node script rather than an inline shell command so it behaves
// the same from PowerShell, cmd.exe, and Git Bash - yarn (like npm) always
// executes package.json scripts via cmd.exe on Windows regardless of which
// terminal you ran `yarn kill` from, so shell-specific flag escaping (`//F`)
// or operators (`|| true`) don't reliably work across all three.
try {
  execSync("taskkill /F /IM node.exe", { stdio: "inherit" });
} catch {
  // No matching process (or it already exited) - nothing to do.
}
