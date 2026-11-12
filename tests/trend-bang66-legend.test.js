// Phiếu đối chiếu lần đo (tab Xu hướng) — chú giải các bảng tra Bảng 66 (trendBang66LegendHtml(), ui-trend.js):
// nằm NGAY TRÊN bảng đầu tiên, nói rõ ô được so với tỷ số nào của lần đo, có ô mẫu đúng class ô trong bảng;
// ô "không nằm trong" có nền xám thật (CSS).
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = fs.readFileSync(path.join(__dirname, "..", "src", "presentation", "tabs", "ui-trend.js"), "utf8");
const CSS = fs.readFileSync(path.join(__dirname, "..", "src", "presentation", "styles", "style-tabs-secondary.css"), "utf8");

function load() {
  const ctx = { console, Date, Math, Number, String, Array, Object, Map, Set, document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] }, window: { addEventListener() {} }, DGA: require("../src/domain/dga-logic"), $: () => null };
  vm.createContext(ctx);
  vm.runInContext("let _allMeasurements = [];\n" + SRC, ctx, { filename: "ui-trend.js" });
  return ctx;
}

describe("trendBang66LegendHtml", () => {
  const { trendBang66LegendHtml } = load();

  test("ghi đủ 3 tỷ số của lần đo đang xem", () => {
    const html = trendBang66LegendHtml({ c2h2_c2h4: { value: 0.0188 }, ch4_h2: { value: 0.75 }, c2h4_c2h6: { value: 5.33 } });
    expect(html).toContain("C2H2/C2H4 = 0,0188");
    expect(html).toContain("CH4/H2 = 0,75");
    expect(html).toContain("C2H4/C2H6 = 5,33");
  });

  test("tỷ số không tính được → dấu —", () => {
    const html = trendBang66LegendHtml({ c2h2_c2h4: null, ch4_h2: { value: 2 }, c2h4_c2h6: { value: null } });
    expect(html).toContain("C2H2/C2H4 = —");
    expect(html).toContain("C2H4/C2H6 = —");
  });

  test("có ô mẫu cho đủ 4 kiểu: trong khoảng, không trong khoảng, NS, dòng khớp", () => {
    const html = trendBang66LegendHtml({});
    for (const cls of ["chk-sample chk-ok", "chk-sample chk-no", "chk-sample chk-ns", "chk-sample chk-row"]) expect(html).toContain(cls);
    expect(html).toMatch(/nằm trong<\/strong> khoảng/);
    expect(html).toMatch(/không nằm trong<\/strong>/);
  });
});

describe("Phiếu đối chiếu — vị trí chú giải và kiểu ô", () => {
  test("chú giải đặt ngay sau tiêu đề bảng 9 dòng, trước bảng; chỉ khi có bảng tra", () => {
    const i = SRC.indexOf("<h4>Bảng 66 — phần 9 dòng");
    const legend = SRC.indexOf("${c9 || iec ? trendBang66LegendHtml(row.ratios) : \"\"}", i);
    const table = SRC.indexOf("${table9}", i);
    expect(i).toBeGreaterThan(0);
    expect(legend).toBeGreaterThan(i);
    expect(table).toBeGreaterThan(legend);
  });
  test("không còn câu chú giải cũ ở cuối phiếu", () => {
    expect(SRC).not.toContain("Ô xanh ✓ = tỷ số nằm trong khoảng của ô; ô xám");
  });
  test("ô không nằm trong khoảng (td.chk-no) có nền, không chỉ đổi màu chữ", () => {
    const rule = CSS.slice(CSS.indexOf(".fault-check-table td.chk-no {"), CSS.indexOf("}", CSS.indexOf(".fault-check-table td.chk-no {")));
    expect(rule).toMatch(/background:/);
  });
});
