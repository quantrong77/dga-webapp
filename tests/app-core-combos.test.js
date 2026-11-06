// Bước 4.2 REFACTOR_PLAN: 4 hàm gợi ý "Trạm" + 5 hàm gợi ý "Thiết bị" viết lặp trong initApp() đã gom về
// stationComboOptions()/deviceComboOptions() (src/presentation/app-core.js). Test so kết quả với NGUYÊN VĂN code cũ
// trên dữ liệu ngẫu nhiên (tên trùng, rỗng, có khoảng trắng, khác trạm, khác loại thiết bị) — phải giống hệt.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const ctx = { document: { addEventListener() {} }, window: {}, console, init: () => {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "src", "presentation", "app-core.js"), "utf8"), ctx, { filename: "app-core.js" });
const DGA = require("../src/domain/dga-logic");

// ---- NGUYÊN VĂN code cũ (trước refactor, initApp() trong app-core.js) ----
const OLD = {
  station: (_allStations) =>
    _allStations
      .slice()
      .sort((a, b) => (a.ten_tram || "").localeCompare(b.ten_tram || "", "vi"))
      .map((s) => ({ value: s.ten_tram, label: (s.ma_tram ? s.ma_tram + " — " : "") + s.ten_tram })),
  oThietbi: (_allMeasurements, _allOilTests) => {
    const byName = new Map();
    _allMeasurements.forEach((r) => {
      const name = (r.thiet_bi || "").trim();
      if (!name || byName.has(name)) return;
      byName.set(name, r.tram || "");
    });
    _allOilTests.forEach((r) => {
      const name = (r.thiet_bi || "").trim();
      if (!name || byName.has(name)) return;
      byName.set(name, r.tram || "");
    });
    return Array.from(byName.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "vi"))
      .map(([name, tram]) => ({ value: name, label: tram ? `${name} — ${tram}` : name }));
  },
  fThietbi: (_allMeasurements, tram) => {
    const byName = new Map();
    _allMeasurements.forEach((r) => {
      const name = (r.thiet_bi || "").trim();
      if (!name || byName.has(name)) return;
      if (tram && (r.tram || "").trim() !== tram) return;
      byName.set(name, r.tram || "");
    });
    return Array.from(byName.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "vi"))
      .map(([name, tram]) => ({ value: name, label: tram ? `${name} — ${tram}` : name }));
  },
  otThietbi: (_allMeasurements, _allOilTests, _allOltcOilTests) => {
    const byName = new Map();
    [_allMeasurements, _allOilTests, _allOltcOilTests].forEach((list) =>
      list.forEach((r) => {
        const name = (r.thiet_bi || "").trim();
        if (!name || byName.has(name)) return;
        byName.set(name, r.tram || "");
      })
    );
    return Array.from(byName.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "vi"))
      .map(([name, tram]) => ({ value: name, label: tram ? `${name} — ${tram}` : name }));
  },
  tioThietbi: (_allMeasurements, _allTioOilTests) => {
    const byName = new Map();
    _allMeasurements.forEach((r) => {
      if (![DGA.EQUIPMENT_TYPES.TI, DGA.EQUIPMENT_TYPES.TU, DGA.EQUIPMENT_TYPES.BUSHING].includes(r.equipment_type)) return;
      const name = (r.thiet_bi || "").trim();
      if (!name || byName.has(name)) return;
      byName.set(name, r.tram || "");
    });
    _allTioOilTests.forEach((r) => {
      const name = (r.thiet_bi || "").trim();
      if (!name || byName.has(name)) return;
      byName.set(name, r.tram || "");
    });
    return Array.from(byName.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "vi"))
      .map(([name, tram]) => ({ value: name, label: tram ? `${name} — ${tram}` : name }));
  },
};

// ---- dữ liệu ngẫu nhiên có hạt giống cố định ----
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const NAMES = ["AT1", "AT2", " AT1 ", "T1", "Đường dây 571", "ă-thiết bị", "", null, "M4100", "TI-01", "TU 02", "Z9"];
const TRAMS = ["Trạm 220kV Hàm Tân", "Trạm 500kV Di Linh", "", null, "  Trạm 110kV Ân Thi ", "Trạm 220kV Hàm Tân "];
const TYPES = Object.values(DGA.EQUIPMENT_TYPES).concat([undefined, "Khác"]);
const records = (n) => Array.from({ length: n }, () => ({ thiet_bi: pick(NAMES), tram: pick(TRAMS), equipment_type: pick(TYPES) }));
const stations = (n) => Array.from({ length: n }, () => ({ ten_tram: pick(["Hàm Tân", "Di Linh", "Ân Thi", "Đắk Nông", "ă", "", null]), ma_tram: pick(["", "HT", null, "DL"]) }));

describe("stationComboOptions / deviceComboOptions giống hệt code cũ", () => {
  test.each(Array.from({ length: 40 }, (_, i) => i))("bộ dữ liệu ngẫu nhiên #%i", () => {
    const m = records(Math.floor(rnd() * 30));
    const o = records(Math.floor(rnd() * 15));
    const ol = records(Math.floor(rnd() * 10));
    const tio = records(Math.floor(rnd() * 10));
    ctx._allStations = stations(Math.floor(rnd() * 12));
    expect(ctx.stationComboOptions()).toEqual(OLD.station(ctx._allStations));
    expect(ctx.deviceComboOptions([m, o])).toEqual(OLD.oThietbi(m, o));
    for (const tram of ["", "Trạm 220kV Hàm Tân", "Trạm 110kV Ân Thi", "không có"]) {
      expect(ctx.deviceComboOptions([m], (r) => !tram || (r.tram || "").trim() === tram)).toEqual(OLD.fThietbi(m, tram));
    }
    expect(ctx.deviceComboOptions([m, o, ol])).toEqual(OLD.otThietbi(m, o, ol));
    const types = [DGA.EQUIPMENT_TYPES.TI, DGA.EQUIPMENT_TYPES.TU, DGA.EQUIPMENT_TYPES.BUSHING];
    expect(ctx.deviceComboOptions([m.filter((r) => types.includes(r.equipment_type)), tio])).toEqual(OLD.tioThietbi(m, tio));
  });
});
