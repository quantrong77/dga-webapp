// Nạp logic DGA đúng như app dùng (dga-logic.js có nhánh Node: nạp 8 file logic/*.js
// vào 1 sandbox `vm` dùng chung rồi trả về object DGA — không cần build/refactor).
//
// LƯU Ý cho người viết test: số liệu "golden" phải lấy từ VĂN BẢN GỐC (QĐ1901/IEC 60599),
// KHÔNG sao chép kết quả chạy ra từ chính code — nếu không test chỉ xác nhận lỗi hiện có.
// Mỗi test ghi nguồn (Bảng/Điều/Table) trong tên hoặc chú thích.
const DGA = require("../dga-logic.js");

/** Bộ khí đầy đủ 7 khí, mặc định 0 — chỉ ghi đè khí cần thiết. */
function gases(overrides = {}) {
  return { H2: 0, CH4: 0, C2H6: 0, C2H4: 0, C2H2: 0, CO: 0, CO2: 0, ...overrides };
}

module.exports = { DGA, gases };
