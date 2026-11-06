/* app-status.js — Trạng thái kết nối & đồng bộ (tách từ app-core.js, Bước 4.2 REFACTOR_PLAN):
   badge "Database"/"Máy chủ nội bộ"/"Chế độ thử nghiệm" (#storageBadge) + dòng chân trang (#footerStorageInfo),
   badge đồng bộ (#syncStatusBadge), đăng ký Service Worker. Nạp TRƯỚC app-core.js. */

/** Gắn sự kiện bấm cho badge #storageBadge — mở Google Sheet/Supabase Dashboard (link
 *  lấy từ data-db-link, xem applyDatabaseBadgeLink() ngay dưới) ở tab mới, tiện cho
 *  Admin thao tác trực tiếp lên dữ liệu. Gắn DUY NHẤT 1 LẦN (initApp() có thể chạy lại
 *  nhiều lần trong 1 phiên trình duyệt — sau khi đăng nhập, sau khi đổi trạng thái badge
 *  do mất kết nối... — nhưng listener chỉ cần gắn 1 lần, luôn đọc link MỚI NHẤT từ
 *  dataset ngay lúc bấm chứ không cần gắn lại) — dùng dataset.linkBound làm cờ đánh dấu
 *  đã gắn, y hệt cách setSidebarCollapse/setupTabLayoutToggle tự đồng bộ trạng thái. */
function setupStorageBadgeLink() {
  const badge = $("storageBadge");
  if (!badge || badge.dataset.linkBound) return;
  badge.dataset.linkBound = "1";
  badge.addEventListener("click", () => {
    const url = badge.dataset.dbLink;
    if (url) window.open(url, "_blank", "noopener");
  });
}

/** Cập nhật link quản lý database gắn trên badge #storageBadge (data-db-link + class
 *  "has-link", xem CSS) theo cấu hình hiện tại (databaseManagementUrl() ở storage.js).
 *  PHẢI gọi lại mỗi khi initApp() gán lại badge.className (className bị GHI ĐÈ toàn bộ
 *  ở đó, xóa mất class "has-link" nếu gọi hàm này trước đó) — xem 3 nơi gọi hàm này
 *  trong initApp(). Không đổi textContent (vẫn luôn là "Database"/"Chế độ thử
 *  nghiệm..." như initApp() đã đặt), chỉ nối thêm gợi ý bấm vào title nếu có link. */
function applyDatabaseBadgeLink(badge) {
  const url = databaseManagementUrl();
  badge.classList.toggle("has-link", !!url);
  if (!url) {
    delete badge.dataset.dbLink;
    return;
  }
  badge.dataset.dbLink = url;
  const hint = Storage.mode === "local-server" ? "Bấm để kiểm tra trạng thái Máy chủ nội bộ On-Premise" : Storage.mode === "gsheet" ? "Bấm để mở Google Sheet quản lý dữ liệu" : "Bấm để mở Supabase Dashboard";
  badge.title = badge.title ? `${badge.title} — ${hint}` : hint;
}

/** Hiện badge chế độ lưu trữ (#storageBadge) + dòng chân trang theo Storage.mode. Badge "Database" chỉ hiện với
 *  Admin (hoặc khi tắt Auth) — xem ghi chú bên trong; cảnh báo "Chế độ thử nghiệm" hiện cho MỌI người. */
function renderStorageBadge(isAdminOrNoAuth) {
  // Badge "Đã kết nối database" chỉ hiện với Admin (chi tiết vận hành/hạ tầng, không
  // cần thiết cho User thường) — khi tắt Auth (Auth.enabled=false, không phân quyền)
  // vẫn hiện bình thường, coi như tương đương Admin. Cảnh báo "Chế độ thử nghiệm"
  // (localStorage) vẫn hiện cho MỌI người vì ai cũng cần biết dữ liệu không dùng chung.
  const badge = $("storageBadge");
  const footerInfo = $("footerStorageInfo");
  if (Storage.mode === "local-server" || Storage.mode === "gsheet" || Storage.mode === "supabase") {
    footerInfo.textContent = Storage.mode === "local-server" ? "lưu trên Máy chủ nội bộ On-Premise (Localhost / LAN)" : "lưu trên database dùng chung (nhiều máy cùng truy cập)";
    badge.classList.toggle("hidden", !isAdminOrNoAuth);
    if (isAdminOrNoAuth) {
      // Màu xanh (.badge.supabase) là trạng thái LẠC QUAN ban đầu — đã có cấu hình
      // (config.js) nên coi như sẽ kết nối được; nếu bước tải Tiêu chuẩn/Lịch sử đo
      // ngay bên dưới (nơi thật sự gọi API đầu tiên) thất bại, badge sẽ bị chuyển
      // sang đỏ (.badge.error) ở khối try/catch tương ứng, xem thêm ghi chú ở đó.
      badge.textContent = Storage.mode === "local-server" ? "Máy chủ nội bộ" : "Database";
      badge.className = "badge supabase";
      badge.title = Storage.mode === "local-server" ? "Đã kết nối Máy chủ nội bộ (On-Premise Localhost)" : "Đã kết nối database";
      applyDatabaseBadgeLink(badge);
    }
  } else {
    badge.textContent = "Chế độ thử nghiệm (chỉ lưu trên trình duyệt này)";
    badge.className = "badge local";
    badge.classList.remove("hidden");
    $("localModeBanner").classList.remove("hidden");
    footerInfo.textContent = "lưu trong localStorage của trình duyệt này — điền config.js để dùng database dùng chung";
  }
}

/** Lần nạp dữ liệu đầu tiên thất bại → chuyển badge sang đỏ "Mất kết nối database" (chỉ chế độ có database dùng chung). */
function markStorageBadgeDisconnected(err, isAdminOrNoAuth) {
  const badge = $("storageBadge");
  // Đây là lần gọi API đầu tiên thật sự chạm tới database (Tiêu chuẩn/Lịch sử đo) —
  // nếu lỗi ngay tại đây, coi như MẤT KẾT NỐI database, chuyển badge #storageBadge
  // (đang lạc quan để xanh từ đầu initApp(), xem phía trên) sang đỏ để phản ánh
  // đúng tình trạng thay vì vẫn hiện xanh gây hiểu lầm là app đang hoạt động bình
  // thường. Không đổi badge khi ở chế độ local (không có khái niệm "mất kết nối").
  if ((Storage.mode === "local-server" || Storage.mode === "gsheet" || Storage.mode === "supabase") && isAdminOrNoAuth) {
    badge.textContent = "Database";
    badge.className = "badge error";
    badge.title = "Mất kết nối database: " + storageErrorMessage(err);
    // Vẫn giữ link Sheet/Dashboard (nếu có) ngay cả khi mất kết nối — admin thường sẽ
    // CẦN mở thẳng Sheet/Dashboard lúc này để xem trực tiếp chuyện gì đang xảy ra.
    applyDatabaseBadgeLink(badge);
  }
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

function setupAutoSyncUI() {
  const badge = $("syncStatusBadge");
  const text = $("syncStatusText");
  if (!badge || !text) return;

  function renderStatus(st) {
    if (Storage.mode === "local") {
      badge.classList.add("hidden");
      return;
    }
    badge.classList.remove("hidden");
    badge.className = "badge sync-badge";

    if (st.syncing) {
      badge.classList.add("syncing");
      text.textContent = "Đang đồng bộ";
      badge.title = st.pendingCount > 0 ? `Đang đồng bộ ${st.pendingCount} mục lên máy chủ...` : "Đang đồng bộ";
    } else if (!st.online) {
      badge.classList.add("offline");
      text.textContent = st.pendingCount > 0
        ? `Chạy offline, tự đồng bộ khi có mạng (${st.pendingCount})`
        : "Chạy offline, tự đồng bộ khi có mạng";
      badge.title = "Chạy offline, tự đồng bộ khi có mạng";
    } else if (st.pendingCount > 0) {
      badge.classList.add("syncing");
      text.textContent = "Đang đồng bộ";
      badge.title = `Có ${st.pendingCount} mục chờ đồng bộ lên máy chủ. Bấm để đồng bộ ngay.`;
    } else {
      badge.classList.add("online");
      text.textContent = "Đã đồng bộ";
      badge.title = "Đã kết nối máy chủ và đồng bộ toàn bộ dữ liệu mới nhất.";
    }
  }

  Storage.onSyncStatusChange(renderStatus);

  if (typeof navigator !== "undefined" && !navigator.onLine && Storage.mode !== "local") {
    showToast("Chạy offline, tự đồng bộ khi có mạng", "warning");
  }

  badge.addEventListener("click", async () => {
    const st = Storage.getSyncStatus();
    if (!st.online) {
      showToast("Chạy offline, tự đồng bộ khi có mạng", "warning");
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
    } else {
      showToast("Toàn bộ dữ liệu đã được đồng bộ với máy chủ.", "success");
    }
  });

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
