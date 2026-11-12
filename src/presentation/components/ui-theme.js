/* ui-theme.js — Nút đổi giao diện sáng/tối ở header. Giao diện được áp sớm ở early-layout.js để không
   nháy nền trắng; file này chỉ lo đổi và ghi nhớ lựa chọn. Bảng màu nằm ở src/presentation/styles/tokens.css. */

const THEME_STORAGE_KEY = "dga_theme";

function currentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** Đồ thị vẽ trên canvas nên không tự theo CSS, phải đặt màu chữ và lưới theo giao diện. */
function applyThemeToChartDefaults() {
  if (typeof Chart === "undefined") return;
  const css = getComputedStyle(document.documentElement);
  Chart.defaults.color = css.getPropertyValue("--gray-600").trim();
  Chart.defaults.borderColor = css.getPropertyValue("--gray-200").trim();
  Chart.defaults.font.family = '"Be Vietnam Pro", "Segoe UI", sans-serif';
}

function renderThemeButton() {
  const toDark = currentTheme() === "light";
  const label = toDark ? "Chuyển sang giao diện tối" : "Chuyển sang giao diện sáng";
  const btn = $("btnToggleTheme");
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.setAttribute("data-tooltip", toDark ? "Giao diện tối" : "Giao diện sáng");
  if ($("themeLabel")) $("themeLabel").textContent = toDark ? "Giao diện tối" : "Giao diện sáng";
  $("themeIconUse").setAttribute("href", toDark ? "#icon-moon" : "#icon-sun");
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (e) { /* trình duyệt chặn lưu: vẫn đổi được trong phiên này */ }
  applyThemeToChartDefaults();
  renderThemeButton();
  document.dispatchEvent(new Event("dga:themechange"));
}

/** Gọi 1 lần ở init() (ui-auth.js). */
function setupTheme() {
  applyThemeToChartDefaults();
  renderThemeButton();
  $("btnToggleTheme").addEventListener("click", () => setTheme(currentTheme() === "dark" ? "light" : "dark"));
}
