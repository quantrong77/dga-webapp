/* Diễn biến loại khiếm khuyết (tab Xu hướng): DGA.buildFaultEvolution() + DGA.bang66RatioThresholds(). */
const fs = require("fs");
const path = require("path");
const DGA = require("../src/domain/dga-logic.js");

const g = (H2, CH4, C2H6, C2H4, C2H2) => ({ H2, CH4, C2H6, C2H4, C2H2, CO: 100, CO2: 1000 });

describe("buildFaultEvolution — giá trị đo", () => {
  const series = [
    { date: 1, gases: g(50, 60, 20, 30, 0), exceedCount: 0 },
    { date: 2, gases: g(90, 260, 90, 220, 0), exceedCount: 2 },
    { date: 3, gases: g(120, 380, 80, 420, 1), exceedCount: 3 },
  ];
  const rows = DGA.buildFaultEvolution(series);

  test("mỗi lần đo 1 dòng, giữ ngày và điều kiện áp dụng", () => {
    expect(rows.map((r) => r.date)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.applicable)).toEqual([false, true, true]);
    expect(rows[0].prevDate).toBeNull();
  });

  test("tỷ số đúng và mã Bảng 66 khớp diagnoseRatios()", () => {
    expect(rows[1].ratios.ch4_h2.value).toBeCloseTo(260 / 90);
    expect(rows[1].ratios.c2h4_c2h6.value).toBeCloseTo(220 / 90);
    expect(rows[1].code).toBe("T2");
    expect(rows[2].code).toBe("T3");
  });

  test("tử số = 0 hoặc tỷ số < 0,01 → kẹp tại RATIO_TREND_FLOOR, đánh dấu censored, giữ giá trị thật", () => {
    expect(rows[0].ratios.c2h2_c2h4).toEqual({ value: DGA.RATIO_TREND_FLOOR, raw: 0, censored: true });
    expect(rows[2].ratios.c2h2_c2h4.censored).toBe(true);
    expect(rows[2].ratios.c2h2_c2h4.raw).toBeCloseTo(1 / 420);
  });

  test("mẫu số = 0 → không tính tỷ số (không dùng quy ước 999) và không gán mã", () => {
    const [r] = DGA.buildFaultEvolution([{ date: 1, gases: g(0, 10, 5, 0, 0), exceedCount: 1 }]);
    expect(r.ratios.ch4_h2).toBeNull();
    expect(r.ratios.c2h2_c2h4).toBeNull();
    expect(r.code).toBeNull();
  });

  test("vị trí Duval khớp diagnoseDuval1()", () => {
    const ref = DGA.diagnoseDuval1(series[2].gases);
    expect(rows[2].duval.zone).toBe(ref.zone);
    expect(rows[2].duval.pctC2H4).toBeCloseTo(ref.pctC2H4);
  });
});

describe("buildFaultEvolution — phần tăng (Δ)", () => {
  test("tính trên hiệu 2 lần đo liên tiếp, bỏ lần đầu", () => {
    const rows = DGA.buildFaultEvolution([
      { date: 1, gases: g(100, 300, 80, 600, 3), exceedCount: 2 },
      { date: 2, gases: g(400, 400, 90, 900, 900), exceedCount: 3 },
    ], { basis: "delta" });
    expect(rows).toHaveLength(1);
    expect(rows[0].prevDate).toBe(1);
    expect(rows[0].ratios.c2h2_c2h4.value).toBeCloseTo(897 / 300);
    expect(rows[0].ratios.ch4_h2.value).toBeCloseTo(100 / 300);
    expect(rows[0].code).toBe("D1");
  });

  test("không tính qua lần lọc/thay dầu và bỏ cặp không có khí tăng", () => {
    const rows = DGA.buildFaultEvolution([
      { date: 1, gases: g(100, 300, 80, 600, 3), exceedCount: 2 },
      { date: 2, gases: g(10, 20, 5, 30, 0), treated: true, exceedCount: 0 },
      { date: 3, gases: g(9, 19, 5, 29, 0), exceedCount: 0 },
      { date: 4, gases: g(30, 60, 10, 40, 0), exceedCount: 0 },
    ], { basis: "delta" });
    expect(rows.map((r) => r.date)).toEqual([4]);
  });

  test("mẫu số giảm (Δ ≤ 0) → tỷ số đó không tính", () => {
    const [r] = DGA.buildFaultEvolution([
      { date: 1, gases: g(100, 300, 90, 200, 0), exceedCount: 1 },
      { date: 2, gases: g(150, 400, 80, 300, 0), exceedCount: 1 },
    ], { basis: "delta" });
    expect(r.ratios.c2h4_c2h6).toBeNull();
    expect(r.code).toBeNull();
  });
});

describe("bang66RatioThresholds", () => {
  test("lấy mốc từ Bảng 66 hiện hành, sắp tăng dần, không trùng", () => {
    const t = DGA.bang66RatioThresholds(0.1);
    expect(t.c2h2_c2h4).toEqual([0.1, 0.2, 0.6, 1, 2.5]);
    expect(t.ch4_h2).toEqual([0.1, 0.5, 1]);
    expect(t.c2h4_c2h6).toEqual([0.2, 1, 2, 4]);
  });

  test("ngưỡng PD theo loại thiết bị (TI/TU 0,2) được đưa vào CH4/H2", () => {
    expect(DGA.bang66RatioThresholds(0.2).ch4_h2).toEqual([0.1, 0.2, 0.5, 1]);
  });
});

describe("Giao diện tab Xu hướng", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  test.each(["trFaultWrap", "tr_faultBasis", "tr_faultPhase", "trRatioChart", "trDuvalSvg", "trFaultBody", "trFaultTickAll", "trFaultNoneTicked", "trFaultCodeLegend", "tr_faultScale", "trFaultCard"])("có phần tử #%s", (id) => {
    expect(html).toContain(`id="${id}"`);
  });
});

describe("Bảng 66 — phần 9 dòng (mốc 0,1 – 1 – 3)", () => {
  const code = (g, h, i) => {
    const res = DGA.diagnoseBang66Code9({ c2h2_c2h4: g, ch4_h2: h, c2h4_c2h6: i });
    return res.match ? res.match.id : null;
  };

  test.each([
    [0.05, 0.5, 0.5, 1], [0.05, 0.05, 0.5, 2], [1, 0.05, 0.5, 3], [5, 0.5, 2, 4], [1, 0.5, 5, 5],
    [0.05, 0.5, 2, 6], [0.05, 3, 0.5, 7], [0.05, 3, 2, 8], [0.05, 3, 5, 9],
  ])("C2H2/C2H4=%p, CH4/H2=%p, C2H4/C2H6=%p → dòng %p", (g, h, i, id) => {
    expect(code(g, h, i)).toBe(id);
  });

  test("biên: cận dưới tính vào, cận trên không tính", () => {
    expect(code(0.05, 0.1, 0.5)).toBe(1); // CH4/H2 = 0,1 thuộc "0,1–1"
    expect(code(0.05, 1, 0.5)).toBe(7); // CH4/H2 = 1 thuộc "> 1"
    expect(code(0.1, 0.5, 2)).toBe(4); // C2H2/C2H4 = 0,1 thuộc "> 0,1", không thuộc "< 0,1"
    expect(code(0.05, 3, 3)).toBe(9); // C2H4/C2H6 = 3 thuộc "> 3"
  });

  test("tổ hợp không khớp dòng nào → null, kèm kết quả từng ô", () => {
    const res = DGA.diagnoseBang66Code9({ c2h2_c2h4: 0.05, ch4_h2: 0.05, c2h4_c2h6: 2 });
    expect(res.match).toBeNull();
    expect(res.rows).toHaveLength(9);
    expect(res.rows[1].cells).toMatchObject({ g: { ok: true }, h: { ok: true }, i: { ok: false } });
  });

  test("thiếu tỷ số → null", () => {
    expect(DGA.diagnoseBang66Code9({ c2h2_c2h4: NaN, ch4_h2: 1, c2h4_c2h6: 1 })).toBeNull();
  });

  test("buildFaultEvolution gắn code9 và chỉ số bản ghi gốc", () => {
    const [r] = DGA.buildFaultEvolution([{ date: 1, gases: g(120, 380, 80, 420, 1), exceedCount: 3 }]);
    expect(r.code9).toMatchObject({ id: 9, family: "T3" });
    expect(r.index).toBe(0);
    const [o] = DGA.buildFaultEvolution([{ date: 1, gases: g(100, 5, 10, 20, 0), exceedCount: 1 }]);
    expect(o.code9).toMatchObject({ id: null, short: "Ngoài bảng" });
  });
});

describe("bang66IecCells — khớp diagnoseRatios()", () => {
  const cases = [
    { c2h2_c2h4: 0.002, ch4_h2: 3.17, c2h4_c2h6: 5.25 },
    { c2h2_c2h4: 0.05, ch4_h2: 2.5, c2h4_c2h6: 2 },
    { c2h2_c2h4: 3, ch4_h2: 0.3, c2h4_c2h6: 30 },
    { c2h2_c2h4: 1.5, ch4_h2: 0.8, c2h4_c2h6: 5 },
    { c2h2_c2h4: 0.5, ch4_h2: 0.05, c2h4_c2h6: 0.1 },
    { c2h2_c2h4: 0.05, ch4_h2: 0.05, c2h4_c2h6: 2 },
  ];
  test.each(cases)("%p", (ratios) => {
    const label = DGA.diagnoseRatios(ratios, 0.1);
    const matched = DGA.bang66IecCells(ratios, 0.1).filter((r) => r.match).map((r) => r.code);
    if (label === DGA.NO_DIAGNOSIS) expect(matched).toEqual([]);
    else expect(matched).toContain(label.split(/[ /]/)[0]);
  });

  test("ô NS luôn đạt và được đánh dấu", () => {
    const pd = DGA.bang66IecCells({ c2h2_c2h4: 5, ch4_h2: 0.05, c2h4_c2h6: 0.1 }, 0.1)[0];
    expect(pd.code).toBe("PD");
    expect(pd.cells.g).toMatchObject({ ns: true, ok: true });
    expect(pd.match).toBe(true);
  });
});
