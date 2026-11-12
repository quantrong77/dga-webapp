/* src/presentation/components/ui-view-context.js — "Ngữ cảnh xem" dùng chung giữa 3 tab XEM dữ liệu: Lịch sử đo,
 * Xu hướng, Cảnh báo (Bước 2b, docs/refactor/UI_UX_PLAN.md). Chọn Trạm/Thiết bị ở 1 tab → sang tab xem khác đã lọc sẵn
 * đúng Trạm/Thiết bị đó, không phải chọn lại. Để trống (xóa ô) ở 1 tab cũng bỏ lọc ở các tab kia.
 *
 * CHỦ Ý không đụng form NHẬP (Khí hòa tan, Lý-Hóa dầu): tránh nhập nhầm số liệu vào thiết bị đang xem.
 *
 * Cách làm: mỗi tab vẫn giữ cặp ô combo riêng như cũ. Module này chỉ (1) ghi nhớ giá trị khi người dùng chốt chọn
 * (sự kiện "change") ở bất kỳ tab nào, và (2) khi mở 1 tab xem có giá trị khác thì điền vào rồi gọi hàm vẽ lại của tab đó.
 * Chỉ nhớ trong phiên (không lưu localStorage) — mở lại app thì bắt đầu từ "Tất cả". */

const VIEW_CONTEXT_TABS = {
  lichsu: {
    station: "lichsu_station",
    device: "lichsu_device",
    // Bảng lịch sử vẽ lại theo sự kiện "input" của 2 ô lọc (bindHistoryTrendAlertEvents(), app-core.js).
    refresh: () => document.getElementById("lichsu_device").dispatchEvent(new Event("input")),
  },
  xuhuong: {
    station: "tr_station",
    device: "tr_device",
    refresh: () => {
      if (typeof updateTrendEmptyNote === "function") updateTrendEmptyNote();
      if (typeof onTrendDeviceChange === "function") onTrendDeviceChange();
    },
  },
  canhbao: {
    station: "al_stationFilter",
    device: "al_deviceFilter",
    refresh: () => { if (typeof refreshAlertsUI === "function") refreshAlertsUI(); },
  },
};

let _viewContext = { station: "", device: "" };

/** Ghi nhớ Trạm/Thiết bị đang xem (VD khi nhảy từ dòng cảnh báo sang Xu hướng bằng code, không qua sự kiện "change"). */
function setViewContext(station, device) {
  _viewContext = { station: String(station || "").trim(), device: String(device || "").trim() };
}

/** Điền ngữ cảnh đang nhớ vào 2 ô của tab `tab` (nếu khác) rồi vẽ lại tab đó. Trả về true nếu có thay đổi. */
function applyViewContext(tab) {
  const cfg = VIEW_CONTEXT_TABS[tab];
  if (!cfg) return false;
  const st = document.getElementById(cfg.station);
  const dev = document.getElementById(cfg.device);
  if (!st || !dev) return false;
  if (st.value.trim() === _viewContext.station && dev.value.trim() === _viewContext.device) return false;
  st.value = _viewContext.station;
  dev.value = _viewContext.device;
  cfg.refresh();
  return true;
}

function setupViewContext() {
  Object.entries(VIEW_CONTEXT_TABS).forEach(([tab, cfg]) => {
    const st = document.getElementById(cfg.station);
    const dev = document.getElementById(cfg.device);
    if (!st || !dev) return;
    // Chỉ "change" (chốt chọn từ danh sách gợi ý / rời ô) — không theo từng phím gõ dở.
    const remember = () => setViewContext(st.value, dev.value);
    st.addEventListener("change", remember);
    dev.addEventListener("change", remember);
    document.querySelectorAll(`.tab-btn[data-tab="${tab}"]`).forEach((btn) => {
      btn.addEventListener("click", () => applyViewContext(tab));
    });
  });
}
