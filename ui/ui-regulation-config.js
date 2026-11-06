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
  // Báo cho các hình vẽ phụ thuộc ngưỡng (Tam giác Duval, biểu đồ Điều 54) vẽ lại theo cấu hình mới.
  if (typeof document !== "undefined") document.dispatchEvent(new Event("dga:regulationchange"));
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
  _rcOverridden = overriddenKeys;
  // Đang có bảng sửa dở chưa lưu (mở lại mục "Quy định") → giữ nguyên, không vẽ lại làm mất số đang sửa
  if (!document.querySelector('#regulationConfigContainer .rc-item[data-dirty="1"]')) renderRegulationConfigUI(overriddenKeys);
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
  if (field.kind === "text") {
    return `
    <label class="field">${escapeHtml(field.label)}
      <input type="text" data-kind="text" data-path='${pathAttr}' value="${escapeHtml(String(val))}" ${canWrite() ? "" : "disabled"} />
    </label>`;
  }
  return `
    <label class="field">${escapeHtml(field.label)}${field.unit ? " (" + escapeHtml(field.unit) + ")" : ""}
      <input type="number" step="0.01" data-path='${pathAttr}' value="${val}" ${canWrite() ? "" : "disabled"} />
    </label>`;
}

function renderRegulationConfigItem(item, overriddenKeys = new Set()) {
  const current = DGA.getRegulationConfigCurrentValues(item.key);
  const isCustom = overriddenKeys.has(item.key);
  const fieldsHtml = item.fields.map((f) => regulationFieldValueHtml(current.values, f)).join("");
  const writable = canWrite();
  return `
    <div class="rc-item" data-config-key="${escapeHtml(item.key)}">
      <div class="rc-item-head">
        <div class="rc-item-title">
          <div class="rc-item-cat">${escapeHtml(item.category)}</div>
          <h4>${escapeHtml(item.title)}</h4>
        </div>
        <div class="rc-actions">
          <span class="pill ${isCustom ? "warn" : "muted"} rc-status">${isCustom ? "Đã tùy chỉnh" : "Mặc định gốc"}</span>
          <span class="pill bad rc-dirty hidden">Chưa lưu</span>
          ${writable ? `
            <button class="btn primary rc-save" type="button">Lưu bảng này</button>
            <button class="btn ghost rc-reset" type="button">Khôi phục mặc định</button>
          ` : ""}
        </div>
      </div>
      <label class="field">Tham chiếu nguồn (có thể sửa)
        <input type="text" class="rc-citation" value="${escapeHtml(current.citation || "")}" ${writable ? "" : "disabled"} />
      </label>
      <div class="rc-fields">${fieldsHtml}</div>
    </div>`;
}

// Bố cục DANH SÁCH | NỘI DUNG (thay cho 34 bảng xếp dọc 1 trang): cột trái liệt kê các bảng theo nhóm (tìm kiếm,
// lọc "đã tùy chỉnh", dấu "chưa lưu"), cột phải chỉ hiện bảng đang chọn. Mọi thẻ bảng vẫn nằm sẵn trong trang (chỉ
// ẩn/hiện) nên chuyển qua lại giữa các bảng KHÔNG mất số đang sửa dở; Lưu/Khôi phục chỉ vẽ lại đúng 1 bảng.
let _rcOverridden = new Set();
let _rcSelectedKey = "";
const RC_SELECTED_STORAGE_KEY = "dga_rc_selected_v1";

/** Nhóm lớn cho danh sách bên trái — suy từ category của registry. */
function regulationTopGroup(item) {
  const c = String(item.category || "");
  if (/^Tên văn bản/i.test(c)) return "Tên văn bản, điều khoản (hiển thị)";
  if (/^Dầu\b/i.test(c)) return "Lý-hóa dầu cách điện";
  return "Khí hòa tan (DGA)";
}

function regulationFold(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

function renderRegulationConfigUI(overriddenKeys = new Set()) {
  const container = $("regulationConfigContainer");
  if (!container) return;
  _rcOverridden = overriddenKeys;
  const registry = DGA.getRegulationConfigRegistry();
  if (!_rcSelectedKey) {
    try { _rcSelectedKey = sessionStorage.getItem(RC_SELECTED_STORAGE_KEY) || ""; } catch (_) { /* bị chặn lưu trữ */ }
  }
  if (!registry.some((it) => it.key === _rcSelectedKey)) _rcSelectedKey = registry.length ? registry[0].key : "";

  // nhóm lớn → category → bảng (giữ thứ tự registry)
  const groups = [];
  const byGroup = new Map();
  registry.forEach((item) => {
    const g = regulationTopGroup(item);
    if (!byGroup.has(g)) { byGroup.set(g, new Map()); groups.push(g); }
    const cats = byGroup.get(g);
    if (!cats.has(item.category)) cats.set(item.category, []);
    cats.get(item.category).push(item);
  });

  const navHtml = groups.map((g) => {
    const cats = byGroup.get(g);
    const count = Array.from(cats.values()).reduce((n, arr) => n + arr.length, 0);
    return `
      <div class="rc-nav-group" data-group="${escapeHtml(g)}">
        <div class="rc-nav-group-title">${escapeHtml(g)} <span class="rc-nav-count">${count}</span></div>
        ${Array.from(cats.entries()).map(([cat, items]) => `
          <div class="rc-nav-cat">${escapeHtml(cat)}</div>
          ${items.map((it) => `
            <button type="button" class="rc-nav-item${it.key === _rcSelectedKey ? " active" : ""}" data-key="${escapeHtml(it.key)}"
              data-search="${escapeHtml(regulationFold([it.title, it.category, it.key, g].join(" ")))}" title="${escapeHtml(it.title)}">
              <span class="rc-nav-title">${escapeHtml(it.title)}</span>
              <span class="rc-nav-flags">
                <span class="rc-nav-dot rc-nav-dirty hidden" title="Có thay đổi chưa lưu">●</span>
                <span class="pill warn rc-nav-custom${overriddenKeys.has(it.key) ? "" : " hidden"}">Đã tùy chỉnh</span>
              </span>
            </button>`).join("")}
        `).join("")}
      </div>`;
  }).join("");

  container.innerHTML = `
    <div class="rc-layout">
      <aside class="rc-nav" aria-label="Danh sách bảng quy định">
        <input type="search" class="rc-search" placeholder="Tìm bảng: Bảng 55, Duval, OLTC, IEC 60422..." aria-label="Tìm bảng quy định" />
        <label class="rc-only-custom-label"><input type="checkbox" class="rc-only-custom" /> Chỉ bảng đã tùy chỉnh
          (<span class="rc-custom-count">${overriddenKeys.size}</span>)</label>
        <div class="rc-nav-list">${navHtml}</div>
        <p class="note rc-nav-empty hidden">Không có bảng nào khớp.</p>
      </aside>
      <section class="rc-detail">
        ${registry.map((item) => renderRegulationConfigItem(item, overriddenKeys)).join("")}
      </section>
    </div>`;

  container.querySelectorAll(".rc-item").forEach((el) => {
    el.classList.toggle("hidden", el.getAttribute("data-config-key") !== _rcSelectedKey);
    regulationBindItem(el);
  });
  container.querySelectorAll(".rc-nav-item").forEach((btn) => {
    btn.addEventListener("click", () => regulationSelect(btn.getAttribute("data-key")));
  });
  const search = container.querySelector(".rc-search");
  const onlyCustom = container.querySelector(".rc-only-custom");
  const applyFilter = () => regulationFilterNav(search.value, onlyCustom.checked);
  search.addEventListener("input", applyFilter);
  onlyCustom.addEventListener("change", applyFilter);
}

/** Gắn sự kiện cho 1 thẻ bảng: Lưu/Khôi phục + đánh dấu "chưa lưu" khi sửa ô bất kỳ. */
function regulationBindItem(el) {
  const key = el.getAttribute("data-config-key");
  el.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", () => regulationMarkDirty(key, true)));
  if (!canWrite()) return;
  const saveBtn = el.querySelector(".rc-save");
  const resetBtn = el.querySelector(".rc-reset");
  if (saveBtn) saveBtn.addEventListener("click", () => onSaveRegulationItem(key));
  if (resetBtn) resetBtn.addEventListener("click", () => onResetRegulationItem(key));
}

function regulationMarkDirty(key, dirty) {
  const item = document.querySelector(`.rc-item[data-config-key="${key}"]`);
  const nav = document.querySelector(`.rc-nav-item[data-key="${key}"]`);
  if (item) { item.dataset.dirty = dirty ? "1" : ""; const b = item.querySelector(".rc-dirty"); if (b) b.classList.toggle("hidden", !dirty); }
  if (nav) { const d = nav.querySelector(".rc-nav-dirty"); if (d) d.classList.toggle("hidden", !dirty); }
}

function regulationSelect(key) {
  if (!key) return;
  _rcSelectedKey = key;
  try { sessionStorage.setItem(RC_SELECTED_STORAGE_KEY, key); } catch (_) { /* bị chặn lưu trữ */ }
  document.querySelectorAll("#regulationConfigContainer .rc-item").forEach((el) => el.classList.toggle("hidden", el.getAttribute("data-config-key") !== key));
  document.querySelectorAll("#regulationConfigContainer .rc-nav-item").forEach((b) => b.classList.toggle("active", b.getAttribute("data-key") === key));
  const detail = document.querySelector("#regulationConfigContainer .rc-detail");
  if (detail && detail.getBoundingClientRect().top < 0) detail.scrollIntoView({ behavior: "smooth", block: "start" });
}

function regulationFilterNav(text, onlyCustom) {
  const q = regulationFold(text).trim();
  const words = q ? q.split(/\s+/) : [];
  let shown = 0;
  document.querySelectorAll("#regulationConfigContainer .rc-nav-group").forEach((g) => {
    let groupShown = 0;
    g.querySelectorAll(".rc-nav-item").forEach((b) => {
      const okText = words.every((w) => b.getAttribute("data-search").includes(w));
      const okCustom = !onlyCustom || _rcOverridden.has(b.getAttribute("data-key"));
      const on = okText && okCustom;
      b.classList.toggle("hidden", !on);
      if (on) groupShown++;
    });
    // ẩn tiêu đề nhóm con không còn bảng nào
    g.querySelectorAll(".rc-nav-cat").forEach((cat) => {
      let n = cat.nextElementSibling;
      let any = false;
      while (n && n.classList.contains("rc-nav-item")) { if (!n.classList.contains("hidden")) any = true; n = n.nextElementSibling; }
      cat.classList.toggle("hidden", !any);
    });
    g.classList.toggle("hidden", groupShown === 0);
    shown += groupShown;
  });
  const empty = document.querySelector("#regulationConfigContainer .rc-nav-empty");
  if (empty) empty.classList.toggle("hidden", shown > 0);
}

/** Vẽ lại ĐÚNG 1 bảng sau khi Lưu/Khôi phục (giữ nguyên số đang sửa dở ở các bảng khác). */
function regulationRerenderItem(key) {
  const item = DGA.getRegulationConfigRegistry().find((it) => it.key === key);
  const old = document.querySelector(`.rc-item[data-config-key="${key}"]`);
  if (!item || !old) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = renderRegulationConfigItem(item, _rcOverridden).trim();
  const el = wrap.firstElementChild;
  el.classList.toggle("hidden", key !== _rcSelectedKey);
  old.replaceWith(el);
  regulationBindItem(el);
  const nav = document.querySelector(`.rc-nav-item[data-key="${key}"] .rc-nav-custom`);
  if (nav) nav.classList.toggle("hidden", !_rcOverridden.has(key));
  const cnt = document.querySelector("#regulationConfigContainer .rc-custom-count");
  if (cnt) cnt.textContent = String(_rcOverridden.size);
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
    } else if (f.kind !== "range" && f.kind !== "text" && v !== null && v !== undefined && Number(v) < 0) {
      problems.push(`${f.label}: không được âm`);
    }
  });
  // Luật thứ tự riêng của từng bảng (VD "từ" < "đến", ranh giới Duval không chồng chéo).
  if (problems.length === 0 && typeof DGA.validateRegulationConfigValues === "function") {
    problems.push(...DGA.validateRegulationConfigValues(item.key, valuesObj));
  }
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
    if (inp.getAttribute("data-kind") === "text") {
      DGA.setValueAtPath(valuesObj, path, raw);
      return;
    }
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
  if (!canWrite()) { notifyError('Chỉ Admin mới lưu được Cấu hình quy định.'); return; }
  const item = DGA.getRegulationConfigRegistry().find((it) => it.key === key);
  const container = document.querySelector(`.rc-item[data-config-key="${key}"]`);
  if (!item || !container) return;

  const citation = container.querySelector(".rc-citation").value.trim();
  if (!citation) { notifyError('Vui lòng nhập tham chiếu nguồn.'); return; }

  const { valuesObj, hasInvalidNumber } = collectRegulationFormValues(container);
  if (hasInvalidNumber) { notifyError('Có ô nhập số không hợp lệ — vui lòng kiểm tra lại.'); return; }
  const problems = validateRegulationValues(item, valuesObj);
  if (problems.length > 0) { notifyError('Vui lòng kiểm tra lại:\n- ' + problems.join('\n- ')); return; }

  try {
    await Storage.saveRegulationConfig({ id: key, citation, values: valuesObj });
    DGA.applyRegulationConfigOverride(key, { citation, values: valuesObj });
    _rcOverridden.add(key);
    regulationRerenderItem(key);
    if (typeof document !== "undefined") document.dispatchEvent(new Event("dga:regulationchange"));
    showToast(`Đã lưu cấu hình cho "${item.title}".`);
  } catch (err) {
    notifyError(storageErrorMessage(err));
  }
}

async function onResetRegulationItem(key) {
  if (!canWrite()) { notifyError('Chỉ Admin mới khôi phục được Cấu hình quy định.'); return; }
  const item = DGA.getRegulationConfigRegistry().find((it) => it.key === key);
  if (!item) return;
  if (!confirm(`Khôi phục "${item.title}" về đúng mặc định gốc? Cấu hình đã lưu cho bảng này (nếu có) sẽ bị xóa.`)) return;
  try {
    await Storage.deleteRegulationConfig(key);
    DGA.resetRegulationConfigItem(key);
    _rcOverridden.delete(key);
    regulationRerenderItem(key);
    if (typeof document !== "undefined") document.dispatchEvent(new Event("dga:regulationchange"));
  } catch (err) {
    notifyError(storageErrorMessage(err));
  }
}
