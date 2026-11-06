// Chạy trước MỖI file test (jest "setupFiles", package.json): backend/onpremise/db.js đọc DGA_DATA_DIR lúc nạp module, nên mỗi
// file test có 1 database tạm riêng (thư mục mới trong thư mục tạm của hệ điều hành) — không đụng tới
// data/database.json thật, các file test chạy song song cũng không tranh nhau 1 file. Dọn thư mục khi tiến trình
// test kết thúc.
const fs = require("fs");
const os = require("os");
const path = require("path");

const runId = process.env.DGA_TEST_RUN_ID || "solo"; // xem tests/global-setup.js
const dir = fs.mkdtempSync(path.join(os.tmpdir(), `dga-webapp-test-${runId}-`));
process.env.DGA_DATA_DIR = dir;

process.on("exit", () => {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) {
    // thư mục tạm — hệ điều hành tự dọn nếu không xóa được (VD file còn bị giữ trên Windows)
  }
});
