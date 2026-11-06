// Chạy 1 lần trước toàn bộ test (jest "globalSetup", package.json): mã riêng cho LẦN CHẠY này — các tiến trình test
// (sinh ra sau bước này nên thừa hưởng biến môi trường) đặt tên database tạm theo mã đó, để tests/global-teardown.js
// chỉ dọn đúng thư mục của lần chạy này, không đụng tới lần chạy Jest khác đang chạy song song (VD chế độ watch).
module.exports = async () => {
  process.env.DGA_TEST_RUN_ID = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
};
