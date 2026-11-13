/* app-status.js — Trạng thái kết nối & đồng bộ (tách từ app-core.js, Bước 4.2 REFACTOR_PLAN):
   nút icon Database (#storageBadge) gộp trạng thái kết nối + đồng bộ ngoại tuyến, dòng chân trang
   (#footerStorageInfo), đăng ký Service Worker. Nạp TRƯỚC app-core.js. */

/* ---------------------------------------------------------------------------------------------------------------
   Nút icon Database (#storageBadge) — gộp 2 huy hiệu cũ "Database" (kết nối) và "Đã đồng bộ" (đồng bộ ngoại tuyến).
   2 nguồn trạng thái ghi vào _dbStatus rồi renderDbStatus() dựng lại nút:
     - conn (renderStorageBadge / markStorageBadgeDisconnected): "ok" | "error" | "local"
     - sync (Storage.onSyncStatusChange, setupAutoSyncUI): { online, syncing, pendingCount }
   Trạng thái hiển thị (data-db-state → màu chấm): error > local > syncing > offline > ok.
   --------------------------------------------------------------------------------------------------------------- */
const _dbStatus = { conn: null, connTitle: "", errMsg: "", sync: null };

/** Hàm thuần (có test): trạng thái + chế độ lưu trữ + link quản lý → { state, label, title, pending }. */
function dbStatusView(st, mode, link) {
  const name = mode === "local-server" ? "Máy chủ nội bộ" : "Database";
  const sync = st.sync || { online: true, syncing: false, pendingCount: 0 };
  const pending = st.conn === "local" ? 0 : sync.pendingCount || 0;
  let state;
  let label;
  let detail;
  if (st.conn === "local") {
    state = "local";
    label = "Chế độ thử nghiệm";
    detail = "Chế độ thử nghiệm — dữ liệu chỉ lưu trên trình duyệt này, không dùng chung";
  } else if (st.conn === "error") {
    state = "error";
    label = `${name}: mất kết nối`;
    detail = `Mất kết nối ${name === "Database" ? "database" : name}${st.errMsg ? ": " + st.errMsg : ""}`;
  } else if (sync.syncing || (sync.online && pending > 0)) {
    state = "syncing";
    label = `${name}: đang đồng bộ${pending ? ` (${pending})` : ""}`;
    detail = pending ? `Đang đồng bộ ${pending} mục lên máy chủ` : "Đang đồng bộ";
  } else if (!sync.online) {
    state = "offline";
    label = `${name}: offline${pending ? ` (${pending})` : ""}`;
    detail = `Chạy offline, tự đồng bộ khi có mạng${pending ? ` — ${pending} mục chờ` : ""}`;
  } else {
    state = "ok";
    label = `${name}: đã đồng bộ`;
    detail = `${st.connTitle || "Đã kết nối database"} · đã đồng bộ toàn bộ dữ liệu mới nhất`;
  }
  let hint = "";
  if (link) {
    hint = mode === "local-server" ? "Bấm để kiểm tra trạng thái Máy chủ nội bộ On-Premise"
      : mode === "gsheet" ? "Bấm để mở Google Sheet quản lý dữ liệu" : "Bấm để mở Supabase Dashboard";
  } else if (state === "syncing" && pending) {
    hint = "Bấm để đồng bộ ngay";
  }
  return { state, label, title: hint ? `${detail} — ${hint}` : detail, pending };
}

/** Dựng lại nút #storageBadge (+ chấm trạng thái trên nút "⋯" của điện thoại) từ _dbStatus. */
function renderDbStatus() {
  const btn = $("storageBadge");
  if (!btn || !_dbStatus.conn) return;
  const v = dbStatusView(_dbStatus, Storage.mode, btn.dataset.dbLink || "");
  btn.classList.remove("hidden");
  btn.dataset.dbState = v.state;
  btn.title = v.title;
  btn.setAttribute("aria-label", v.title);
  btn.dataset.tooltip = v.label;
  const lbl = $("dbStatusLabel");
  if (lbl) lbl.textContent = v.label;
  const cnt = $("dbPendingCount");
  if (cnt) {
    cnt.textContent = v.pending > 99 ? "99+" : String(v.pending);
    cnt.classList.toggle("hidden", !v.pending);
  }
  // Điện thoại: nút Database nằm trong menu "⋯" → chấm màu trên nút "⋯" khi trạng thái KHÁC "đã đồng bộ".
  const menuDot = $("menuDbDot");
  if (menuDot) {
    menuDot.dataset.dbState = v.state;
    menuDot.classList.toggle("hidden", v.state === "ok");
  }
}

/** Gắn sự kiện bấm cho nút #storageBadge — 1 lần (initApp() có thể chạy lại nhiều lần trong 1 phiên; listener luôn đọc
 *  link MỚI NHẤT từ data-db-link lúc bấm). Admin có link quản lý → mở Google Sheet/Supabase Dashboard/trang máy chủ ở tab
 *  mới (như badge "Database" cũ). Có mục chờ đồng bộ → đồng bộ ngay (như badge "Đã đồng bộ" cũ). Còn lại → báo trạng thái. */
function setupStorageBadgeLink() {
  const badge = $("storageBadge");
  if (!badge || badge.dataset.linkBound) return;
  badge.dataset.linkBound = "1";
  badge.addEventListener("click", async () => {
    const url = badge.dataset.dbLink;
    if (url) window.open(url, "_blank", "noopener");
    if (_dbStatus.conn === "local") {
      if (!url) showToast("Chế độ thử nghiệm — dữ liệu chỉ lưu trên trình duyệt này.", "warning");
      return;
    }
    const st = Storage.getSyncStatus();
    if (!st.online) {
      if (!url) showToast("Chạy offline, tự đồng bộ khi có mạng", "warning");
      return;
    }
    if (st.pendingCount > 0) {
      showToast("Đang đồng bộ", "info");
      const res = await Storage.processSyncQueue();
      if (res && res.processed > 0) {
        showToast(`Đã đồng bộ thành công ${res.processed} mục lên máy chủ!`, "success");
        try {
          await refreshStandardsUI();
          await refreshHistoryUI();
        } catch (e) {}
      }
    } else if (!url) {
      if (_dbStatus.conn === "error") showToast(badge.title, "error");
      else showToast("Toàn bộ dữ liệu đã được đồng bộ với máy chủ.", "success");
    }
  });
}

/** Link quản lý database (data-db-link + class has-link) trên nút #storageBadge theo cấu hình (databaseManagementUrl() ở
 *  storage-core.js). Chỉ Admin (hoặc khi tắt Auth) mới có link; User thường chỉ xem trạng thái. */
function applyDatabaseBadgeLink(badge, isAdminOrNoAuth) {
  const url = isAdminOrNoAuth ? databaseManagementUrl() : "";
  badge.classList.toggle("has-link", !!url);
  if (url) badge.dataset.dbLink = url;
  else delete badge.dataset.dbLink;
}

/** Trạng thái lưu trữ theo Storage.mode → nút icon Database + dòng chân trang. Nút hiện cho MỌI người (trạng thái đồng bộ
 *  ai cũng cần biết, như badge "Đã đồng bộ" cũ); link mở database chỉ gắn cho Admin (như badge "Database" cũ).
 *  Chế độ thử nghiệm (localStorage) còn bật banner đỏ đầu trang. */
function renderStorageBadge(isAdminOrNoAuth) {
  const badge = $("storageBadge");
  const footerInfo = $("footerStorageInfo");
  _dbStatus.errMsg = "";
  if (Storage.mode === "local-server" || Storage.mode === "gsheet" || Storage.mode === "supabase") {
    footerInfo.textContent = Storage.mode === "local-server" ? "lưu trên Máy chủ nội bộ On-Premise (Localhost / LAN)" : "lưu trên database dùng chung (nhiều máy cùng truy cập)";
    // Trạng thái LẠC QUAN ban đầu (đã có cấu hình) — nếu lần tải Tiêu chuẩn/Lịch sử đo đầu tiên lỗi,
    // markStorageBadgeDisconnected() chuyển sang "error" (chấm đỏ).
    _dbStatus.conn = "ok";
    _dbStatus.connTitle = Storage.mode === "local-server" ? "Đã kết nối Máy chủ nội bộ (On-Premise Localhost)" : "Đã kết nối database";
    applyDatabaseBadgeLink(badge, isAdminOrNoAuth);
  } else {
    _dbStatus.conn = "local";
    _dbStatus.connTitle = "";
    applyDatabaseBadgeLink(badge, false);
    $("localModeBanner").classList.remove("hidden");
    footerInfo.textContent = "lưu trong localStorage của trình duyệt này — điền config.js để dùng database dùng chung";
  }
  renderDbStatus();
}

/** Lần nạp dữ liệu đầu tiên thất bại → chấm đỏ "mất kết nối" (chỉ chế độ có database dùng chung). Vẫn giữ link
 *  Sheet/Dashboard — Admin thường CẦN mở thẳng lúc này để xem chuyện gì đang xảy ra. */
function markStorageBadgeDisconnected(err, isAdminOrNoAuth) {
  if (!(Storage.mode === "local-server" || Storage.mode === "gsheet" || Storage.mode === "supabase")) return;
  _dbStatus.conn = "error";
  _dbStatus.errMsg = storageErrorMessage(err);
  applyDatabaseBadgeLink($("storageBadge"), isAdminOrNoAuth);
  renderDbStatus();
}

// Gọi từ initApp() — tức SAU khi đăng nhập, lúc sự kiện "load" thường đã xảy ra từ lâu. Trước đây chỉ gắn trình
// nghe "load" nên Service Worker không bao giờ được đăng ký (lỗi #2, BUGS_FOUND.md) → mất mạng thì tải lại trang
// không mở được app. Nay: trang đã tải xong thì đăng ký ngay, chưa xong mới chờ "load".
function registerServiceWorker() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  if (!("serviceWorker" in navigator) || !window.location.protocol.startsWith("http")) return;
  const doRegister = () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("Không đăng ký được Service Worker:", err);
    });
  };
  if (document.readyState === "complete") doRegister();
  else window.addEventListener("load", doRegister, { once: true });
}

// Đồng bộ ngoại tuyến: ghi trạng thái vào _dbStatus.sync → renderDbStatus(). Gắn 1 lần (initApp() có thể chạy lại).
function setupAutoSyncUI() {
  if (setupAutoSyncUI._bound) return;
  setupAutoSyncUI._bound = true;
  Storage.onSyncStatusChange((st) => {
    _dbStatus.sync = st;
    renderDbStatus();
  });

  if (typeof navigator !== "undefined" && !navigator.onLine && Storage.mode !== "local") {
    showToast("Chạy offline, tự đồng bộ khi có mạng", "warning");
  }

  window.addEventListener("online", async () => {
    showToast("Đang đồng bộ", "info");
    const res = await Storage.processSyncQueue();
    if (res && res.processed > 0) {
      showToast(`Đã tự động đồng bộ xong ${res.processed} mục lên máy chủ!`, "success");
      try {
        await refreshStandardsUI();
        await refreshHistoryUI();
      } catch (e) {}
    }
  });

  window.addEventListener("offline", () => {
    showToast("Chạy offline, tự đồng bộ khi có mạng", "warning");
  });
  // Mất mạng / có mạng lại → đổi màu chấm ngay (không chờ hàng đợi đồng bộ báo).
  const refreshOnline = () => {
    _dbStatus.sync = Storage.getSyncStatus();
    renderDbStatus();
  };
  window.addEventListener("online", refreshOnline);
  window.addEventListener("offline", refreshOnline);

  // Tự động kiểm tra đồng bộ ngầm định kỳ mỗi 45 giây nếu online và có queue tồn đọng
  setInterval(() => {
    if (typeof navigator !== "undefined" && navigator.onLine && Storage.getSyncStatus().pendingCount > 0) {
      Storage.processSyncQueue().then((res) => {
        if (res && res.processed > 0) {
          try { refreshHistoryUI(); } catch (e) {}
        }
      }).catch(() => {});
    }
  }, 45000);
}
