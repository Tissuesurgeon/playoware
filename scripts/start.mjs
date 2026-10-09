import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["--import", "tsx", "scripts/server.mjs"], {
  stdio: "inherit",
  env: process.env,
});

function stop() {
  child.kill("SIGTERM");
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
