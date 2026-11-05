/* Biểu đồ Điều 54 (ui/ui-dieu54-charts.js) phải vẽ ĐÚNG ranh giới vùng mà logic chẩn đoán đang dùng:
 *  - Tam giác Duval: mọi điểm bên trong 1 vùng vẽ -> classifyDuval1() trả đúng mã vùng đó (Bảng 67).
 *  - Biểu đồ 2 (3 trục): điểm bên trong 1 khối -> diagnoseRatios() trả đúng mã (Bảng 66).
 *  - Hình dựng được (không có NaN) ở cả giao diện sáng/tối. */
const DGA = require("../dga-logic");
const C = require("../ui/ui-dieu54-charts");

function pointInPoly([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

describe("Tam giác Duval vẽ khớp classifyDuval1() (Bảng 67)", () => {
  test("lưới điểm %C2H2/%C2H4 bước 0,5% (bỏ sát ranh giới)", () => {
    const nearBoundary = (v, marks) => marks.some((b) => Math.abs(v - b) < 0.3);
    let checked = 0;
    for (let a = 0.25; a < 100; a += 0.5) {
      for (let e = 0.25; a + e < 100; e += 0.5) {
        const m = 100 - a - e;
        if (nearBoundary(a, [4, 13, 15, 29]) || nearBoundary(e, [20, 23, 40, 50]) || Math.abs(m - 98) < 0.3) continue;
        const zones = C.D54_DUVAL_ZONES.filter((z) => pointInPoly([a, e], z.poly));
        expect(zones).toHaveLength(1); // các vùng phủ kín tam giác, không chồng nhau
        const want = DGA.classifyDuval1({ pctCH4: m, pctC2H4: e, pctC2H2: a }).zone;
        expect([a, e, zones[0].code]).toEqual([a, e, want]);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(15000);
  });

  test("ví dụ Điều 54 (C2H2 20%, C2H4 30%, CH4 50%) nằm trong vùng D2", () => {
    expect(DGA.classifyDuval1({ pctCH4: 50, pctC2H4: 30, pctC2H2: 20 }).zone).toBe("D2");
    expect(C.D54_DUVAL_ZONES.find((z) => pointInPoly([20, 30], z.poly)).code).toBe("D2");
  });

  test("đỉnh tam giác: CH4 ở trên (xa), C2H2 bên trái, C2H4 bên phải", () => {
    const [cx, cy] = C.d54DuvalXY(0, 0), [lx, ly] = C.d54DuvalXY(100, 0), [rx] = C.d54DuvalXY(0, 100);
    expect(cy).toBeGreaterThan(ly);
    expect(lx).toBeLessThan(cx);
    expect(rx).toBeGreaterThan(cx);
  });
});

describe("Biểu đồ 2 (3 trục) vẽ khớp diagnoseRatios() (Bảng 66)", () => {
  // Lấy điểm giữa (thang log) của khối, thay Infinity/0 bằng mép trục.
  const lo = C.D54_CHART2.range[0], hi = C.D54_CHART2.range[1];
  const mid = ([a, b]) => Math.sqrt((a === 0 ? lo : a) * (b === Infinity ? hi : b));
  // Khối D1 và D2 chồng nhau một phần (vùng "D1/D2") nên tâm khối có thể rơi vào phần chồng lấn.
  const expectCode = { PD: /^PD -/, D1: /^D1(\/D2)? -/, D2: /^(D1\/)?D2 -/, T1: /^T1 -/, T2: /^T2 -/, T3: /^T3 -/ };
  test.each(C.D54_CHART2.zones.map((z) => [z.code, z]))("tâm khối %s", (code, z) => {
    const out = DGA.diagnoseRatios({ c2h4_c2h6: mid(z.x), ch4_h2: mid(z.y), c2h2_c2h4: mid(z.z) });
    expect(out).toMatch(expectCode[code]);
  });
  test("phần D1 không chồng D2 (C2H4/C2H6 ∈ (1; 2)) -> chỉ D1", () => {
    expect(DGA.diagnoseRatios({ c2h4_c2h6: 1.5, ch4_h2: 0.3, c2h2_c2h4: 5 })).toMatch(/^D1 -/);
  });
});

describe("Dựng hình không lỗi", () => {
  const themes = [false, true].map((dark) => ({
    dark,
    zone: { PD: "#7c3aed", D1: "#f97316", D2: "#dc2626", D12: "#e8590c", T1: "#eab308", T2: "#f59e0b", T3: "#b45309", DT: "#db2777", PDT1: "#a78bfa" },
    text: "#000000", muted: "#555555", grid: "#cccccc", floor: "rgba(0,0,0,0.03)", point: "#0369a1", example: "#000000",
  }));
  const current = { c2h2_c2h4: 0.05, ch4_h2: 2, c2h4_c2h6: 3 };
  const view = { yaw: -0.4, pitch: 0.9, focal: 7, scale: 170, cx: 260, cy: 200 };
  const allFinite = (scene) => scene.items.every((it) => {
    const pts = it.type === "poly" ? it.pts : it.type === "line" ? [it.a, it.b] : [it.p];
    return pts.every((p) => {
      const q = C.d54Project(p, view);
      return Number.isFinite(q.x) && Number.isFinite(q.y);
    });
  });
  test.each(themes)("giao diện dark=%#", (th) => {
    expect(allFinite(C.d54BuildChart1("left", th, current))).toBe(true);
    expect(allFinite(C.d54BuildChart1("right", th, current))).toBe(true);
    expect(allFinite(C.d54BuildChart2(th, current))).toBe(true);
    expect(allFinite(C.d54BuildDuval(th, { example: true, current: { pctC2H2: 20, pctC2H4: 30, pctCH4: 50 } }))).toBe(true);
  });
});
