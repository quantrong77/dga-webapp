/* backend/onpremise/serve.js — Máy chủ web tĩnh cục bộ và API CSDL On-Premise không phụ thuộc thư viện ngoài (zero-dependency).
 * Dùng để chạy thử nghiệm trên http://localhost:8080 (hoặc PORT do môi trường chỉ định).
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { handleApiRequest } = require("./api");
const { isAllowedStaticPath } = require("./static-allowlist");

const PORT = parseInt(process.env.PORT, 10) || 8080;
const ROOT = path.resolve(__dirname, "..", "..");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

const server = http.createServer((req, res) => {
  // CORS & CSP headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse URL & decode URI components
  let reqPath;
  let urlObj;
  try {
    urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    reqPath = decodeURIComponent(urlObj.pathname);
  } catch (e) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("400 Bad Request");
    return;
  }

  // ĐIỀU HƯỚNG TỚI API CSDL ON-PREMISE NỘI BỘ
  if (reqPath === "/api" || reqPath.startsWith("/api/")) {
    handleApiRequest(req, res, urlObj);
    return;
  }

  // Rewrite / to /index.html
  if (reqPath === "/" || reqPath === "") {
    reqPath = "/index.html";
  }

  // Chỉ phục vụ file web theo DANH SÁCH CHO PHÉP (static-allowlist.js, dùng chung với bản GitHub Pages) — mọi đường
  // dẫn khác (data/database.json, data/uploads/, .git/, backend/, node_modules/, docs/, *.md, BBTN thật…) trả 404 như
  // không tồn tại (lỗi #4). File đính kèm chỉ tải qua /api/files/… (có kiểm tra phiên đăng nhập).
  const safePath = path.normalize(path.join(ROOT, reqPath));
  const rel = path.relative(ROOT, safePath).split(path.sep).join("/");
  if (!isAllowedStaticPath(rel)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found");
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    const headers = {
      "Content-Type": contentType,
      "Content-Length": stats.size,
      "Access-Control-Allow-Origin": "*",
    };

    if (ext === ".html" || ext === ".js" || ext === ".json") {
      headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0";
      headers["Pragma"] = "no-cache";
      headers["Expires"] = "0";
    } else {
      headers["Cache-Control"] = "no-cache";
    }

    res.writeHead(200, headers);

    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`\n===================================================================`);
    console.log(`[THÔNG BÁO] Cổng ${PORT} đã có máy chủ đang chạy sẵn.`);
    console.log(`Ứng dụng đang hoạt động bình thường tại: http://localhost:${PORT}`);
    console.log(`===================================================================\n`);
    return;
  }
  console.error("Lỗi khởi động máy chủ:", err);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`DGA Web App đang chạy tại:`);
  console.log(`  > Giao diện Web:    http://localhost:${PORT}`);
  console.log(`  > CSDL On-Premise:  http://localhost:${PORT}/api`);
  console.log(`  > Thư mục dữ liệu:  ./data/ (database.json & uploads/)`);
  console.log(`Bấm Ctrl+C để dừng máy chủ.`);
});
