import { createServer } from "node:http";
import next from "next";
import { attachRealtime } from "../src/server/ws.ts";

const port = Number(process.env.PORT || 3000);
const hostname = "0.0.0.0";
const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((request, response) => {
  void handle(request, response);
});

await attachRealtime(server);

server.listen(port, hostname, () => {
  console.log(`playoware listening on http://${hostname}:${port}`);
});

function stop() {
  server.close(() => process.exit(0));
}

process.on("SIGTERM", stop);
process.on("SIGINT", stop);
