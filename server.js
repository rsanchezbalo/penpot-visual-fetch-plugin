const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 7654;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".css": "text/css",
};

http
  .createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);
    const pathname = new URL(req.url, "http://localhost").pathname;
    const filePath = path.join(
      ROOT,
      pathname === "/" ? "/index.html" : pathname,
    );

    // Safety: never escape the root dir
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(data);
    });
  })
  .listen(PORT, () => {
    console.log(`Penpot Visual Fetch plugin server → http://localhost:${PORT}`);
    console.log(`Manifest → http://localhost:${PORT}/manifest.json`);
  });
