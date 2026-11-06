/**
 * @jest-environment node
 */
/* tests/alerts-update.test.js
 * Kiểm thử tính năng rà soát và cập nhật tab "Cảnh báo" sau khi người dùng nhập mới hoặc hiệu chỉnh số liệu.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

describe("Tab Cảnh báo: Rà soát và cập nhật sau khi hiệu chỉnh số liệu", () => {
  let ctx;

  beforeEach(() => {
    // Tạo môi trường sandbox DOM + script globals
    ctx = {
      window: {},
      document: {
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: (tag) => ({
          tagName: tag,
          innerHTML: "",
          appendChild: () => {},
          querySelector: () => null,
          classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        }),
      },
      console,
      Date,
      Math,
      Number,
      String,
      Array,
      Set,
      Map,
      escapeHtml: (s) => String(s || ""),
      verdictPill: (v) => "<span>" + v + "</span>",
      tioVerdictPill: (v) => "<span>" + v + "</span>",
      DGA: require("../src/domain/dga-logic"),
    };
    ctx.window = ctx;
    ctx.global = ctx;
    vm.createContext(ctx);

    // Load các helpers cần thiết từ logic và ui
    const loadScript = (file) => {
      const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
      vm.runInContext(code, ctx);
    };

    loadScript("src/data/drivers/storage-core.js");
    loadScript("src/data/drivers/storage-auth.js");
    loadScript("ui/ui-utils.js");
    loadScript("ui/ui-standards.js");
    loadScript("ui/ui-auth.js");
    loadScript("ui/ui-history.js");
    loadScript("ui/ui-alerts.js");

    ctx.setMeasurements = (arr) => {
      ctx.__tempM = arr;
      vm.runInContext("_allMeasurements = __tempM;", ctx);
    };
    ctx.setOilTests = (arr) => {
      ctx.__tempOil = arr;
      vm.runInContext("_allOilTests = __tempOil;", ctx);
    };
    ctx.setStandards = (arr) => {
      ctx.__tempStd = arr;
      vm.runInContext("_allStandards = __tempStd;", ctx);
    };
    ctx.setOltcOilTests = (arr) => {
      ctx.__tempOltc = arr;
      vm.runInContext("_allOltcOilTests = __tempOltc;", ctx);
    };
    ctx.setTioOilTests = (arr) => {
      ctx.__tempTio = arr;
      vm.runInContext("_allTioOilTests = __tempTio;", ctx);
    };

    ctx.setStandards([]);
    ctx.setOilTests([]);
    ctx.setOltcOilTests([]);
    ctx.setTioOilTests([]);
  });

  test("1. Hàm alertSortRecordsDescending sắp xếp chuẩn theo ngày giảm dần và lần đo giảm dần", () => {
    const records = [
      { id: "1", sample_date: "2026-05-01", lan_do: 1 },
      { id: "2", sample_date: "2026-10-15", lan_do: 2 },
      { id: "3", sample_date: "2026-10-15", lan_do: 3 }, // cùng ngày nhưng lần đo lớn hơn
      { id: "4", sample_date: "2026-03-01", lan_do: 1 },
    ];
    const sorted = ctx.alertSortRecordsDescending(records);
    expect(sorted[0].id).toBe("3"); // 2026-10-15, lần 3
    expect(sorted[1].id).toBe("2"); // 2026-10-15, lần 2
    expect(sorted[2].id).toBe("1"); // 2026-05-01
    expect(sorted[3].id).toBe("4"); // 2026-03-01
  });

  test("2. computeGasAlerts phát hiện cảnh báo khi có số liệu vượt ngưỡng", () => {
    // Giả lập thiết bị AT1 TBA 500kV Di Linh có H2 = 500 ppm (vượt ngưỡng Bảng 64)
    ctx.setMeasurements([
      {
        id: "m_1",
        tram: "TBA 500kV Di Linh",
        thiet_bi: "AT1",
        equipment_type: "MBA",
        pha: "chung3pha",
        sample_date: "2026-10-20",
        lan_do: 1,
        h2: 500, // vượt ngưỡng 300
        ch4: 10,
        c2h2: 0,
        c2h4: 10,
        c2h6: 10,
        co: 200,
        co2: 1500,
      },
    ]);

    const alerts = ctx.computeGasAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0].deviceName).toBe("AT1");
    expect(alerts[0].level).toBe("alarm");
    expect(alerts[0].exceededItems).toContain("H2");
    expect(alerts[0].record).toBeDefined();
    expect(alerts[0].record.id).toBe("m_1");
    expect(alerts[0].isEdited).toBe(false);
  });

  test("3. Sau khi hiệu chỉnh số liệu nhập sai về bình thường, thiết bị được gỡ khỏi danh sách Cảnh báo", () => {
    // Người dùng sửa lại số liệu nhập nhầm: H2 từ 500 về 50 ppm, CO2 từ 1500 về 500 ppm
    ctx.setMeasurements([
      {
        id: "m_1",
        tram: "TBA 500kV Di Linh",
        thiet_bi: "AT1",
        equipment_type: "MBA",
        pha: "chung3pha",
        sample_date: "2026-10-20",
        lan_do: 1,
        h2: 50, // số liệu đúng sau hiệu chỉnh (dưới ngưỡng 300)
        ch4: 10,
        c2h2: 0,
        c2h4: 10,
        c2h6: 10,
        co: 200,
        co2: 500, // dưới ngưỡng 900
        edited_fields: "H2: 500 -> 50, CO2: 1500 -> 500",
        edit_log: "2026-11-03T18:00:00.000Z - admin@ptc3.evnnpt.vn: H2: 500 -> 50, CO2: 1500 -> 500 (sửa do nhập nhầm)",
        edited_at: "2026-11-03T18:00:00.000Z",
      },
    ]);

    const alerts = ctx.computeGasAlerts();
    // Thiết bị không còn vượt ngưỡng -> không còn cảnh báo nào
    expect(alerts.length).toBe(0);
  });

  test("4. Khi hiệu chỉnh số liệu mà vẫn còn vượt ngưỡng, hiển thị nhãn và vết hiệu chỉnh", () => {
    // Người dùng sửa H2 từ 500 về 400 ppm (vẫn vượt ngưỡng 300 nhưng có lưu vết)
    ctx.setMeasurements([
      {
        id: "m_1",
        tram: "TBA 500kV Di Linh",
        thiet_bi: "AT1",
        equipment_type: "MBA",
        pha: "chung3pha",
        sample_date: "2026-10-20",
        lan_do: 1,
        h2: 400,
        ch4: 10,
        c2h2: 0,
        c2h4: 10,
        c2h6: 10,
        co: 200,
        co2: 1500,
        edited_fields: "H2: 500 -> 400",
        edit_log: "2026-11-03T18:00:00.000Z - admin@ptc3.evnnpt.vn: H2: 500 -> 400",
        edited_at: "2026-11-03T18:00:00.000Z",
      },
    ]);

    const alerts = ctx.computeGasAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0].isEdited).toBe(true);
    expect(alerts[0].editLog).toContain("H2: 500 -> 400");
    expect(alerts[0].record.id).toBe("m_1");
  });

  test("5. computeOilAlerts lưu đầy đủ record và cờ hiệu chỉnh", () => {
    ctx.setOilTests([
      {
        id: "oil_1",
        tram: "TBA 220kV Bảo Lộc",
        thiet_bi: "AT1",
        voltage_class: "220",
        oil_state: "vanhanh",
        oil_sample_point: "chung",
        sample_date: "2026-10-10",
        moisture_ppm: 35, // vượt ngưỡng 20
        tgd_90c_percent: 0.5,
        bdv_kv: 60,
        edited_fields: "moisture_ppm: 50 -> 35",
        edit_log: "2026-11-03T18:00:00.000Z: moisture_ppm: 50 -> 35",
        edited_at: "2026-11-03T18:00:00.000Z",
      },
    ]);

    const alerts = ctx.computeOilAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0].source).toBe("oil");
    expect(alerts[0].record).toBeDefined();
    expect(alerts[0].record.id).toBe("oil_1");
    expect(alerts[0].isEdited).toBe(true);
    expect(alerts[0].exceededItems).toContain("Độ ẩm dầu");
  });

  test("6. Auth.isAdmin, Auth.isViewer, Auth.isUser trả về đúng theo vai trò phiên đăng nhập", () => {
    ctx.window.DGA_CONFIG = { LOCAL_SERVER_URL: "/api" };
    ctx.Auth.current = null;
    expect(ctx.Auth.isAdmin()).toBe(false);
    expect(ctx.Auth.isViewer()).toBe(false);

    ctx.Auth.current = { email: "admin@ptc3.evnnpt.vn", role: "admin" };
    expect(ctx.Auth.isAdmin()).toBe(true);
    expect(ctx.Auth.isViewer()).toBe(false);
    expect(ctx.Auth.isUser()).toBe(true);
    expect(ctx.canWrite()).toBe(true);
    expect(ctx.canEditRecord({ created_by: "other@ptc3.evnnpt.vn" })).toBe(true);

    ctx.Auth.current = { email: "viewer@ptc3.evnnpt.vn", role: "viewer" };
    expect(ctx.Auth.isAdmin()).toBe(false);
    expect(ctx.Auth.isViewer()).toBe(true);
    expect(ctx.canWrite()).toBe(false);

    ctx.Auth.current = { email: "user@ptc3.evnnpt.vn", role: "user" };
    expect(ctx.Auth.isAdmin()).toBe(false);
    expect(ctx.Auth.isViewer()).toBe(false);
    expect(ctx.Auth.isUser()).toBe(true);
    expect(ctx.canEditRecord({ created_by: "user@ptc3.evnnpt.vn" })).toBe(true);
    expect(ctx.canEditRecord({ created_by: "other@ptc3.evnnpt.vn" })).toBe(false);
  });

  test("7. Nút 'Xem' luôn xuất hiện trong các bảng lịch sử đo (kể cả khi không có file đính kèm)", () => {
    const fs = require("fs");
    const histContent = fs.readFileSync("ui/ui-history.js", "utf8");
    const oilContent = fs.readFileSync("ui/ui-oil.js", "utf8");
    const oltcContent = fs.readFileSync("ui/ui-oltc.js", "utf8");
    const tioContent = fs.readFileSync("ui/ui-ti-oil.js", "utf8");

    // Nút Xem (icon "eye") luôn được vẽ — KHÔNG nằm trong điều kiện rec.bbtn_url
    expect(histContent).toMatch(/rowActionBtn\("viewbbtn", "eye"/);
    expect(histContent).not.toMatch(/rec\.bbtn_url &&\s*rowActionBtn/);
    expect(oilContent).toMatch(/rowActionBtn\("view", "eye"/);
    expect(oltcContent).toMatch(/rowActionBtn\("view", "eye"/);
    expect(tioContent).toMatch(/rowActionBtn\("viewbbtn", "eye"/);
  });

  test("8. Bảng Cảnh báo (ui-alerts.js) có nút 'Xem' trên từng dòng cảnh báo", () => {
    const fs = require("fs");
    const alertsContent = fs.readFileSync("ui/ui-alerts.js", "utf8");
    expect(alertsContent).toMatch(/rowActionBtn\("view", "eye"/);
    expect(alertsContent).toMatch(/onViewMeasurement\(a\.record\)/);
  });

  test("9. Nút thao tác dạng icon cùng kích thước, xếp thành 1 cột, có tooltip (Cảnh báo + Lịch sử)", () => {
    const fs = require("fs");
    const css = fs.readFileSync("css/style-tab-tables.css", "utf8");
    expect(css).toMatch(/\.btn-action-alert,\s*\.btn-action-hist,\s*\.actions-cell \.row-action-btn \{[^}]*width: 30px;/);
    expect(css).toMatch(/\.actions-stack \{[^}]*flex-direction: column;/);
    expect(css).toMatch(/\.row-action-btn\[data-tooltip\]::after \{[^}]*content: attr\(data-tooltip\);/);
  });

  test("10. Không còn nút chữ Xem/Sửa/Xóa trong cột Thao tác; mỗi nút có icon + tooltip + aria-label", () => {
    const fs = require("fs");
    for (const f of ["ui/ui-alerts.js", "ui/ui-history.js", "ui/ui-oil.js", "ui/ui-oltc.js", "ui/ui-ti-oil.js"]) {
      const src = fs.readFileSync(f, "utf8");
      expect(src).not.toMatch(/>\s*(?:Xem|Sửa|Xóa|BBTN 3 pha)\s*<\/button>/);
      expect(src).toMatch(/rowActionsHtml\(\[/);
    }
    const html = ctx.rowActionBtn("del", "trash", "Xóa lần đo này", { danger: true, cls: "btn-action-hist" });
    expect(html).toContain('data-action="del"');
    expect(html).toContain('data-tooltip="Xóa lần đo này"');
    expect(html).toContain('aria-label="Xóa lần đo này"');
    expect(html).toContain('href="#icon-trash"');
    expect(html).toMatch(/class="btn danger icon-only row-action-btn btn-action-hist"/);
    expect(ctx.rowActionsHtml([html, false, ""])).toBe(`<div class="btn-row actions-stack">${html}</div>`);
    const index = fs.readFileSync("index.html", "utf8");
    for (const id of ["icon-eye", "icon-edit", "icon-trash", "icon-trend", "icon-layers"]) {
      expect(index).toContain(`<symbol id="${id}"`);
    }
  });
  test("Hiệu chỉnh về số liệu khỏe có khí KPH (=0) -> KHÔNG còn Báo động 'đổi loại sự cố'", () => {
    // Cả 2 lần đo đều Đạt, mọi khí dưới giá trị điển hình; lần sau có C2H2 = KPH (0).
    // Trước bản sửa: tab Cảnh báo tự suy mã T1 -> T2 từ tỷ số 0/x và báo BÁO ĐỘNG dù Tình
    // trạng "Đạt" (tab Khí hòa tan coi tỷ số không có hiệu lực -> Bình thường).
    const base = { tram: "TBA 220kV X", thiet_bi: "T1", equipment_type: "MBA", pha: "chung3pha", co: 100, co2: 600 };
    ctx.setMeasurements([
      { ...base, id: "p", sample_date: "2026-04-01", lan_do: 1, h2: 5, ch4: 8, c2h6: 3, c2h4: 1, c2h2: 0 },
      { ...base, id: "c", sample_date: "2026-10-01", lan_do: 2, h2: 5, ch4: 8, c2h6: 3, c2h4: 4, c2h2: 0 },
    ]);
    expect(ctx.computeGasAlerts()).toHaveLength(0);
  });

  test("Bản nhập sai CÙNG NGÀY không được dùng làm 'lần đo trước' của bản nhập lại cho đúng", () => {
    const base = { tram: "TBA 220kV X", thiet_bi: "T2", equipment_type: "MBA", pha: "chung3pha", co: 100, co2: 600 };
    ctx.setMeasurements([
      { ...base, id: "old", sample_date: "2026-04-01", lan_do: 1, h2: 5, ch4: 8, c2h6: 3, c2h4: 1, c2h2: 0.5 },
      // nhập sai (C2H4 gõ nhầm 8 thay vì 1 -> mã T2) ...
      { ...base, id: "wrong", sample_date: "2026-10-01", lan_do: 2, h2: 5, ch4: 8, c2h6: 3, c2h4: 8, c2h2: 0.5 },
      // ... rồi nhập lại đúng cùng ngày, lần đo 3 (mã T1, giống lần đo tháng 4)
      { ...base, id: "fixed", sample_date: "2026-10-01", lan_do: 3, h2: 5, ch4: 8, c2h6: 3, c2h4: 1, c2h2: 0.5 },
    ]);
    expect(ctx.computeGasAlerts()).toHaveLength(0);
  });
});

describe("Tab Cảnh báo: lọc theo Thiết bị thuộc Trạm", () => {
  let ctx2;
  const fs = require("fs");
  const path = require("path");
  const vm = require("vm");
  const inputs = { al_stationFilter: { value: "" }, al_deviceFilter: { value: "" } };
  beforeAll(() => {
    ctx2 = {
      console, Date, Math, Number, String, Array, Set, Map,
      document: { getElementById: (id) => inputs[id] || null, querySelector: () => null, querySelectorAll: () => [] },
      escapeHtml: (s) => String(s || ""), verdictPill: (v) => v, tioVerdictPill: (v) => v,
      DGA: require("../src/domain/dga-logic"),
    };
    ctx2.window = ctx2; ctx2.global = ctx2;
    vm.createContext(ctx2);
    ["src/data/drivers/storage-core.js", "src/data/drivers/storage-auth.js", "ui/ui-utils.js", "ui/ui-standards.js", "ui/ui-auth.js", "ui/ui-history.js", "ui/ui-alerts.js"]
      .forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx2));
    const bad = { equipment_type: "MBA", pha: "chung3pha", sample_date: "2026-10-01", lan_do: 1, h2: 500, ch4: 10, c2h6: 10, c2h4: 10, c2h2: 0, co: 200, co2: 1500 };
    ctx2.__m = [
      { ...bad, id: "1", tram: "TBA A", thiet_bi: "T1" },
      { ...bad, id: "2", tram: "TBA A", thiet_bi: "T2" },
      { ...bad, id: "3", tram: "TBA B", thiet_bi: "T1" },
    ];
    vm.runInContext("_allMeasurements = __m; _allOilTests = []; _allOltcOilTests = []; _allTioOilTests = []; _allStandards = [];", ctx2);
  });

  test("gợi ý Thiết bị chỉ thuộc trạm đang chọn; để trống trạm thì kèm tên trạm", () => {
    inputs.al_stationFilter.value = "TBA A";
    expect(ctx2.alertDeviceOptions().map((o) => o.value)).toEqual(["T1", "T2"]);
    inputs.al_stationFilter.value = "TBA B";
    expect(ctx2.alertDeviceOptions().map((o) => o.value)).toEqual(["T1"]);
    inputs.al_stationFilter.value = "";
    expect(ctx2.alertDeviceOptions().find((o) => o.value === "T1").label).toBe("T1 — TBA A, TBA B");
  });

  test("lọc bảng + đếm thiết bị theo Trạm và Thiết bị", () => {
    const all = ctx2.computeGasAlerts();
    expect(ctx2.filterAlertsBy(all, { station: "TBA A", device: "T1" }).map((a) => a.record.id)).toEqual(["1"]);
    expect(ctx2.filterAlertsBy(all, { station: "", device: "T1" }).map((a) => a.record.id).sort()).toEqual(["1", "3"]);
    expect(ctx2.totalTrackedDeviceCount("TBA A", "")).toBe(2);
    expect(ctx2.totalTrackedDeviceCount("TBA A", "T2")).toBe(1);
  });
});

describe("Tab Cảnh báo: tỷ lệ bổ sung Điều 54 (O2/N2, CO2/CO) cho MBA/Kháng dầu", () => {
  const fs = require("fs");
  const path = require("path");
  const vm = require("vm");
  let c;
  beforeAll(() => {
    c = {
      console, Date, Math, Number, String, Array, Set, Map,
      document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
      escapeHtml: (s) => String(s || ""), verdictPill: (v) => v, tioVerdictPill: (v) => v, DGA: require("../src/domain/dga-logic"),
    };
    c.window = c; c.global = c;
    vm.createContext(c);
    ["src/data/drivers/storage-core.js", "src/data/drivers/storage-auth.js", "ui/ui-utils.js", "ui/ui-standards.js", "ui/ui-auth.js", "ui/ui-history.js", "ui/ui-alerts.js"]
      .forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), c));
  });
  const run = (recs) => {
    c.__m = recs;
    vm.runInContext("_allMeasurements = __m; _allOilTests = []; _allOltcOilTests = []; _allTioOilTests = []; _allStandards = [];", c);
    return c.computeGasAlerts();
  };
  const ok = { tram: "A", pha: "chung3pha", sample_date: "2026-10-01", lan_do: 1, h2: 20, ch4: 10, c2h6: 10, c2h4: 20, c2h2: 0.5 };
  const MBA = "MBA/Kháng dầu";

  test("chỉ lệch O2/N2 -> Cảnh báo, cột chỉ tiêu ghi O2/N2, tick N2/O2 ở xu hướng", () => {
    const [a] = run([{ ...ok, id: "1", thiet_bi: "T1", equipment_type: MBA, co: 200, co2: 1500, n2: 50000, o2: 10000 }]);
    expect(a.level).toBe("alert");
    expect(a.exceededItems).toEqual(["O2/N2"]);
    expect(a.exceededKeys).toEqual(["gas:N2", "gas:O2"]);
  });

  test("CO2/CO > 10 và CO2 > 10.000 ppm -> Cảnh báo, chỉ tiêu CO2/CO, tick CO/CO2", () => {
    const [a] = run([{ ...ok, id: "2", thiet_bi: "T3", equipment_type: MBA, co: 500, co2: 11000 }]);
    expect(a.exceededItems).toEqual(["CO2/CO"]);
    expect(a.exceededKeys).toEqual(["gas:CO", "gas:CO2"]);
  });

  test("ngưỡng O2/N2 theo cấu hình Admin (không viết cứng 0,3)", () => {
    const rec = { ...ok, id: "3", thiet_bi: "T4", equipment_type: MBA, co: 200, co2: 1500, n2: 50000, o2: 17500 }; // O2/N2 = 0,35
    expect(run([rec])).toHaveLength(0);
    c.DGA.applyRegulationConfigOverride("DIEU54_ADDITIONAL", { values: { o2n2_low: 0.4 } });
    expect(run([rec])[0].exceededItems).toEqual(["O2/N2"]);
    c.DGA.resetRegulationConfigItem("DIEU54_ADDITIONAL");
  });

  test("cột Khuyến cáo: hành động riêng theo đúng điều kiện O2/N2, CO2/CO thấp, CO2/CO cao", () => {
    const [o] = run([{ ...ok, id: "k1", thiet_bi: "K1", equipment_type: MBA, co: 200, co2: 1500, n2: 50000, o2: 10000 }]);
    expect(o.action).toMatch(/^• O2\/N2 = 0,2 < 0,3/);
    expect(o.action).toMatch(/chỉ số axit/);
    expect(o.action).not.toMatch(/CO2\/CO/);

    const [lo] = run([{ ...ok, id: "k2", thiet_bi: "K2", equipment_type: MBA, co: 1200, co2: 2400 }]);
    expect(lo.action).toMatch(/CO2\/CO = 2 < 3 và CO > 1000 ppm/);
    expect(lo.action).toMatch(/furan \(2-FAL\).*độ trùng hợp giấy \(DP\)/);
    expect(lo.action).not.toMatch(/quá nhiệt nhẹ/);

    const [hi] = run([{ ...ok, id: "k3", thiet_bi: "K3", equipment_type: MBA, co: 500, co2: 11000 }]);
    expect(hi.action).toMatch(/CO2\/CO = 22 > 10 và CO2 > 10\.000 ppm/);
    expect(hi.action).toMatch(/hệ thống làm mát/);
    expect(hi.action).not.toMatch(/carbon hóa/);

    // Cả CO2/CO cao và O2/N2 thấp -> 2 khuyến cáo, mỗi dòng 1 gạch đầu dòng
    const [both] = run([{ ...ok, id: "k4", thiet_bi: "K4", equipment_type: MBA, co: 500, co2: 11000, n2: 50000, o2: 10000 }]);
    expect(both.action.split("\n")).toHaveLength(2);
  });

  test("TI/TU, sứ xuyên KHÔNG bị gắn tỷ lệ bổ sung Điều 54 (chỉ quy định cho MBA)", () => {
    const alerts = run([
      { ...ok, id: "ti", thiet_bi: "TI1", equipment_type: "TI (biến dòng điện)", h2: 20, ch4: 5, c2h6: 5, c2h4: 2, co: 100, co2: 500, n2: 50000, o2: 10000 },
    ]);
    alerts.forEach((a) => {
      expect(a.exceededItems).not.toContain("O2/N2");
      expect(a.reasons.join(" ")).not.toMatch(/Tỷ lệ bổ sung/);
    });
  });
});

test("O2/N2 = 0,27 (làm tròn 1 chữ số thành 0,3) vẫn phải cảnh báo — so ngưỡng bằng giá trị chưa làm tròn", () => {
  const DGA = require("../src/domain/dga-logic");
  const r = DGA.diagnoseAdditionalRatios({ CO: 200, CO2: 1500 }, 50000, 13500);
  expect(r.o2_n2).toBe(0.27);
  expect(DGA.dieu54AdditionalFlags(r).o2n2).toBe(true);
  expect(DGA.dieu54AdvisoryMessages({ additionalRatios: r, bang63: null, equipmentType: "MBA/Kháng dầu" })).toHaveLength(1);
  expect(DGA.dieu54AdvisoryMessages({ additionalRatios: r, bang63: null, equipmentType: "TI (biến dòng điện)" })).toHaveLength(0);
});

test("O2/N2: so ngưỡng bằng số thực; hiển thị cắt bớt 3 chữ số nên số < 0,3 không bao giờ hiện thành 0,3", () => {
  const DGA = require("../src/domain/dga-logic");
  const at = (ratio) => DGA.diagnoseAdditionalRatios({ CO: 200, CO2: 1500 }, 10000, ratio * 10000);
  [[0.2998, 0.299, true], [0.29999, 0.299, true], [0.3, 0.3, false], [0.30002, 0.3, false], [4.35, 4.35, false]].forEach(([v, shown, warn]) => {
    const r = at(v);
    expect([v, r.o2_n2, DGA.dieu54AdditionalFlags(r).o2n2]).toEqual([v, shown, warn]);
  });
});

describe("Tab Cảnh báo: lọc Loại cảnh báo + nhận biết cảnh báo cũ (không phải số liệu mới nhất)", () => {
  const fs = require("fs");
  const path = require("path");
  const vm = require("vm");
  let c;
  beforeAll(() => {
    c = {
      console, Date, Math, Number, String, Array, Set, Map,
      document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
      escapeHtml: (s) => String(s ?? ""), verdictPill: (v) => v, tioVerdictPill: (v) => v, DGA: require("../src/domain/dga-logic"),
    };
    c.window = c; c.global = c;
    vm.createContext(c);
    ["src/data/drivers/storage-core.js", "src/data/drivers/storage-auth.js", "ui/ui-utils.js", "ui/ui-standards.js", "ui/ui-auth.js", "ui/ui-history.js", "ui/ui-alerts.js"]
      .forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), c));
  });
  const run = (recs) => {
    c.__m = recs;
    vm.runInContext("_allMeasurements = __m; _allOilTests = []; _allOltcOilTests = []; _allTioOilTests = []; _allStandards = [];", c);
    return c.collectAllAlerts();
  };
  const MBA = "MBA/Kháng dầu";
  const ok = { tram: "A", equipment_type: MBA, h2: 20, ch4: 10, c2h6: 10, c2h4: 20, c2h2: 0.5, co: 200, co2: 1500 };
  const bad = { ...ok, h2: 500 };

  test("Pha để trống và 'Chung 3 pha' là CÙNG thiết bị: số liệu mới đã Đạt thì không còn cảnh báo cũ", () => {
    const alerts = run([
      { ...bad, id: "old", thiet_bi: "T1", pha: "", lan_do: 1, sample_date: "2025-01-01" },
      { ...ok, id: "new", thiet_bi: "T1", pha: "chung3pha", lan_do: 2, sample_date: "2026-01-01" },
    ]);
    expect(alerts).toHaveLength(0);
  });

  test("cảnh báo đang hiện là của lần đo mới nhất: thứ k/n + isLatest", () => {
    const [a] = run([
      { ...ok, id: "1", thiet_bi: "T2", pha: "chung3pha", lan_do: 1, sample_date: "2025-01-01" },
      { ...bad, id: "2", thiet_bi: "T2", pha: "chung3pha", lan_do: 2, sample_date: "2026-01-01" },
    ]);
    expect([a.ordinal, a.total, a.isLatest]).toEqual([2, 2, true]);
    expect(c.alertLanDoHtml(a)).toMatch(/Lần 2.*thứ 2\/2 lần đo.*Mới nhất/);
  });

  test("bản ghi mới hơn nhập lệch Pha/tên (rơi sang nhóm khác) -> cảnh báo cũ, ghi rõ số liệu mới nhất đã hết cảnh báo", () => {
    const alerts = run([
      { ...bad, id: "old", thiet_bi: "T3", pha: "chung3pha", lan_do: 1, sample_date: "2025-01-01" },
      { ...ok, id: "new", thiet_bi: "t3 ", pha: "A", lan_do: 2, sample_date: "2026-01-01" },
    ]);
    expect(alerts).toHaveLength(1);
    const [a] = alerts;
    expect(a.isLatest).toBe(false);
    expect(a.newerRecord.id).toBe("new");
    expect(a.newerStillAlert).toBe(false);
    expect(c.alertLanDoHtml(a)).toMatch(/Cảnh báo cũ.*2026-01-01, Lần 2.*đã KHÔNG còn cảnh báo/);
    expect(c.filterAlertsBy(alerts, { data: "latest" })).toHaveLength(0);
    expect(c.filterAlertsBy(alerts, { data: "stale" })).toHaveLength(1);
  });

  test("TI pha A và pha B là 2 thiết bị — số liệu mới của pha B không làm pha A thành 'cũ'", () => {
    const TI = "TI (biến dòng điện)";
    const alerts = run([
      { ...bad, h2: 2000, id: "a", thiet_bi: "TI1", equipment_type: TI, pha: "A", lan_do: 1, sample_date: "2025-01-01" },
      { ...ok, id: "b", thiet_bi: "TI1", equipment_type: TI, pha: "B", lan_do: 2, sample_date: "2026-01-01" },
    ]);
    const a = alerts.find((x) => x.record.id === "a");
    expect(a.isLatest).toBe(true);
  });

  test("lọc Loại cảnh báo theo mức / loại đo / hạng mục", () => {
    const alerts = run([
      { ...bad, id: "abs", thiet_bi: "X1", pha: "chung3pha", lan_do: 1, sample_date: "2026-01-01" },
      { ...ok, id: "o2", thiet_bi: "X2", pha: "chung3pha", lan_do: 1, sample_date: "2026-01-01", n2: 50000, o2: 10000 },
      { ...ok, id: "co", thiet_bi: "X3", pha: "chung3pha", lan_do: 1, sample_date: "2026-01-01", co: 500, co2: 11000 },
    ]);
    const ids = (type) => c.filterAlertsBy(alerts, { type }).map((a) => a.record.id).sort();
    expect(ids("cat:o2n2")).toEqual(["o2"]);
    expect(ids("cat:co2co")).toEqual(["co"]);
    expect(ids("cat:absolute")).toEqual(["abs"]);
    expect(ids("level:alert")).toEqual(["co", "o2"]);
    expect(ids("src:gas")).toEqual(["abs", "co", "o2"]);
    expect(ids("src:oil")).toEqual([]);
  });
});
