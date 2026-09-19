/* ui-regulation-config.js — Mục "Quy định" trong tab "Cấu hình" (2 mục "Tiêu chuẩn"/"Quy
   định" gộp chung 1 tab, chọn bằng .cauhinh-subtab-btn — xem setupCauHinhSubtabs() ở
   app-core.js): cho phép Admin xem/sửa số liệu + tham chiếu nguồn của các bảng ngưỡng ĐƠN
   GIẢN (không có logic rẽ nhánh phức tạp — xem REGULATION_CONFIG_REGISTRY ở dga-logic.js,
   mục 9) trích từ QĐ1901/IEC 60599:2022, KHÔNG cần sửa code khi 2 quy định này có bản cập
   nhật trong tương lai.

   Tách RIÊNG khỏi mục "Tiêu chuẩn" cùng tab (ui-standards.js — tiêu chuẩn NHÀ SẢN XUẤT,
   override theo TỪNG manufacturer) — ở đây là bảng QUY ĐỊNH GỐC (QĐ1901/IEC) áp dụng khi
   KHÔNG có tiêu chuẩn nhà sản xuất nào khớp, nên chỉ có ĐÚNG 1 bộ giá trị cho mỗi bảng
   (không phải danh sách tự do nhiều dòng như mục Tiêu chuẩn).

   Cơ chế: mỗi bảng đăng ký trong DGA.getRegulationConfigRegistry() có 1 "target" là
   CHÍNH object hằng số dùng trực tiếp trong resolveStandard()/computeRateOfChange()/
   evaluateOltcOilTest()... (dga-logic.js) — DGA.applyRegulationConfigOverride() ghi đè
   THẲNG property của object đó, nên mọi hàm liên quan tự động dùng số mới mà KHÔNG cần
   sửa lại code ở nơi khác. File này chỉ lo: (1) nạp override đã lưu ở Storage lúc khởi
   động app, (2) render form theo registry (generic — không code riêng cho từng bảng),
   (3) đọc lại giá trị form khi Lưu/Khôi phục mặc định. */

/** Nạp toàn bộ bản ghi cấu hình đã lưu (Storage.listRegulationConfig()) và áp dụng lên
 *  đúng bảng hằng số tương ứng trong dga-logic.js. Gọi ở initApp() TRƯỚC khi bất kỳ tab
 *  nào dùng đến resolveStandard()/evaluateOilTest()... để đảm bảo mọi phân tích DGA/Dầu
 *  cách điện ngay từ lần đầu tiên đã dùng đúng số đã cấu hình (không phải mặc định gốc
 *  rồi mới "nhảy" số sau khi mục "Quy định" trong tab "Cấu hình" được mở lần đầu).
 *  @returns {Array} danh sách bản ghi vừa nạp (để refreshRegulationConfigUI() biết bảng
 *    nào đã có override, hiển thị đúng trạng thái "Đã tùy chỉnh"/"Mặc định").
 */
async function applyAllRegulationConfigOverrides() {
  const records = await Storage.listRegulationConfig();
  (records || []).forEach((r) => {
    if (!r || !r.id) return;
    if (r.citation || r.values) {
      DGA.applyRegulationConfigOverride(r.id, { citation: r.citation, values: r.values });
    }
  });
  return records || [];
}

async function refreshRegulationConfigUI() {
  let records = [];
  try {
    records = await applyAllRegulationConfigOverrides();
  } catch (err) {
    console.warn("Không tải được Cấu hình quy định (có thể backend chưa hỗ trợ regulation_config — dùng mặc định gốc):", err);
  }
  const overriddenKeys = new Set(records.map((r) => r.id));
  renderRegulationConfigUI(overriddenKeys);
  const hint = $("quydinhLoadingHint");
  if (hint) hint.classList.add("hidden");
}

function regulationFieldValueHtml(current, field) {
  if (field.kind === "range") {
    const arr = DGA.getValueAtPath(current, field.path);
    const lo = Array.isArray(arr) && arr[0] !== null && arr[0] !== undefined ? arr[0] : "";
    const hi = Array.isArray(arr) && arr[1] !== null && arr[1] !== undefined ? arr[1] : "";
    const pathAttr = escapeHtml(JSON.stringify(field.path));
    return `
      <label class="field">${escapeHtml(field.label)}${field.unit ? " (" + escapeHtml(field.unit) + ")" : ""}
        <div class="rc-range-field">
          <input type="number" step="0.01" placeholder="Từ" data-path='${pathAttr}' data-sub="lo" value="${lo}" ${canWrite() ? "" : "disabled"} />
          <span>–</span>
          <input type="number" step="0.01" placeholder="Đến" data-path='${pathAttr}' data-sub="hi" value="${hi}" ${canWrite() ? "" : "disabled"} />
        </div>
      </label>`;
  }
  const v = DGA.getValueAtPath(current, field.path);
  const val = v === null || v === undefined ? "" : v;
  const pathAttr = escapeHtml(JSON.stringify(field.path));
  return `
    <label class="field">${escapeHtml(field.label)}${field.unit ? " (" + escapeHtml(field.unit) + ")" : ""}
      <input type="number" step="0.01" data-path='${pathAttr}' value="${val}" ${canWrite() ? "" : "disabled"} />
    </label>`;
}

function renderRegulationConfigItem(item, overriddenKeys) {
  const current = DGA.getRegulationConfigCurrentValues(item.key);
  const isCustom = overriddenKeys.has(item.key);
  const fieldsHtml = item.fields.map((f) => regulationFieldValueHtml(current.values, f)).join("");
  const writable = canWrite();
  return `
    <div class="rc-item" data-config-key="${escapeHtml(item.key)}">
      <h4>${escapeHtml(item.title)}</h4>
      <label class="field">Tham chiếu nguồn (có thể sửa)
        <input type="text" class="rc-citation" value="${escapeHtml(current.citation || "")}" ${writable ? "" : "disabled"} />
      </label>
      <div class="rc-fields">${fieldsHtml}</div>
      <div class="rc-actions">
        <span class="pill ${isCustom ? "warn" : "muted"} rc-status">${isCustom ? "Đã tùy chỉnh" : "Mặc định gốc"}</span>
        ${writable ? `
          <button class="btn primary rc-save" type="button">Lưu bảng này</button>
          <button class="btn ghost rc-reset" type="button">Khôi phục mặc định</button>
        ` : ""}
      </div>
    </div>`;
}

function renderRegulationConfigUI(overriddenKeys) {
  const container = $("regulationConfigContainer");
  if (!container) return;
  const registry = DGA.getRegulationConfigRegistry();
  const categories = [];
  const byCategory = new Map();
  registry.forEach((item) => {
    if (!byCategory.has(item.category)) {
      byCategory.set(item.category, []);
      categories.push(item.category);
    }
    byCategory.get(item.category).push(item);
  });

  container.innerHTML = categories
    .map((cat) => {
      const items = byCategory.get(cat);
      return `
        <div class="rc-category">${escapeHtml(cat)}</div>
        ${items.map((item) => renderRegulationConfigItem(item, overriddenKeys)).join("")}
      `;
    })
    .join("");

  if (!canWrite()) return;
  container.querySelectorAll(".rc-item").forEach((el) => {
    const key = el.getAttribute("data-config-key");
    const saveBtn = el.querySelector(".rc-save");
    const resetBtn = el.querySelector(".rc-reset");
    if (saveBtn) saveBtn.addEventListener("click", () => onSaveRegulationItem(key));
    if (resetBtn) resetBtn.addEventListener("click", () => onResetRegulationItem(key));
  });
}

/** Kiểm tra hợp lý số liệu SAU KHI đã đọc từ form (âm/khoảng thấp>khoảng cao) — chỉ
 *  cảnh báo, không tự sửa. */
function validateRegulationValues(item, valuesObj) {
  const problems = [];
  item.fields.forEach((f) => {
    const v = DGA.getValueAtPath(valuesObj, f.path);
    if (f.kind === "range" && Array.isArray(v)) {
      const [lo, hi] = v;
      if (lo !== null && lo !== undefined && lo < 0) problems.push(`${f.label}: giá trị "Từ" không được âm`);
      if (hi !== null && hi !== undefined && hi < 0) problems.push(`${f.label}: giá trị "Đến" không được âm`);
      if (lo !== null && lo !== undefined && hi !== null && hi !== undefined && lo > hi) {
        problems.push(`${f.label}: giá trị "Từ" đang lớn hơn "Đến"`);
      }
    } else if (f.kind !== "range" && v !== null && v !== undefined && Number(v) < 0) {
      problems.push(`${f.label}: không được âm`);
    }
  });
  return problems;
}

/** Đọc toàn bộ input trong 1 thẻ .rc-item, build lại thành object lồng nhau đúng shape
 *  của bảng (dùng DGA.setValueAtPath() theo data-path/data-sub đã gắn lúc render). */
function collectRegulationFormValues(container) {
  const valuesObj = {};
  let hasInvalidNumber = false;
  container.querySelectorAll("input[data-path]").forEach((inp) => {
    const path = JSON.parse(inp.getAttribute("data-path"));
    const sub = inp.getAttribute("data-sub");
    const raw = inp.value.trim();
    let num = null;
    if (raw !== "") {
      num = Number(raw);
      if (!Number.isFinite(num)) hasInvalidNumber = true;
    }
    if (sub) {
      let cur = DGA.getValueAtPath(valuesObj, path);
      if (!Array.isArray(cur)) cur = [null, null];
      if (sub === "lo") cur[0] = num; else cur[1] = num;
      DGA.setValueAtPath(valuesObj, path, cur);
    } else {
      DGA.setValueAtPath(valuesObj, path, num);
    }
  });
  return { valuesObj, hasInvalidNumber };
}

async function onSaveRegulationItem(key) {
  if (!canWrite()) { alert('Chỉ Admin mới lưu được Cấu hình quy định.'); return; }
  const item = DGA.getRegulationConfigRegistry().find((it) => it.key === key);
  const container = document.querySelector(`.rc-item[data-config-key="${key}"]`);
  if (!item || !container) return;

  const citation = container.querySelector(".rc-citation").value.trim();
  if (!citation) { alert('Vui lòng nhập tham chiếu nguồn.'); return; }

  const { valuesObj, hasInvalidNumber } = collectRegulationFormValues(container);
  if (hasInvalidNumber) { alert('Có ô nhập số không hợp lệ — vui lòng kiểm tra lại.'); return; }
  const problems = validateRegulationValues(item, valuesObj);
  if (problems.length > 0) { alert('Vui lòng kiểm tra lại:\n- ' + problems.join('\n- ')); return; }

  try {
    await Storage.saveRegulationConfig({ id: key, citation, values: valuesObj });
    DGA.applyRegulationConfigOverride(key, { citation, values: valuesObj });
    await refreshRegulationConfigUI();
    alert(`Đã lưu cấu hình cho "${item.title}".`);
  } catch (err) {
    alert(storageErrorMessage(err));
  }
}

async function onResetRegulationItem(key) {
  if (!canWrite()) { alert('Chỉ Admin mới khôi phục được Cấu hình quy định.'); return; }
  const item = DGA.getRegulationConfigRegistry().find((it) => it.key === key);
  if (!item) return;
  if (!confirm(`Khôi phục "${item.title}" về đúng mặc định gốc? Cấu hình đã lưu cho bảng này (nếu có) sẽ bị xóa.`)) return;
  try {
    await Storage.deleteRegulationConfig(key);
    DGA.resetRegulationConfigItem(key);
    await refreshRegulationConfigUI();
  } catch (err) {
    alert(storageErrorMessage(err));
  }
}
