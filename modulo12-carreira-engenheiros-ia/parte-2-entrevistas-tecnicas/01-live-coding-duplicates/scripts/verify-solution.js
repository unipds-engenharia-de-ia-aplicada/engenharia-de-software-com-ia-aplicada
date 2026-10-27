// Runs every test against the reference solution (solution/ folder).
import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["--test"], {
  stdio: "inherit",
  env: { ...process.env, SOLUTION: "1" },
});
process.exit(result.status ?? 1);
