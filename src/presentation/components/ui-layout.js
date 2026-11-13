/* src/presentation/components/ui-layout.js — Quản lý chuyển đổi bố cục tab (ngang / dọc sidebar), header sticky và subtabs. */

const TAB_LAYOUT_STORAGE_KEY = "dga_tab_layout";

function applyTabLayout(isSidebar) {
  document.body.classList.toggle("tabs-sidebar", isSidebar);
  const btn = $("btnToggleTabLayout");
  if (!btn) return;
  btn.setAttribute("aria-pressed", String(isSidebar));
  btn.title = isSidebar ? "Chuyển thanh tab về ngang (phía trên)" : "Chuyển thanh tab sang cột dọc (bên trái)";
  btn.setAttribute("data-tooltip", isSidebar ? "Chuyển tab ngang" : "Chuyển tab dọc");
}

function setupTabLayoutToggle() {
  const btn = $("btnToggleTabLayout");
  if (!btn) return;
  applyTabLayout(document.body.classList.contains("tabs-sidebar"));
  if (btn._hasTabLayoutListener) return;
  btn._hasTabLayoutListener = true;
  btn.addEventListener("click", () => {
    const next = !document.body.classList.contains("tabs-sidebar");
    applyTabLayout(next);
    try { localStorage.setItem(TAB_LAYOUT_STORAGE_KEY, next ? "sidebar" : "top"); } catch (e) {}
  });
}

const SIDEBAR_COLLAPSE_STORAGE_KEY = "dga_sidebar_collapsed";

function getSidebarCollapseBtn() {
  return $("btnCollapseSidebar") || $("btnToggleSidebarCollapse");
}

function applySidebarCollapse(isCollapsed) {
  document.body.classList.toggle("sidebar-collapsed", isCollapsed);
  const btn = getSidebarCollapseBtn();
  if (!btn) return;
  btn.setAttribute("aria-pressed", String(isCollapsed));
  btn.title = isCollapsed ? "Mở rộng sidebar (hiện chữ)" : "Thu gọn sidebar (chỉ hiện icon)";
  btn.setAttribute("aria-label", btn.title);
}

function setupSidebarCollapseToggle() {
  const btn = getSidebarCollapseBtn();
  if (!btn) return;
  applySidebarCollapse(document.body.classList.contains("sidebar-collapsed"));
  if (btn._hasCollapseListener) return;
  btn._hasCollapseListener = true;
  btn.addEventListener("click", () => {
    const next = !document.body.classList.contains("sidebar-collapsed");
    applySidebarCollapse(next);
    try { localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, next ? "1" : "0"); } catch (e) {}
  });
}

/** Menu "⋯" của header trên điện thoại (≤ 800px): mở/đóng #headerMenu (.header-tools). Đóng khi bấm ra ngoài, bấm 1 mục,
 *  nhấn Esc, hoặc khi màn hình rộng ra (máy tính hiện thẳng các nút trên header, xem style-base.css). */
function setupHeaderMenu() {
  const btn = document.getElementById("btnHeaderMenu");
  const menu = document.getElementById("headerMenu");
  if (!btn || !menu) return;
  const setOpen = (open) => {
    menu.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "Đóng menu" : "Mở menu");
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(!menu.classList.contains("open"));
  });
  menu.addEventListener("click", (e) => {
    if (e.target.closest("button")) setOpen(false);
  });
  document.addEventListener("click", (e) => {
    if (menu.classList.contains("open") && !menu.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("open")) {
      setOpen(false);
      btn.focus();
    }
  });
  if (window.matchMedia) {
    const mq = window.matchMedia("(min-width: 801px)");
    const onChange = () => { if (mq.matches) setOpen(false); };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
  }
}

function setupStickyHeaderObserver() {
  const header = document.querySelector("header.app-header");
  if (!header || !document.documentElement) return;
  const updateHeight = () => {
    try {
      const h = header.getBoundingClientRect().height;
      if (h > 0) {
        document.documentElement.style.setProperty("--header-height", `${Math.round(h)}px`);
      }
    } catch (_) {}
  };
  updateHeight();
  if (typeof ResizeObserver !== "undefined") {
    try {
      new ResizeObserver(updateHeight).observe(header);
    } catch (_) {}
  } else if (typeof window !== "undefined") {
    window.addEventListener("resize", updateHeight);
  }
}

/** Thanh cuộn ngang PHÍA TRÊN bảng (mọi .table-scroll trong <main>). Bảng nhiều cột (VD Lịch sử đo khí hòa tan:
 *  21 cột, ~1560px) rộng hơn khung → trước đây chỉ có thanh cuộn ở ĐÁY bảng, bảng dài phải kéo xuống cuối mới cuộn
 *  ngang được. Thanh trên đồng bộ 2 chiều với thanh dưới, DÍNH ngay dưới header + thanh tab khi cuộn trang
 *  (--sticky-top), chỉ hiện khi bảng thực sự bị khuất. Bề rộng bảng đổi (đổi bộ lọc, nạp dữ liệu, đổi cỡ cửa
 *  sổ, mở/thu sidebar) → ResizeObserver cập nhật lại. */
function attachTopScrollbar(sc) {
  if (!sc || sc.dataset.topScroll) return;
  sc.dataset.topScroll = "1";
  const bar = document.createElement("div");
  bar.className = "table-scroll-top hidden";
  bar.setAttribute("aria-hidden", "true"); // thanh phụ cho chuột; bàn phím/trình đọc dùng chính khung bảng
  bar.tabIndex = -1;
  const inner = document.createElement("div");
  bar.appendChild(inner);
  sc.parentNode.insertBefore(bar, sc);
  let syncing = null;
  bar.addEventListener("scroll", () => {
    if (syncing === "sc") { syncing = null; return; }
    syncing = "bar";
    sc.scrollLeft = bar.scrollLeft;
  }, { passive: true });
  sc.addEventListener("scroll", () => {
    if (syncing === "bar") { syncing = null; return; }
    syncing = "sc";
    bar.scrollLeft = sc.scrollLeft;
  }, { passive: true });
  const update = () => {
    const overflow = sc.scrollWidth - sc.clientWidth > 1 && sc.clientWidth > 0;
    bar.classList.toggle("hidden", !overflow);
    if (!overflow) return;
    inner.style.width = sc.scrollWidth + "px";
    bar.scrollLeft = sc.scrollLeft;
  };
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(update);
    ro.observe(sc);
    if (sc.firstElementChild) ro.observe(sc.firstElementChild);
  } else {
    window.addEventListener("resize", update);
  }
  update();
}

function setupTopScrollbars() {
  document.querySelectorAll("main .table-scroll").forEach(attachTopScrollbar);
  // Độ cao phần dính ở đỉnh trang (header + thanh tab ngang) — chỗ thanh cuộn trên bảng dính vào khi cuộn trang.
  // Bố cục sidebar (màn hình > 800px): thanh tab nằm bên trái, không chiếm chiều cao phía trên.
  const nav = document.querySelector("nav.tabs");
  const updateTop = () => {
    const sidebar = document.body.classList.contains("tabs-sidebar") && window.innerWidth > 800;
    const h = nav && !sidebar ? Math.round(nav.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty("--tabs-height", h + "px");
  };
  updateTop();
  if (nav && typeof ResizeObserver !== "undefined") new ResizeObserver(updateTop).observe(nav);
  window.addEventListener("resize", updateTop);
  new MutationObserver(updateTop).observe(document.body, { attributes: true, attributeFilter: ["class"] });
}

/** Nút "Về đầu trang" (#btnBackToTop) — hiện khi đã cuộn xuống quá ~1,5 màn hình (bảng Lịch sử đo nhiều dòng...),
 *  bấm thì cuộn lên đầu và đưa focus về nội dung chính (người dùng bàn phím không bị kẹt ở cuối trang). */
function setupBackToTop() {
  const btn = document.getElementById("btnBackToTop");
  if (!btn) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    btn.classList.toggle("hidden", window.scrollY < Math.max(600, window.innerHeight * 1.5));
  };
  window.addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  btn.addEventListener("click", () => {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    const main = document.getElementById("mainContent");
    if (main) main.focus({ preventScroll: true });
  });
  update();
}

/** Khung "Nhập BBTN" (.bbtn-import-panel — tab Khí hòa tan, Lý-Hóa dầu, dầu 3 pha): mặc định THU GỌN chỉ còn tiêu đề +
 *  2 nút chọn "Một BBTN" / "Nhiều BBTN"; bấm nút nào thì hiện phần tương ứng (class show-one / show-many trên panel,
 *  CSS ở style-components.css), bấm lại để ẩn — mở được cả 2 cùng lúc. Phần phụ của ô 1 BBTN (.bbtn-import-x1: file
 *  đang đính kèm, nút Hiện BBTN đối chiếu, Lưu cả biên bản...) luôn hiện khi có nội dung, kể cả lúc thu gọn. */
function setupBbtnImportPickers() {
  document.querySelectorAll(".bbtn-import-panel").forEach((panel, idx) => {
    const h2 = panel.querySelector(":scope > h2");
    const grid = panel.querySelector(":scope > .bbtn-import-grid");
    if (!h2 || !grid || panel.querySelector(".bbtn-pick-group")) return;
    if (!grid.id) grid.id = "bbtnImportGrid" + idx;
    const head = document.createElement("div");
    head.className = "bbtn-import-head";
    h2.before(head);
    head.appendChild(h2);
    const group = document.createElement("div");
    group.className = "bbtn-pick-group";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Chọn cách nhập BBTN");
    const picks = [
      ["one", "#icon-paperclip", "Một BBTN", "Đọc 1 biên bản vào form để đối chiếu rồi lưu"],
      ["many", "#icon-layers", "Nhiều BBTN / thư mục", "Nhập hàng loạt nhiều biên bản hoặc cả thư mục"],
    ];
    picks.forEach(([key, icon, label, tip]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bbtn-pick";
      b.dataset.bbtnPick = key;
      b.title = tip;
      b.setAttribute("aria-pressed", "false");
      b.setAttribute("aria-controls", grid.id);
      b.innerHTML = `<svg class="icon-svg" aria-hidden="true"><use href="${icon}"></use></svg>${label}`;
      b.addEventListener("click", () => {
        const on = !panel.classList.contains("show-" + key);
        panel.classList.toggle("show-" + key, on);
        b.setAttribute("aria-pressed", String(on));
        if (on) {
          const input = panel.querySelector(`.bbtn-import-z${key === "one" ? 1 : 2} input[type="file"]`);
          if (input) input.focus({ preventScroll: true });
        }
      });
      group.appendChild(b);
    });
    head.appendChild(group);
  });
}

function setupTabs() {
  // Nút chuyển nhanh sang tab khác (vd thông báo "Tài khoản chỉ xem": data-goto-tab="lichsu").
  document.querySelectorAll("[data-goto-tab]").forEach((el) => {
    el.addEventListener("click", () => {
      const target = document.querySelector(`.tab-btn[data-tab="${el.dataset.gotoTab}"]`);
      if (target) target.click();
    });
  });
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
      const targetTab = btn.dataset.tab;
      // Mọi nút trỏ cùng 1 tab cùng sáng (VD chuông cảnh báo ở header + tab "Cảnh báo" ở thanh tab).
      document.querySelectorAll(`.tab-btn[data-tab="${targetTab}"]`).forEach((b) => b.classList.add("active"));
      btn.classList.add("active");
      if (targetTab === "cauhinh") {
        const qtPanel = $("tab-quantri");
        if (qtPanel) qtPanel.classList.remove("hidden");
        const cauhinhSubBtn = document.querySelector('.quantri-subtab-btn[data-subtab="cauhinh"]');
        if (cauhinhSubBtn) cauhinhSubBtn.click();
        const navQt = $("navQuanTri");
        if (navQt) navQt.classList.add("active");
      } else {
        const tabEl = $("tab-" + targetTab);
        if (tabEl) tabEl.classList.remove("hidden");
        if (targetTab === "canhbao" && typeof refreshAlertsUI === "function") {
          refreshAlertsUI();
        }
      }
      if (targetTab === "dga" || targetTab === "nhap") {
        // ô chọn file trong #bbtnDropzone (control nhận bàn phím); khung Nhập BBTN đang thu gọn → nút "Một BBTN"
        const bbtnInput = $("f_bbtn");
        const focusEl = bbtnInput && bbtnInput.offsetParent ? bbtnInput : document.querySelector(`#tab-${targetTab} [data-bbtn-pick="one"]`);
        if (focusEl) focusEl.focus({ preventScroll: true });
      }
      // Tránh cuộn trang khi bấm các nút icon trên Header (chỉ cuộn cho các nút trong sidebar/nav.tabs)
      if (!btn.classList.contains("header-icon-btn")) {
        btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }
    });
  });
}

function setupCauHinhSubtabs() {
  document.querySelectorAll(".cauhinh-subtab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".cauhinh-subtab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".cauhinh-subpanel").forEach((p) => p.classList.add("hidden"));
      btn.classList.add("active");
      const targetSubtab = btn.dataset.subtab;
      const subpanel = $("cauhinh-" + targetSubtab);
      if (subpanel) subpanel.classList.remove("hidden");
      // refreshRegulationConfigUI() nạp danh sách bảng đã tùy chỉnh rồi mới vẽ — gọi thẳng
      // renderRegulationConfigUI() không tham số làm lỗi "overriddenKeys.has" (form vẽ dở dang).
      if (targetSubtab === "quydinh" && typeof refreshRegulationConfigUI === "function") {
        refreshRegulationConfigUI();
      }
    });
  });
}

function setupQuyTrinhSubtabs() {
  document.querySelectorAll(".quytrinh-subtab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".quytrinh-subtab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".quytrinh-subpanel").forEach((p) => p.classList.add("hidden"));
      btn.classList.add("active");
      const targetSubtab = btn.dataset.subtab;
      const subpanel = $("quytrinh-" + targetSubtab);
      if (subpanel) subpanel.classList.remove("hidden");
    });
  });
}

function setupQuantriSubtabs() {
  document.querySelectorAll(".quantri-subtab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".quantri-subtab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".quantri-subpanel").forEach((p) => p.classList.add("hidden"));
      btn.classList.add("active");
      const target = btn.dataset.subtab;
      const subpanel = $("quantri-" + target);
      if (subpanel) subpanel.classList.remove("hidden");
      if (target === "cauhinh" && typeof setupCauHinhSubtabs === "function") {
        const activeSub = document.querySelector(".cauhinh-subtab-btn.active") || document.querySelector('.cauhinh-subtab-btn[data-subtab="tieuchuan"]');
        if (activeSub) activeSub.click();
      }
    });
  });
}

/** Đồng bộ thuộc tính ARIA với class "active" của nút tab — 1 bộ nghe chung ở document (chạy SAU trình xử lý
 *  click của từng nút vì sự kiện nổi bọt lên document; cả .click() gọi bằng code cũng đi qua đây):
 *  - tab chính (.tab-btn, nằm trong <nav> + vài nút ở header): aria-current="page" cho tab đang mở;
 *  - tab con (role="tab" trong role="tablist"): aria-selected="true/false" — trước đây chỉ tab con "cách nhập"
 *    cập nhật, các tab con Quy trình/Quản trị/Cấu hình luôn để aria-selected="false". */
function syncTabAria() {
  document.querySelectorAll(".tab-btn").forEach((b) => {
    if (b.classList.contains("active")) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  document.querySelectorAll('[role="tab"]').forEach((b) => {
    b.setAttribute("aria-selected", b.classList.contains("active") ? "true" : "false");
  });
}

function setupTabAriaSync() {
  syncTabAria();
  document.addEventListener("click", (e) => {
    if (e.target && e.target.closest && e.target.closest('.tab-btn, [role="tab"]')) syncTabAria();
  });
}

/** Focus trong hộp thoại (Bước 5) — áp dụng chung cho mọi .mini-modal-overlay và .lightbox, không cần sửa từng hộp:
 *  - mở hộp: nhớ phần tử đang focus, đưa focus vào ô nhập/nút đầu tiên trong hộp (trừ khi code mở hộp đã tự focus);
 *  - Tab / Shift+Tab chỉ chạy vòng trong hộp, không lọt ra trang phía sau;
 *  - đóng hộp: trả focus về nút đã mở hộp. */
const DIALOG_FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function dialogFocusables(overlay) {
  return Array.from(overlay.querySelectorAll(DIALOG_FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
}

function setupDialogFocus() {
  const overlays = Array.from(document.querySelectorAll(".mini-modal-overlay, .lightbox"));
  const returnTo = new Map();
  const isOpen = (o) => !o.classList.contains("hidden");
  const onChange = (o) => {
    if (isOpen(o)) {
      if (returnTo.has(o)) return;
      returnTo.set(o, document.activeElement);
      // Chờ code mở hộp chạy xong (có thể tự focus 1 ô cụ thể, VD Đổi mật khẩu → "Mật khẩu hiện tại").
      setTimeout(() => {
        if (!isOpen(o) || o.contains(document.activeElement)) return;
        const items = dialogFocusables(o);
        const first = items.find((el) => !el.classList.contains("mini-modal-close") && !el.classList.contains("lightbox-close")) || items[0];
        if (first) first.focus();
      }, 0);
    } else if (returnTo.has(o)) {
      const prev = returnTo.get(o);
      returnTo.delete(o);
      if (prev && prev.isConnected && prev.getClientRects().length && typeof prev.focus === "function") prev.focus();
    }
  };
  const mo = new MutationObserver((list) => list.forEach((m) => onChange(m.target)));
  overlays.forEach((o) => mo.observe(o, { attributes: true, attributeFilter: ["class"] }));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const open = overlays.filter(isOpen);
    const o = open[open.length - 1];
    if (!o) return;
    const items = dialogFocusables(o);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (!o.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

/** Nút "Xóa form" (Bước 5): form đang có số liệu thì hỏi lại trước khi xóa trắng (trước đây bấm nhầm là mất hết số liệu
 *  chưa lưu). Chạy ở pha capture → chặn được handler xóa form gắn sẵn trên nút. Form trống thì xóa luôn, không hỏi. */
const CLEAR_FORM_BUTTONS = {
  btnClearForm: "#dgaInputSplitLayout",
  btnClearOilForm: "#oSplitLayout",
  btnClearOltcOilForm: "#oltcFormPanel",
  btnT3Clear: "#tio3Panel",
  btnClearTioOilForm: null, // form TI/TU 1 pha không có id riêng → dùng .panel chứa nút
};

function formHasUserData(root) {
  if (!root) return false;
  return Array.from(root.querySelectorAll("input, textarea")).some((el) => {
    if (el.disabled || el.readOnly) return false;
    if (el.type === "file") return el.files && el.files.length > 0;
    if (el.type === "checkbox" || el.type === "radio" || el.type === "button" || el.type === "submit") return false;
    return el.value.trim() !== "";
  });
}

function setupClearFormConfirm() {
  // Gắn ở document, pha capture → luôn chạy TRƯỚC handler xóa form gắn trên chính nút (mọi trình duyệt).
  document.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest && e.target.closest(Object.keys(CLEAR_FORM_BUTTONS).map((id) => "#" + id).join(","));
    if (!btn) return;
    const sel = CLEAR_FORM_BUTTONS[btn.id];
    const root = (sel && document.querySelector(sel)) || btn.closest(".panel");
    if (formHasUserData(root) && !confirm("Xóa trắng toàn bộ ô đã nhập ở form?\n\nSố liệu CHƯA LƯU sẽ mất.")) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
}

/** Phím Esc đóng hộp thoại nhỏ (.mini-modal-overlay: đổi mật khẩu, mật khẩu tạm) — bằng chính nút "×" của hộp,
 *  nên khi nút bị ẩn (bắt buộc đổi mật khẩu tạm) thì Esc cũng không đóng được. */
function setupMiniModalEscape() {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const overlay = document.querySelector(".mini-modal-overlay:not(.hidden)");
    const closeBtn = overlay && overlay.querySelector(".mini-modal-close:not(.hidden)");
    if (closeBtn) closeBtn.click();
  });
}
