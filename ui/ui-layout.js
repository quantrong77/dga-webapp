/* ui/ui-layout.js — Quản lý chuyển đổi bố cục tab (ngang / dọc sidebar), header sticky và subtabs. */

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

function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
      btn.classList.add("active");
      const targetTab = btn.dataset.tab;
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
        const dropzone = $("bbtnDropzone");
        if (dropzone) dropzone.focus();
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
