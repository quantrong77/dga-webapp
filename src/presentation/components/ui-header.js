/* src/presentation/components/ui-header.js — Header kiểu "thanh ứng dụng": tìm nhanh thiết bị ở giữa, chuông cảnh báo,
 * toàn màn hình, khối tài khoản có menu (Đổi mật khẩu / Đăng xuất).
 *
 * Tìm nhanh thiết bị (#quickSearch): gom MỌI bản ghi đã nạp (khí hòa tan + dầu MBA/OLTC/TI-TU) theo Trạm + Thiết bị,
 * khớp KHÔNG phân biệt dấu/hoa thường (guideFold(), ui-guides.js). Chọn 1 thiết bị → ghi "ngữ cảnh xem chung"
 * (setViewContext(), ui-view-context.js) rồi mở tab Lịch sử đo (hoặc Xu hướng) → 3 tab xem đều lọc sẵn thiết bị đó.
 * Mẫu ARIA combobox + listbox: ↑/↓ chọn, Enter mở, Esc đóng; Ctrl+K hoặc "/" (khi không đang gõ ô khác) để focus ô. */

const QUICK_SEARCH_MAX = 8;
let _headerAlertLevels = new Map(); // "trạm|||thiết bị" (đã fold) → "alarm" | "alert"

function qsFold(s) {
  return typeof guideFold === "function"
    ? guideFold(s)
    : String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}
function qsKey(tram, thietBi) {
  return qsFold(String(tram || "").trim()) + "|||" + qsFold(String(thietBi || "").trim());
}

/** Gom bản ghi theo Trạm + Thiết bị — hàm thuần (có test). sources: [{ label, records }]. */
function quickSearchIndex(sources) {
  const map = new Map();
  (sources || []).forEach(({ label, records }) => {
    (records || []).forEach((r) => {
      const device = String(r.thiet_bi || "").trim();
      if (!device || /^[\s\-?]*$/.test(device)) return;
      const station = /^[\s\-?]*$/.test(String(r.tram || "")) ? "" : String(r.tram || "").trim();
      const key = qsKey(station, device);
      let e = map.get(key);
      if (!e) {
        e = { key, station, device, kinds: new Set(), count: 0, lastDate: "", fold: qsFold(device + " " + station) };
        map.set(key, e);
      }
      e.kinds.add(label);
      e.count++;
      const d = String((typeof DGA !== "undefined" && DGA.formatSampleDate ? DGA.formatSampleDate(r.sample_date) : r.sample_date) || "");
      if (d > e.lastDate) e.lastDate = d;
    });
  });
  return Array.from(map.values());
}

/** Lọc + xếp hạng kết quả — hàm thuần (có test). Ưu tiên: tên thiết bị bắt đầu bằng từ khóa → chứa từ khóa → khớp
 *  theo trạm; cùng hạng thì thiết bị đo gần đây lên trước. Nhiều từ khóa (cách nhau bởi dấu cách) phải khớp đủ. */
function quickSearchMatch(index, query, max) {
  const words = qsFold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const rank = (e) => {
    const dev = qsFold(e.device);
    if (dev.startsWith(words[0])) return 0;
    if (dev.includes(words[0])) return 1;
    return 2;
  };
  return index
    .filter((e) => words.every((w) => e.fold.includes(w)))
    .map((e) => ({ e, r: rank(e) }))
    .sort((a, b) => a.r - b.r || (b.e.lastDate > a.e.lastDate ? 1 : b.e.lastDate < a.e.lastDate ? -1 : 0) || a.e.device.localeCompare(b.e.device, "vi"))
    .slice(0, max || QUICK_SEARCH_MAX)
    .map((x) => x.e);
}

function quickSearchSources() {
  // Biến `let` toàn cục của ui-history.js / ui-ti-oil.js (script thường, chung phạm vi toàn cục).
  /* global _allMeasurements, _allOilTests, _allOltcOilTests, _allTioOilTests */
  return [
    { label: "Khí hòa tan", records: typeof _allMeasurements !== "undefined" ? _allMeasurements : [] },
    { label: "Dầu MBA", records: typeof _allOilTests !== "undefined" ? _allOilTests : [] },
    { label: "Dầu OLTC", records: typeof _allOltcOilTests !== "undefined" ? _allOltcOilTests : [] },
    { label: "Dầu TI/TU", records: typeof _allTioOilTests !== "undefined" ? _allTioOilTests : [] },
  ];
}

/** Chuông cảnh báo ở header: số thiết bị đang Cảnh báo/Báo động theo LẦN ĐO MỚI NHẤT (không theo bộ lọc tab Cảnh báo).
 *  Gọi từ refreshAlertsUI() (ui-alerts.js) với toàn bộ cảnh báo. Đồng thời nhớ mức của từng thiết bị cho ô tìm nhanh. */
function updateHeaderAlerts(allAlerts) {
  const current = (allAlerts || []).filter((a) => a.isLatest !== false && (a.level === "alarm" || a.level === "alert"));
  // Mức cho ô tìm nhanh: theo Trạm + Thiết bị (gộp pha), lấy mức nặng nhất.
  const levels = new Map();
  current.forEach((a) => {
    const k = qsKey(a.tram, a.deviceName);
    if (a.level === "alarm" || !levels.has(k)) levels.set(k, a.level);
  });
  _headerAlertLevels = levels;
  const badge = document.getElementById("headerAlertCount");
  const btn = document.getElementById("btnHeaderAlerts");
  if (!badge || !btn) return;
  // Số trên chuông: CÙNG cách đếm với thẻ "Thiết bị đang có cảnh báo" ở tab Cảnh báo (alertLevelSummary(), theo
  // Trạm + Thiết bị + Pha, mỗi thiết bị 1 lần) — không lệch số giữa 2 nơi.
  const sum = typeof alertLevelSummary === "function" ? alertLevelSummary(current) : null;
  const n = sum ? sum.warnDevices : levels.size;
  const nAlarm = sum ? sum.alarmDevices : Array.from(levels.values()).filter((l) => l === "alarm").length;
  badge.textContent = n > 99 ? "99+" : String(n);
  badge.classList.toggle("hidden", n === 0);
  badge.classList.toggle("is-alert-only", n > 0 && nAlarm === 0);
  // Tên đọc = chữ hiển thị "Cảnh báo" (.hdr-label) + chi tiết chỉ cho trình đọc màn hình (#headerAlertSr).
  const detail = n === 0 ? ": không có thiết bị nào đang cảnh báo" : `: ${n} thiết bị đang cảnh báo${nAlarm ? ` (${nAlarm} Báo động)` : ""}`;
  const sr = document.getElementById("headerAlertSr");
  if (sr) sr.textContent = detail;
  btn.title = "Cảnh báo" + detail;
  btn.setAttribute("data-tooltip", n === 0 ? "Cảnh báo" : `${n} thiết bị cảnh báo`);
}

function qsEscape(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
/** Tô đậm phần khớp từ khóa (so trên chuỗi đã bỏ dấu — cùng độ dài với chuỗi gốc NFC tiếng Việt). */
function qsHighlight(text, query) {
  const w = qsFold(query).split(/\s+/).filter(Boolean)[0];
  const raw = String(text);
  const f = qsFold(raw);
  const i = w && f.length === raw.length ? f.indexOf(w) : -1;
  if (i < 0) return qsEscape(raw);
  return qsEscape(raw.slice(0, i)) + "<mark>" + qsEscape(raw.slice(i, i + w.length)) + "</mark>" + qsEscape(raw.slice(i + w.length));
}

function openDeviceFromSearch(entry, tab) {
  if (!entry) return;
  // Bộ lọc thêm của Lịch sử đo (Loại thiết bị, khoảng ngày) có thể đang che mất thiết bị vừa chọn → bỏ đi.
  ["historyEquipmentFilter", "lichsu_from", "lichsu_to"].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });
  if (typeof toggleLichSuOilSourceWraps === "function") { try { toggleLichSuOilSourceWraps(); } catch (_) { /* tab chưa sẵn sàng */ } }
  if (typeof setViewContext === "function") setViewContext(entry.station, entry.device);
  const btn = document.querySelector(`nav.tabs .tab-btn[data-tab="${tab || "lichsu"}"]`) || document.querySelector(`.tab-btn[data-tab="${tab || "lichsu"}"]`);
  if (btn) btn.click();
  if (typeof applyViewContext === "function") applyViewContext(tab || "lichsu");
  window.scrollTo({ top: 0 });
}

function setupQuickSearch() {
  const input = document.getElementById("quickSearch");
  const list = document.getElementById("quickSearchList");
  const wrap = document.getElementById("headerSearch");
  if (!input || !list || !wrap) return;
  const header = wrap.closest("header");
  let results = [];
  let active = -1;
  let index = null;

  const close = () => {
    list.classList.add("hidden");
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  };
  const setActive = (i) => {
    active = i;
    list.querySelectorAll('[role="option"]').forEach((el, j) => {
      el.classList.toggle("active", j === i);
      el.setAttribute("aria-selected", j === i ? "true" : "false");
      if (j === i) { input.setAttribute("aria-activedescendant", el.id); el.scrollIntoView({ block: "nearest" }); }
    });
  };
  const render = () => {
    const q = input.value.trim();
    if (!q) { close(); return; }
    if (!index) index = quickSearchIndex(quickSearchSources());
    results = quickSearchMatch(index, q, QUICK_SEARCH_MAX);
    if (!results.length) {
      list.innerHTML = `<div class="qs-empty">Không thấy thiết bị nào khớp "<strong>${qsEscape(q)}</strong>". Thử gõ tên trạm, hoặc 1 phần tên thiết bị.</div>`;
    } else {
      list.innerHTML = results.map((e, i) => {
        const lvl = _headerAlertLevels.get(e.key);
        const pill = lvl === "alarm" ? '<span class="qs-pill qs-alarm">Báo động</span>' : lvl === "alert" ? '<span class="qs-pill qs-alert">Cảnh báo</span>' : "";
        const date = e.lastDate && typeof fmtDateVN === "function" ? fmtDateVN(e.lastDate) : e.lastDate;
        return `<div class="qs-item" role="option" id="qsOpt${i}" aria-selected="false" data-i="${i}">
          <div class="qs-main">
            <div class="qs-name">${qsHighlight(e.device, q)} ${pill}</div>
            <div class="qs-sub">${e.station ? qsHighlight(e.station, q) : "(chưa ghi trạm)"} · ${qsEscape(Array.from(e.kinds).join(", "))}${date ? ` · đo gần nhất ${qsEscape(date)}` : ""}</div>
          </div>
          <span class="qs-act" data-act="xuhuong" data-i="${i}" aria-hidden="true" title="Mở Xu hướng của thiết bị này (Shift+Enter)">Xu hướng</span>
        </div>`;
      }).join("") + `<div class="qs-foot" aria-hidden="true">↑↓ chọn · Enter: Lịch sử đo · Shift+Enter: Xu hướng · Esc đóng</div>`;
    }
    list.classList.remove("hidden");
    input.setAttribute("aria-expanded", "true");
    setActive(results.length ? 0 : -1);
  };
  const choose = (i, tab) => {
    const e = results[i];
    if (!e) return;
    input.value = "";
    close();
    input.blur();
    if (header) header.classList.remove("search-open");
    openDeviceFromSearch(e, tab);
  };

  let timer = null;
  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(render, 80); });
  input.addEventListener("focus", () => { index = null; if (input.value.trim()) render(); }); // nạp lại chỉ mục: dữ liệu có thể vừa đổi
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" && results.length) { e.preventDefault(); if (list.classList.contains("hidden")) render(); else setActive((active + 1) % results.length); }
    else if (e.key === "ArrowUp" && results.length) { e.preventDefault(); setActive((active - 1 + results.length) % results.length); }
    else if (e.key === "Enter") { e.preventDefault(); if (active >= 0) choose(active, e.shiftKey ? "xuhuong" : "lichsu"); }
    else if (e.key === "Escape") {
      if (!list.classList.contains("hidden")) { e.stopPropagation(); close(); }
      else if (input.value) input.value = "";
      else { input.blur(); if (header) header.classList.remove("search-open"); }
    }
  });
  list.addEventListener("mousedown", (e) => e.preventDefault()); // giữ focus ở ô nhập khi bấm vào danh sách
  list.addEventListener("click", (e) => {
    const act = e.target.closest(".qs-act");
    const item = e.target.closest(".qs-item");
    if (act) choose(Number(act.dataset.i), act.dataset.act);
    else if (item) choose(Number(item.dataset.i), "lichsu");
  });
  input.addEventListener("blur", () => setTimeout(close, 120));

  // Phím tắt Ctrl+K / "/" → focus ô tìm (không cướp phím khi đang gõ ở ô nhập khác).
  document.addEventListener("keydown", (e) => {
    const typing = e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
    if (((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) || (e.key === "/" && !typing)) {
      if (!document.body.offsetParent && document.documentElement.classList.contains("app-booting")) return;
      e.preventDefault();
      if (header) header.classList.add("search-open");
      input.focus();
      input.select();
    }
  });

  // Điện thoại: nút kính lúp mở ô tìm trùm lên header; nút × đóng lại.
  const openBtn = document.getElementById("btnQuickSearchOpen");
  const closeBtn = document.getElementById("btnQuickSearchClose");
  if (openBtn) openBtn.addEventListener("click", () => { header.classList.add("search-open"); input.focus(); });
  if (closeBtn) closeBtn.addEventListener("click", () => { input.value = ""; close(); header.classList.remove("search-open"); if (openBtn) openBtn.focus(); });
}

/** Toàn màn hình (Fullscreen API) — trình duyệt không hỗ trợ (Safari iPhone) thì ẩn nút. */
function setupFullscreenToggle() {
  const btn = document.getElementById("btnFullscreen");
  if (!btn) return;
  const root = document.documentElement;
  if (!root.requestFullscreen || !document.exitFullscreen) { btn.classList.add("hidden"); return; }
  const use = btn.querySelector("use");
  const label = btn.querySelector(".hdr-label");
  const sync = () => {
    const on = !!document.fullscreenElement;
    if (use) use.setAttribute("href", on ? "#icon-minimize" : "#icon-maximize");
    const t = on ? "Thoát toàn màn hình" : "Toàn màn hình";
    btn.title = t;
    btn.setAttribute("aria-label", t);
    btn.setAttribute("data-tooltip", t);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    if (label) label.textContent = t;
  };
  btn.addEventListener("click", () => {
    const p = document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen();
    if (p && p.catch) p.catch(() => {});
  });
  document.addEventListener("fullscreenchange", sync);
  sync();
}

/** Khối tài khoản: bấm → menu Đổi mật khẩu / Đăng xuất (máy tính). Trong menu "⋯" (điện thoại) các mục hiện sẵn. */
function setupUserMenu() {
  const btn = document.getElementById("userBadge");
  const menu = document.getElementById("userMenu");
  if (!btn || !menu) return;
  const setOpen = (open) => {
    menu.classList.toggle("is-open", open); // không dùng .hidden: class đó có !important, chặn menu hiện sẵn trong menu ⋯ (điện thoại)
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = !menu.classList.contains("is-open");
    setOpen(open);
    if (open) { const first = menu.querySelector("button:not(.hidden)"); if (first) first.focus(); }
  });
  document.addEventListener("click", (e) => { if (!menu.contains(e.target) && e.target !== btn) setOpen(false); });
  menu.addEventListener("click", (e) => { if (e.target.closest("button")) setOpen(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("is-open")) { setOpen(false); btn.focus(); }
  });
}

/** Avatar chữ cái + tên + vai trò ở khối tài khoản (gọi từ renderUserHeader(), app-core.js). */
function renderUserChip(email, roleLabel) {
  const local = String(email || "").split("@")[0];
  const parts = local.split(/[._\-\s]+/).filter(Boolean);
  const initials = ((parts[0] || "?")[0] + (parts.length > 1 ? parts[parts.length - 1][0] : (parts[0] || "").slice(1, 2))).toUpperCase();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("userAvatar", initials);
  set("userName", email || "");
  set("userRole", roleLabel || "");
  set("userMenuEmail", email || "");
  const btn = document.getElementById("userBadge");
  if (btn) btn.title = `${email} — ${roleLabel}. Bấm để mở menu tài khoản`;
}

function setupHeader() {
  setupQuickSearch();
  setupFullscreenToggle();
  setupUserMenu();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { quickSearchIndex, quickSearchMatch, qsFold, qsHighlight, renderUserChip };
}
