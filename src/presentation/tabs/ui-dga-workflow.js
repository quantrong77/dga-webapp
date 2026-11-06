/* src/presentation/tabs/ui-dga-workflow.js — Lưu đồ "Quy trình nghiệp vụ đánh giá DGA" (tab Quy trình > Đánh giá DGA).
 *
 * Số hóa lưu đồ đánh giá khí hòa tan của Điều 54 QĐ1901 (mục 3: khoảng điển hình Bảng 64 -> tốc độ
 * tăng Bảng 65 -> kiểm tra nhiễm khí OLTC -> tỷ số khí Bảng 66/Duval) kết hợp lưu đồ Hình 1 (mục 9)
 * IEC 60599:2022 (mức ALERT/ALARM, "change in fault type"). Đây đúng là thuật toán ứng dụng đang chạy
 * (computeOverallStatus()/buildRecommendations() ở src/domain/dga-logic-gas.js).
 *
 * Vẽ bằng SVG với class CSS (css/style-dga-workflow.css) dùng biến màu giao diện nên tự đổi theo chế
 * độ sáng/tối, không cần vẽ lại. Tọa độ khung cố định (viewBox 1100 × 1570), co giãn theo bề ngang.
 *
 * Mũi tên khai báo theo CẠNH khối (from/to: [id, "top"|"bottom"|"left"|"right"]) — tọa độ đường đi
 * và vị trí nhãn tính tự động: nhãn đoạn ngang nằm ngay TRÊN đường kẻ (căn giữa đoạn), nhãn đoạn dọc
 * nằm sát bên phải (hoặc trái nếu labelSide = "left"). */

const WF_W = 1100;
const WF_H = 1570;
const WF_X = 470; // trục chính
const WF_L = 112; // cột trái
const WF_R = 860; // cột phải

// type: start | process | decision | normal | alert | alarm | note
const WF_NODES = [
  { id: "start", type: "start", x: WF_X, y: 45, w: 440, h: 58, lines: ["Kết quả phân tích khí hòa tan (DGA) của lần đo", "7 khí chính H2, CH4, C2H6, C2H4, C2H2, CO, CO2 (+ N2, O2)"] },
  { id: "check", type: "process", x: WF_X, y: 140, w: 440, h: 60, lines: ["Kiểm tra số liệu: khí ghi KPH hoặc để trống = KPH;", "loại trừ lỗi lấy mẫu/đo lường rõ ràng (IEC 60599 mục 9)"] },
  { id: "std", type: "process", x: WF_X, y: 235, w: 440, h: 60, lines: ["Xác định tiêu chuẩn: NSX (nếu có) hoặc chặt hơn giữa", "QĐ1901 và IEC 60599 Annex A theo loại thiết bị"] },
  { id: "d_typ", type: "decision", x: WF_X, y: 365, w: 300, h: 124, lines: ["Hàm lượng khí so với", "khoảng điển hình", "(Bảng 64 / Annex A)?"] },
  { id: "low", type: "note", x: WF_L, y: 365, w: 196, h: 92, lines: ["Kiểm tra lỗi lấy mẫu,", "đo lường hoặc do xử lý", "dầu gần đây; tiếp tục", "theo dõi định kỳ"] },
  { id: "d_rate0", type: "decision", x: WF_R, y: 365, w: 240, h: 112, lines: ["Tốc độ tăng", "vượt Bảng 65?"] },
  { id: "normal", type: "normal", x: WF_R, y: 225, w: 230, h: 66, lines: ["BÌNH THƯỜNG", "Tiếp tục theo dõi định kỳ"] },
  { id: "alertRate", type: "alert", x: WF_R, y: 510, w: 240, h: 82, lines: ["CẢNH BÁO", "Tốc độ tăng cao là dấu hiệu", "sớm của lỗi tiềm ẩn: tăng cường", "phân tích, theo dõi xu hướng"] },
  { id: "d_rate", type: "decision", x: WF_X, y: 535, w: 300, h: 124, lines: ["Tốc độ tăng so với", "khoảng điển hình", "Bảng 65 (lần đo trước)?"] },
  { id: "rateLow", type: "note", x: WF_L, y: 535, w: 196, h: 104, lines: ["Trong khoảng: tiếp tục", "theo dõi định kỳ.", "Thấp hơn: kiểm tra lỗi", "đo lường hoặc do xử lý", "dầu gần đây"] },
  { id: "d_oltc", type: "decision", x: WF_X, y: 700, w: 320, h: 112, lines: ["MBA: C2H2/H2 > 2 – 3?", "(nghi nhiễm khí từ OLTC)"] },
  { id: "oltc", type: "note", x: WF_R, y: 700, w: 240, h: 96, lines: ["Lấy mẫu dầu khoang OLTC, so", "sánh với khoang dầu chính, trừ", "khí nền từ OLTC rồi tính lại", "hàm lượng khoang chính"] },
  { id: "ratio", type: "process", x: WF_X, y: 850, w: 540, h: 108, lines: ["Xác định tính chất khiếm khuyết: 3 tỷ số C2H2/C2H4,", "CH4/H2, C2H4/C2H6 -> Bảng 66 (= Table 1 IEC 60599);", "không khớp -> bảng đơn giản PD / D / T (sơ bộ);", "đối chiếu Tam giác Duval 1 (Bảng 67), Biểu đồ 1, 2"] },
  { id: "extra", type: "process", x: WF_X, y: 965, w: 540, h: 62, lines: ["Tỷ lệ bổ sung CO2/CO, O2/N2 — đánh giá cho MỌI dầu, kể cả", "dầu đang vận hành; đối chiếu Bảng 68, 69 (lỗi điển hình)"] },
  { id: "d_b63", type: "decision", x: WF_X, y: 1090, w: 340, h: 120, lines: ["Dầu mới đưa vào vận hành /", "sau sửa chữa có thay dầu", "hoặc có lọc dầu?"] },
  { id: "b63", type: "note", x: WF_R, y: 1090, w: 240, h: 96, lines: ["Bảng 63: tổng hàm lượng khí", "hòa tan < 1,0% (110–220 kV),", "< 0,5% (500 kV); vượt -> kiểm", "tra lại quy trình xử lý dầu"] },
  { id: "d_alarm", type: "decision", x: WF_X, y: 1270, w: 380, h: 130, lines: ["Vượt ngưỡng tuyệt đối / loại bỏ NSX,", "hoặc loại sự cố đổi khác", "so với lần đo liền trước?"] },
  { id: "alarm", type: "alarm", x: WF_R, y: 1270, w: 240, h: 96, lines: ["BÁO ĐỘNG", "Hành động ngay; nguy cơ sự cố", "-> đề xuất dừng vận hành tìm", "nguyên nhân; báo cáo (Điều 6)"] },
  { id: "alert", type: "alert", x: WF_X, y: 1412, w: 440, h: 76, lines: ["CẢNH BÁO", "Tăng tần suất thí nghiệm, đề xuất phép thử chuyên sâu", "hoặc xin ý kiến nhà sản xuất"] },
  { id: "save", type: "start", x: WF_X, y: 1520, w: 600, h: 62, lines: ["Lưu lịch sử đo -> theo dõi xu hướng -> lần đo kế tiếp", "(chu kỳ Điều 54: 3 ngày, 1, 3, 6 tháng sau đóng điện, sau đó 1 năm/lần)"] },
];

const WF_EDGE_SPECS = [
  { from: ["start", "bottom"], to: ["check", "top"] },
  { from: ["check", "bottom"], to: ["std", "top"] },
  { from: ["std", "bottom"], to: ["d_typ", "top"] },
  { from: ["d_typ", "left"], to: ["low", "right"], label: "Tất cả thấp hơn" },
  { from: ["d_typ", "right"], to: ["d_rate0", "left"], label: "Trong khoảng" },
  { from: ["d_typ", "bottom"], to: ["d_rate", "top"], label: "Vượt (≥ 1 khí)" },
  { from: ["d_rate0", "top"], to: ["normal", "bottom"], label: "Không" },
  { from: ["d_rate0", "bottom"], to: ["alertRate", "top"], label: "Có" },
  { from: ["d_rate", "left"], to: ["rateLow", "right"], label: "Không vượt" },
  { from: ["d_rate", "bottom"], to: ["d_oltc", "top"], label: "Cao hơn" },
  { from: ["rateLow", "bottom"], to: ["ratio", "left"], label: "vẫn tra tỷ số", dash: true },
  { from: ["d_oltc", "right"], to: ["oltc", "left"], label: "Có" },
  { from: ["d_oltc", "bottom"], to: ["ratio", "top"], label: "Không" },
  { from: ["oltc", "bottom"], to: ["ratio", "right"] },
  { from: ["ratio", "bottom"], to: ["extra", "top"] },
  { from: ["extra", "bottom"], to: ["d_b63", "top"] },
  { from: ["d_b63", "right"], to: ["b63", "left"], label: "Có" },
  { from: ["d_b63", "bottom"], to: ["d_alarm", "top"], label: "Không (dầu đang vận hành)", labelSide: "left" },
  { from: ["b63", "bottom"], to: ["d_alarm", "top"], via: [[WF_R, 1192], [WF_X, 1192]], dash: true },
  { from: ["d_alarm", "right"], to: ["alarm", "left"], label: "Có" },
  { from: ["d_alarm", "bottom"], to: ["alert", "top"], label: "Không" },
  { from: ["alert", "bottom"], to: ["save", "top"] },
  { from: ["alarm", "bottom"], to: ["save", "right"] },
];

const WF_BY_ID = Object.fromEntries(WF_NODES.map((n) => [n.id, n]));

function wfAnchor([id, side]) {
  const n = WF_BY_ID[id];
  if (side === "top") return [n.x, n.y - n.h / 2];
  if (side === "bottom") return [n.x, n.y + n.h / 2];
  if (side === "left") return [n.x - n.w / 2, n.y];
  return [n.x + n.w / 2, n.y];
}

/** Đường đi gấp khúc: thẳng nếu cùng hàng/cột; ngược lại 1 góc vuông (ra theo hướng cạnh xuất phát). */
function wfRoute(spec) {
  const a = wfAnchor(spec.from), b = wfAnchor(spec.to);
  if (spec.via) return [a, ...spec.via, b];
  if (a[0] === b[0] || a[1] === b[1]) return [a, b];
  const vertical = spec.from[1] === "top" || spec.from[1] === "bottom";
  return [a, vertical ? [a[0], b[1]] : [b[0], a[1]], b];
}

/** Nhãn đặt theo đoạn ĐẦU tiên: đoạn ngang -> ngay trên đường, căn giữa; đoạn dọc -> sát bên cạnh. */
function wfLabelPos(pts, side) {
  const [a, b] = pts;
  if (a[1] === b[1]) return { x: (a[0] + b[0]) / 2, y: a[1] - 9, anchor: "middle" };
  const y = (a[1] + b[1]) / 2;
  return side === "left" ? { x: a[0] - 8, y, anchor: "end" } : { x: a[0] + 8, y, anchor: "start" };
}

const WF_EDGES = WF_EDGE_SPECS.map((s) => {
  const pts = wfRoute(s);
  return { ...s, pts, labelPos: s.label ? wfLabelPos(pts, s.labelSide) : null };
});

/** Escape + "->" thành mũi tên + chỉ số dưới trong công thức khí (C2H2 -> C₂H₂). */
function wfText(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/->/g, "→")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\b(C2H2|C2H4|C2H6|CH4|CO2|H2|N2|O2)\b/g, (f) =>
      f.replace(/(\d)/g, '<tspan baseline-shift="sub" class="wf-sub">$1</tspan>'));
}

function wfNodeSvg(n) {
  const x0 = n.x - n.w / 2, y0 = n.y - n.h / 2;
  let shape;
  if (n.type === "decision") {
    shape = `<polygon class="wf-shape wf-decision" points="${n.x},${y0} ${n.x + n.w / 2},${n.y} ${n.x},${y0 + n.h} ${x0},${n.y}"/>`;
  } else {
    const r = n.type === "start" ? n.h / 2 : 10;
    shape = `<rect class="wf-shape wf-${n.type}" x="${x0}" y="${y0}" width="${n.w}" height="${n.h}" rx="${r}"/>`;
  }
  const lh = 17;
  const top = n.y - ((n.lines.length - 1) * lh) / 2;
  const isStatus = ["normal", "alert", "alarm"].includes(n.type);
  const text = n.lines
    .map((l, i) => `<text class="wf-text${isStatus && i === 0 ? " wf-status-title" : ""}" x="${n.x}" y="${top + i * lh}">${wfText(l)}</text>`)
    .join("");
  return `<g class="wf-node" data-node="${n.id}">${shape}${text}</g>`;
}

function wfEdgeSvg(e) {
  const d = e.pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  return `<path class="wf-edge${e.dash ? " wf-edge-dash" : ""}" d="${d}" marker-end="url(#wfArrow)"/>`;
}

function wfLabelSvg(e) {
  if (!e.labelPos) return "";
  const { x, y, anchor } = e.labelPos;
  return `<text class="wf-label" x="${x}" y="${y}" text-anchor="${anchor}">${wfText(e.label)}</text>`;
}

function buildDgaWorkflowSvg() {
  return (
    `<defs><marker id="wfArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">` +
    `<path class="wf-arrow" d="M0,0 L10,5 L0,10 z"/></marker></defs>` +
    WF_EDGES.map(wfEdgeSvg).join("") +
    WF_NODES.map(wfNodeSvg).join("") +
    // nhãn vẽ SAU khối để không bị khối che
    WF_EDGES.map(wfLabelSvg).join("")
  );
}

function renderDgaWorkflow() {
  if (typeof document === "undefined") return;
  const svg = document.getElementById("dgaWorkflowSvg");
  if (!svg || svg.dataset.ready) return;
  svg.setAttribute("viewBox", `0 0 ${WF_W} ${WF_H}`);
  svg.innerHTML = buildDgaWorkflowSvg();
  svg.dataset.ready = "1";
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderDgaWorkflow);
  else renderDgaWorkflow();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { WF_NODES, WF_EDGES, buildDgaWorkflowSvg, wfText };
}
