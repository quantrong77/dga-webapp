/**
 * @jest-environment node
 */
// Tab Cảnh báo — thống kê THEO THIẾT BỊ (alertLevelSummary(), ui-alerts.js): mỗi thiết bị tính 1 lần ở mức nặng nhất,
// nên "Thiết bị mức Cảnh báo" + "Thiết bị mức Báo động" = "Thiết bị đang có cảnh báo" (trước đây đếm theo dòng:
// 37 + 3 = 40 nhưng chỉ 39 thiết bị vì 1 thiết bị cảnh báo ở 2 nguồn dữ liệu).
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load() {
  const ctx = {
    window: {}, console, Date, Math, Number, String, Array, Set, Map,
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    DGA: require("../src/domain/dga-logic"),
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src/presentation/tabs/ui-alerts.js"), "utf8"), ctx);
  return ctx;
}

const row = (tram, deviceName, level, source, identityPhase = "") => ({ tram, deviceName, level, source, identityPhase });

describe("alertLevelSummary", () => {
  const { alertLevelSummary } = load();

  test("1 thiết bị cảnh báo ở 2 nguồn → đếm 1 thiết bị, ở mức nặng nhất", () => {
    const rows = [
      row("T1", "AT1", "alert", "gas"),
      row("T1", "AT1", "alarm", "oltc"), // cùng thiết bị, nguồn khác, mức nặng hơn
      row("T1", "AT2", "alert", "gas"),
      row("T2", "TI-174", "alarm", "tio", "B"),
    ];
    const s = alertLevelSummary(rows);
    expect(s.warnDevices).toBe(3);
    expect(s.alarmDevices).toBe(2); // AT1 (nặng nhất = Báo động) + TI-174 pha B
    expect(s.alertDevices).toBe(1); // AT2
    expect(s.alarmDevices + s.alertDevices).toBe(s.warnDevices);
    expect(s.alertRows).toBe(2);
    expect(s.alarmRows).toBe(2);
    expect(s.multiSourceDevices).toBe(1);
  });

  test("ví dụ thực tế: 40 dòng (37 Cảnh báo + 3 Báo động), 39 thiết bị → 36 + 3 = 39", () => {
    const rows = [];
    for (let i = 0; i < 36; i++) rows.push(row("T", "D" + i, "alert", "gas"));
    rows.push(row("T", "X", "alert", "gas"));
    rows.push(row("T", "X", "alarm", "oil")); // thiết bị X: khí Cảnh báo, dầu Báo động
    rows.push(row("T", "Y", "alarm", "gas"));
    rows.push(row("T", "Z", "alarm", "oltc"));
    const s = alertLevelSummary(rows);
    expect(s.alertRows + s.alarmRows).toBe(40);
    expect(s.alertRows).toBe(37);
    expect(s.warnDevices).toBe(39);
    expect(s.alertDevices).toBe(36);
    expect(s.alarmDevices).toBe(3);
  });

  test("cùng tên thiết bị nhưng khác pha là 2 thiết bị (TI 3 pha rời)", () => {
    const s = alertLevelSummary([row("T", "TI-1", "alert", "tio", "A"), row("T", "TI-1", "alert", "tio", "C")]);
    expect(s.warnDevices).toBe(2);
    expect(s.multiSourceDevices).toBe(0);
  });

  test("dòng 'normal' (xuất Excel) không tính là đang cảnh báo; thiết bị có cả normal + alert tính Cảnh báo", () => {
    const s = alertLevelSummary([row("T", "A", "normal", "gas"), row("T", "A", "alert", "oil"), row("T", "B", "normal", "gas")]);
    expect(s.devices).toBe(2);
    expect(s.warnDevices).toBe(1);
    expect(s.alertDevices).toBe(1);
    expect(s.normalDevices).toBe(1);
    expect(s.normalRows).toBe(2);
  });

  test("rỗng", () => {
    const s = alertLevelSummary([]);
    expect([s.devices, s.warnDevices, s.alarmDevices, s.alertDevices]).toEqual([0, 0, 0, 0]);
  });
});
