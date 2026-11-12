// Tab "Lịch sử đo" — bộ lọc chung (ui-history.js): khoảng ngày, quy đổi "Loại thiết bị" sang bảng con Dầu, số đếm.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load() {
  const els = {};
  const el = (id) => (els[id] ||= { id, value: "", textContent: "", disabled: false, classList: { toggle() {}, add() {}, remove() {} } });
  const ctx = { console, DGA: require("../src/domain/dga-logic"), $: el, document: {}, window: {} };
  vm.createContext(ctx);
  for (const f of ["src/presentation/components/ui-utils.js", "src/presentation/tabs/ui-history.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx);
  }
  vm.runInContext("var _allTioOilTests = [];", ctx);
  return { ctx, el };
}

describe("lichsuMatchesFilter — khoảng ngày", () => {
  const { ctx } = load();
  const rec = { tram: "T1", thiet_bi: "AT1", sample_date: "2026-03-15" };
  test("không lọc → khớp", () => {
    expect(ctx.lichsuMatchesFilter(rec, { station: "", device: "", from: "", to: "" })).toBe(true);
  });
  test("trong / ngoài khoảng, tính cả 2 đầu mút", () => {
    expect(ctx.lichsuMatchesFilter(rec, { from: "2026-03-15", to: "2026-03-15" })).toBe(true);
    expect(ctx.lichsuMatchesFilter(rec, { from: "2026-03-16" })).toBe(false);
    expect(ctx.lichsuMatchesFilter(rec, { to: "2026-03-14" })).toBe(false);
  });
  test("bản ghi không có ngày bị loại khi đang lọc theo ngày", () => {
    expect(ctx.lichsuMatchesFilter({ tram: "T1" }, { from: "2026-01-01" })).toBe(false);
  });
  test("vẫn lọc đúng Trạm/Thiết bị", () => {
    expect(ctx.lichsuMatchesFilter(rec, { station: "T2" })).toBe(false);
    expect(ctx.lichsuMatchesFilter(rec, { station: "T1", device: "AT1" })).toBe(true);
  });
});

describe("lichsuOilSourceVisibility — Loại thiết bị chung → bảng con Dầu", () => {
  const { ctx } = load();
  const T = ctx.DGA.EQUIPMENT_TYPES;
  test("Tất cả → cả 3 bảng", () => {
    expect(ctx.lichsuOilSourceVisibility("")).toEqual({ main: true, oltc: true, instrument: true, instrumentType: "" });
  });
  test("MBA/Kháng dầu → dầu MBA chính + OLTC", () => {
    expect(ctx.lichsuOilSourceVisibility(T.MBA)).toEqual({ main: true, oltc: true, instrument: false, instrumentType: "" });
  });
  test("TI / TU / Sứ xuyên → bảng TI/TU/Sứ xuyên đúng loại", () => {
    for (const t of [T.TI, T.TU, T.BUSHING]) {
      expect(ctx.lichsuOilSourceVisibility(t)).toEqual({ main: false, oltc: false, instrument: true, instrumentType: t });
    }
  });
  test("Khác → không bảng dầu nào", () => {
    expect(ctx.lichsuOilSourceVisibility("Khác")).toEqual({ main: false, oltc: false, instrument: false, instrumentType: "" });
  });
});

describe("lichsuFilteredGas / lichsuFilteredOil — 1 bộ lọc cho cả 2 bảng", () => {
  const { ctx, el } = load();
  const T = ctx.DGA.EQUIPMENT_TYPES;
  vm.runInContext(`
    _allMeasurements = [
      { tram: "T1", thiet_bi: "AT1", equipment_type: "${T.MBA}", sample_date: "2026-01-10" },
      { tram: "T1", thiet_bi: "TI-A", equipment_type: "${T.TI}", sample_date: "2026-02-10" },
      { tram: "T2", thiet_bi: "AT2", equipment_type: "${T.MBA}", sample_date: "2026-03-10" },
    ];
    _allOilTests = [{ tram: "T1", thiet_bi: "AT1", sample_date: "2026-01-12" }, { tram: "T2", thiet_bi: "AT2", sample_date: "2026-03-12" }];
    _allOltcOilTests = [{ tram: "T1", thiet_bi: "AT1", sample_date: "2026-01-12" }];
    _allTioOilTests = [{ tram: "T1", thiet_bi: "TI-A", equipment_type: "${T.TI}", sample_date: "2026-02-11" }];
  `, ctx);
  const n = () => { const o = ctx.lichsuFilteredOil(); return [ctx.lichsuFilteredGas().length, o.main.length, o.oltc.length, o.instrument.length]; };

  test("không lọc", () => {
    expect(n()).toEqual([3, 2, 1, 1]);
  });
  test("Trạm T1 + MBA → khí 1, dầu chính 1, OLTC 1, TI/TU 0", () => {
    el("lichsu_station").value = "T1";
    el("historyEquipmentFilter").value = T.MBA;
    expect(n()).toEqual([1, 1, 1, 0]);
  });
  test("Trạm T1 + TI → khí 1, chỉ bảng TI/TU", () => {
    el("historyEquipmentFilter").value = T.TI;
    expect(n()).toEqual([1, 0, 0, 1]);
  });
  test("khoảng ngày tháng 1 → chỉ bản ghi tháng 1", () => {
    el("lichsu_station").value = "";
    el("historyEquipmentFilter").value = "";
    el("lichsu_from").value = "2026-01-01";
    el("lichsu_to").value = "2026-01-31";
    expect(n()).toEqual([1, 1, 1, 0]);
  });
  test("số đếm trên 2 nút + tóm tắt bộ lọc", () => {
    ctx.updateLichSuCounts();
    expect(el("lichsuCountGas").textContent).toBe("(1)");
    expect(el("lichsuCountOil").textContent).toBe("(2)");
    expect(el("lichsuFilterSummary").textContent).toBe("Đang lọc: 01/01/2026 → 31/01/2026");
    expect(el("btnLichsuClearFilters").disabled).toBe(false);
  });
});

describe('"(Chưa ghi loại thiết bị)" — bản ghi cũ không có equipment_type', () => {
  const { ctx, el } = load();
  vm.runInContext(`
    _allMeasurements = [{ tram: "T1", thiet_bi: "A" }, { tram: "T1", thiet_bi: "B", equipment_type: "" }, { tram: "T1", thiet_bi: "C", equipment_type: "MBA/Kháng dầu" }];
    _allOilTests = [{ tram: "T1", thiet_bi: "A" }]; _allOltcOilTests = [];
  `, ctx);
  test("lọc ra đúng 2 lần đo chưa ghi loại; bảng dầu không hiện", () => {
    el("historyEquipmentFilter").value = "__none__";
    expect(ctx.lichsuFilteredGas().map((r) => r.thiet_bi)).toEqual(["A", "B"]);
    const o = ctx.lichsuFilteredOil();
    expect(o.main.length + o.oltc.length + o.instrument.length).toBe(0);
    ctx.updateLichSuCounts();
    expect(el("lichsuFilterSummary").textContent).toBe("Đang lọc: chưa ghi loại thiết bị");
  });
});
