/* src/presentation/tabs/ui-dieu54-charts.js — Vẽ lại các biểu đồ chẩn đoán của Điều 54 QĐ1901 (tab "Quy trình"):
 *   - Biểu đồ 1: tỷ số hàm lượng khí, 2 mặt phẳng (CH4/H2 – C2H2/C2H4 và C2H4/C2H6 – C2H2/C2H4)
 *   - Biểu đồ 2: tỷ số hàm lượng khí dạng không gian 3 trục
 *   - Biểu đồ 3: tam giác Duval 1 (vùng lỗi theo Bảng 67) + Ví dụ xác định điểm (CH4 50%, C2H4 30%, C2H2 20%)
 * Ranh giới vùng lấy đúng theo Bảng 66/Bảng 67 (cùng số liệu với diagnoseRatios()/classifyDuval1()
 * ở src/domain/dga-logic-gas.js — tests/dieu54-charts.test.js đối chiếu 2 bên).
 *
 * Hiển thị 3D bằng SVG thuần (không thư viện ngoài — app phải chạy được offline): mỗi vùng là 1
 * khối hộp/lăng trụ, chiếu phối cảnh + sắp xếp theo độ sâu (painter's algorithm). Kéo chuột/chạm để
 * xoay, phím mũi tên khi đang focus, nút "Mặc định" / "Nhìn thẳng (2D)". Màu theo giao diện sáng/tối
 * (đọc biến CSS, vẽ lại khi có sự kiện "dga:themechange"). Nếu đã phân tích 1 lần đo ở tab "Khí hòa
 * tan" (_lastAnalysis, ui-dga.js), điểm của lần đo đó được chấm lên các biểu đồ. */

const D54_SVG_NS = "http://www.w3.org/2000/svg";

// ---------------------------------------------------------------------------
// Màu vùng lỗi — 2 bộ cho giao diện sáng/tối (cùng tông, bản tối sáng hơn để nổi trên nền tối)
// ---------------------------------------------------------------------------
const D54_ZONE_COLORS = {
  light: { PD: "#7c3aed", D1: "#f97316", D2: "#dc2626", D12: "#e8590c", T1: "#eab308", T2: "#f59e0b", T3: "#b45309", DT: "#db2777", PDT1: "#a78bfa" },
  dark: { PD: "#a78bfa", D1: "#fb923c", D2: "#f87171", D12: "#fd7e14", T1: "#facc15", T2: "#fbbf24", T3: "#d97706", DT: "#f472b6", PDT1: "#c4b5fd" },
};

function d54Theme() {
  const dark = typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
  const css = typeof getComputedStyle === "function" ? getComputedStyle(document.documentElement) : null;
  const v = (name, fb) => (css && css.getPropertyValue(name).trim()) || fb;
  return {
    dark,
    zone: D54_ZONE_COLORS[dark ? "dark" : "light"],
    text: v("--text-primary", dark ? "#e2e8f0" : "#0f172a"),
    muted: v("--text-secondary", dark ? "#94a3b8" : "#475569"),
    grid: v("--border-strong", dark ? "#475569" : "#cbd5e1"),
    floor: dark ? "rgba(148,163,184,0.10)" : "rgba(15,23,42,0.035)",
    point: dark ? "#38bdf8" : "#0369a1",
    example: dark ? "#f8fafc" : "#0f172a",
  };
}

// ---------------------------------------------------------------------------
// Tiện ích màu
// ---------------------------------------------------------------------------
function d54Hex(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function d54Shade(hex, f) {
  // f > 1 làm sáng, f < 1 làm tối
  const [r, g, b] = d54Hex(hex).map((c) => (f >= 1 ? c + (255 - c) * (f - 1) : c * f));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}
function d54Esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// ---------------------------------------------------------------------------
// Máy chiếu 3D tối giản: điểm thế giới [x, y, z] (x sang phải, y vào sâu, z hướng lên)
// ---------------------------------------------------------------------------
function d54Project(p, view) {
  const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw);
  const cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  const x1 = p[0] * cy - p[1] * sy;
  const y1 = p[0] * sy + p[1] * cy;
  const up = p[2] * cp + y1 * sp;
  const depth = y1 * cp - p[2] * sp;
  const k = view.focal / (view.focal + depth);
  return { x: view.cx + x1 * k * view.scale, y: view.cy - up * k * view.scale, depth };
}

/** Khối hộp trục thẳng [x0..x1]×[y0..y1]×[z0..z1] -> 6 mặt, tô sáng/tối theo hướng mặt. */
function d54Box(b, color, opts) {
  const o = opts || {};
  const [x0, x1, y0, y1, z0, z1] = b;
  const P = (x, y, z) => [x, y, z];
  const faces = [
    { pts: [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], light: 1.18 }, // trên
    { pts: [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], light: 0.92 }, // trước
    { pts: [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], light: 0.78 }, // phải
    { pts: [P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1)], light: 0.86 }, // trái
    { pts: [P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1)], light: 0.7 }, // sau
    { pts: [P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x0, y0, z0)], light: 0.6 }, // đáy
  ];
  return faces.map((f) => ({ type: "poly", pts: f.pts, fill: d54Shade(color, f.light), opacity: o.opacity ?? 0.92, stroke: d54Shade(color, 0.62) }));
}

/** Lăng trụ đứng từ đa giác đáy (trên mặt z = 0) cao h. */
function d54Prism(poly2d, h, color, opts) {
  const o = opts || {};
  const items = [];
  const top = poly2d.map(([x, y]) => [x, y, h]);
  const bottom = poly2d.map(([x, y]) => [x, y, 0]);
  items.push({ type: "poly", pts: top, fill: d54Shade(color, 1.12), opacity: o.opacity ?? 0.95, stroke: d54Shade(color, 0.6) });
  for (let i = 0; i < poly2d.length; i++) {
    const j = (i + 1) % poly2d.length;
    const [ax, ay] = poly2d[i], [bx, by] = poly2d[j];
    // tô theo hướng pháp tuyến cạnh để khối có chiều sâu
    const nx = by - ay, ny = -(bx - ax);
    const len = Math.hypot(nx, ny) || 1;
    const light = 0.72 + 0.2 * ((-0.5 * nx - 0.85 * ny) / len);
    items.push({ type: "poly", pts: [bottom[i], bottom[j], top[j], top[i]], fill: d54Shade(color, light), opacity: o.opacity ?? 0.95, stroke: d54Shade(color, 0.55) });
  }
  return items;
}

function d54Render(svg, scene, view) {
  const items = scene.items.map((it) => {
    if (it.type === "poly") {
      const pr = it.pts.map((p) => d54Project(p, view));
      return { it, pr, depth: pr.reduce((s, q) => s + q.depth, 0) / pr.length + (it.bias || 0) };
    }
    if (it.type === "line") {
      const pr = [d54Project(it.a, view), d54Project(it.b, view)];
      return { it, pr, depth: (pr[0].depth + pr[1].depth) / 2 + (it.bias || 0) };
    }
    const pr = [d54Project(it.p, view)];
    return { it, pr, depth: it.type === "text" ? -1e9 : pr[0].depth - 0.001 };
  });
  items.sort((a, b) => b.depth - a.depth); // xa vẽ trước
  let out = "";
  for (const { it, pr } of items) {
    if (it.type === "poly") {
      out += `<polygon points="${pr.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ")}" fill="${it.fill}" fill-opacity="${it.opacity ?? 1}" stroke="${it.stroke || "none"}" stroke-width="${it.strokeWidth || 0.8}" stroke-linejoin="round"/>`;
    } else if (it.type === "line") {
      out += `<line x1="${pr[0].x.toFixed(1)}" y1="${pr[0].y.toFixed(1)}" x2="${pr[1].x.toFixed(1)}" y2="${pr[1].y.toFixed(1)}" stroke="${it.stroke}" stroke-width="${it.width || 1}"${it.dash ? ` stroke-dasharray="${it.dash}"` : ""}${it.arrow ? ' marker-end="url(#d54Arrow)"' : ""} stroke-linecap="round"/>`;
    } else if (it.type === "point") {
      out += `<circle cx="${pr[0].x.toFixed(1)}" cy="${pr[0].y.toFixed(1)}" r="${it.r || 5}" fill="${it.fill}" stroke="${it.stroke || "#fff"}" stroke-width="1.6"/>`;
      if (it.ring) out += `<circle cx="${pr[0].x.toFixed(1)}" cy="${pr[0].y.toFixed(1)}" r="${(it.r || 5) + 4}" fill="none" stroke="${it.fill}" stroke-width="1.2" opacity="0.6"/>`;
    } else if (it.type === "text") {
      out += `<text x="${pr[0].x.toFixed(1)}" y="${pr[0].y.toFixed(1)}" fill="${it.color}" font-size="${it.size || 12}" font-weight="${it.weight || 500}" text-anchor="${it.anchor || "middle"}" dominant-baseline="middle"${it.halo ? ` stroke="${it.halo}" stroke-width="3" paint-order="stroke"` : ""}>${it.html ? it.text : d54Esc(it.text)}</text>`;
    }
  }
  const arrowColor = scene.arrowColor || "#64748b";
  svg.innerHTML =
    `<defs><marker id="d54Arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${arrowColor}"/></marker></defs>` + out;
}

/** Chuỗi hóa học có chỉ số dưới: "C2H2" -> C<tspan>2</tspan>H<tspan>2</tspan> */
function d54Chem(s) {
  return d54Esc(s).replace(/([A-Za-z])(\d+)/g, '$1<tspan baseline-shift="sub" font-size="75%">$2</tspan>');
}

// ---------------------------------------------------------------------------
// Thang log cho các biểu đồ tỷ số khí
// ---------------------------------------------------------------------------
function d54LogMap(lo, hi) {
  const a = Math.log10(lo), b = Math.log10(hi);
  return (v) => {
    const c = Math.min(Math.max(v, lo), hi);
    return ((Math.log10(c) - a) / (b - a)) * 2 - 1; // -> [-1, 1]
  };
}

function d54FormatTick(v) {
  return String(v).replace(".", ",");
}

// ---------------------------------------------------------------------------
// Ngưỡng lấy TRỰC TIẾP từ logic (Admin có thể cấu hình ở "Cấu hình" > "Quy định") — hình luôn
// khớp với kết quả chẩn đoán: Bảng 66 (QD1901_BANG66_TABLE1), ngưỡng PD CH4/H2 của MBA
// (PD_THRESHOLD_BY_TYPE), Bảng 67 (QD1901_BANG67_DUVAL).
// ---------------------------------------------------------------------------
function d54Logic() {
  if (typeof window !== "undefined" && window.DGA) return window.DGA;
  if (typeof require === "function") return require("../../domain/dga-logic");
  return null;
}
function d54Table1() {
  const D = d54Logic();
  return { T: D.QD1901_BANG66_TABLE1, pd: D.PD_THRESHOLD_BY_TYPE[D.EQUIPMENT_TYPES.MBA] };
}

/** Hiệu 2 hình chữ nhật [x0, x1, y0, y1] -> danh sách mảnh còn lại (tối đa 4). */
function d54RectMinus(a, b) {
  const ix0 = Math.max(a[0], b[0]), ix1 = Math.min(a[1], b[1]);
  const iy0 = Math.max(a[2], b[2]), iy1 = Math.min(a[3], b[3]);
  if (ix0 >= ix1 || iy0 >= iy1) return [a];
  const out = [];
  if (a[0] < ix0) out.push([a[0], ix0, a[2], a[3]]);
  if (ix1 < a[1]) out.push([ix1, a[1], a[2], a[3]]);
  if (a[2] < iy0) out.push([ix0, ix1, a[2], iy0]);
  if (iy1 < a[3]) out.push([ix0, ix1, iy1, a[3]]);
  return out;
}
function d54RectAnd(a, b) {
  const r = [Math.max(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.min(a[3], b[3])];
  return r[0] < r[1] && r[2] < r[3] ? r : null;
}
const d54Area = (r, X, Y) => (X(r[1]) - X(r[0])) * (Y(r[3]) - Y(r[2]));

// ---------------------------------------------------------------------------
// Biểu đồ 1 — mặt phẳng tỷ số khí (2 hình). Vùng = khối phẳng (slab) trên mặt sàn.
// Các vùng "NS" (không có ý nghĩa) của bảng gốc vẽ thành dải sát trục như hình IEC (C2H2/C2H4 < 0,01).
// ---------------------------------------------------------------------------
const D54_NS_LOW = 0.01;
const D54_CHART1 = { yRange: [0.004, 6], left: { title: "CH4/H2", xRange: [0.04, 4] }, right: { title: "C2H4/C2H6", xRange: [0.05, 8] } };

/** Vùng Biểu đồ 1 theo ngưỡng hiện hành: [{code, key, r:[x0,x1,y0,y1]}] (D1/D2 tách 3 phần). */
function d54Chart1Zones(side) {
  const { T, pd } = d54Table1();
  const INF = Infinity;
  const left = side === "left";
  // x = CH4/H2 (trái) hoặc C2H4/C2H6 (phải); y = C2H2/C2H4
  const d1 = left ? [T.D1.h_min, T.D1.h_max, T.D1.g_min, INF] : [T.D1.i_min, INF, T.D1.g_min, INF];
  const d2 = left ? [T.D2.h_min, T.D2.h_max, T.D2.g_min, T.D2.g_max] : [T.D2.i_min, INF, T.D2.g_min, T.D2.g_max];
  const zones = [];
  const both = d54RectAnd(d1, d2);
  d54RectMinus(d1, d2).forEach((r) => zones.push({ code: "D1", key: "D1", r }));
  d54RectMinus(d2, d1).forEach((r) => zones.push({ code: "D2", key: "D2", r }));
  if (both) zones.push({ code: "D1/D2", key: "D12", r: both });
  if (left) {
    zones.push({ code: "PD", key: "PD", r: [0, pd, 0, D54_NS_LOW] });
    zones.push({ code: "T1", key: "T1", r: [T.T1.h_min, INF, 0, D54_NS_LOW] });
    zones.push({ code: "T2", key: "T2", r: [T.T2.h_min, INF, D54_NS_LOW, T.T2.g_max] });
    zones.push({ code: "T3", key: "T3", r: [T.T3.h_min, INF, T.T2.g_max, T.T3.g_max] });
  } else {
    zones.push({ code: "PD/T1", key: "PDT1", r: [0, T.PD.i_max, 0, D54_NS_LOW] });
    zones.push({ code: "T1", key: "T1", r: [T.PD.i_max, T.T1.i_max, 0, D54_NS_LOW] });
    zones.push({ code: "T2", key: "T2", r: [T.T2.i_min, T.T2.i_max, 0, T.T2.g_max] });
    zones.push({ code: "T3", key: "T3", r: [T.T3.i_min, INF, 0, T.T3.g_max] });
  }
  return zones;
}

function d54Ticks(values) {
  return Array.from(new Set(values.filter((v) => Number.isFinite(v) && v > 0))).sort((a, b) => a - b);
}

function d54BuildChart1(side, th, current) {
  const cfg = D54_CHART1[side];
  const mx = d54LogMap(cfg.xRange[0], cfg.xRange[1]);
  const my = d54LogMap(D54_CHART1.yRange[0], D54_CHART1.yRange[1]);
  const X = (v) => (v === 0 ? -1 : v === Infinity ? 1 : mx(v));
  const Y = (v) => (v === 0 ? -1 : v === Infinity ? 1 : my(v));
  const zones = d54Chart1Zones(side);
  const xTicks = d54Ticks(zones.flatMap((z) => [z.r[0], z.r[1]]));
  const yTicks = d54Ticks(zones.flatMap((z) => [z.r[2], z.r[3]]));
  const items = [];
  // mặt sàn + lưới
  items.push({ type: "poly", pts: [[-1, -1, -0.002], [1, -1, -0.002], [1, 1, -0.002], [-1, 1, -0.002]], fill: th.floor, opacity: 1, stroke: th.grid, bias: 10 });
  xTicks.forEach((t) => {
    items.push({ type: "line", a: [X(t), -1, 0], b: [X(t), 1, 0], stroke: th.grid, width: 0.7, dash: "3 3", bias: 9 });
    items.push({ type: "text", p: [X(t), -1.12, 0], text: d54FormatTick(t), color: th.muted, size: 11 });
  });
  yTicks.forEach((t) => {
    items.push({ type: "line", a: [-1, Y(t), 0], b: [1, Y(t), 0], stroke: th.grid, width: 0.7, dash: "3 3", bias: 9 });
    items.push({ type: "text", p: [-1.06, Y(t), 0], text: d54FormatTick(t), color: th.muted, size: 11, anchor: "end" });
  });
  // Nhãn mỗi mã chỉ ghi 1 lần, ở mảnh lớn nhất
  const biggest = {};
  zones.forEach((z, i) => {
    if (biggest[z.code] === undefined || d54Area(z.r, X, Y) > d54Area(zones[biggest[z.code]].r, X, Y)) biggest[z.code] = i;
  });
  zones.forEach((z, i) => {
    const color = th.zone[z.key];
    const h = 0.1 + (z.key === "D12" ? 0.06 : 0);
    const r = z.r;
    items.push(...d54Box([X(r[0]), X(r[1]), Y(r[2]), Y(r[3]), 0, h], color, { opacity: 0.9 }));
    if (biggest[z.code] === i) {
      items.push({ type: "text", p: [(X(r[0]) + X(r[1])) / 2, (Y(r[2]) + Y(r[3])) / 2, h + 0.02], text: z.code, color: "#fff", size: 12.5, weight: 700, halo: d54Shade(color, 0.55) });
    }
  });
  // nhãn trục
  items.push({ type: "text", p: [1.12, -0.95, 0], text: d54Chem(cfg.title), html: true, color: th.text, size: 13, weight: 600, anchor: "start" });
  items.push({ type: "text", p: [-1.02, 1.14, 0], text: d54Chem("C2H2/C2H4"), html: true, color: th.text, size: 13, weight: 600, anchor: "start" });
  if (current) {
    const xv = side === "left" ? current.ch4_h2 : current.c2h4_c2h6;
    const yv = current.c2h2_c2h4;
    if (Number.isFinite(xv) && Number.isFinite(yv)) {
      const p = [X(Math.max(xv, 1e-9)), Y(Math.max(yv, 1e-9)), 0.2];
      items.push({ type: "line", a: [p[0], p[1], 0], b: p, stroke: th.point, width: 1.4, dash: "2 2" });
      items.push({ type: "point", p, fill: th.point, r: 5, ring: true });
    }
  }
  return { items, arrowColor: th.muted };
}

// ---------------------------------------------------------------------------
// Biểu đồ 2 — không gian 3 trục: X = C2H4/C2H6, Y = CH4/H2, Z = C2H2/C2H4 (thang log)
// ---------------------------------------------------------------------------
const D54_CHART2 = { range: [0.05, 10], ticks: [0.1, 1, 10] };

/** Khối Biểu đồ 2 theo ngưỡng hiện hành (Bảng 66). Trục "NS" vẽ thành khối thấp sát sàn. */
function d54Chart2Zones() {
  const { T, pd } = d54Table1();
  const INF = Infinity, ns = 0.1;
  return [
    { code: "PD", key: "PD", x: [0, T.PD.i_max], y: [0, pd], z: [0, ns] },
    { code: "D1", key: "D1", x: [T.D1.i_min, INF], y: [T.D1.h_min, T.D1.h_max], z: [T.D1.g_min, INF] },
    { code: "D2", key: "D2", x: [T.D2.i_min, INF], y: [T.D2.h_min, T.D2.h_max], z: [T.D2.g_min, T.D2.g_max] },
    { code: "T1", key: "T1", x: [0, T.T1.i_max], y: [T.T1.h_min, INF], z: [0, ns] },
    { code: "T2", key: "T2", x: [T.T2.i_min, T.T2.i_max], y: [T.T2.h_min, INF], z: [0, T.T2.g_max] },
    { code: "T3", key: "T3", x: [T.T3.i_min, INF], y: [T.T3.h_min, INF], z: [0, T.T3.g_max] },
  ];
}
function d54BuildChart2(th, current) {
  const m = d54LogMap(D54_CHART2.range[0], D54_CHART2.range[1]);
  const A = (v) => (v === 0 ? -1 : v === Infinity ? 1 : m(v));
  const Z = (v) => (A(v) + 1) * 0.85; // trục đứng [0 .. 1,7]
  const items = [];
  const zTop = Z(Infinity);
  // 3 mặt khung: sàn, tường sau, tường trái
  items.push({ type: "poly", pts: [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]], fill: th.floor, opacity: 1, stroke: th.grid, bias: 10 });
  items.push({ type: "poly", pts: [[-1, 1, 0], [1, 1, 0], [1, 1, zTop], [-1, 1, zTop]], fill: th.floor, opacity: 1, stroke: th.grid, bias: 10 });
  items.push({ type: "poly", pts: [[-1, -1, 0], [-1, 1, 0], [-1, 1, zTop], [-1, -1, zTop]], fill: th.floor, opacity: 1, stroke: th.grid, bias: 10 });
  D54_CHART2.ticks.forEach((t) => {
    items.push({ type: "line", a: [A(t), -1, 0], b: [A(t), 1, 0], stroke: th.grid, width: 0.7, dash: "3 3", bias: 9 });
    items.push({ type: "line", a: [A(t), 1, 0], b: [A(t), 1, zTop], stroke: th.grid, width: 0.7, dash: "3 3", bias: 9 });
    items.push({ type: "line", a: [-1, A(t), 0], b: [1, A(t), 0], stroke: th.grid, width: 0.7, dash: "3 3", bias: 9 });
    items.push({ type: "line", a: [-1, A(t), 0], b: [-1, A(t), zTop], stroke: th.grid, width: 0.7, dash: "3 3", bias: 9 });
    items.push({ type: "line", a: [-1, 1, Z(t)], b: [1, 1, Z(t)], stroke: th.grid, width: 0.7, dash: "3 3", bias: 9 });
    items.push({ type: "line", a: [-1, -1, Z(t)], b: [-1, 1, Z(t)], stroke: th.grid, width: 0.7, dash: "3 3", bias: 9 });
    items.push({ type: "text", p: [A(t), -1.13, 0], text: d54FormatTick(t), color: th.muted, size: 11 });
    items.push({ type: "text", p: [1.1, A(t), 0], text: d54FormatTick(t), color: th.muted, size: 11, anchor: "start" });
    items.push({ type: "text", p: [-1.08, -1, Z(t)], text: d54FormatTick(t), color: th.muted, size: 11, anchor: "end" });
  });
  d54Chart2Zones().forEach((z) => {
    const color = th.zone[z.key];
    const b = [A(z.x[0]), A(z.x[1]), A(z.y[0]), A(z.y[1]), Z(z.z[0]), Z(z.z[1])];
    items.push(...d54Box(b, color, { opacity: 0.62 }));
    items.push({ type: "text", p: [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2, b[5] + 0.06], text: z.code, color: th.text, size: 12.5, weight: 700, halo: th.dark ? "#0f172a" : "#ffffff" });
  });
  items.push({ type: "text", p: [0, -1.33, 0], text: `X: ${d54Chem("C2H4/C2H6")}`, html: true, color: th.text, size: 12.5, weight: 600 });
  items.push({ type: "text", p: [1.32, 0, 0], text: `Y: ${d54Chem("CH4/H2")}`, html: true, color: th.text, size: 12.5, weight: 600, anchor: "start" });
  items.push({ type: "text", p: [-1, -1, zTop + 0.16], text: `Z: ${d54Chem("C2H2/C2H4")}`, html: true, color: th.text, size: 12.5, weight: 600 });
  if (current && [current.c2h4_c2h6, current.ch4_h2, current.c2h2_c2h4].every(Number.isFinite)) {
    const p = [A(Math.max(current.c2h4_c2h6, 1e-9)), A(Math.max(current.ch4_h2, 1e-9)), Z(Math.max(current.c2h2_c2h4, 1e-9))];
    items.push({ type: "line", a: [p[0], p[1], 0], b: p, stroke: th.point, width: 1.4, dash: "2 2" });
    items.push({ type: "point", p, fill: th.point, r: 5, ring: true });
  }
  return { items, arrowColor: th.muted };
}

// ---------------------------------------------------------------------------
// Biểu đồ 3 — Tam giác Duval 1. Vùng dựng từ Bảng 67 hiện hành (a = %C2H2, e = %C2H4, %CH4 = 100 − a − e)
// ---------------------------------------------------------------------------
function d54DuvalZones() {
  const L = d54Logic().QD1901_BANG67_DUVAL;
  const pdA = 100 - L.pd_ch4, t = L.t_c2h2, t1 = L.t1_c2h4, t2 = L.t2_c2h4, t3 = L.t3_c2h2;
  const d = L.d_c2h2, d1 = L.d1_c2h4, d2e = L.d2_c2h4, d2a = L.d2_c2h2;
  return [
    { code: "PD", key: "PD", poly: [[0, 0], [0, pdA], [pdA, 0]] },
    { code: "T1", key: "T1", poly: [[0, pdA], [0, t1], [t, t1], [t, 0], [pdA, 0]], label: [t * 0.35, (pdA + t1) / 2] },
    { code: "T2", key: "T2", poly: [[0, t1], [0, t2], [t, t2], [t, t1]], label: [t * 0.4, (t1 + t2) / 2] },
    { code: "T3", key: "T3", poly: [[0, t2], [0, 100], [t3, 100 - t3], [t3, t2]], label: [t3 * 0.4, (t2 + 100 - t3 * 0.4) / 2] },
    { code: "D1", key: "D1", poly: [[d, 0], [100, 0], [100 - d1, d1], [d, d1]], label: [(d + 100 - d1) / 2, d1 / 3] },
    { code: "D2", key: "D2", poly: [[d, d1], [100 - d1, d1], [d2a, 100 - d2a], [d2a, d2e], [d, d2e]], label: [(d + 100 - d1) / 2 - 3, (d1 + d2e) / 2 + 4.5] },
    { code: "D+T", key: "DT", poly: [[t, 0], [d, 0], [d, d2e], [d2a, d2e], [d2a, 100 - d2a], [t3, 100 - t3], [t3, t2], [t, t2]], label: [(t + d) / 2, (d1 + d2e) / 2] },
  ];
}

const D54_TRI_H = 50 * Math.sqrt(3);
/** (a = %C2H2, e = %C2H4) -> tọa độ thế giới trên mặt sàn. Đỉnh CH4 ở xa (trên), C2H2 trái, C2H4 phải. */
function d54DuvalXY(a, e) {
  const m = 100 - a - e;
  const X = (m / 100) * 50 + e; // giống duvalPlotXY() ở src/domain/dga-logic-gas.js
  const Y = (m / 100) * D54_TRI_H;
  return [(X - 50) / 50, (Y - D54_TRI_H / 3) / 50];
}

function d54BuildDuval(th, opts) {
  const o = opts || {};
  const items = [];
  const corner = { CH4: d54DuvalXY(0, 0), C2H4: d54DuvalXY(0, 100), C2H2: d54DuvalXY(100, 0) };
  d54DuvalZones().forEach((z) => {
    const color = th.zone[z.key];
    const h = z.key === "PD" ? 0.12 : 0.08;
    const poly = z.poly.map(([a, e]) => d54DuvalXY(a, e));
    items.push(...d54Prism(poly, h, color, { opacity: o.example ? 0.75 : 0.92 }));
    if (!z.label) return; // PD: vùng rất nhỏ ở đỉnh — ghi nhãn ngay tại đỉnh tam giác
    const [la, le] = z.label;
    const [lx, ly] = d54DuvalXY(la, le);
    items.push({ type: "text", p: [lx, ly, h + 0.02], text: z.code, color: "#fff", size: z.key.startsWith("T") ? 11 : 13, weight: 700, halo: d54Shade(color, 0.5) });
  });
  // vạch chia 20/40/60/80 trên 3 cạnh, nhãn hướng ra ngoài
  const out = (p, c) => [p[0] + (p[0] - c[0]) * 0.07, p[1] + (p[1] - c[1]) * 0.07, 0];
  const center = [0, 0];
  [20, 40, 60, 80].forEach((k) => {
    const pCH4 = d54DuvalXY(100 - k, 0); // cạnh trái C2H2–CH4: %CH4 = k
    const pC2H4 = d54DuvalXY(0, k); // cạnh phải CH4–C2H4: %C2H4 = k
    const pC2H2 = d54DuvalXY(k, 100 - k); // cạnh đáy C2H4–C2H2: %C2H2 = k
    [[pCH4, "CH4"], [pC2H4, "C2H4"], [pC2H2, "C2H2"]].forEach(([p]) => {
      items.push({ type: "text", p: out(p, center), text: String(k), color: th.muted, size: 11 });
    });
  });
  // tên đỉnh + chiều tăng
  items.push({ type: "text", p: [corner.CH4[0], corner.CH4[1] + 0.13, 0], text: "PD", color: th.text, size: 12, weight: 700 });
  if (o.example) items.push({ type: "text", p: [corner.CH4[0] - 0.12, corner.CH4[1] + 0.27, 0], text: `100% ${d54Chem("CH4")}`, html: true, color: th.text, size: 12, weight: 600, anchor: "end" });
  items.push({ type: "text", p: [corner.C2H2[0] - 0.05, corner.C2H2[1] - 0.14, 0], text: `100% ${d54Chem("C2H2")}`, html: true, color: th.text, size: 12, weight: 600, anchor: "start" });
  items.push({ type: "text", p: [corner.C2H4[0] + 0.05, corner.C2H4[1] - 0.14, 0], text: `100% ${d54Chem("C2H4")}`, html: true, color: th.text, size: 12, weight: 600, anchor: "end" });
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const lm = mid(corner.C2H2, corner.CH4), rm = mid(corner.CH4, corner.C2H4), bm = mid(corner.C2H2, corner.C2H4);
  if (!o.example) items.push({ type: "text", p: [lm[0] - 0.32, lm[1] + 0.05, 0], text: `% ${d54Chem("CH4")} ↗`, html: true, color: th.text, size: 12.5, weight: 600 });
  if (!o.example) items.push({ type: "text", p: [rm[0] + 0.32, rm[1] + 0.05, 0], text: `% ${d54Chem("C2H4")} ↘`, html: true, color: th.text, size: 12.5, weight: 600 });
  if (!o.example) items.push({ type: "text", p: [bm[0], bm[1] - 0.28, 0], text: `← % ${d54Chem("C2H2")}`, html: true, color: th.text, size: 12.5, weight: 600 });

  // Ví dụ Điều 54: C2H2 = 20%, C2H4 = 30%, CH4 = 50% -> D2 (đường gióng như hình gốc)
  if (o.example) {
    const a = 20, e = 30;
    const P = d54DuvalXY(a, e);
    const zl = 0.13;
    const guide = (from) => ({ type: "line", a: [from[0], from[1], zl], b: [P[0], P[1], zl], stroke: th.example, width: 1.5, dash: "5 4" });
    const fromCH4 = d54DuvalXY(50, 0); // %CH4 = 50 trên cạnh trái (song song đáy)
    const fromC2H4 = d54DuvalXY(0, 30); // %C2H4 = 30 trên cạnh phải
    const fromC2H2 = d54DuvalXY(20, 80); // %C2H2 = 20 trên cạnh đáy
    items.push(guide(fromCH4), guide(fromC2H4), guide(fromC2H2));
    items.push({ type: "point", p: [P[0], P[1], zl], fill: th.example, stroke: th.dark ? "#0f172a" : "#fff", r: 6 });
    items.push({ type: "text", p: [fromCH4[0] - 0.2, fromCH4[1], 0], text: `50% ${d54Chem("CH4")}`, html: true, color: th.text, size: 12, weight: 700, anchor: "end" });
    items.push({ type: "text", p: [fromC2H4[0] + 0.2, fromC2H4[1], 0], text: `30% ${d54Chem("C2H4")}`, html: true, color: th.text, size: 12, weight: 700, anchor: "start" });
    items.push({ type: "text", p: [fromC2H2[0] - 0.06, fromC2H2[1] - 0.3, 0], text: `20% ${d54Chem("C2H2")}`, html: true, color: th.text, size: 12, weight: 700 });
  }
  if (o.current) {
    const P = d54DuvalXY(o.current.pctC2H2, o.current.pctC2H4);
    items.push({ type: "line", a: [P[0], P[1], 0], b: [P[0], P[1], 0.22], stroke: th.point, width: 1.4, dash: "2 2" });
    items.push({ type: "point", p: [P[0], P[1], 0.22], fill: th.point, r: 5, ring: true });
  }
  return { items, arrowColor: th.muted };
}

// ---------------------------------------------------------------------------
// Khung tương tác: xoay bằng kéo chuột/chạm/phím mũi tên, nút đặt lại/nhìn thẳng
// ---------------------------------------------------------------------------
const D54_FIGURES = [
  { id: "d54Chart1Left", build: (th, cur) => d54BuildChart1("left", th, cur && cur.ratios), view: { yaw: -0.32, pitch: 0.95 }, scale: 148 },
  { id: "d54Chart1Right", build: (th, cur) => d54BuildChart1("right", th, cur && cur.ratios), view: { yaw: -0.32, pitch: 0.95 }, scale: 148 },
  { id: "d54Chart2", build: (th, cur) => d54BuildChart2(th, cur && cur.ratios), view: { yaw: -0.62, pitch: 0.42 }, scale: 118 },
  { id: "d54Duval", build: (th, cur) => d54BuildDuval(th, { current: cur && cur.duval }), view: { yaw: 0, pitch: 1.0 }, scale: 158 },
  { id: "d54DuvalExample", build: (th) => d54BuildDuval(th, { example: true }), view: { yaw: 0, pitch: 1.0 }, scale: 158 },
];
const D54_TOP_VIEW = { yaw: 0, pitch: Math.PI / 2 };

const _d54State = {};

/** Lần đo đang phân tích ở tab "Khí hòa tan" (nếu có) -> tỷ số + % Duval để chấm điểm. */
function d54CurrentReading() {
  try {
    if (typeof _lastAnalysis === "undefined" || !_lastAnalysis) return null;
    const a = _lastAnalysis;
    if (!a.ratios) return null;
    const m = a.measurement || {};
    return { ratios: a.ratios, duval: a.duval && Number.isFinite(a.duval.pctC2H2) ? a.duval : null, label: `${m.tram || ""} ${m.thiet_bi || ""}`.trim() };
  } catch (e) {
    return null;
  }
}

function d54Draw(fig) {
  const svg = typeof document !== "undefined" ? document.getElementById(fig.id) : null;
  if (!svg) return;
  const st = _d54State[fig.id];
  const vb = svg.viewBox.baseVal;
  const W = (vb && vb.width) || 520, H = (vb && vb.height) || 400;
  const view = { yaw: st.yaw, pitch: st.pitch, focal: 7, scale: fig.scale || 175, cx: W / 2, cy: H / 2 + (fig.id === "d54Chart2" ? 55 : fig.id.startsWith("d54Chart1") ? -6 : 14) };
  const scene = fig.build(d54Theme(), d54CurrentReading());
  d54Render(svg, scene, view);
}

function d54Animate(fig, target) {
  const st = _d54State[fig.id];
  const from = { yaw: st.yaw, pitch: st.pitch };
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / 380);
    const e = 1 - Math.pow(1 - k, 3);
    st.yaw = from.yaw + (target.yaw - from.yaw) * e;
    st.pitch = from.pitch + (target.pitch - from.pitch) * e;
    d54Draw(fig);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function d54Attach(fig) {
  const svg = document.getElementById(fig.id);
  if (!svg || svg.dataset.d54Ready) return;
  svg.dataset.d54Ready = "1";
  _d54State[fig.id] = { yaw: fig.view.yaw, pitch: fig.view.pitch };
  const st = _d54State[fig.id];
  let drag = null;
  let raf = 0;
  const redraw = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; d54Draw(fig); });
  };
  const clampPitch = (p) => Math.min(Math.PI / 2, Math.max(0.18, p));
  svg.addEventListener("pointerdown", (ev) => {
    drag = { x: ev.clientX, y: ev.clientY, yaw: st.yaw, pitch: st.pitch };
    svg.setPointerCapture(ev.pointerId);
    svg.classList.add("dragging");
  });
  svg.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    st.yaw = drag.yaw + (ev.clientX - drag.x) * 0.01;
    st.pitch = clampPitch(drag.pitch + (ev.clientY - drag.y) * 0.01);
    redraw();
  });
  const end = () => { drag = null; svg.classList.remove("dragging"); };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  svg.addEventListener("dblclick", () => d54Animate(fig, fig.view));
  svg.addEventListener("keydown", (ev) => {
    const d = 0.12;
    if (ev.key === "ArrowLeft") st.yaw -= d;
    else if (ev.key === "ArrowRight") st.yaw += d;
    else if (ev.key === "ArrowUp") st.pitch = clampPitch(st.pitch + d);
    else if (ev.key === "ArrowDown") st.pitch = clampPitch(st.pitch - d);
    else return;
    ev.preventDefault();
    redraw();
  });
  const figure = svg.closest(".d54-fig");
  if (figure) {
    const reset = figure.querySelector('[data-d54="reset"]');
    const top = figure.querySelector('[data-d54="top"]');
    if (reset) reset.addEventListener("click", () => d54Animate(fig, fig.view));
    if (top) top.addEventListener("click", () => d54Animate(fig, D54_TOP_VIEW));
  }
}

/** Vẽ (lại) toàn bộ biểu đồ Điều 54 — gọi khi mở tab Quy trình, đổi giao diện, hoặc vừa phân tích lần đo. */
function renderDieu54Charts() {
  if (typeof document === "undefined") return;
  D54_FIGURES.forEach((fig) => {
    if (!document.getElementById(fig.id)) return;
    d54Attach(fig);
    d54Draw(fig);
  });
  renderDieu54Bang67Table();
  const note = document.getElementById("d54CurrentNote");
  if (note) {
    const cur = d54CurrentReading();
    note.classList.toggle("hidden", !cur);
    if (cur) note.textContent = `Chấm tròn xanh: lần đo đang phân tích ở tab "Khí hòa tan"${cur.label ? ` (${cur.label})` : ""}.`;
  }
}

/** Bảng 67 hiển thị cạnh Biểu đồ 3 — dựng từ ngưỡng HIỆN HÀNH (Admin có thể đã cấu hình). */
function renderDieu54Bang67Table() {
  const body = document.getElementById("d54Bang67Body");
  const D = d54Logic();
  if (!body || !D) return;
  const L = D.QD1901_BANG67_DUVAL;
  const f = (v, gas) => `${String(v).replace(".", ",")}% ${gas.replace(/(\d)/g, "<sub>$1</sub>")}`;
  const rows = [
    ["PD", [f(L.pd_ch4, "CH4")]],
    ["D1", [f(L.d1_c2h4, "C2H4"), f(L.d_c2h2, "C2H2")]],
    ["D2", [f(L.d1_c2h4, "C2H4"), f(L.d_c2h2, "C2H2"), f(L.d2_c2h4, "C2H4"), f(L.d2_c2h2, "C2H2")]],
    ["T1", [f(L.t_c2h2, "C2H2"), f(L.t1_c2h4, "C2H4")]],
    ["T2", [f(L.t_c2h2, "C2H2"), f(L.t1_c2h4, "C2H4"), f(L.t2_c2h4, "C2H4")]],
    ["T3", [f(L.t3_c2h2, "C2H2"), f(L.t2_c2h4, "C2H4")]],
  ];
  body.innerHTML = rows
    .map(([code, cells]) => `<tr><th>${code}</th>${[0, 1, 2, 3].map((i) => `<td>${cells[i] || ""}</td>`).join("")}</tr>`)
    .join("");
}

function setupDieu54Charts() {
  if (typeof document === "undefined") return;
  renderDieu54Charts();
  document.addEventListener("dga:themechange", renderDieu54Charts);
  document.addEventListener("dga:regulationchange", renderDieu54Charts);
  const tabBtn = document.querySelector('button.tab-btn[data-tab="quytrinh"]');
  if (tabBtn) tabBtn.addEventListener("click", () => setTimeout(renderDieu54Charts, 0));
  // Biểu đồ nằm trong mục con "Đánh giá DGA" của tab Quy trình
  const subBtn = document.querySelector('.quytrinh-subtab-btn[data-subtab="danhgia"]');
  if (subBtn) subBtn.addEventListener("click", () => setTimeout(renderDieu54Charts, 0));
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupDieu54Charts);
  else setupDieu54Charts();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { D54_CHART1, D54_CHART2, d54Chart1Zones, d54Chart2Zones, d54DuvalZones, d54RectMinus, d54DuvalXY, d54BuildChart1, d54BuildChart2, d54BuildDuval, d54Project };
}
