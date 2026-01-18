import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desiredPort = Number.parseInt(process.env.PORT || "5173", 10) || 5173;
const host = process.env.HOST || "127.0.0.1";

const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".wgsl": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  const urlPath = req.url === "/" ? "/index.html" : req.url;
  const safePath = path.normalize(urlPath).replace(/^\.\.(\/|\\|$)/, "");
  const filePath = path.join(__dirname, safePath);

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": mime[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});

function openBrowser(url) {
  if (process.env.OPEN_BROWSER !== "1") return;

  try {
    if (process.platform === "darwin") {
      // Prefer Chrome if available (avoids Safari "HTTPS-Only" issues for local HTTP, and WebGPU support is better).
      const chromeCheck = spawnSync("open", ["-Ra", "Google Chrome"], { stdio: "ignore" });
      if (chromeCheck.status === 0) {
        spawn("open", ["-a", "Google Chrome", url], { stdio: "ignore", detached: true }).unref();
      } else {
        spawn("open", [url], { stdio: "ignore", detached: true }).unref();
      }
    } else if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true }).unref();
    } else {
      spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
    }
  } catch {
    // ignore
  }
}

server.on("error", (err) => {
  if (err && typeof err === "object" && err.code === "EADDRINUSE") {
    console.warn(`Port ${desiredPort} is already in use. Using a free port instead...`);
    setTimeout(() => {
      server.listen(0, host);
    }, 0);
    return;
  }
  console.error(err);
  process.exitCode = 1;
});

server.on("listening", () => {
  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : desiredPort;
  const url = `http://${host}:${actualPort}`;
  console.log(`Server running at ${url}`);
  openBrowser(url);
});

server.listen(desiredPort, host);
