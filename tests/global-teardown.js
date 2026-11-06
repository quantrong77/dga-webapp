// Chạy 1 lần sau khi TOÀN BỘ test xong (jest "globalTeardown", package.json): xóa các database tạm do
// tests/setup-test-env.js tạo ra — tiến trình worker của Jest thường bị dừng trước khi kịp tự dọn.
const fs = require("fs");
const os = require("os");
const path = require("path");

module.exports = async () => {
  const tmp = os.tmpdir();
  // chỉ thư mục của LẦN CHẠY này (tests/global-setup.js) — không xóa của lần chạy Jest khác đang chạy song song
  const prefix = `dga-webapp-test-${process.env.DGA_TEST_RUN_ID || "solo"}-`;
  for (const name of fs.readdirSync(tmp)) {
    if (!name.startsWith(prefix)) continue;
    try {
      fs.rmSync(path.join(tmp, name), { recursive: true, force: true });
    } catch (_) {
      // file còn bị giữ (Windows) — để lần chạy sau dọn tiếp
    }
  }
};
