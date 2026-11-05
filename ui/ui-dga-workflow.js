/* ui/ui-dga-workflow.js — Lưu đồ "Quy trình nghiệp vụ đánh giá DGA" (tab Quy trình > Đánh giá DGA).
 *
 * Số hóa lưu đồ đánh giá khí hòa tan của Điều 54 QĐ1901 (mục 3: khoảng điển hình Bảng 64 -> tốc độ
 * tăng Bảng 65 -> kiểm tra nhiễm khí OLTC -> tỷ số khí Bảng 66/Duval) kết hợp lưu đồ Hình 1 (mục 9)
 * IEC 60599:2022 (mức ALERT/ALARM, "change in fault type"). Đây đúng là thuật toán ứng dụng đang chạy
 * (computeOverallStatus()/buildRecommendations() ở logic/dga-logic-gas.js).
 *
 * Vẽ bằng SVG với class CSS (css/style-dga-workflow.css) dùng biến màu giao diện nên tự đổi theo chế
 * độ sáng/tối, không cần vẽ lại. Tọa độ khung cố định (viewBox 1100 × 1400), co giãn theo bề ngang. */

const WF_W = 1100;
const WF_H = 1400;
const WF_X = 480; // trục chính
const WF_L = 135; // cột trái
const WF_R = 840; // cột phải

// type: start | process | decision | normal | alert | alarm | note
const WF_NODES = [
  { id: "start", type: "start", x: WF_X, y: 45, w: 440, h: 58, lines: ["Kết quả phân tích khí hòa tan (DGA) của lần đo", "7 khí chính H2, CH4, C2H6, C2H4, C2H2, CO, CO2 (+ N2, O2)"] },
  { id: "check", type: "process", x: WF_X, y: 140, w: 480, h: 60, lines: ["Kiểm tra số liệu: khí ghi KPH hoặc để trống = KPH;", "loại trừ lỗi lấy mẫu/đo lường rõ ràng (IEC 60599 mục 9)"] },
  { id: "std", type: "process", x: WF_X, y: 235, w: 480, h: 60, lines: ["Xác định tiêu chuẩn: NSX (nếu có) hoặc chặt hơn giữa", "QĐ1901 và IEC 60599 Annex A theo loại thiết bị"] },
  { id: "d_typ", type: "decision", x: WF_X, y: 360, w: 330, h: 124, lines: ["Hàm lượng khí so với", "khoảng điển hình", "(Bảng 64 / Annex A)?"] },
  { id: "low", type: "note", x: WF_L, y: 360, w: 236, h: 92, lines: ["Kiểm tra lỗi lấy mẫu,", "đo lường hoặc do xử lý", "dầu gần đây;", "tiếp tục theo dõi định kỳ"] },
  { id: "d_rate0", type: "decision", x: WF_R, y: 360, w: 270, h: 112, lines: ["Tốc độ tăng", "vượt Bảng 65?"] },
  { id: "normal", type: "normal", x: WF_R, y: 222, w: 250, h: 66, lines: ["BÌNH THƯỜNG", "Tiếp tục theo dõi định kỳ"] },
  { id: "alertRate", type: "alert", x: WF_R, y: 502, w: 250, h: 82, lines: ["CẢNH BÁO", "Tốc độ tăng cao là dấu hiệu", "sớm của lỗi tiềm ẩn: tăng", "cường phân tích, theo dõi xu hướng"] },
  { id: "d_rate", type: "decision", x: WF_X, y: 525, w: 330, h: 124, lines: ["Tốc độ tăng so với", "khoảng điển hình", "Bảng 65 (lần đo trước)?"] },
  { id: "rateLow", type: "note", x: WF_L, y: 525, w: 236, h: 104, lines: ["Trong khoảng: tiếp tục", "theo dõi định kỳ.", "Thấp hơn: kiểm tra lỗi", "đo lường hoặc do xử lý", "dầu gần đây"] },
  { id: "d_oltc", type: "decision", x: WF_X, y: 690, w: 330, h: 112, lines: ["MBA: C2H2/H2 > 2 – 3?", "(nghi nhiễm khí từ OLTC)"] },
  { id: "oltc", type: "note", x: WF_R, y: 690, w: 260, h: 96, lines: ["Lấy mẫu dầu khoang OLTC,", "so sánh với khoang dầu chính,", "trừ khí nền từ OLTC rồi tính", "lại hàm lượng khoang chính"] },
  { id: "ratio", type: "process", x: WF_X, y: 840, w: 540, h: 108, lines: ["Xác định tính chất khiếm khuyết: 3 tỷ số C2H2/C2H4,", "CH4/H2, C2H4/C2H6 -> Bảng 66 (= Table 1 IEC 60599);", "không khớp -> bảng đơn giản PD / D / T (sơ bộ);", "đối chiếu Tam giác Duval 1 (Bảng 67), Biểu đồ 1, 2"] },
  { id: "extra", type: "process", x: WF_X, y: 962, w: 540, h: 66, lines: ["Đánh giá bổ sung: tỷ lệ CO2/CO, O2/N2; Bảng 63 (dầu mới /", "sau sửa chữa); đối chiếu Bảng 68, 69 (lỗi điển hình)"] },
  { id: "d_alarm", type: "decision", x: WF_X, y: 1090, w: 400, h: 130, lines: ["Vượt ngưỡng tuyệt đối / loại bỏ NSX,", "hoặc loại sự cố đổi khác", "so với lần đo liền trước?"] },
  { id: "alarm", type: "alarm", x: WF_R, y: 1090, w: 260, h: 96, lines: ["BÁO ĐỘNG", "Hành động ngay; nguy cơ sự cố", "-> đề xuất dừng vận hành tìm", "nguyên nhân; báo cáo (Điều 6)"] },
  { id: "alert", type: "alert", x: WF_X, y: 1232, w: 440, h: 76, lines: ["CẢNH BÁO", "Tăng tần suất thí nghiệm, đề xuất phép thử chuyên sâu", "hoặc xin ý kiến nhà sản xuất"] },
  { id: "save", type: "start", x: WF_X, y: 1345, w: 600, h: 62, lines: ["Lưu lịch sử đo -> theo dõi xu hướng -> lần đo kế tiếp", "(chu kỳ Điều 54: 3 ngày, 1, 3, 6 tháng sau đóng điện, sau đó 1 năm/lần)"] },
];

// points: đường gấp khúc; label: [x, y, text, anchor?]
const WF_EDGES = [
  { pts: [[WF_X, 74], [WF_X, 110]] },
  { pts: [[WF_X, 170], [WF_X, 205]] },
  { pts: [[WF_X, 265], [WF_X, 298]] },
  { pts: [[WF_X - 165, 360], [WF_L + 118, 360]], label: [WF_L + 150, 300, "Tất cả thấp hơn", "middle"] },
  { pts: [[WF_X + 165, 360], [WF_R - 135, 360]], label: [WF_X + 172, 348, "Trong khoảng", "start"] },
  { pts: [[WF_X, 422], [WF_X, 463]], label: [WF_X + 10, 444, "Vượt (≥ 1 khí)", "start"] },
  { pts: [[WF_R, 304], [WF_R, 255]], label: [WF_R + 10, 282, "Không", "start"] },
  { pts: [[WF_R, 416], [WF_R, 461]], label: [WF_R + 10, 440, "Có", "start"] },
  { pts: [[WF_X - 165, 525], [WF_L + 118, 525]], label: [WF_L + 150, 462, "Không vượt", "middle"] },
  { pts: [[WF_X, 587], [WF_X, 634]], label: [WF_X + 10, 610, "Cao hơn", "start"] },
  { pts: [[WF_L, 577], [WF_L, 840], [WF_X - 270, 840]], label: [WF_L + 8, 760, "vẫn tra tỷ số", "start"], dash: true },
  { pts: [[WF_X + 165, 690], [WF_R - 130, 690]], label: [WF_X + 172, 678, "Có", "start"] },
  { pts: [[WF_X, 746], [WF_X, 786]], label: [WF_X + 10, 766, "Không", "start"] },
  { pts: [[WF_R, 738], [WF_R, 840], [WF_X + 270, 840]] },
  { pts: [[WF_X, 894], [WF_X, 929]] },
  { pts: [[WF_X, 995], [WF_X, 1025]] },
  { pts: [[WF_X + 200, 1090], [WF_R - 130, 1090]], label: [WF_X + 206, 1078, "Có", "start"] },
  { pts: [[WF_X, 1155], [WF_X, 1194]], label: [WF_X + 10, 1174, "Không", "start"] },
  { pts: [[WF_X, 1270], [WF_X, 1314]] },
  { pts: [[WF_R, 1138], [WF_R, 1345], [WF_X + 300, 1345]] },
];

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
  let s = `<path class="wf-edge${e.dash ? " wf-edge-dash" : ""}" d="${d}" marker-end="url(#wfArrow)"/>`;
  if (e.label) {
    const [x, y, t, anchor] = e.label;
    s += `<text class="wf-label" x="${x}" y="${y}" text-anchor="${anchor || "middle"}">${wfText(t)}</text>`;
  }
  return s;
}

function buildDgaWorkflowSvg() {
  return (
    `<defs><marker id="wfArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">` +
    `<path class="wf-arrow" d="M0,0 L10,5 L0,10 z"/></marker></defs>` +
    WF_EDGES.map(wfEdgeSvg).join("") +
    WF_NODES.map(wfNodeSvg).join("")
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
