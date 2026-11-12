// Tab Xu hướng — tiêu chuẩn 1 thông số khí khi CHUỘT PHẢI vào tên khí (thay bảng "Tiêu chuẩn so sánh của thông số khí
// đang vẽ" dưới đồ thị): trendStandardInfo() + trendStdKeyAtChartPoint(), ui-trend.js.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "src/presentation/tabs/ui-trend.js"), "utf8");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function load() {
  const ctx = {
    console, Date, Math, Number, String, Array, Object, Map, Set,
    document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    window: { addEventListener() {} },
    DGA: require("../src/domain/dga-logic"),
    $: () => null,
    escapeHtml: (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
  };
  vm.createContext(ctx);
  vm.runInContext("let _allMeasurements = [];\n" + SRC, ctx, { filename: "ui-trend.js" });
  return ctx;
}

const MBA = require("../src/domain/dga-logic").EQUIPMENT_TYPES.MBA;
const recs = [{ sample_date: "2026-01-01", equipment_type: MBA }, { sample_date: "2026-06-01", equipment_type: MBA, bang63_voltage_class: "500" }];

describe("trendStandardInfo", () => {
  const { trendStandardInfo, DGA } = load();

  test("7 khí: giá trị điển hình + tốc độ gia tăng điển hình + nguồn", () => {
    const info = trendStandardInfo("gas:H2", recs);
    expect(info.name).toBe("H2");
    const labels = info.rows.map((r) => r[0]);
    expect(labels).toEqual(expect.arrayContaining(["Giá trị điển hình", "Tốc độ gia tăng điển hình"]));
    const std = DGA.resolveStandard({ equipmentType: MBA }, []);
    expect(info.rows[0][1]).toContain(Number(std.limits.H2).toLocaleString("vi-VN"));
    expect(info.source.length).toBeGreaterThan(0);
    expect(info.basis).toContain("lần đo gần nhất");
  });

  test("N2/O2, TCG, Tổng khí hòa tan có nội dung riêng như bảng cũ", () => {
    expect(trendStandardInfo("gas:N2", recs).rows[0][1]).toBe("Không có ngưỡng riêng");
    expect(trendStandardInfo("gas:TCG", recs).source).toContain("IEEE C57.104-2008");
    const b63 = trendStandardInfo("gas:BANG63", recs);
    expect(b63.rows[0][1]).toContain("(cấp của thiết bị)"); // 500 kV in đậm theo cấp điện áp đã nhập
    expect(b63.source).toContain("Bảng 63");
  });

  test("không phải thông số khí / không có dữ liệu → null", () => {
    expect(trendStandardInfo("oil:moisture", recs)).toBeNull();
    expect(trendStandardInfo("gas:H2", [])).toBeNull();
  });
});

describe("trendStdKeyAtChartPoint — chuột phải trên đồ thị", () => {
  const { trendStdKeyAtChartPoint } = load();
  const chart = {
    $trendLabelBoxes: [{ x: 100, y: 50, w: 30, h: 16, datasetIndex: 1 }],
    data: { datasets: [{ paramKey: "gas:H2" }, { paramKey: "gas:C2H2" }] },
    isDatasetVisible: () => true,
    getDatasetMeta: (i) => ({ data: i === 0 ? [{ x: 0, y: 200 }, { x: 400, y: 200 }] : [{ x: 0, y: 300 }, { x: 10, y: 300 }] }),
  };
  test("trúng nhãn tên khí → khí của nhãn đó", () => {
    expect(trendStdKeyAtChartPoint(chart, 110, 55)).toBe("gas:C2H2");
  });
  test("không trúng nhãn, gần 1 đường → khí của đường đó", () => {
    expect(trendStdKeyAtChartPoint(chart, 200, 203)).toBe("gas:H2");
  });
  test("vùng trống → không có", () => {
    expect(trendStdKeyAtChartPoint(chart, 200, 120)).toBeNull();
  });
});

describe("index.html", () => {
  test("đã bỏ bảng tiêu chuẩn dưới đồ thị, có ô thông tin chuột phải", () => {
    expect(HTML).not.toContain('id="trStdWrap"');
    expect(HTML).not.toContain("Tiêu chuẩn so sánh của thông số khí đang vẽ<button");
    expect(HTML).toContain('id="trStdPopover"');
  });
});

describe("trendStdKeyAtChartPoint — chú thích (legend) dưới đồ thị", () => {
  const { trendStdKeyAtChartPoint } = load();
  test("trúng mục chú thích → khí của mục đó", () => {
    const chart = {
      $trendLabelBoxes: [],
      legend: { legendHitBoxes: [{ left: 10, top: 400, width: 80, height: 14 }, { left: 100, top: 400, width: 90, height: 14 }], legendItems: [{ datasetIndex: 0 }, { datasetIndex: 1 }] },
      data: { datasets: [{ paramKey: "gas:H2" }, { paramKey: "gas:C2H4" }] },
      isDatasetVisible: () => true,
      getDatasetMeta: () => ({ data: [] }),
    };
    expect(trendStdKeyAtChartPoint(chart, 140, 406)).toBe("gas:C2H4");
  });
});
