import { spawn } from "node:child_process";

const children = [
  spawn("npx", ["next", "dev", "--hostname", "0.0.0.0", "--port", "3000"], { stdio: "inherit", shell: false }),
  spawn("npx", ["tsx", "src/server/ws.ts"], { stdio: "inherit", shell: false }),
];

function stop() {
  for (const child of children) child.kill("SIGTERM");
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

for (const child of children) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      stop();
      process.exit(code);
    }
  });
}
