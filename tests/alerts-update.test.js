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
      DGA: require("../dga-logic"),
    };
    ctx.window = ctx;
    ctx.global = ctx;
    vm.createContext(ctx);

    // Load các helpers cần thiết từ logic và ui
    const loadScript = (file) => {
      const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
      vm.runInContext(code, ctx);
    };

    loadScript("storage/storage-core.js");
    loadScript("storage/storage-auth.js");
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

    // Bảng đo khí ui-history.js phải có nút Xem mà không phụ thuộc vào rec.bbtn_url
    expect(histContent).toMatch(/<button class="btn ghost" data-action="viewbbtn"[^>]*>Xem<\/button>/);
    expect(histContent).not.toMatch(/\$\{rec\.bbtn_url \? `<button class="btn ghost" data-action="viewbbtn"/);

    // Bảng dầu ui-oil.js, ui-oltc.js và ui-ti-oil.js phải có nút Xem
    expect(oilContent).toMatch(/<button class="btn ghost" data-action="view"[^>]*>Xem<\/button>/);
    expect(oltcContent).toMatch(/<button class="btn ghost" data-action="view"[^>]*>Xem<\/button>/);
    expect(tioContent).toMatch(/<button class="btn ghost" data-action="viewbbtn"[^>]*>Xem<\/button>/);
  });
});
