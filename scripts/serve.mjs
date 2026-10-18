import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
export async function startServer(port = 4173) {
  const root = path.resolve("public");
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const file = path.resolve(
      root,
      "." + (pathname === "/" ? "/demo.html" : pathname),
    );
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      res.setHeader(
        "Content-Type",
        file.endsWith(".html") ? "text/html; charset=utf-8" : "text/plain",
      );
      res.end(body);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const server = await startServer(Number(process.env.PORT || 4173));
  console.log(`Writing room: http://127.0.0.1:${server.address().port}`);
}
