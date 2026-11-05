/* ui/ui-utils.js — Tiện ích định dạng, kiểm tra tính hợp lệ và xử lý chuỗi hiển thị HTML. */

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Nút thao tác DẠNG ICON trong cột "Thao tác" của các bảng (tab Cảnh báo, Lịch sử đo/dầu):
 *  chỉ hiện icon, tooltip (data-tooltip, CSS ở css/style-tab-tables.css) mô tả hành động khi
 *  trỏ chuột/focus bàn phím, aria-label cho trình đọc màn hình. Các nút xếp thành 1 CỘT dọc
 *  nhờ khung .actions-stack — xem rowActionsHtml() bên dưới.
 *  @param {string} action  giá trị data-action (code bắt sự kiện tìm nút theo thuộc tính này)
 *  @param {string} icon    id symbol trong sprite (index.html), không kèm tiền tố "icon-"
 *  @param {string} tip     mô tả hành động (hiển thị ở tooltip)
 *  @param {{danger?: boolean, cls?: string}} [opts] */
function rowActionBtn(action, icon, tip, opts) {
  const o = opts || {};
  const cls = ["btn", o.danger ? "danger" : "ghost", "icon-only", "row-action-btn", o.cls || ""].join(" ").trim();
  const t = escapeHtml(tip);
  return `<button type="button" class="${cls}" data-action="${escapeHtml(action)}" data-tooltip="${t}" aria-label="${t}">` +
    `<svg class="icon-svg" aria-hidden="true"><use href="#icon-${escapeHtml(icon)}"></use></svg></button>`;
}

/** Khung chứa các nút rowActionBtn() xếp thành 1 cột dọc — bỏ qua phần tử rỗng (nút bị ẩn
 *  do không đủ quyền, VD Sửa/Xóa). */
function rowActionsHtml(buttons) {
  return `<div class="btn-row actions-stack">${buttons.filter(Boolean).join("")}</div>`;
}

/** URL đọc từ database (bbtn_url, image_url...) chỉ được mở/hiển thị nếu là http(s) — chặn
 *  "javascript:"/"data:text/html"... do ai đó ghi thẳng vào database qua API để chạy mã độc
 *  khi người khác bấm "Xem". Trả về URL gốc nếu an toàn, null nếu không. */
function safeHttpUrl(url) {
  if (!url) return null;
  const str = String(url).trim();
  if (!str || !/^https?:\/\//i.test(str)) return null;
  try {
    const u = new URL(str);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch (e) {
    return null;
  }
}

/** Xác thực dữ liệu đầu vào: không đại lượng nào ở đây (nồng độ khí ppm, %, kV, °C, năm,
 *  lần đo, ngưỡng cấu hình...) có thể ÂM về mặt vật lý — người dùng gõ nhầm dấu "-" hoặc
 *  paste nhầm số âm là lỗi nhập liệu, không phải giá trị hợp lệ. Dùng CHUNG cho mọi form
 *  nhập số liệu (DGA, dầu MBA, dầu OLTC, cấu hình tiêu chuẩn NSX — xem các lời gọi ở
 *  ui-dga.js/ui-oil.js/ui-oltc.js/ui-standards.js). fields: mảng [{label, value}]; value
 *  có thể là number|null|undefined|NaN — bỏ qua khi không phải số (nghĩa là "chưa nhập").
 *  Trả về nhãn tiếng Việt của trường ÂM đầu tiên tìm thấy, hoặc null nếu tất cả hợp lệ. */
function findNegativeValueField(fields) {
  for (const { label, value } of fields) {
    if (typeof value === "number" && !Number.isNaN(value) && value < 0) return label;
  }
  return null;
}

function alertIfNegative(fields) {
  const negativeField = findNegativeValueField(fields);
  if (negativeField) {
    notifyError(`Giá trị "${negativeField}" không hợp lệ: không được nhập số âm.`);
    return true;
  }
  return false;
}

/** Thông báo (KHÔNG chặn lưu, khác alertIfNegative ở trên) khi để TRỐNG 1/nhiều trong 7
 *  khí chính (H2, CH4, C2H6, C2H4, C2H2, CO, CO2) lúc nhập/sửa số liệu ở tab DGA — ô trống
 *  được hiểu là KPH (không phát hiện), xem onAnalyze() (ui-dga.js). */
function findEmptyMainGasLabels() {
  return DGA.GASES.filter((g) => $("g_" + g) && $("g_" + g).value.trim() === "");
}

function warnIfEmptyMainGas() {
  const empty = findEmptyMainGasLabels();
  if (empty.length === 0) return;
  const text =
    `Khí ${empty.join(", ")} để TRỐNG — được hiểu là KPH (không phát hiện, lưu 0 ppm). ` +
    `Nếu khí này CHƯA ĐO thì kiểm tra lại BBTN/số liệu gốc và sửa sau khi lưu.`;
  if (typeof notifyInfo === "function") notifyInfo(text);
  else console.info("[DGA] " + text);
}

// ---------------------------------------------------------------------------
// Lưu vết CHỈNH SỬA số liệu khí — khi người dùng SỬA 1 lần đo đã lưu (không phải nhập
// mới), so sánh 7 khí chính + N2/O2 giữa bản ghi GỐC và giá trị vừa nhập để biết ĐÚNG
// những ô nào đã bị chỉnh sửa, dùng tô nền đỏ cảnh báo + ghi log kèm timestamp ở tab
// "Lịch sử đo".
// ---------------------------------------------------------------------------

const EDIT_TRACKED_GAS_FIELDS = ["H2", "CH4", "C2H6", "C2H4", "C2H2", "CO", "CO2", "N2", "O2"];

function editTrackedFieldOldValue(oldRec, field) {
  if (field === "N2") return oldRec.n2 ?? oldRec.N2 ?? null;
  if (field === "O2") return oldRec.o2 ?? oldRec.O2 ?? null;
  return recordGases(oldRec)[field] ?? null;
}

function editTrackedFieldNewValue(field, gases, n2, o2) {
  if (field === "N2") return n2;
  if (field === "O2") return o2;
  return gases[field] ?? null;
}

function numOrNullForDiff(v) {
  return v === null || v === undefined || v === "" ? null : Number(v);
}

/** So sánh giá trị 9 trường số liệu chính (7 khí + N2/O2) giữa bản ghi GỐC (trước khi
 *  sửa, "oldRec") và giá trị MỚI đang chuẩn bị lưu ("gases"/"n2"/"o2") — dùng khi SỬA 1
 *  lần đo đã lưu. Trả về { editedFields, editLogEntry }. */
function diffTrackedGasFields(oldRec, gases, n2, o2) {
  const changes = [];
  EDIT_TRACKED_GAS_FIELDS.forEach((field) => {
    const oldVal = numOrNullForDiff(editTrackedFieldOldValue(oldRec, field));
    const newVal = numOrNullForDiff(editTrackedFieldNewValue(field, gases, n2, o2));
    if (oldVal === newVal) return;
    changes.push({ field, oldVal, newVal });
  });
  if (changes.length === 0) return { editedFields: "", editLogEntry: "" };
  const editedFields = changes.map((c) => `${c.field}:${c.oldVal ?? ""}`).join("|");
  const changeText = changes.map((c) => `${c.field}: ${c.oldVal ?? "—"} → ${c.newVal ?? "—"}`).join("; ");
  const editLogEntry = `${new Date().toLocaleString("vi-VN")}: ${changeText}`;
  return { editedFields, editLogEntry };
}

/** Phân tích chuỗi "H2:12|CO2:2000" thành Map<field, giá trị cũ dạng chuỗi>. */
function parseEditedFields(editedFieldsStr) {
  const map = new Map();
  if (!editedFieldsStr) return map;
  String(editedFieldsStr).split("|").forEach((part) => {
    const idx = part.indexOf(":");
    if (idx < 0) return;
    map.set(part.slice(0, idx), part.slice(idx + 1));
  });
  return map;
}

/** Icon nhỏ cạnh TÊN 1 khí hòa tan cụ thể. */
function gasLabelIcon(gas) {
  const icon = gas === "CO" || gas === "CO2" ? "book" : "flask";
  return `<svg class="gas-icon" aria-hidden="true"><use href="#icon-${icon}"></use></svg>`;
}
