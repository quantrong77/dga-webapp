/* src/presentation/components/ui-combobox.js — Combo box tìm kiếm tiếng Việt không dấu và popover thông tin trợ giúp. */

function normalizeSearch(s) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bỏ các dấu thanh/dấu phụ đã tách rời sau NFD
    .replace(/đ|Đ/g, "d") // "đ"/"Đ" không tách bằng NFD nên thay thủ công
    .toLowerCase()
    .trim();
}

/** Hiện/ẩn thông báo "Vui lòng chờ! Đang nạp dữ liệu..." ở mọi khung Trạm/Thiết bị
 *  đang gắn class "combo-loading-hint" (DGA, Dầu cách điện MBA, Dầu OLTC — xem
 *  index.html). */
function setComboLoading(isLoading) {
  document.querySelectorAll(".combo-loading-hint").forEach((el) => {
    el.classList.toggle("hidden", !isLoading);
  });
}

function setupCombo({ input, toggleBtn, listEl, getOptions }) {
  if (!input || !toggleBtn || !listEl) return;
  let currentOptions = [];

  function render(filterText) {
    const norm = normalizeSearch(filterText);
    const all = getOptions();
    currentOptions = !norm
      ? all
      : all.filter((o) => normalizeSearch(o.label).includes(norm) || normalizeSearch(o.value).includes(norm));
    if (currentOptions.length === 0) {
      listEl.innerHTML = `<div class="combo-empty">Không tìm thấy mục nào khớp — cứ gõ tiếp để dùng làm giá trị mới</div>`;
    } else {
      listEl.innerHTML = currentOptions
        .map((o, i) => `<div class="combo-item" data-idx="${i}">${escapeHtml(o.label)}</div>`)
        .join("");
    }
  }

  function open(filterText) {
    render(filterText);
    listEl.classList.remove("hidden");
  }
  function close() {
    listEl.classList.add("hidden");
  }

  input.addEventListener("input", () => open(input.value));
  input.addEventListener("focus", () => open(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  toggleBtn.addEventListener("click", () => {
    if (listEl.classList.contains("hidden")) {
      input.focus();
      open("");
    } else {
      close();
    }
  });
  listEl.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".combo-item");
    if (!item) return;
    e.preventDefault();
    const opt = currentOptions[Number(item.dataset.idx)];
    if (opt) {
      input.value = opt.value;
      close();
      input.dispatchEvent(new Event("change"));
    }
  });
  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !toggleBtn.contains(e.target) && !listEl.contains(e.target)) close();
  });
}

/** Gắn sự kiện cho MỌI nút icon "i" (class="info-icon-btn", có aria-controls trỏ tới id
 *  1 div.info-popover ngay trong HTML — xem ví dụ "Điểm lấy mẫu OLTC" ở index.html/tab
 *  OLTC) — bấm icon để mở/đóng khung giải thích thêm ngay dưới trường đó. */
function setupInfoPopovers() {
  const closeAll = () => {
    document.querySelectorAll(".info-popover:not(.hidden)").forEach((panel) => {
      panel.classList.add("hidden");
      const btn = document.querySelector(`.info-icon-btn[aria-controls="${panel.id}"]`);
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  };
  document.querySelectorAll(".info-icon-btn[aria-controls]").forEach((btn) => {
    const panel = document.getElementById(btn.getAttribute("aria-controls"));
    if (!panel) return;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willShow = panel.classList.contains("hidden");
      closeAll();
      if (willShow) {
        panel.classList.remove("hidden");
        btn.setAttribute("aria-expanded", "true");
      }
    });
    const closeBtn = panel.querySelector(".info-popover-close");
    if (closeBtn) closeBtn.addEventListener("click", closeAll);
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest(".info-popover") || e.target.closest(".info-icon-btn")) return;
    closeAll();
  });
}
