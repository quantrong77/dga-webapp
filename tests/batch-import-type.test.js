// Nhập BBTN hàng loạt: ô "Loại thiết bị" áp dụng chung cả đợt (mặc định TI). Đợt nhập lại BBTN của MBA AT1 bị lưu
// nhầm thành TI → lần đo biến mất khỏi Lịch sử đo khi lọc MBA và bị đánh giá theo ngưỡng TI. Nay chặn lưu khi
// loại đang chọn khác loại của các lần đo đã lưu cùng thiết bị, hoặc khác loại đọc được từ BBTN.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const code = fs.readFileSync(path.join(__dirname, "..", "src", "presentation", "tabs", "ui-batch-import.js"), "utf8").replace(/\r\n/g, "\n");
const start = code.indexOf("function batchEquipmentTypeConflict");
const end = code.indexOf("\n}\n", start) + 3;
const sb = {};
vm.createContext(sb);
vm.runInContext(code.slice(start, end) + "\nthis.f = batchEquipmentTypeConflict;", sb);
const conflict = sb.f;

const MBA = "MBA/Kháng dầu";
const TI = "TI (biến dòng điện)";
const existing = [
  { tram: "Trạm 220kV Phan Thiết", thiet_bi: "MBA AT1", equipment_type: MBA },
  { tram: "Trạm 220kV Phan Thiết", thiet_bi: "TI 171", equipment_type: TI },
];

describe("batchEquipmentTypeConflict", () => {
  test("thiết bị đã có lần đo loại MBA mà đang chọn TI → chặn (so khớp không phân biệt hoa thường/khoảng trắng)", () => {
    const msg = conflict(TI, [], existing, " trạm 220kV phan thiết ", "mba at1");
    expect(msg).toMatch(/đã có lần đo lưu với Loại thiết bị "MBA\/Kháng dầu"/);
    expect(msg).toMatch(/đang chọn "TI \(biến dòng điện\)"/);
  });
  test("BBTN ghi Máy biến áp mà đang chọn TI → chặn (thiết bị mới, chưa có lần đo)", () => {
    expect(conflict(TI, [{ parsed: { loai: MBA } }, { parsed: null }], existing, "Trạm X", "MBA T9")).toMatch(/BBTN ghi thiết bị là "MBA\/Kháng dầu"/);
  });
  test("chọn đúng loại, hoặc BBTN không nhận ra loại → cho lưu", () => {
    expect(conflict(MBA, [{ parsed: { loai: MBA } }], existing, "Trạm 220kV Phan Thiết", "MBA AT1")).toBeNull();
    expect(conflict(TI, [{ parsed: { loai: null } }], existing, "Trạm 220kV Phan Thiết", "TI 171")).toBeNull();
    expect(conflict(TI, [], [], "Trạm X", "TI 9")).toBeNull();
  });
});
