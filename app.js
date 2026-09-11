/* app.js — glue logic: UI events, kết nối dga-logic.js + storage.js */

(function () {
  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------------------
  // Danh mục Trạm mặc định (MaTram/TenTram) — chỉ dùng để "gieo" (seed) 1 lần
  // duy nhất vào Storage.listStations() nếu danh mục đang trống. Sau đó danh
  // mục được quản lý hoàn toàn qua Storage (thêm trạm mới khi người dùng gõ
  // tay 1 trạm chưa có), không đọc lại mảng này nữa.
  // ---------------------------------------------------------------------
  const SEED_STATIONS = [
    ["TBA-01", "TBA 500kV Pleiku"],
    ["TBA-02", "TBA 500kV Pleiku 2"],
    ["TBA-03", "TBA 220kV Chư Sê"],
    ["TBA-04", "TBA 220kV An Khê"],
    ["TBA-05", "TBA 220kV KrôngBuk"],
    ["TBA-06", "TBA 220kV Krông Ana"],
    ["TBA-07", "XT273 NMTĐ Srêpốk 4"],
    ["TBA-08", "TBA 220kV Quy Nhơn"],
    ["TBA-09", "TBA 220kV Phước An"],
    ["TBA-10", "TBA 220kV Phù Mỹ"],
    ["TBA-11", "TBA 220kV Tuy Hòa"],
    ["TBA-12", "TBA 220kV Nha Trang"],
    ["TBA-13", "TBA 500kV Vân Phong"],
    ["TBA-14", "TBA 220kV Vân Phong"],
    ["TBA-15", "TBA 220kV Cam Ranh"],
    ["TBA-16", "TBA 500kV Đắk Nông"],
    ["TBA-17", "TBA 220kV Đắk Nông"],
    ["TBA-18", "TBA 500kV Di Linh"],
    ["TBA-19", "TBA 220kV Bảo Lộc"],
    ["TBA-20", "TBA 220kV Đức Trọng"],
    ["TBA-21", "TBA 500kV Vĩnh Tân"],
    ["TBA-22", "TBA 220kV Phan Thiết"],
    ["TBA-23", "TBA 220kV Hàm Tân"],
    ["TBA-24", "TBA 220kV Phan Rí"],
    ["TBA-25", "TBA 220kV Vĩnh Hảo"],
    ["TBA-26", "TBA 500kV Thuận Nam"],
    ["TBA-27", "TBA 220kV Tháp Chàm"],
    ["TBA-28", "TBA 220kV Ninh Phước"],
    ["TBA-29", "TBA 220kV Phước Thái"],
  ].map(([ma_tram, ten_tram]) => ({ ma_tram, ten_tram }));

  // ---------------------------------------------------------------------
  // Đăng nhập / phân quyền — chỉ có tác dụng khi Auth.enabled (chế độ Google
  // Sheets, xem storage.js). Ở chế độ Supabase/localStorage, mọi hàm bên dưới
  // đều trả về true — hành vi y hệt bản trước khi có đăng nhập.
  //
  // canWrite(): CHỈ Admin — dùng cho Tiêu chuẩn/Trạm/Quản trị user, và cho nút
  // "Xóa" của Đo khí/Dầu MBA/Dầu OLTC (xóa luôn là đặc quyền Admin).
  //
  // canSaveEntry(): mọi user ĐÃ ĐĂNG NHẬP (không cần Admin) — dùng để cho phép
  // Đo khí/Dầu MBA/Dầu OLTC được TỰ NHẬP bản ghi mới. Trong thực tế luôn true
  // một khi đã vào được giao diện chính (màn hình đăng nhập chặn từ trước),
  // giữ lại hàm riêng để rõ ý định và phòng hờ.
  //
  // canEditRecord(rec): Admin sửa được mọi bản ghi; user thường chỉ sửa được
  // bản ghi do CHÍNH MÌNH nhập (so theo rec.created_by — xem prepareOwnedRecord()
  // ở Code.gs, đây chỉ là gợi ý hiển thị nút "Sửa"; quyền thật được kiểm tra lại
  // ở server, không tin tưởng tuyệt đối phía client).
  // ---------------------------------------------------------------------
  function canWrite() {
    return !Auth.enabled || Auth.isAdmin();
  }

  function currentUserEmail() {
    return (Auth.current && Auth.current.email) || null;
  }

  function isOwnRecord(rec) {
    const email = currentUserEmail();
    return !!(email && rec && rec.created_by && String(rec.created_by).trim().toLowerCase() === email.trim().toLowerCase());
  }

  function canSaveEntry() {
    return !Auth.enabled || !!Auth.current;
  }

  function canEditRecord(rec) {
    return !Auth.enabled || Auth.isAdmin() || isOwnRecord(rec);
  }

  /** Chuỗi ngắn hiển thị "Người nhập" trong bảng lịch sử — email người tạo bản ghi,
   *  kèm tooltip cho biết ai/lúc nào sửa lần cuối nếu có. Bản ghi cũ (trước khi có
   *  tính năng lưu vết) không có created_by → hiển thị "—". */
  function ownerCellHtml(rec) {
    if (!rec.created_by) return `<span class="pill muted" title="Bản ghi cũ, chưa có dữ liệu người nhập">—</span>`;
    const editedLater = rec.updated_by && rec.updated_at && rec.updated_by !== rec.created_by;
    const title = editedLater
      ? `Sửa lần cuối bởi ${rec.updated_by} lúc ${new Date(rec.updated_at).toLocaleString("vi-VN")}`
      : `Nhập lúc ${rec.created_at ? new Date(rec.created_at).toLocaleString("vi-VN") : ""}`;
    return `<span style="font-size:12px;" title="${escapeHtml(title)}">${escapeHtml(rec.created_by)}${editedLater ? " ✎" : ""}</span>`;
  }

  async function init() {
    setupAuthForms();

    if (!Auth.enabled) {
      $("authOverlay").classList.add("hidden");
      await initApp();
      return;
    }

    Auth.loadSaved();
    const session = await Auth.refresh();
    if (session) {
      $("authOverlay").classList.add("hidden");
      await initApp();
    } else {
      $("authOverlay").classList.remove("hidden");
      initGoogleSignIn();
    }
  }

  function setupAuthForms() {
    $("linkShowRegister").addEventListener("click", (e) => {
      e.preventDefault();
      $("authLoginForm").classList.add("hidden");
      $("authRegisterForm").classList.remove("hidden");
    });
    $("linkShowLogin").addEventListener("click", (e) => {
      e.preventDefault();
      $("authRegisterForm").classList.add("hidden");
      $("authLoginForm").classList.remove("hidden");
    });

    $("btnAuthLogin").addEventListener("click", async () => {
      const email = $("auth_login_email").value.trim();
      const password = $("auth_login_password").value;
      const errEl = $("authLoginError");
      errEl.classList.add("hidden");
      if (!email || !password) {
        errEl.textContent = "Vui lòng nhập email và mật khẩu.";
        errEl.classList.remove("hidden");
        return;
      }
      setAuthLoading(true, "Đang đăng nhập...");
      try {
        await Auth.login(email, password);
        setAuthLoading(false);
        $("authOverlay").classList.add("hidden");
        showToast("Đăng nhập thành công!");
        await initApp();
      } catch (err) {
        setAuthLoading(false);
        errEl.textContent = err.message || String(err);
        errEl.classList.remove("hidden");
      }
    });

    $("btnAuthRegister").addEventListener("click", async () => {
      const email = $("auth_register_email").value.trim();
      const password = $("auth_register_password").value;
      const errEl = $("authRegisterError");
      errEl.classList.add("hidden");
      if (!email || !password) {
        errEl.textContent = "Vui lòng nhập email và mật khẩu.";
        errEl.classList.remove("hidden");
        return;
      }
      setAuthLoading(true, "Đang đăng ký...");
      try {
        await Auth.register(email, password);
        setAuthLoading(false);
        $("authOverlay").classList.add("hidden");
        showToast("Đăng ký thành công!");
        await initApp();
      } catch (err) {
        setAuthLoading(false);
        errEl.textContent = err.message || String(err);
        errEl.classList.remove("hidden");
      }
    });

    $("btnLogout").addEventListener("click", async () => {
      await Auth.logout();
      // Tải lại trang cho gọn — reset toàn bộ state trong bộ nhớ (danh sách đã
      // nạp, form đang nhập dở...) và quay lại đúng luồng init() từ đầu.
      location.reload();
    });
  }

  // ---------------------------------------------------------------------
  // Đăng nhập bằng Google (Google Identity Services) — tùy chọn, chỉ hiện khi
  // config.js có GOOGLE_CLIENT_ID và thư viện GIS tải thành công. Không ảnh hưởng
  // gì đến luồng đăng nhập email/mật khẩu hiện có nếu chưa cấu hình.
  // ---------------------------------------------------------------------
  // initGoogleSignIn() có thể được gọi 2 LẦN theo 2 đường khác nhau, vì thẻ <script>
  // của GIS tải bất đồng bộ (async) nên KHÔNG đảm bảo tải xong trước khi init() ở
  // trên chạy tới initGoogleSignIn() lần đầu — đây là race condition thật sự, không
  // phải trường hợp hiếm (đã xác nhận qua console log thực tế: cảnh báo "Google
  // Identity Services chưa sẵn sàng" xuất hiện dù GOOGLE_CLIENT_ID đã cấu hình đúng).
  // Nên ngoài lần gọi ở init(), app.js còn đăng ký window.onGoogleLibraryLoad — GIS
  // tự động gọi hàm toàn cục này khi thư viện thật sự sẵn sàng, bất kể thứ tự tải.
  // Cờ googleSignInInitialized để không khởi tạo/renderButton 2 lần nếu cả 2 đường
  // đều thành công (vd: thư viện tải rất nhanh, kịp trước init()).
  let googleSignInInitialized = false;
  function initGoogleSignIn() {
    if (googleSignInInitialized) return;
    const clientId = window.DGA_CONFIG && window.DGA_CONFIG.GOOGLE_CLIENT_ID;
    if (!clientId) return; // chưa cấu hình -> giữ nguyên UI đăng nhập email/mật khẩu như cũ
    if (typeof google === "undefined" || !google.accounts || !google.accounts.id) {
      // Thư viện GIS chưa tải xong tại thời điểm này -> bỏ qua lần này, không chặn
      // đăng nhập email/mật khẩu; window.onGoogleLibraryLoad sẽ thử lại khi tải xong.
      console.warn("Google Identity Services chưa sẵn sàng ở lần gọi này — sẽ tự thử lại khi tải xong.");
      return;
    }
    try {
      google.accounts.id.initialize({ client_id: clientId, callback: onGoogleCredential });
      google.accounts.id.renderButton($("googleSignInBtn"), {
        theme: "outline", size: "large", text: "continue_with", width: 320, locale: "vi",
      });
      $("googleSignInWrap").classList.remove("hidden");
      googleSignInInitialized = true;
    } catch (err) {
      console.warn("Không khởi tạo được Đăng nhập Google:", err);
    }
  }

  // GIS tự động gọi window.onGoogleLibraryLoad ngay khi thư viện tải xong — đây là
  // cách chính thức của Google để xử lý đúng thứ tự tải bất đồng bộ (xem thẻ <script
  // async> trong index.html). Nếu người dùng đã đăng nhập xong trước khi hàm này
  // chạy, initGoogleSignIn() vẫn chạy an toàn (chỉ gắn nút vào overlay đang ẩn).
  window.onGoogleLibraryLoad = initGoogleSignIn;

  /** Callback của google.accounts.id — nhận credential (ID token JWT), gửi lên Apps
   *  Script để xác thực + tự động đăng ký/đăng nhập (xem actionGoogleLogin trong Code.gs). */
  async function onGoogleCredential(response) {
    const errEl = $("authLoginError");
    errEl.classList.add("hidden");
    setAuthLoading(true, "Đang xác thực với Google...");
    try {
      await Auth.loginWithGoogle(response.credential);
      setAuthLoading(false);
      $("authOverlay").classList.add("hidden");
      showToast("Đăng nhập thành công!");
      await initApp();
    } catch (err) {
      setAuthLoading(false);
      errEl.textContent = "Đăng nhập Google thất bại: " + ((err && err.message) || err);
      errEl.classList.remove("hidden");
    }
  }

  /** Hiện/ẩn spinner phủ lên thẻ đăng nhập trong lúc chờ server — cho người dùng biết
   *  thao tác đang được xử lý (đăng nhập/đăng ký/xác thực Google đều dùng chung). */
  function setAuthLoading(isLoading, message) {
    $("authLoadingOverlay").classList.toggle("hidden", !isLoading);
    if (message) $("authLoadingText").textContent = message;
    $("btnAuthLogin").disabled = isLoading;
    $("btnAuthRegister").disabled = isLoading;
  }

  /** Thông báo nổi góc trên bên phải, tự biến mất sau ~2.4s — dùng cho các mốc thao
   *  tác rõ ràng của người dùng (đăng nhập/đăng ký thành công), không dùng cho các
   *  bước tự động ngầm (vd: tự khôi phục phiên đăng nhập đã lưu khi tải lại trang). */
  function showToast(message, type) {
    const container = $("toastContainer");
    if (!container) return;
    const el = document.createElement("div");
    el.className = "toast " + (type || "success");
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add("fade-out");
      setTimeout(() => el.remove(), 320);
    }, 2400);
  }

  // ---------------------------------------------------------------------
  // Khởi động app THẬT SỰ — chỉ gọi sau khi đã xác định được quyền truy cập
  // (Auth tắt, hoặc đã đăng nhập thành công). Hiện trạng thái lưu trữ, nạp
  // danh sách tiêu chuẩn & lịch sử, khóa các nút Lưu/Sửa/Xóa nếu không phải Admin.
  // ---------------------------------------------------------------------
  async function initApp() {
    if (Auth.enabled && Auth.current) {
      const roleLabel = Auth.current.role === "admin" ? "Admin" : "User";
      $("userBadge").textContent = `${Auth.current.email} — ${roleLabel}`;
      $("userBadge").classList.remove("hidden");
      $("btnLogout").classList.remove("hidden");
      $("navQuanTri").classList.toggle("hidden", Auth.current.role !== "admin");
    }

    const badge = $("storageBadge");
    const footerInfo = $("footerStorageInfo");
    if (Storage.mode === "gsheet") {
      badge.textContent = "Đã kết nối database";
      badge.className = "badge supabase";
      footerInfo.textContent = "lưu trên database dùng chung (nhiều máy cùng truy cập)";
    } else if (Storage.mode === "supabase") {
      badge.textContent = "Đã kết nối database";
      badge.className = "badge supabase";
      footerInfo.textContent = "lưu trên database dùng chung (nhiều máy cùng truy cập)";
    } else {
      badge.textContent = "Chế độ thử nghiệm (chỉ lưu trên trình duyệt này)";
      badge.className = "badge local";
      footerInfo.textContent = "lưu trong localStorage của trình duyệt này — điền config.js để dùng database dùng chung";
    }

    setupTabs();
    setupHandbookLightbox();
    setupMindmap();
    $("f_ngay").value = new Date().toISOString().slice(0, 10);
    $("o_ngay").value = new Date().toISOString().slice(0, 10);
    $("ot_ngay").value = new Date().toISOString().slice(0, 10);
    populateOilVoltageClasses();
    toggleOilMembraneField();
    populateOltcOptions();
    toggleOltcPhaseField();
    toggleOltcMembraneField();

    // Danh mục Trạm được cô lập trong try/catch RIÊNG — nếu backend chưa deploy
    // hỗ trợ Trạm (vd: Apps Script chưa deploy bản mới, hoặc bảng "stations" chưa
    // tạo trong Supabase), lỗi ở đây KHÔNG được để chặn phần Tiêu chuẩn/Lịch sử
    // đo bên dưới — 2 phần đó độc lập với danh mục Trạm.
    try {
      await seedStationsIfNeeded();
      await refreshStationsUI();
    } catch (err) {
      console.warn("Không tải được danh mục Trạm:", err);
    }

    try {
      await refreshStandardsUI();
      await refreshHistoryUI();
    } catch (err) {
      alert(storageErrorMessage(err));
    }

    // Tab "Dầu cách điện" — cô lập trong try/catch RIÊNG (giống danh mục Trạm):
    // nếu backend chưa deploy hỗ trợ oil_tests (Apps Script chưa deploy bản mới,
    // hoặc bảng "oil_tests" chưa tạo trong Supabase), lỗi ở đây KHÔNG được chặn
    // các tab khác đã tải xong ở trên.
    try {
      await refreshOilTestsUI();
    } catch (err) {
      console.warn("Không tải được lịch sử thí nghiệm dầu:", err);
    }

    // Dầu OLTC — cô lập trong try/catch RIÊNG, y hệt lý do ở dầu chính MBA: sheet
    // "oltc_oil_tests" là MỚI, backend có thể chưa deploy/tạo bảng kịp.
    try {
      await refreshOltcOilTestsUI();
    } catch (err) {
      console.warn("Không tải được lịch sử thí nghiệm dầu OLTC:", err);
    }

    // Tab "Quản trị" (quản lý user) — cô lập trong try/catch riêng, chỉ Admin mới
    // gọi tới vì listUsers() bị Apps Script chặn với user thường (requireAdmin).
    if (Auth.enabled && Auth.isAdmin()) {
      try {
        await refreshUsersUI();
      } catch (err) {
        console.warn("Không tải được danh sách user:", err);
      }
    }

    // Khóa nút Lưu tiêu chuẩn với user không có quyền ghi (User thường khi đã bật
    // đăng nhập). Nút Xóa ở bảng Lịch sử/Tiêu chuẩn được ẩn ngay khi render dòng
    // (xem refreshHistoryUI/refreshStandardsUI) nên không cần xử lý thêm ở đây.
    $("btnSaveStandard").disabled = !canWrite();
    $("btnSaveStandard").title = canWrite() ? "" : "Chỉ Admin mới lưu được tiêu chuẩn.";

    setupCombo({
      input: $("o_tram"),
      toggleBtn: $("o_tram_toggle"),
      listEl: $("o_tram_list"),
      getOptions: () =>
        _allStations
          .slice()
          .sort((a, b) => (a.ten_tram || "").localeCompare(b.ten_tram || "", "vi"))
          .map((s) => ({ value: s.ten_tram, label: (s.ma_tram ? s.ma_tram + " — " : "") + s.ten_tram })),
    });
    // Ô "Thiết bị" ở tab Dầu cách điện gợi ý từ cả lần đo DGA lẫn thí nghiệm dầu đã
    // lưu trước đó (cùng 1 MBA có thể vừa có lịch sử đo khí, vừa có lịch sử dầu).
    setupCombo({
      input: $("o_thietbi"),
      toggleBtn: $("o_thietbi_toggle"),
      listEl: $("o_thietbi_list"),
      getOptions: () => {
        const byName = new Map();
        _allMeasurements.forEach((r) => {
          const name = (r.thiet_bi || "").trim();
          if (!name || byName.has(name)) return;
          byName.set(name, r.tram || "");
        });
        _allOilTests.forEach((r) => {
          const name = (r.thiet_bi || "").trim();
          if (!name || byName.has(name)) return;
          byName.set(name, r.tram || "");
        });
        return Array.from(byName.entries())
          .sort((a, b) => a[0].localeCompare(b[0], "vi"))
          .map(([name, tram]) => ({ value: name, label: tram ? `${name} — ${tram}` : name }));
      },
    });

    setupCombo({
      input: $("f_tram"),
      toggleBtn: $("f_tram_toggle"),
      listEl: $("f_tram_list"),
      getOptions: () =>
        _allStations
          .slice()
          .sort((a, b) => (a.ten_tram || "").localeCompare(b.ten_tram || "", "vi"))
          .map((s) => ({ value: s.ten_tram, label: (s.ma_tram ? s.ma_tram + " — " : "") + s.ten_tram })),
    });
    setupCombo({
      input: $("s_manufacturer"),
      toggleBtn: $("s_manufacturer_toggle"),
      listEl: $("s_manufacturer_list"),
      getOptions: () => {
        const names = Array.from(new Set(_allStandards.map((s) => s.manufacturer).filter(Boolean)));
        names.sort((a, b) => a.localeCompare(b, "vi"));
        return names.map((n) => ({ value: n, label: n }));
      },
    });
    // Ô "Thiết bị" chưa có danh mục riêng như Trạm — gợi ý được lấy từ các thiết bị
    // đã từng nhập trong lịch sử đo (_allMeasurements), không bắt buộc chọn từ đó.
    setupCombo({
      input: $("f_thietbi"),
      toggleBtn: $("f_thietbi_toggle"),
      listEl: $("f_thietbi_list"),
      getOptions: () => {
        const byName = new Map();
        _allMeasurements.forEach((r) => {
          const name = (r.thiet_bi || "").trim();
          if (!name || byName.has(name)) return;
          byName.set(name, r.tram || "");
        });
        return Array.from(byName.entries())
          .sort((a, b) => a[0].localeCompare(b[0], "vi"))
          .map(([name, tram]) => ({ value: name, label: tram ? `${name} — ${tram}` : name }));
      },
    });

    setupCombo({
      input: $("ot_tram"),
      toggleBtn: $("ot_tram_toggle"),
      listEl: $("ot_tram_list"),
      getOptions: () =>
        _allStations
          .slice()
          .sort((a, b) => (a.ten_tram || "").localeCompare(b.ten_tram || "", "vi"))
          .map((s) => ({ value: s.ten_tram, label: (s.ma_tram ? s.ma_tram + " — " : "") + s.ten_tram })),
    });
    // Ô "Thiết bị" ở dầu OLTC gợi ý từ cả lịch sử đo DGA, dầu chính MBA lẫn dầu OLTC
    // đã lưu trước đó (cùng 1 MBA có thể xuất hiện ở cả 3 nơi).
    setupCombo({
      input: $("ot_thietbi"),
      toggleBtn: $("ot_thietbi_toggle"),
      listEl: $("ot_thietbi_list"),
      getOptions: () => {
        const byName = new Map();
        _allMeasurements.forEach((r) => {
          const name = (r.thiet_bi || "").trim();
          if (!name || byName.has(name)) return;
          byName.set(name, r.tram || "");
        });
        _allOilTests.forEach((r) => {
          const name = (r.thiet_bi || "").trim();
          if (!name || byName.has(name)) return;
          byName.set(name, r.tram || "");
        });
        _allOltcOilTests.forEach((r) => {
          const name = (r.thiet_bi || "").trim();
          if (!name || byName.has(name)) return;
          byName.set(name, r.tram || "");
        });
        return Array.from(byName.entries())
          .sort((a, b) => a[0].localeCompare(b[0], "vi"))
          .map(([name, tram]) => ({ value: name, label: tram ? `${name} — ${tram}` : name }));
      },
    });

    $("btnAnalyze").addEventListener("click", onAnalyze);
    $("btnClearForm").addEventListener("click", clearForm);
    $("btnCancelEditMeasurement").addEventListener("click", clearForm);
    $("btnAnalyzeOil").addEventListener("click", onAnalyzeOil);
    $("btnClearOilForm").addEventListener("click", clearOilForm);
    $("btnCancelEditOilTest").addEventListener("click", clearOilForm);
    $("o_voltage_class").addEventListener("change", toggleOilMembraneField);
    $("btnAnalyzeOltcOil").addEventListener("click", onAnalyzeOltcOil);
    $("btnClearOltcOilForm").addEventListener("click", clearOltcOilForm);
    $("btnCancelEditOltcOilTest").addEventListener("click", clearOltcOilForm);
    $("ot_voltage_class").addEventListener("change", toggleOltcMembraneField);
    $("ot_samplepoint").addEventListener("change", toggleOltcPhaseField);
    $("btnSaveStandard").addEventListener("click", onSaveStandard);
    $("btnCancelEditStandard").addEventListener("click", resetStandardForm);
    $("s_standard_type").addEventListener("change", toggleStandardTypeFields);
    $("historyFilter").addEventListener("input", () => refreshHistoryUI());
    $("f_loai").addEventListener("change", () => { refreshManufacturerOptions(); toggleMbaSubtypeField(); });
    $("cmp_device").addEventListener("change", refreshCompareMeasurementOptions);
    $("btnCompareRate").addEventListener("click", onCompareRate);
    $("tr_device").addEventListener("change", onTrendDeviceChange);
    toggleMbaSubtypeField();
    toggleStandardTypeFields();
    drawDuvalTriangleBase();
  }

  // ---------------------------------------------------------------------
  // Combo box tự viết: ô nhập text + nút ▼ + danh sách gợi ý (thay <datalist>
  // gốc — <datalist> của trình duyệt không tìm bỏ dấu tiếng Việt được và giới
  // hạn số dòng hiển thị). Vẫn cho gõ tự do bất kỳ giá trị nào không có trong
  // danh sách (không ép buộc phải chọn 1 mục có sẵn).
  // ---------------------------------------------------------------------
  function normalizeSearch(s) {
    return (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // bỏ các dấu thanh/dấu phụ đã tách rời sau NFD
      .replace(/đ|Đ/g, "d") // "đ"/"Đ" không tách bằng NFD nên thay thủ công
      .toLowerCase()
      .trim();
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
    // mousedown (không phải click) để chọn được TRƯỚC khi input mất focus (blur
    // sẽ đóng danh sách trước khi sự kiện click kịp bắn nếu dùng "click").
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

  function toggleMbaSubtypeField() {
    const isMba = $("f_loai").value === DGA.EQUIPMENT_TYPES.MBA;
    $("f_mbasubtype_wrap").classList.toggle("hidden", !isMba);
  }

  function setupTabs() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
        btn.classList.add("active");
        $("tab-" + btn.dataset.tab).classList.remove("hidden");
      });
    });
  }

  /** Lightbox phóng to ảnh "Cẩm nang tham khảo nhanh" (tab "Quy trình đánh giá") —
   *  bấm ảnh thu nhỏ để mở, bấm nút đóng/ra ngoài ảnh/phím Esc để đóng. */
  function setupHandbookLightbox() {
    const thumb = $("btnOpenHandbook");
    const lightbox = $("handbookLightbox");
    const closeBtn = $("btnCloseHandbook");
    if (!thumb || !lightbox || !closeBtn) return;
    const open = () => {
      lightbox.classList.remove("hidden");
      document.body.style.overflow = "hidden";
    };
    const close = () => {
      lightbox.classList.add("hidden");
      document.body.style.overflow = "";
    };
    thumb.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !lightbox.classList.contains("hidden")) close();
    });
  }

  /** Sơ đồ tư duy diễn giải DGA (tab "Quy trình đánh giá") — các nhánh dùng thẻ
   *  <details>/<summary> gốc nên tự có hành vi bấm-để-mở/đóng, không cần JS.
   *  Hàm này chỉ nối 2 nút tiện ích "Mở tất cả" / "Thu gọn tất cả". */
  function setupMindmap() {
    const root = $("mindmapRoot");
    const btnExpand = $("btnMindmapExpandAll");
    const btnCollapse = $("btnMindmapCollapseAll");
    if (!root) return;
    const allNodes = () => root.querySelectorAll("details.mm-node");
    if (btnExpand) {
      btnExpand.addEventListener("click", () => {
        allNodes().forEach((d) => (d.open = true));
      });
    }
    if (btnCollapse) {
      btnCollapse.addEventListener("click", () => {
        allNodes().forEach((d) => (d.open = false));
      });
    }
  }

  // _editingMeasurementId: id của lần đo đang SỬA (null = đang nhập MỚI). Cùng cơ chế
  // với _editingStandardId (xem onEditStandard/resetStandardForm bên dưới).
  let _editingMeasurementId = null;

  function clearForm() {
    ["f_tram", "f_thietbi", "f_ghichu"].forEach((id) => ($(id).value = ""));
    DGA.GASES.forEach((g) => ($("g_" + g).value = ""));
    $("f_landocount").value = 1;
    $("resultsPanel").classList.add("hidden");
    resetMeasurementEditState();
  }

  function resetMeasurementEditState() {
    _editingMeasurementId = null;
    $("editingMeasurementNote").classList.add("hidden");
    $("btnCancelEditMeasurement").classList.add("hidden");
    $("btnAnalyze").textContent = "Phân tích & Lưu";
  }

  /** Nạp 1 lần đo đã lưu lên form tab "DGA" để sửa — bấm "Cập nhật & Lưu" sẽ
   *  ghi đè đúng bản ghi này (giữ nguyên id), thay vì tạo thêm 1 bản ghi mới. Chỉ gọi
   *  được khi canEditRecord(rec) đã xác nhận (nút "Sửa" chỉ hiện khi đủ quyền) — server
   *  (Code.gs) vẫn kiểm tra lại quyền này, đây chỉ là gợi ý hiển thị phía client. */
  function onEditMeasurement(rec) {
    if (!canEditRecord(rec)) return;
    _editingMeasurementId = rec.id;
    $("f_tram").value = rec.tram || "";
    $("f_thietbi").value = rec.thiet_bi || "";
    $("f_loai").value = rec.equipment_type || "";
    refreshManufacturerOptions();
    toggleMbaSubtypeField();
    $("f_mbasubtype").value = rec.mba_subtype || "";
    $("f_nsx").value = rec.manufacturer || "";
    $("f_pha").value = rec.pha || "";
    $("f_landocount").value = rec.lan_do ?? 1;
    $("f_ngay").value = rec.sample_date || "";
    $("f_ghichu").value = rec.ghi_chu || "";
    const gasesRec = recordGases(rec);
    DGA.GASES.forEach((g) => { $("g_" + g).value = gasesRec[g] ?? ""; });
    $("editingMeasurementNote").classList.remove("hidden");
    $("btnCancelEditMeasurement").classList.remove("hidden");
    $("btnAnalyze").textContent = "Cập nhật & Lưu";
    document.querySelector('button.tab-btn[data-tab="nhap"]').click();
    $("f_tram").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ---------------------------------------------------------------------
  // Tam giác Duval — vẽ khung tam giác + đường phân vùng (theo bảng "Limits of
  // zones", Annex B, Figure B.3, IEC 60599:1999) và điểm chẩn đoán bằng SVG.
  // Hệ tọa độ: đỉnh CH4 ở trên (50, 0 khi lật trục y), C2H2 dưới-trái (0, H),
  // C2H4 dưới-phải (100, H), với H = 100*sqrt(3)/2 ≈ 86,6. viewBox lật trục y
  // (y_svg = H - y_toan_hoc) để đỉnh CH4 hiển thị ở trên.
  // ---------------------------------------------------------------------
  function duvalToSvgY(y) { return 86.602540378 - y; }

  function duvalEdgePoint(pct) {
    const h = 86.602540378;
    const x = (pct.pctCH4 / 100) * 50 + (pct.pctC2H4 / 100) * 100;
    const y = (pct.pctCH4 / 100) * h;
    return { x, y: duvalToSvgY(y) };
  }

  function drawDuvalTriangleBase() {
    const svg = $("duvalSvg");
    if (!svg) return;
    const h = 86.602540378;
    let s = "";

    // Viền tam giác chính
    s += `<polygon class="duval-tri-line" points="0,${h} 100,${h} 50,0" />`;

    // Lưới phần trăm (10% một nấc) song song 3 cạnh — chỉ vẽ nhẹ để tham khảo
    for (let k = 10; k < 100; k += 10) {
      // đường song song cạnh đáy (ứng với %CH4 = k)
      const y = duvalToSvgY((k / 100) * h);
      const xL = (k / 100) * 50;
      const xR = 100 - (k / 100) * 50;
      s += `<line class="duval-grid-line" x1="${xL}" y1="${y}" x2="${xR}" y2="${y}" />`;
    }

    // Đường phân vùng chính theo bảng "Limits of zones" gốc (Annex B, Figure B.3):
    const P = (m, e, a) => duvalEdgePoint({ pctCH4: m, pctC2H4: e, pctC2H2: a });
    const zoneLines = [
      // PD: %CH4 = 98 (đường song song đáy gần đỉnh)
      [P(98, 2, 0), P(98, 0, 2)],
      // T1/T2 biên trên C2H2=4: đoạn từ C2H4=0..~96
      [P(96, 0, 4), P(46, 50, 4)],
      // T1/T2 biên C2H4=10 (trong dải C2H2<=4)
      [P(90, 10, 0), P(86, 10, 4)],
      // T2/T3 biên C2H4=50 (trong dải C2H2<=4)
      [P(50, 50, 0), P(46, 50, 4)],
      // D1/D2 biên C2H4=23 (trong dải C2H2>=13)
      [P(64, 23, 13), P(0, 23, 77)],
      // D1/T1 & D2 biên C2H2=13
      [P(64, 23, 13), P(87, 0, 13)],
      // D2/T3(vùng cao C2H4) biên C2H4=38 (trong dải C2H2>=13)
      [P(49, 38, 13), P(0, 38, 62)],
    ];
    zoneLines.forEach(([a, b]) => {
      s += `<line class="duval-zone-line" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`;
    });

    // Nhãn đỉnh
    s += `<text class="duval-label" x="50" y="-2" text-anchor="middle">CH4</text>`;
    s += `<text class="duval-label" x="-2" y="${h + 4}" text-anchor="start">C2H2</text>`;
    s += `<text class="duval-label" x="102" y="${h + 4}" text-anchor="end">C2H4</text>`;
    s += `<text class="duval-label" x="50" y="${h * 0.35}" text-anchor="middle">D1</text>`;
    s += `<text class="duval-label" x="30" y="${h * 0.6}" text-anchor="middle">D2</text>`;
    s += `<text class="duval-label" x="70" y="${h * 0.85}" text-anchor="middle">T3</text>`;
    s += `<text class="duval-label" x="35" y="${h * 0.92}" text-anchor="middle">T2</text>`;
    s += `<text class="duval-label" x="15" y="${h * 0.97}" text-anchor="middle">T1</text>`;

    svg.innerHTML = s;
  }

  function drawDuvalPoint(xyMath) {
    const svg = $("duvalSvg");
    if (!svg) return;
    const pt = { x: xyMath.x, y: duvalToSvgY(xyMath.y) };
    svg.innerHTML += `<circle class="duval-point" cx="${pt.x}" cy="${pt.y}" r="2.2" />`;
  }

  // ---------------------------------------------------------------------
  // Danh mục Trạm — ô "Trạm" dùng combo box tự viết (xem setupCombo ở trên)
  // để vừa gõ-tìm (bỏ dấu), vừa chọn từ danh sách gợi ý qua nút ▼, vừa nhập
  // tự do 1 trạm chưa có trong danh mục (không bắt buộc phải khớp 1 mục nào).
  // ---------------------------------------------------------------------
  let _allStations = [];

  async function seedStationsIfNeeded() {
    const existing = await Storage.listStations();
    if (existing && existing.length > 0) return;
    for (const s of SEED_STATIONS) {
      try {
        await Storage.saveStation(s);
      } catch (err) {
        console.warn("Seed station thất bại:", s, err);
      }
    }
  }

  async function refreshStationsUI() {
    _allStations = await Storage.listStations();
  }

  // Nếu người dùng gõ tay 1 tên trạm chưa có trong danh mục, tự động thêm vào
  // danh mục để lần sau xuất hiện như 1 gợi ý — không yêu cầu điền Mã trạm.
  async function registerStationIfNew(tenTram) {
    const name = (tenTram || "").trim();
    if (!name) return;
    const already = _allStations.some((s) => (s.ten_tram || "").trim().toLowerCase() === name.toLowerCase());
    if (already) return;
    try {
      await Storage.saveStation({ ma_tram: "", ten_tram: name });
      await refreshStationsUI();
    } catch (err) {
      console.warn("Không thể tự thêm trạm mới vào danh mục:", err);
    }
  }

  // ---------------------------------------------------------------------
  // Nhà sản xuất: nạp dropdown theo loại thiết bị đang chọn
  // ---------------------------------------------------------------------
  let _allStandards = [];

  async function refreshManufacturerOptions() {
    const sel = $("f_nsx");
    const loai = $("f_loai").value;
    const options = _allStandards.filter(
      (s) => (s.equipment_type === loai || s.equipmentType === loai) && !isOilStandardRecord(s)
    );
    sel.innerHTML = '<option value="">— Không có / dùng QĐ1901 —</option>';
    options.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.manufacturer;
      opt.textContent = s.manufacturer;
      sel.appendChild(opt);
    });
  }

  // Dropdown "Nhà sản xuất" ở tab Dầu cách điện — chỉ liệt kê NSX có tiêu chuẩn
  // DẦU (standard_type = "dau"), không lẫn với tiêu chuẩn khí ở trên. Dùng chung
  // cho cả dầu chính MBA (#o_nsx) và dầu OLTC (#ot_nsx — chỉ áp dụng khi Dầu mới,
  // xem evaluateOltcOilTest(): "vận hành" luôn dùng Bảng 49, không có ưu tiên NSX).
  function refreshOilManufacturerOptions() {
    const names = Array.from(new Set(_allStandards.filter(isOilStandardRecord).map((s) => s.manufacturer).filter(Boolean)));
    names.sort((a, b) => a.localeCompare(b, "vi"));
    ["o_nsx", "ot_nsx"].forEach((id) => {
      const sel = $(id);
      if (!sel) return;
      const currentVal = sel.value;
      sel.innerHTML = '<option value="">— Không có / dùng QĐ1901 —</option>';
      names.forEach((n) => {
        const opt = document.createElement("option");
        opt.value = n;
        opt.textContent = n;
        sel.appendChild(opt);
      });
      if (names.includes(currentVal)) sel.value = currentVal;
    });
  }

  function standardRecordToLimits(rec) {
    return {
      H2: rec.h2 ?? rec.H2, CH4: rec.ch4 ?? rec.CH4, C2H6: rec.c2h6 ?? rec.C2H6,
      C2H4: rec.c2h4 ?? rec.C2H4, C2H2: rec.c2h2 ?? rec.C2H2, CO: rec.co ?? rec.CO, CO2: rec.co2 ?? rec.CO2,
    };
  }

  // Ngưỡng LOẠI BỎ (condemning) — độc lập với ngưỡng tuyệt đối ở trên, không bắt buộc
  // đủ 7 khí. Trả về null nếu nhà sản xuất chưa cấu hình khí nào.
  function standardRecordToCondemning(rec) {
    const out = {};
    let any = false;
    DGA.GASES.forEach((g) => {
      const v = rec["loaibo_" + g.toLowerCase()] ?? rec["loaibo_" + g];
      if (v !== undefined && v !== null && v !== "") {
        out[g] = Number(v);
        any = true;
      }
    });
    return any ? out : null;
  }

  // Chuẩn hóa 1 bản ghi lần đo (từ Storage) về object khí viết HOA (H2, CH4, ...),
  // chấp nhận cả 2 kiểu chữ hoa/thường tùy backend đã lưu.
  function recordGases(rec) {
    return {
      H2: rec.H2 ?? rec.h2, CH4: rec.CH4 ?? rec.ch4, C2H6: rec.C2H6 ?? rec.c2h6,
      C2H4: rec.C2H4 ?? rec.c2h4, C2H2: rec.C2H2 ?? rec.c2h2, CO: rec.CO ?? rec.co, CO2: rec.CO2 ?? rec.co2,
    };
  }

  function standardRecordToRate(rec) {
    const pairs = [
      ["H2", "rate_h2_lo", "rate_h2_hi"], ["CH4", "rate_ch4_lo", "rate_ch4_hi"],
      ["C2H6", "rate_c2h6_lo", "rate_c2h6_hi"], ["C2H4", "rate_c2h4_lo", "rate_c2h4_hi"],
      ["C2H2", "rate_c2h2_lo", "rate_c2h2_hi"], ["CO", "rate_co_lo", "rate_co_hi"],
      ["CO2", "rate_co2_lo", "rate_co2_hi"],
    ];
    const rate = {};
    let any = false;
    pairs.forEach(([gas, loKey, hiKey]) => {
      if (rec[loKey] !== undefined && rec[loKey] !== null && rec[hiKey] !== undefined && rec[hiKey] !== null) {
        rate[gas] = [Number(rec[loKey]), Number(rec[hiKey])];
        any = true;
      }
    });
    return any ? rate : null;
  }

  // "Loại tiêu chuẩn" — record cũ (lưu từ trước khi có tính năng này) không có
  // standard_type, coi như "khi" để tương thích ngược.
  function isOilStandardRecord(rec) {
    return rec.standard_type === "dau";
  }
  function isGasStandardRecord(rec) {
    return !isOilStandardRecord(rec);
  }

  function toManufacturerStandardsForLogic(list) {
    return list.filter(isGasStandardRecord).map((rec) => ({
      manufacturer: rec.manufacturer,
      equipmentType: rec.equipment_type || rec.equipmentType,
      source: rec.source,
      limits: standardRecordToLimits(rec),
      rate: standardRecordToRate(rec),
      condemning: standardRecordToCondemning(rec),
    }));
  }

  // Tiêu chuẩn dầu NSX (dùng cho DGA.evaluateOilTest ở tab "Dầu cách điện") — mỗi
  // bản ghi ứng với 1 tổ hợp (manufacturer, cấp điện áp, trạng thái dầu) cụ thể.
  function toOilStandardsForLogic(list) {
    return list.filter(isOilStandardRecord).map((rec) => ({
      manufacturer: rec.manufacturer,
      voltageClass: rec.oil_voltage_class,
      oilState: rec.oil_state === "new" ? "new" : "inservice",
      moisture: rec.oil_moisture_ppm,
      tgd90: rec.oil_tgd_90c_percent,
      bdv: rec.oil_bdv_kv,
      source: rec.source,
    }));
  }

  function oilVoltageClassLabel(vc) {
    const found = DGA.OIL_VOLTAGE_CLASSES.find((c) => c.value === vc);
    return found ? found.label : vc || "—";
  }

  // id của tiêu chuẩn đang SỬA (null = đang ở chế độ "thêm mới"). Có id thì
  // Storage.saveStandard() sẽ GHI ĐÈ đúng dòng đó thay vì tạo dòng mới (xem
  // storage.js: saveStandard dùng record.id để upsert).
  let _editingStandardId = null;

  function toggleStandardTypeFields() {
    const isOil = $("s_standard_type").value === "dau";
    $("stdGasFields").classList.toggle("hidden", isOil);
    $("stdOilFields").classList.toggle("hidden", !isOil);
    $("s_equipmenttype_wrap").classList.toggle("hidden", isOil);
  }

  async function refreshStandardsUI() {
    _allStandards = await Storage.listStandards();
    refreshManufacturerOptions();
    refreshOilManufacturerOptions();

    const tbody = $("standardsTable");
    tbody.innerHTML = "";
    $("standardsEmpty").classList.toggle("hidden", _allStandards.length > 0);
    _allStandards.forEach((rec) => {
      const isOil = isOilStandardRecord(rec);
      let appliesTo, thresholdText;
      if (isOil) {
        appliesTo = `${oilVoltageClassLabel(rec.oil_voltage_class)} — ${rec.oil_state === "new" ? "Dầu mới" : "Dầu vận hành"}`;
        const parts = [];
        if (rec.oil_moisture_ppm !== undefined && rec.oil_moisture_ppm !== null && rec.oil_moisture_ppm !== "") parts.push(`Độ ẩm=${rec.oil_moisture_ppm}ppm`);
        if (rec.oil_tgd_90c_percent !== undefined && rec.oil_tgd_90c_percent !== null && rec.oil_tgd_90c_percent !== "") parts.push(`tgδ=${rec.oil_tgd_90c_percent}%`);
        if (rec.oil_bdv_kv !== undefined && rec.oil_bdv_kv !== null && rec.oil_bdv_kv !== "") parts.push(`BDV=${rec.oil_bdv_kv}kV`);
        thresholdText = parts.length > 0 ? parts.join(", ") : "—";
      } else {
        appliesTo = rec.equipment_type || rec.equipmentType;
        const limits = standardRecordToLimits(rec);
        const condemning = standardRecordToCondemning(rec);
        const condemningText = condemning
          ? " | Loại bỏ: " + DGA.GASES.filter((g) => condemning[g] !== undefined).map((g) => g + "=" + condemning[g]).join(", ")
          : "";
        thresholdText = DGA.GASES.map((g) => g + "=" + (limits[g] ?? "—")).join(", ") + condemningText;
      }
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHtml(rec.manufacturer)}</strong></td>
        <td>${isOil ? '<span class="pill muted">Dầu</span>' : '<span class="pill muted">Khí</span>'}</td>
        <td>${escapeHtml(appliesTo || "—")}</td>
        <td style="font-size:12px;">${escapeHtml(thresholdText)}</td>
        <td>${escapeHtml(rec.source || "—")}</td>
        <td style="white-space:nowrap;">${canWrite() ? `<button class="btn ghost" data-action="edit" style="padding:5px 10px; font-size:12px;">Sửa</button> <button class="btn danger" data-action="del">Xóa</button>` : ""}</td>
      `;
      const editBtn = tr.querySelector('[data-action="edit"]');
      const delBtn = tr.querySelector('[data-action="del"]');
      if (editBtn) editBtn.addEventListener("click", () => onEditStandard(rec));
      if (delBtn) {
        delBtn.addEventListener("click", async () => {
          if (_editingStandardId === rec.id) resetStandardForm();
          try {
            await Storage.deleteStandard(rec.id);
            await refreshStandardsUI();
          } catch (err) {
            alert(storageErrorMessage(err));
          }
        });
      }
      tbody.appendChild(tr);
    });
  }

  /** Nạp 1 tiêu chuẩn đã có lên form để sửa — bấm "Cập nhật tiêu chuẩn" sẽ ghi đè
   *  đúng dòng này (giữ nguyên id), thay vì tạo thêm 1 dòng mới. */
  function onEditStandard(rec) {
    if (!canWrite()) return;
    _editingStandardId = rec.id;
    $("s_manufacturer").value = rec.manufacturer || "";
    $("s_source").value = rec.source || "";
    const isOil = isOilStandardRecord(rec);
    $("s_standard_type").value = isOil ? "dau" : "khi";
    toggleStandardTypeFields();
    if (isOil) {
      $("s_oil_voltage_class").value = rec.oil_voltage_class || "";
      $("s_oil_state").value = rec.oil_state === "new" ? "new" : "inservice";
      $("s_oil_moisture").value = rec.oil_moisture_ppm ?? "";
      $("s_oil_tgd90").value = rec.oil_tgd_90c_percent ?? "";
      $("s_oil_bdv").value = rec.oil_bdv_kv ?? "";
    } else {
      $("s_equipmenttype").value = rec.equipment_type || rec.equipmentType || "";
      DGA.GASES.forEach((g) => {
        const v = rec[g.toLowerCase()] ?? rec[g];
        $("s_" + g).value = v ?? "";
        const vLoaibo = rec["loaibo_" + g.toLowerCase()] ?? rec["loaibo_" + g];
        $("s_loaibo_" + g).value = vLoaibo ?? "";
      });
    }
    $("editingStandardNote").classList.remove("hidden");
    $("btnCancelEditStandard").classList.remove("hidden");
    $("btnSaveStandard").textContent = "Cập nhật tiêu chuẩn";
    $("s_manufacturer").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function resetStandardForm() {
    _editingStandardId = null;
    ["s_manufacturer", "s_source", "s_oil_moisture", "s_oil_tgd90", "s_oil_bdv"].forEach((id) => ($(id).value = ""));
    DGA.GASES.forEach((g) => { $("s_" + g).value = ""; $("s_loaibo_" + g).value = ""; });
    $("s_standard_type").value = "khi";
    toggleStandardTypeFields();
    $("editingStandardNote").classList.add("hidden");
    $("btnCancelEditStandard").classList.add("hidden");
    $("btnSaveStandard").textContent = "Lưu tiêu chuẩn";
  }

  async function onSaveStandard() {
    if (!canWrite()) { alert("Chỉ Admin mới lưu được tiêu chuẩn."); return; }
    const manufacturer = $("s_manufacturer").value.trim();
    if (!manufacturer) { alert("Vui lòng nhập tên nhà sản xuất."); return; }
    const standardType = $("s_standard_type").value === "dau" ? "dau" : "khi";
    const source = $("s_source").value.trim();

    let rec;
    if (standardType === "dau") {
      const moisture = $("s_oil_moisture").value;
      const tgd90 = $("s_oil_tgd90").value;
      const bdv = $("s_oil_bdv").value;
      if (moisture === "" && tgd90 === "" && bdv === "") {
        alert("Vui lòng nhập ít nhất 1 trong 3 ngưỡng: Độ ẩm dầu, tgδ ở 90°C, hoặc Điện áp chọc thủng.");
        return;
      }
      rec = {
        manufacturer, source, standard_type: "dau",
        equipment_type: DGA.EQUIPMENT_TYPES.MBA,
        oil_voltage_class: $("s_oil_voltage_class").value,
        oil_state: $("s_oil_state").value,
        oil_moisture_ppm: moisture === "" ? null : Number(moisture),
        oil_tgd_90c_percent: tgd90 === "" ? null : Number(tgd90),
        oil_bdv_kv: bdv === "" ? null : Number(bdv),
      };
    } else {
      const equipmentType = $("s_equipmenttype").value;
      rec = {
        manufacturer, source, standard_type: "khi",
        equipment_type: equipmentType,
      };
      DGA.GASES.forEach((g) => {
        const v = $("s_" + g).value;
        rec[g.toLowerCase()] = v === "" ? null : Number(v);
        const vLoaibo = $("s_loaibo_" + g).value;
        rec["loaibo_" + g.toLowerCase()] = vLoaibo === "" ? null : Number(vLoaibo);
      });
    }
    if (_editingStandardId) rec.id = _editingStandardId;

    const wasEditing = !!_editingStandardId;
    try {
      await Storage.saveStandard(rec);
      resetStandardForm();
      await refreshStandardsUI();
      alert((wasEditing ? "Đã cập nhật tiêu chuẩn cho " : "Đã lưu tiêu chuẩn cho ") + manufacturer + ".");
    } catch (err) {
      alert(storageErrorMessage(err));
    }
  }

  // ---------------------------------------------------------------------
  // Tab "Quản trị" — chỉ Admin thấy được tab này (xem toggle navQuanTri trong
  // initApp). Cho phép nâng/hạ quyền Admin ↔ User cho từng email đã đăng ký.
  // ---------------------------------------------------------------------
  async function refreshUsersUI() {
    const users = await Auth.listUsers();
    const tbody = $("usersTable");
    tbody.innerHTML = "";
    $("usersEmpty").classList.toggle("hidden", users.length > 0);

    users
      .slice()
      .sort((a, b) => (a.email || "").localeCompare(b.email || ""))
      .forEach((u) => {
        const isSelf = Auth.current && Auth.current.email === u.email;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(u.email)}${isSelf ? ' <span class="pill muted">bạn</span>' : ""}</td>
          <td></td>
          <td style="font-size:12px;">${escapeHtml(u.created_at || "—")}</td>
          <td style="font-size:12px;">${escapeHtml(u.last_login || "—")}</td>
          <td></td>
        `;
        const roleCell = tr.children[1];
        const sel = document.createElement("select");
        sel.className = "role-select";
        sel.innerHTML = `<option value="user">User</option><option value="admin">Admin</option>`;
        sel.value = u.role === "admin" ? "admin" : "user";
        // Không cho tự hạ quyền chính mình để tránh tự khóa mình khỏi tab Quản trị.
        sel.disabled = isSelf;
        sel.addEventListener("change", async () => {
          try {
            await Auth.setUserRole(u.email, sel.value);
            await refreshUsersUI();
          } catch (err) {
            alert("Đổi quyền thất bại: " + ((err && err.message) || err));
            await refreshUsersUI();
          }
        });
        roleCell.appendChild(sel);

        const delCell = tr.children[4];
        if (!isSelf) {
          const delBtn = document.createElement("button");
          delBtn.className = "btn danger";
          delBtn.textContent = "Xóa";
          delBtn.addEventListener("click", async () => {
            if (confirm(`Xóa tài khoản ${u.email}? Người này sẽ không đăng nhập được nữa.`)) {
              try {
                await Auth.deleteUser(u.email);
                await refreshUsersUI();
              } catch (err) {
                alert("Xóa user thất bại: " + ((err && err.message) || err));
              }
            }
          });
          delCell.appendChild(delBtn);
        }
        tbody.appendChild(tr);
      });
  }

  // ---------------------------------------------------------------------
  // Phân tích & lưu 1 lần đo
  // ---------------------------------------------------------------------
  async function onAnalyze() {
    const gases = {};
    DGA.GASES.forEach((g) => (gases[g] = $("g_" + g).value === "" ? 0 : Number($("g_" + g).value)));

    const equipmentType = $("f_loai").value;
    const mbaSubtype = equipmentType === DGA.EQUIPMENT_TYPES.MBA ? $("f_mbasubtype").value : null;

    const measurement = {
      id: _editingMeasurementId || undefined,
      tram: $("f_tram").value.trim(),
      thiet_bi: $("f_thietbi").value.trim(),
      equipment_type: equipmentType,
      mba_subtype: mbaSubtype,
      manufacturer: $("f_nsx").value || null,
      pha: $("f_pha").value,
      lan_do: Number($("f_landocount").value) || 1,
      sample_date: $("f_ngay").value,
      ghi_chu: $("f_ghichu").value.trim(),
      ...gases,
    };

    if (!measurement.thiet_bi || !measurement.sample_date) {
      alert("Vui lòng nhập ít nhất Thiết bị và Ngày lấy mẫu.");
      return;
    }

    // 1) Xác định tiêu chuẩn áp dụng: NSX nếu có cấu hình đầy đủ; ngược lại, tiêu chuẩn
    //    CHẶT HƠN giữa QĐ1901 và bảng tham khảo tương ứng của IEC 60599:1999 Annex A
    //    (hoặc trực tiếp IEC Annex A khi QĐ1901 chưa có bảng riêng — sứ xuyên).
    const logicMeasurement = { equipmentType: measurement.equipment_type, manufacturer: measurement.manufacturer, mbaSubtype };
    const standard = DGA.resolveStandard(logicMeasurement, toManufacturerStandardsForLogic(_allStandards));

    // 2) TCG + đánh giá tuyệt đối
    const tcg = DGA.computeTCG(gases);
    const evalRows = DGA.evaluateAbsolute(gases, standard.limits);
    const overall = DGA.overallVerdict(evalRows);
    const exceedCount = DGA.countExceedTypical(gases, measurement.equipment_type, logicMeasurement);

    // 3) Ba tỷ số khí cơ bản + chẩn đoán Bảng 66 (ngưỡng PD theo loại thiết bị — 0,1 mặc
    //    định, 0,2 cho TI/TU theo Annex A.3.3, 0,07 cho sứ xuyên theo Annex A.4.3)
    const ratios = DGA.computeRatios(gases);
    const diagnosis = DGA.diagnoseRatios(ratios, standard.pdThreshold);
    const applicability = DGA.ratioApplicability(exceedCount);

    // 3bis) Chẩn đoán Tam giác Duval 1 (Annex B, Figure B.3)
    const duval = DGA.diagnoseDuval1(gases);

    // 3ter) Ngưỡng LOẠI BỎ riêng của nhà sản xuất (nếu có cấu hình) — cảnh báo nghiêm
    //    trọng hơn mức "không đạt" thông thường, độc lập với ngưỡng tuyệt đối ở trên.
    const condemningRows = DGA.evaluateCondemning(gases, standard.condemning);

    // 4) Tốc độ sinh khí — tìm lần đo gần nhất trước đó cùng Trạm+Thiết bị+Pha
    let all;
    try {
      all = await Storage.listMeasurements();
    } catch (err) {
      alert(storageErrorMessage(err));
      return;
    }
    const prior = all
      .filter((r) => r.tram === measurement.tram && r.thiet_bi === measurement.thiet_bi && r.pha === measurement.pha)
      .filter((r) => new Date(r.sample_date) < new Date(measurement.sample_date))
      .sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date))[0];

    let rateRows = null;
    let priorDiagnosis = null;
    if (prior) {
      const deltaDays = Math.round((new Date(measurement.sample_date) - new Date(prior.sample_date)) / 86400000);
      rateRows = DGA.computeRateOfChange(prior, gases, deltaDays, standard.rate, measurement.equipment_type);
      // Chẩn đoán Bảng 66 của lần đo liền trước — dùng để phát hiện "đổi loại lỗi"
      // (điều kiện ALARM riêng của lưu đồ IEC 60599, xem computeOverallStatus()).
      priorDiagnosis = DGA.diagnoseRatios(DGA.computeRatios(prior), standard.pdThreshold);
    }

    // 5) Khuyến cáo tổng hợp
    const recs = DGA.buildRecommendations({ overallOk: overall === "Đạt", exceedCount, diagnosis, duval, rateRows, condemningRows });

    // 5bis) Trạng thái tổng thể (Bình thường/Cảnh báo/Báo động) — số hóa lưu đồ Hình 1
    //    IEC 60599:1999; xem giải thích đầy đủ ở tab "Quy trình đánh giá".
    const overallStatus = DGA.computeOverallStatus({
      overallOk: overall === "Đạt", exceedCount, diagnosis, priorDiagnosis, rateRows, condemningRows,
    });

    renderResults({ tcg, evalRows, overall, diagnosis, standard, ratios, applicability, duval, rateRows, prior, recs, condemningRows, overallStatus });

    // 6) Lưu vào lịch sử — mọi user đã đăng nhập đều lưu được (xem canSaveEntry()); khi
    //    đang SỬA 1 bản ghi có sẵn (_editingMeasurementId), server chỉ chấp nhận nếu là
    //    Admin hoặc đúng người đã nhập bản ghi đó (prepareOwnedRecord() ở Code.gs) — lỗi
    //    nếu có sẽ hiện nguyên văn ở khối catch bên dưới.
    if (!canSaveEntry()) return;
    const wasEditing = !!_editingMeasurementId;

    try {
      await Storage.addMeasurement(measurement);
      await registerStationIfNew(measurement.tram);
      resetMeasurementEditState();
      await refreshHistoryUI();
      if (wasEditing) showToast("Đã cập nhật lần đo.");
    } catch (err) {
      alert("Đã hiển thị kết quả đánh giá, nhưng LƯU THẤT BẠI: " + storageErrorMessage(err));
    }
  }

  function storageErrorMessage(err) {
    const base = (err && err.message) || String(err);
    if (Storage.mode === "gsheet") {
      return "Lỗi kết nối Google Sheets: " + base +
        "\n\nKiểm tra: URL trong config.js đúng chưa, Apps Script đã Deploy > New deployment với " +
        "\"Who has access: Anyone\" chưa, và Google Sheet chưa bị xóa/đổi quyền.";
    }
    if (Storage.mode === "supabase") {
      return "Lỗi kết nối Supabase: " + base;
    }
    return "Lỗi lưu dữ liệu: " + base;
  }

  function verdictPill(v) {
    if (v === "Đạt") return `<span class="pill ok">Đạt</span>`;
    if (v === "Không có ngưỡng") return `<span class="pill muted">Không có ngưỡng</span>`;
    return `<span class="pill bad">Không đạt</span>`;
  }

  function renderResults({ tcg, evalRows, overall, diagnosis, standard, ratios, applicability, duval, rateRows, prior, recs, condemningRows, overallStatus }) {
    $("resultsPanel").classList.remove("hidden");

    if (overallStatus) {
      const STATUS_ICON = { normal: "check-circle", alert: "alert-triangle", alarm: "alert-octagon" };
      $("overallStatusBanner").className = "status-banner status-" + overallStatus.level;
      $("statusBadgeText").innerHTML =
        `<svg class="status-icon" aria-hidden="true"><use href="#icon-${STATUS_ICON[overallStatus.level] || "check-circle"}"></use></svg>` +
        escapeHtml(overallStatus.label);
      $("statusReasonsList").innerHTML = overallStatus.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
      $("statusActionText").textContent = overallStatus.action;
    }

    $("r_tcg").textContent = tcg.toFixed(1) + " ppm";
    $("r_overall").innerHTML = overall === "Đạt" ? `<span class="pill ok">Đạt</span>` : `<span class="pill bad">Không đạt</span>`;
    $("r_diag").textContent = diagnosis;
    $("r_duval").textContent = duval ? duval.zone : "—";
    $("r_standard").textContent = standard.sourceLabel;

    const condemnMap = {};
    (condemningRows || []).forEach((r) => (condemnMap[r.gas] = r));
    const condemnExceeded = DGA.condemningExceededRows(condemningRows);
    if (condemnExceeded.length > 0) {
      $("condemnBanner").classList.remove("hidden");
      $("condemnBanner").innerHTML =
        `⚠ CẢNH BÁO NGHIÊM TRỌNG — VƯỢT NGƯỠNG LOẠI BỎ (do nhà sản xuất quy định) ở ${condemnExceeded.length} khí: ` +
        condemnExceeded.map((r) => `${r.gas} (${r.value} &gt; ${r.limit} ppm)`).join(", ") +
        `. Đây là mức nghiêm trọng hơn "Không đạt" thông thường — khuyến cáo báo cáo ngay cấp có thẩm quyền.`;
    } else {
      $("condemnBanner").classList.add("hidden");
    }

    $("r_gasTable").innerHTML = evalRows.map((r) => {
      const c = condemnMap[r.gas];
      const condemnCell = !c ? "—" : c.exceeded ? `<strong style="color:var(--bad);">${c.limit} ⚠</strong>` : c.limit;
      return `<tr><td>${r.gas}</td><td>${r.value}</td><td>${r.limit ?? "—"}</td><td>${condemnCell}</td><td>${verdictPill(r.verdict)}</td></tr>`;
    }).join("");

    $("r_ratio1").textContent = ratios.c2h2_c2h4.toFixed(3);
    $("r_ratio2").textContent = ratios.ch4_h2.toFixed(3);
    $("r_ratio3").textContent = ratios.c2h4_c2h6.toFixed(3);
    $("r_pdthreshold").textContent = "< " + standard.pdThreshold;
    $("r_applicability").textContent = applicability;

    if (duval) {
      $("r_pctch4").textContent = duval.pctCH4.toFixed(1) + "%";
      $("r_pctc2h4").textContent = duval.pctC2H4.toFixed(1) + "%";
      $("r_pctc2h2").textContent = duval.pctC2H2.toFixed(1) + "%";
      $("r_duvalzone").innerHTML = `<strong>${duval.zone}</strong> — ${duval.label}`;
      drawDuvalTriangleBase();
      drawDuvalPoint(duval.xy);
    } else {
      $("r_pctch4").textContent = $("r_pctc2h4").textContent = $("r_pctc2h2").textContent = "—";
      $("r_duvalzone").textContent = "Không đủ dữ liệu (cần CH4/C2H4/C2H2 > 0)";
      drawDuvalTriangleBase();
    }

    if (rateRows) {
      $("rateSection").classList.remove("hidden");
      $("rateNote").textContent = `So với lần đo trước (${prior.sample_date}) — ` +
        (rateRows[0].officialForEquipment
          ? "Bảng 65 áp dụng CHÍNH THỨC cho MBA/Kháng dầu."
          : "Bảng 65 chỉ QĐ1901 quy định chính thức cho MBA — với loại thiết bị này chỉ dùng để THAM KHẢO.");
      $("r_rateTable").innerHTML = rateRows.map((r) => `
        <tr>
          <td>${r.gas}</td><td>${r.before}</td><td>${r.after}</td><td>${r.delta}</td>
          <td>${r.ratePerYear}</td><td>${r.rangeLo} – ${r.rangeHi}</td>
          <td>${r.verdict.startsWith("⚠") ? `<span class="pill warn">${r.verdict}</span>` : r.verdict}</td>
        </tr>
      `).join("");
    } else {
      $("rateSection").classList.add("hidden");
    }

    $("r_recs").innerHTML = recs.map((r) => `<li>${r}</li>`).join("");
    if (typeof $("resultsPanel").scrollIntoView === "function") {
      $("resultsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // ---------------------------------------------------------------------
  // Tab "Dầu cách điện" — Độ ẩm dầu (ppm), tgδ ở 90°C (%), Điện áp chọc thủng
  // dầu (kV), theo Bảng 58/55/54 QĐ1901 (Điều 50/47/46), phân theo cấp điện áp
  // MBA. Chỉ áp dụng MBA/Kháng dầu. IEC 60599:1999 không tự quy định 3 hạng mục
  // này (thuộc phạm vi IEC 60422) nên chỉ đối chiếu theo đúng bảng của QĐ1901 —
  // xem DGA.evaluateOilTest() trong dga-logic.js.
  // ---------------------------------------------------------------------
  function populateOilVoltageClasses() {
    const optionsHtml = DGA.OIL_VOLTAGE_CLASSES.map(
      (c) => `<option value="${c.value}">${escapeHtml(c.label)}</option>`
    ).join("");
    $("o_voltage_class").innerHTML = optionsHtml;
    $("s_oil_voltage_class").innerHTML = optionsHtml;
  }

  // "Có bảo vệ màng/nitơ" chỉ có ý nghĩa với các cấp điện áp mà Bảng 58 phân biệt
  // 2 mức (có/không màng) — suy ra trực tiếp từ DGA.bang58WaterLimits() thay vì
  // lặp lại danh sách cấp điện áp ở đây, để luôn khớp với dga-logic.js.
  function toggleOilMembraneField() {
    const vc = $("o_voltage_class").value;
    const withMembrane = DGA.bang58WaterLimits(vc, true);
    const withoutMembrane = DGA.bang58WaterLimits(vc, false);
    const applicable = withMembrane.new !== withoutMembrane.new || withMembrane.inservice !== withoutMembrane.inservice;
    $("o_membrane_wrap").classList.toggle("hidden", !applicable);
    if (!applicable) $("o_membrane").checked = false;
  }

  // _editingOilTestId: id của thí nghiệm dầu MBA đang SỬA (null = đang nhập MỚI).
  let _editingOilTestId = null;

  function clearOilForm() {
    ["o_tram", "o_thietbi", "o_ghichu", "o_moisture", "o_tgd90", "o_bdv"].forEach((id) => ($(id).value = ""));
    $("o_membrane").checked = false;
    $("o_nsx").value = "";
    $("oilResultsPanel").classList.add("hidden");
    resetOilTestEditState();
  }

  function resetOilTestEditState() {
    _editingOilTestId = null;
    $("editingOilTestNote").classList.add("hidden");
    $("btnCancelEditOilTest").classList.add("hidden");
    $("btnAnalyzeOil").textContent = "Đánh giá & Lưu";
  }

  /** Nạp 1 thí nghiệm dầu MBA đã lưu lên form để sửa — xem onEditMeasurement() ở trên. */
  function onEditOilTest(rec) {
    if (!canEditRecord(rec)) return;
    _editingOilTestId = rec.id;
    $("o_tram").value = rec.tram || "";
    $("o_thietbi").value = rec.thiet_bi || "";
    $("o_voltage_class").value = rec.voltage_class || "";
    toggleOilMembraneField();
    $("o_oilstate").value = rec.oil_state || "inservice";
    $("o_nsx").value = rec.manufacturer || "";
    $("o_membrane").checked = !!rec.has_membrane_n2;
    $("o_ngay").value = rec.sample_date || "";
    $("o_moisture").value = rec.moisture_ppm ?? "";
    $("o_tgd90").value = rec.tgd_90c_percent ?? "";
    $("o_bdv").value = rec.bdv_kv ?? "";
    $("o_ghichu").value = rec.ghi_chu || "";
    $("editingOilTestNote").classList.remove("hidden");
    $("btnCancelEditOilTest").classList.remove("hidden");
    $("btnAnalyzeOil").textContent = "Cập nhật & Lưu";
    document.querySelector('button.tab-btn[data-tab="dau"]').click();
    $("o_tram").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function onAnalyzeOil() {
    const voltageClass = $("o_voltage_class").value;
    const oilState = $("o_oilstate").value;
    const hasMembraneN2 = !$("o_membrane_wrap").classList.contains("hidden") && $("o_membrane").checked;
    const manufacturer = $("o_nsx").value || null;

    const oilTest = {
      id: _editingOilTestId || undefined,
      tram: $("o_tram").value.trim(),
      thiet_bi: $("o_thietbi").value.trim(),
      voltage_class: voltageClass,
      oil_state: oilState,
      has_membrane_n2: hasMembraneN2,
      manufacturer,
      sample_date: $("o_ngay").value,
      moisture_ppm: $("o_moisture").value === "" ? null : Number($("o_moisture").value),
      tgd_90c_percent: $("o_tgd90").value === "" ? null : Number($("o_tgd90").value),
      bdv_kv: $("o_bdv").value === "" ? null : Number($("o_bdv").value),
      ghi_chu: $("o_ghichu").value.trim(),
    };

    if (!oilTest.thiet_bi || !oilTest.sample_date) {
      alert("Vui lòng nhập ít nhất Thiết bị và Ngày lấy mẫu.");
      return;
    }
    if (oilTest.moisture_ppm === null && oilTest.tgd_90c_percent === null && oilTest.bdv_kv === null) {
      alert("Vui lòng nhập ít nhất 1 trong 3 giá trị: Độ ẩm dầu, tgδ ở 90°C, hoặc Điện áp chọc thủng dầu.");
      return;
    }

    const evalResult = DGA.evaluateOilTest({
      voltageClass, oilState, hasMembraneN2, manufacturer,
      manufacturerOilStandards: toOilStandardsForLogic(_allStandards),
      moisture: oilTest.moisture_ppm, tgd90: oilTest.tgd_90c_percent, bdv: oilTest.bdv_kv,
    });
    renderOilResults(evalResult);

    // Lưu vào lịch sử — mọi user đã đăng nhập đều lưu được, y hệt onAnalyze().
    if (!canSaveEntry()) return;
    const wasEditing = !!_editingOilTestId;

    try {
      await Storage.addOilTest(oilTest);
      await registerStationIfNew(oilTest.tram);
      resetOilTestEditState();
      await refreshOilTestsUI();
      if (wasEditing) showToast("Đã cập nhật thí nghiệm dầu.");
    } catch (err) {
      alert("Đã hiển thị kết quả đánh giá, nhưng LƯU THẤT BẠI: " + storageErrorMessage(err));
    }
  }

  function renderOilResults(evalResult) {
    $("oilResultsPanel").classList.remove("hidden");
    $("o_overall").innerHTML =
      evalResult.overall === "Đạt" ? `<span class="pill ok">Đạt</span>`
      : evalResult.overall === "Chưa đủ dữ liệu" ? `<span class="pill muted">Chưa đủ dữ liệu</span>`
      : `<span class="pill bad">Không đạt</span>`;
    $("o_resultTable").innerHTML = evalResult.rows.map((r) => `
      <tr>
        <td>${r.label}</td><td>${r.value}</td>
        <td>${r.direction === "ge" ? "≥ " : "≤ "}${r.limit}</td>
        <td>${r.unit}</td><td>${verdictPill(r.verdict)}</td>
        <td style="font-size:12px;">${r.ref}</td>
      </tr>
    `).join("");
    if (typeof $("oilResultsPanel").scrollIntoView === "function") {
      $("oilResultsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function refreshOilTestsUI() {
    const all = await Storage.listOilTests();
    _allOilTests = all;
    const sorted = all.slice().sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date));

    const tbody = $("oilHistoryTable");
    tbody.innerHTML = "";
    $("oilHistoryEmpty").classList.toggle("hidden", sorted.length > 0);

    const oilStandardsForLogic = toOilStandardsForLogic(_allStandards);
    sorted.forEach((rec) => {
      const evalResult = DGA.evaluateOilTest({
        voltageClass: rec.voltage_class, oilState: rec.oil_state, hasMembraneN2: rec.has_membrane_n2,
        manufacturer: rec.manufacturer || null, manufacturerOilStandards: oilStandardsForLogic,
        moisture: rec.moisture_ppm, tgd90: rec.tgd_90c_percent, bdv: rec.bdv_kv,
      });
      const overallPill =
        evalResult.overall === "Đạt" ? verdictPill("Đạt")
        : evalResult.overall === "Chưa đủ dữ liệu" ? `<span class="pill muted">Chưa đủ dữ liệu</span>`
        : verdictPill("Không đạt");

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${rec.sample_date}</td>
        <td>${escapeHtml(rec.tram || "—")}</td>
        <td>${escapeHtml(rec.thiet_bi)}</td>
        <td>${escapeHtml(oilVoltageClassLabel(rec.voltage_class))}</td>
        <td>${rec.oil_state === "new" ? "Dầu mới" : "Dầu vận hành"}</td>
        <td>${rec.moisture_ppm ?? "—"}</td>
        <td>${rec.tgd_90c_percent ?? "—"}</td>
        <td>${rec.bdv_kv ?? "—"}</td>
        <td>${overallPill}</td>
        <td>${ownerCellHtml(rec)}</td>
        <td style="white-space:nowrap;">
          ${canEditRecord(rec) ? `<button class="btn ghost" data-action="edit" style="padding:5px 10px; font-size:12px;">Sửa</button>` : ""}
          ${canWrite() ? `<button class="btn danger" data-action="del" style="padding:5px 10px; font-size:12px;">Xóa</button>` : ""}
        </td>
      `;
      const editBtn = tr.querySelector('[data-action="edit"]');
      if (editBtn) editBtn.addEventListener("click", () => onEditOilTest(rec));
      const delBtn = tr.querySelector('[data-action="del"]');
      if (delBtn) {
        delBtn.addEventListener("click", async () => {
          if (confirm("Xóa thí nghiệm dầu này khỏi lịch sử?")) {
            try {
              await Storage.deleteOilTest(rec.id);
              await refreshOilTestsUI();
            } catch (err) {
              alert(storageErrorMessage(err));
            }
          }
        });
      }
      tbody.appendChild(tr);
    });

    refreshTrendDeviceOptions();
  }

  // ---------------------------------------------------------------------
  // Dầu khoang điều áp dưới tải (OLTC) — Điều 37/Bảng 49 QĐ1901
  // ---------------------------------------------------------------------
  function populateOltcOptions() {
    $("ot_samplepoint").innerHTML = DGA.OLTC_SAMPLE_POINTS.map(
      (p) => `<option value="${p.value}">${escapeHtml(p.label)}</option>`
    ).join("");
    $("ot_voltage_class").innerHTML = DGA.OIL_VOLTAGE_CLASSES.map(
      (c) => `<option value="${c.value}">${escapeHtml(c.label)}</option>`
    ).join("");
  }

  // Pha (A/B/C) chỉ có ý nghĩa khi OLTC lấy mẫu kiểu "pharieng" (mỗi pha 1 khoang/mẫu
  // riêng) — "trungtinh" là 1 mẫu chung cho cả 3 pha nên ẩn hẳn ô chọn Pha.
  function toggleOltcPhaseField() {
    $("ot_phase_wrap").classList.toggle("hidden", $("ot_samplepoint").value !== "pharieng");
  }

  // Giống toggleOilMembraneField() ở dầu chính — chỉ có ý nghĩa khi dầu OLTC MỚI LẮP
  // (lúc đó áp dụng tiêu chuẩn dầu chính MBA, Bảng 58 có phân biệt có/không màng ở
  // 1 số cấp điện áp); dầu OLTC vận hành dùng Bảng 49 riêng, không có khái niệm này.
  function toggleOltcMembraneField() {
    const vc = $("ot_voltage_class").value;
    const withMembrane = DGA.bang58WaterLimits(vc, true);
    const withoutMembrane = DGA.bang58WaterLimits(vc, false);
    const applicable = withMembrane.new !== withoutMembrane.new || withMembrane.inservice !== withoutMembrane.inservice;
    $("ot_membrane_wrap").classList.toggle("hidden", !applicable);
    if (!applicable) $("ot_membrane").checked = false;
  }

  function oltcSamplePointLabel(sp) {
    const found = DGA.OLTC_SAMPLE_POINTS.find((p) => p.value === sp);
    return found ? found.label : sp || "—";
  }

  // _editingOltcOilTestId: id của thí nghiệm dầu OLTC đang SỬA (null = đang nhập MỚI).
  let _editingOltcOilTestId = null;

  function clearOltcOilForm() {
    ["ot_tram", "ot_thietbi", "ot_ghichu", "ot_moisture", "ot_tgd90", "ot_bdv"].forEach((id) => ($(id).value = ""));
    $("ot_membrane").checked = false;
    $("ot_nsx").value = "";
    $("oltcOilResultsPanel").classList.add("hidden");
    resetOltcOilTestEditState();
  }

  function resetOltcOilTestEditState() {
    _editingOltcOilTestId = null;
    $("editingOltcOilTestNote").classList.add("hidden");
    $("btnCancelEditOltcOilTest").classList.add("hidden");
    $("btnAnalyzeOltcOil").textContent = "Đánh giá & Lưu";
  }

  /** Nạp 1 thí nghiệm dầu OLTC đã lưu lên form để sửa — xem onEditMeasurement() ở trên. */
  function onEditOltcOilTest(rec) {
    if (!canEditRecord(rec)) return;
    _editingOltcOilTestId = rec.id;
    $("ot_tram").value = rec.tram || "";
    $("ot_thietbi").value = rec.thiet_bi || "";
    $("ot_samplepoint").value = rec.oltc_sample_point || "";
    toggleOltcPhaseField();
    if (rec.oltc_sample_point === "pharieng") $("ot_phase").value = rec.phase || "A";
    $("ot_voltage_class").value = rec.voltage_class || "";
    toggleOltcMembraneField();
    $("ot_oilstate").value = rec.oil_state || "inservice";
    $("ot_nsx").value = rec.manufacturer || "";
    $("ot_membrane").checked = !!rec.has_membrane_n2;
    $("ot_ngay").value = rec.sample_date || "";
    $("ot_moisture").value = rec.moisture_ppm ?? "";
    $("ot_tgd90").value = rec.tgd_90c_percent ?? "";
    $("ot_bdv").value = rec.bdv_kv ?? "";
    $("ot_ghichu").value = rec.ghi_chu || "";
    $("editingOltcOilTestNote").classList.remove("hidden");
    $("btnCancelEditOltcOilTest").classList.remove("hidden");
    $("btnAnalyzeOltcOil").textContent = "Cập nhật & Lưu";
    document.querySelector('button.tab-btn[data-tab="dau"]').click();
    $("ot_tram").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function onAnalyzeOltcOil() {
    const oltcSamplePoint = $("ot_samplepoint").value;
    const phase = oltcSamplePoint === "pharieng" ? $("ot_phase").value : "";
    const voltageClass = $("ot_voltage_class").value;
    const oilState = $("ot_oilstate").value;
    const hasMembraneN2 = !$("ot_membrane_wrap").classList.contains("hidden") && $("ot_membrane").checked;
    const manufacturer = $("ot_nsx").value || null;

    const oltcOilTest = {
      id: _editingOltcOilTestId || undefined,
      tram: $("ot_tram").value.trim(),
      thiet_bi: $("ot_thietbi").value.trim(),
      oltc_sample_point: oltcSamplePoint,
      phase,
      voltage_class: voltageClass,
      oil_state: oilState,
      has_membrane_n2: hasMembraneN2,
      manufacturer,
      sample_date: $("ot_ngay").value,
      moisture_ppm: $("ot_moisture").value === "" ? null : Number($("ot_moisture").value),
      tgd_90c_percent: $("ot_tgd90").value === "" ? null : Number($("ot_tgd90").value),
      bdv_kv: $("ot_bdv").value === "" ? null : Number($("ot_bdv").value),
      ghi_chu: $("ot_ghichu").value.trim(),
    };

    if (!oltcOilTest.thiet_bi || !oltcOilTest.sample_date) {
      alert("Vui lòng nhập ít nhất Thiết bị và Ngày lấy mẫu.");
      return;
    }
    if (oltcOilTest.moisture_ppm === null && oltcOilTest.tgd_90c_percent === null && oltcOilTest.bdv_kv === null) {
      alert("Vui lòng nhập ít nhất 1 trong 3 giá trị: Độ ẩm dầu, tgδ ở 90°C, hoặc Điện áp chọc thủng dầu.");
      return;
    }

    const evalResult = DGA.evaluateOltcOilTest({
      oltcSamplePoint, voltageClass, oilState, hasMembraneN2, manufacturer,
      manufacturerOilStandards: toOilStandardsForLogic(_allStandards),
      moisture: oltcOilTest.moisture_ppm, tgd90: oltcOilTest.tgd_90c_percent, bdv: oltcOilTest.bdv_kv,
    });
    renderOltcOilResults(evalResult);

    if (!canSaveEntry()) return;
    const wasEditing = !!_editingOltcOilTestId;

    try {
      await Storage.addOltcOilTest(oltcOilTest);
      await registerStationIfNew(oltcOilTest.tram);
      resetOltcOilTestEditState();
      await refreshOltcOilTestsUI();
      if (wasEditing) showToast("Đã cập nhật thí nghiệm dầu OLTC.");
    } catch (err) {
      alert("Đã hiển thị kết quả đánh giá, nhưng LƯU THẤT BẠI: " + storageErrorMessage(err));
    }
  }

  function renderOltcOilResults(evalResult) {
    $("oltcOilResultsPanel").classList.remove("hidden");
    $("ot_overall").innerHTML =
      evalResult.overall === "Đạt" ? `<span class="pill ok">Đạt</span>`
      : evalResult.overall === "Chưa đủ dữ liệu" ? `<span class="pill muted">Chưa đủ dữ liệu</span>`
      : `<span class="pill bad">Không đạt</span>`;
    $("ot_resultTable").innerHTML = evalResult.rows.map((r) => `
      <tr>
        <td>${r.label}</td><td>${r.value}</td>
        <td>${r.limit === null ? "—" : (r.direction === "ge" ? "≥ " : "≤ ") + r.limit}</td>
        <td>${r.unit}</td><td>${verdictPill(r.verdict)}</td>
        <td style="font-size:12px;">${r.ref}</td>
      </tr>
    `).join("");
    if (typeof $("oltcOilResultsPanel").scrollIntoView === "function") {
      $("oltcOilResultsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function refreshOltcOilTestsUI() {
    const all = await Storage.listOltcOilTests();
    _allOltcOilTests = all;
    const sorted = all.slice().sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date));

    const tbody = $("oltcOilHistoryTable");
    tbody.innerHTML = "";
    $("oltcOilHistoryEmpty").classList.toggle("hidden", sorted.length > 0);

    const oilStandardsForLogic = toOilStandardsForLogic(_allStandards);
    sorted.forEach((rec) => {
      const evalResult = DGA.evaluateOltcOilTest({
        oltcSamplePoint: rec.oltc_sample_point, voltageClass: rec.voltage_class, oilState: rec.oil_state,
        hasMembraneN2: rec.has_membrane_n2, manufacturer: rec.manufacturer || null,
        manufacturerOilStandards: oilStandardsForLogic,
        moisture: rec.moisture_ppm, tgd90: rec.tgd_90c_percent, bdv: rec.bdv_kv,
      });
      const overallPill =
        evalResult.overall === "Đạt" ? verdictPill("Đạt")
        : evalResult.overall === "Chưa đủ dữ liệu" ? `<span class="pill muted">Chưa đủ dữ liệu</span>`
        : verdictPill("Không đạt");

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${rec.sample_date}</td>
        <td>${escapeHtml(rec.tram || "—")}</td>
        <td>${escapeHtml(rec.thiet_bi)}</td>
        <td>${escapeHtml(oltcSamplePointLabel(rec.oltc_sample_point))}</td>
        <td>${rec.phase ? escapeHtml(rec.phase) : "—"}</td>
        <td>${escapeHtml(oilVoltageClassLabel(rec.voltage_class))}</td>
        <td>${rec.oil_state === "new" ? "Dầu mới" : "Dầu vận hành"}</td>
        <td>${rec.moisture_ppm ?? "—"}</td>
        <td>${rec.bdv_kv ?? "—"}</td>
        <td>${overallPill}</td>
        <td>${ownerCellHtml(rec)}</td>
        <td style="white-space:nowrap;">
          ${canEditRecord(rec) ? `<button class="btn ghost" data-action="edit" style="padding:5px 10px; font-size:12px;">Sửa</button>` : ""}
          ${canWrite() ? `<button class="btn danger" data-action="del" style="padding:5px 10px; font-size:12px;">Xóa</button>` : ""}
        </td>
      `;
      const editBtn = tr.querySelector('[data-action="edit"]');
      if (editBtn) editBtn.addEventListener("click", () => onEditOltcOilTest(rec));
      const delBtn = tr.querySelector('[data-action="del"]');
      if (delBtn) {
        delBtn.addEventListener("click", async () => {
          if (confirm("Xóa thí nghiệm dầu OLTC này khỏi lịch sử?")) {
            try {
              await Storage.deleteOltcOilTest(rec.id);
              await refreshOltcOilTestsUI();
            } catch (err) {
              alert(storageErrorMessage(err));
            }
          }
        });
      }
      tbody.appendChild(tr);
    });

    refreshTrendDeviceOptions();
  }

  // ---------------------------------------------------------------------
  // Lịch sử đo
  // ---------------------------------------------------------------------
  let _allMeasurements = [];
  let _allOilTests = [];
  let _allOltcOilTests = [];

  async function refreshHistoryUI() {
    const all = await Storage.listMeasurements();
    _allMeasurements = all;
    const filterText = ($("historyFilter").value || "").toLowerCase();
    const filtered = all.filter((r) =>
      !filterText || (r.tram || "").toLowerCase().includes(filterText) || (r.thiet_bi || "").toLowerCase().includes(filterText)
    );
    filtered.sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date));

    const tbody = $("historyTable");
    tbody.innerHTML = "";
    $("historyEmpty").classList.toggle("hidden", filtered.length > 0);

    filtered.forEach((rec) => {
      const gases = recordGases(rec);
      const mbaSubtype = rec.mba_subtype ?? rec.mbaSubtype ?? null;
      const standard = DGA.resolveStandard({ equipmentType: rec.equipment_type, manufacturer: rec.manufacturer, mbaSubtype }, toManufacturerStandardsForLogic(_allStandards));
      const evalRows = DGA.evaluateAbsolute(gases, standard.limits);
      const overall = DGA.overallVerdict(evalRows);
      const ratios = DGA.computeRatios(gases);
      const diagnosis = DGA.diagnoseRatios(ratios, standard.pdThreshold);
      const duval = DGA.diagnoseDuval1(gases);
      const tcg = DGA.computeTCG(gases);
      const condemnBad = DGA.condemningExceededRows(DGA.evaluateCondemning(gases, standard.condemning)).length > 0;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${rec.sample_date}</td>
        <td>${escapeHtml(rec.tram || "—")}</td>
        <td>${escapeHtml(rec.thiet_bi)}</td>
        <td>${escapeHtml(rec.equipment_type)}</td>
        <td>${escapeHtml(rec.pha || "—")}</td>
        <td>${rec.lan_do ?? "—"}</td>
        <td>${tcg.toFixed(1)}</td>
        <td>${overall === "Đạt" ? verdictPill("Đạt") : verdictPill("Không đạt")}${condemnBad ? ' <span class="pill bad">⚠ Loại bỏ</span>' : ""}</td>
        <td style="font-size:12px;">${diagnosis}</td>
        <td style="font-size:12px;">${duval ? duval.zone : "—"}</td>
        <td>${ownerCellHtml(rec)}</td>
        <td style="white-space:nowrap;">
          ${canEditRecord(rec) ? `<button class="btn ghost" data-action="edit" style="padding:5px 10px; font-size:12px;">Sửa</button>` : ""}
          ${canWrite() ? `<button class="btn danger" data-action="del" style="padding:5px 10px; font-size:12px;">Xóa</button>` : ""}
        </td>
      `;
      const editBtn = tr.querySelector('[data-action="edit"]');
      if (editBtn) editBtn.addEventListener("click", () => onEditMeasurement(rec));
      const delBtn = tr.querySelector('[data-action="del"]');
      if (delBtn) {
        delBtn.addEventListener("click", async () => {
          if (confirm("Xóa lần đo này khỏi lịch sử?")) {
            try {
              await Storage.deleteMeasurement(rec.id);
              await refreshHistoryUI();
            } catch (err) {
              alert(storageErrorMessage(err));
            }
          }
        });
      }
      tbody.appendChild(tr);
    });

    refreshCompareDeviceOptions();
    refreshTrendDeviceOptions();
  }

  // ---------------------------------------------------------------------
  // So sánh tốc độ gia tăng khí giữa 2 lần đo CHỌN được (không chỉ tự động lấy lần
  // liền trước) — dùng chung DGA.computeRateOfChange()/DGA.resolveStandard().
  // ---------------------------------------------------------------------
  function deviceKey(rec) {
    return `${rec.tram || ""}|||${rec.thiet_bi || ""}|||${rec.pha || ""}`;
  }

  function measurementOptionLabel(rec) {
    return `${rec.sample_date} (Lần ${rec.lan_do ?? "?"})`;
  }

  function refreshCompareDeviceOptions() {
    const sel = $("cmp_device");
    if (!sel) return;
    const currentVal = sel.value;

    const byKey = new Map();
    _allMeasurements.forEach((r) => {
      const key = deviceKey(r);
      if (!byKey.has(key)) byKey.set(key, { tram: r.tram, thiet_bi: r.thiet_bi, pha: r.pha, count: 0 });
      byKey.get(key).count++;
    });

    sel.innerHTML = '<option value="">— Chọn thiết bị —</option>';
    Array.from(byKey.entries())
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => (a[1].thiet_bi || "").localeCompare(b[1].thiet_bi || ""))
      .forEach(([key, v]) => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = `${v.thiet_bi || "?"} — ${v.tram || "?"} — Pha ${v.pha || "?"} (${v.count} lần đo)`;
        sel.appendChild(opt);
      });

    if (Array.from(byKey.keys()).includes(currentVal)) sel.value = currentVal;
    refreshCompareMeasurementOptions();
  }

  function refreshCompareMeasurementOptions() {
    const key = $("cmp_device").value;
    const beforeSel = $("cmp_before");
    const afterSel = $("cmp_after");
    beforeSel.innerHTML = "";
    afterSel.innerHTML = "";

    if (!key) {
      // Chưa chọn thiết bị: chỉ hiện ghi chú "chưa đủ dữ liệu" nếu dropdown thiết bị
      // không có lựa chọn nào ngoài placeholder (tức chưa có thiết bị nào đủ 2 lần đo).
      $("cmpEmpty").classList.toggle("hidden", $("cmp_device").options.length > 1);
      $("cmpResultWrap").classList.add("hidden");
      return;
    }
    const list = _allMeasurements.filter((r) => deviceKey(r) === key).sort((a, b) => new Date(a.sample_date) - new Date(b.sample_date));
    if (list.length < 2) {
      $("cmpEmpty").classList.remove("hidden");
      $("cmpResultWrap").classList.add("hidden");
      return;
    }
    $("cmpEmpty").classList.add("hidden");
    list.forEach((r) => {
      const o1 = document.createElement("option"); o1.value = r.id; o1.textContent = measurementOptionLabel(r);
      beforeSel.appendChild(o1);
      const o2 = document.createElement("option"); o2.value = r.id; o2.textContent = measurementOptionLabel(r);
      afterSel.appendChild(o2);
    });
    // Mặc định chọn sẵn 2 lần đo gần nhất — người dùng có thể đổi sang mốc bất kỳ khác
    beforeSel.value = list[list.length - 2].id;
    afterSel.value = list[list.length - 1].id;
  }

  function onCompareRate() {
    const key = $("cmp_device").value;
    if (!key) { alert("Vui lòng chọn thiết bị."); return; }
    const list = _allMeasurements.filter((r) => deviceKey(r) === key);
    const beforeRec = list.find((r) => String(r.id) === $("cmp_before").value);
    const afterRec = list.find((r) => String(r.id) === $("cmp_after").value);
    if (!beforeRec || !afterRec) { alert("Vui lòng chọn đủ 2 lần đo."); return; }
    if (beforeRec.id === afterRec.id) { alert("Vui lòng chọn 2 lần đo khác nhau."); return; }

    // Luôn xếp theo thời gian thực tế, bất kể người dùng chọn ở ô "thứ nhất"/"thứ hai" nào
    const [prevRec, currRec] = new Date(beforeRec.sample_date) <= new Date(afterRec.sample_date)
      ? [beforeRec, afterRec] : [afterRec, beforeRec];

    const deltaDays = Math.round((new Date(currRec.sample_date) - new Date(prevRec.sample_date)) / 86400000);
    if (deltaDays <= 0) { alert("2 lần đo phải có ngày lấy mẫu khác nhau."); return; }

    const mbaSubtype = currRec.mba_subtype ?? currRec.mbaSubtype ?? null;
    const standard = DGA.resolveStandard(
      { equipmentType: currRec.equipment_type, manufacturer: currRec.manufacturer, mbaSubtype },
      toManufacturerStandardsForLogic(_allStandards)
    );
    const rateRows = DGA.computeRateOfChange(recordGases(prevRec), recordGases(currRec), deltaDays, standard.rate, currRec.equipment_type);
    const usingCustomRate = standard.rate !== DGA.QD1901_BANG65_RATE;

    $("cmpResultWrap").classList.remove("hidden");
    $("cmpNote").textContent =
      `${prevRec.sample_date} → ${currRec.sample_date} (${deltaDays} ngày) — Tiêu chuẩn tốc độ: ` +
      (usingCustomRate ? "khoảng tốc độ riêng của nhà sản xuất" : "Bảng 65 QĐ1901 (Điều 54, tương ứng mục 8.4 IEC 60599:1999)") + ". " +
      (rateRows[0].officialForEquipment
        ? "Áp dụng CHÍNH THỨC cho MBA/Kháng dầu."
        : "Chỉ QĐ1901 quy định chính thức cho MBA — với loại thiết bị này chỉ dùng để THAM KHẢO.");
    $("cmpTable").innerHTML = rateRows.map((r) => `
      <tr>
        <td>${r.gas}</td><td>${r.before}</td><td>${r.after}</td><td>${r.delta}</td>
        <td>${r.ratePerYear}</td><td>${r.rangeLo} – ${r.rangeHi}</td>
        <td>${r.verdict.startsWith("⚠") ? `<span class="pill warn">${r.verdict}</span>` : r.verdict}</td>
      </tr>
    `).join("");
  }

  // ---------------------------------------------------------------------
  // Tab "Xu hướng" — đồ thị xu hướng theo thời gian cho 1 thiết bị, gộp cả 3
  // nguồn dữ liệu đã lưu: khí hòa tan (đo DGA), dầu MBA chính, dầu OLTC. Gom
  // theo TÊN thiết bị (thiet_bi) — giống cách các ô combo "Thiết bị" khác trong
  // app đang gộp gợi ý (bỏ qua Trạm/Pha để đơn giản, nhất quán với phần còn lại).
  // Dùng Chart.js (tải trong index.html, kiểm tra typeof Chart trước khi dùng —
  // nếu CDN lỗi/mất mạng thì chỉ phần đồ thị bị ẩn, không chặn phần còn lại).
  // ---------------------------------------------------------------------
  const TREND_COLORS = [
    "#2e75b6", "#c1121f", "#1a7f37", "#b45309", "#6f42c1", "#0891b2", "#be185d",
    "#4d7c0f", "#9333ea", "#0d9488", "#ca8a04", "#475569", "#db2777",
    "#0f766e", "#a21caf", "#65a30d", "#c2410c", "#1e40af", "#991b1b",
  ];

  // Thứ tự ưu tiên hiển thị khi tách theo pha: A, B, C trước, các giá trị khác (hiếm gặp,
  // vd người dùng gõ tự do pha khác) xếp sau theo alphabet.
  const TREND_PHASE_ORDER = { A: 0, B: 1, C: 2 };

  const TREND_PARAM_DEFS = Object.assign(
    {},
    ...DGA.GASES.map((g) => ({ ["gas:" + g]: { label: g, unit: "ppm", axis: "yGas", field: g } })),
    {
      "oil:moisture": { label: "Độ ẩm dầu chính", unit: "ppm", axis: "yMoisture", field: "moisture_ppm" },
      "oil:tgd90": { label: "tgδ 90°C dầu chính", unit: "%", axis: "yTgd", field: "tgd_90c_percent" },
      "oil:bdv": { label: "Điện áp chọc thủng dầu chính", unit: "kV", axis: "yBdv", field: "bdv_kv" },
      "oltc:moisture": { label: "Độ ẩm dầu OLTC", unit: "ppm", axis: "yMoisture", field: "moisture_ppm" },
      "oltc:tgd90": { label: "tgδ 90°C dầu OLTC", unit: "%", axis: "yTgd", field: "tgd_90c_percent" },
      "oltc:bdv": { label: "Điện áp chọc thủng dầu OLTC", unit: "kV", axis: "yBdv", field: "bdv_kv" },
    }
  );

  // Được giữ nguyên khi đổi thiết bị, để người dùng không phải chọn lại các thông số
  // quen dùng (vd: luôn xem H2/CH4) mỗi lần chuyển sang thiết bị khác.
  let _trendSelectedParams = new Set();
  // Mặc định tick sẵn cả 3 pha phổ biến — thiết bị nào chỉ có 1 pha thì ô lọc pha tự ẩn
  // (xem renderTrendPhaseFilter), không ảnh hưởng gì đến các thiết bị đó.
  let _trendSelectedPhases = new Set(["A", "B", "C"]);
  let _trendChart = null;

  function trendDeviceName(rec) {
    return (rec.thiet_bi || "").trim();
  }

  // Gộp chung pha của cả khí hòa tan (trường "pha") lẫn dầu OLTC lấy mẫu riêng từng pha
  // (trường "phase", chỉ có khi oltc_sample_point = "pharieng") — cùng 1 thiết bị thì pha
  // A/B/C phải là cùng ý nghĩa vật lý cho mọi loại số liệu, nên dùng chung 1 bộ lọc.
  function trendDistinctPhases(gasRecords, oltcRecords) {
    const set = new Set();
    gasRecords.forEach((r) => { const p = (r.pha || "").trim(); if (p) set.add(p); });
    oltcRecords.forEach((r) => {
      if (r.oltc_sample_point !== "pharieng") return;
      const p = (r.phase || "").trim();
      if (p) set.add(p);
    });
    return Array.from(set).sort((a, b) => (TREND_PHASE_ORDER[a] ?? 99) - (TREND_PHASE_ORDER[b] ?? 99) || a.localeCompare(b));
  }

  function refreshTrendDeviceOptions() {
    const sel = $("tr_device");
    if (!sel) return;
    const currentVal = sel.value;

    const names = new Set();
    _allMeasurements.forEach((r) => { const n = trendDeviceName(r); if (n) names.add(n); });
    _allOilTests.forEach((r) => { const n = trendDeviceName(r); if (n) names.add(n); });
    _allOltcOilTests.forEach((r) => { const n = trendDeviceName(r); if (n) names.add(n); });

    sel.innerHTML = '<option value="">— Chọn thiết bị —</option>';
    Array.from(names).sort((a, b) => a.localeCompare(b, "vi")).forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });

    $("trEmpty").classList.toggle("hidden", names.size > 0);
    if (names.has(currentVal)) sel.value = currentVal;
    onTrendDeviceChange();
  }

  function trendRecordsForDevice(device) {
    const gasRecords = _allMeasurements
      .filter((r) => trendDeviceName(r) === device)
      .sort((a, b) => new Date(a.sample_date) - new Date(b.sample_date));
    const oilRecords = _allOilTests
      .filter((r) => trendDeviceName(r) === device)
      .sort((a, b) => new Date(a.sample_date) - new Date(b.sample_date));
    const oltcRecords = _allOltcOilTests
      .filter((r) => trendDeviceName(r) === device)
      .sort((a, b) => new Date(a.sample_date) - new Date(b.sample_date));
    return { gasRecords, oilRecords, oltcRecords };
  }

  function onTrendDeviceChange() {
    const device = $("tr_device").value;
    ["trHistGasWrap", "trHistOilWrap", "trHistOltcWrap"].forEach((id) => $(id).classList.add("hidden"));

    if (!device) {
      $("trContentWrap").classList.add("hidden");
      destroyTrendChart();
      return;
    }
    $("trContentWrap").classList.remove("hidden");

    const { gasRecords, oilRecords, oltcRecords } = trendRecordsForDevice(device);
    renderTrendPhaseFilter(gasRecords, oilRecords, oltcRecords);
    renderTrendParamCheckboxes(gasRecords, oilRecords, oltcRecords);
    renderTrendHistoryTables(gasRecords, oilRecords, oltcRecords);
    renderTrendChart(gasRecords, oilRecords, oltcRecords);
  }

  // Chỉ hiện ô lọc pha khi thiết bị thực sự có từ 2 pha trở lên trong dữ liệu đã lưu —
  // thiết bị 1 pha (đa số dầu MBA chính, hoặc TI/TU chỉ nhập 1 pha) thì ẩn hẳn, giữ nguyên
  // hành vi gộp đơn giản như trước (không thêm hậu tố " - Pha X" vào tên đường trong chú giải).
  function renderTrendPhaseFilter(gasRecords, oilRecords, oltcRecords) {
    const phases = trendDistinctPhases(gasRecords, oltcRecords);
    const wrap = $("trPhaseWrap");
    if (phases.length < 2) {
      wrap.classList.add("hidden");
      return;
    }
    wrap.classList.remove("hidden");
    const el = $("trPhaseChecks");
    el.innerHTML = phases.map((p) => {
      const checked = _trendSelectedPhases.has(p) ? "checked" : "";
      return `<label class="chk"><input type="checkbox" data-trend-phase="${escapeHtml(p)}" ${checked} /> Pha ${escapeHtml(p)}</label>`;
    }).join("");
    el.querySelectorAll("input[data-trend-phase]").forEach((cb) => {
      cb.addEventListener("change", () => {
        if (cb.checked) _trendSelectedPhases.add(cb.dataset.trendPhase);
        else _trendSelectedPhases.delete(cb.dataset.trendPhase);
        renderTrendChart(gasRecords, oilRecords, oltcRecords);
      });
    });
  }

  function renderTrendParamCheckboxes(gasRecords, oilRecords, oltcRecords) {
    const hasGas = gasRecords.length > 0;
    const hasOil = oilRecords.length > 0;
    const hasOltc = oltcRecords.length > 0;
    $("trParamsGasWrap").classList.toggle("hidden", !hasGas);
    $("trParamsOilWrap").classList.toggle("hidden", !hasOil);
    $("trParamsOltcWrap").classList.toggle("hidden", !hasOltc);

    const buildChecks = (containerId, keys) => {
      const el = $(containerId);
      el.innerHTML = keys.map((key) => {
        const def = TREND_PARAM_DEFS[key];
        const checked = _trendSelectedParams.has(key) ? "checked" : "";
        return `<label class="chk"><input type="checkbox" data-trend-key="${key}" ${checked} /> ${escapeHtml(def.label)}</label>`;
      }).join("");
      el.querySelectorAll("input[data-trend-key]").forEach((cb) => {
        cb.addEventListener("change", () => {
          if (cb.checked) _trendSelectedParams.add(cb.dataset.trendKey);
          else _trendSelectedParams.delete(cb.dataset.trendKey);
          renderTrendChart(gasRecords, oilRecords, oltcRecords);
        });
      });
    };

    if (hasGas) buildChecks("trParamsGas", DGA.GASES.map((g) => "gas:" + g));
    if (hasOil) buildChecks("trParamsOil", ["oil:moisture", "oil:tgd90", "oil:bdv"]);
    if (hasOltc) buildChecks("trParamsOltc", ["oltc:moisture", "oltc:tgd90", "oltc:bdv"]);
  }

  function renderTrendHistoryTables(gasRecords, oilRecords, oltcRecords) {
    $("trHistGasWrap").classList.toggle("hidden", gasRecords.length === 0);
    $("trHistOilWrap").classList.toggle("hidden", oilRecords.length === 0);
    $("trHistOltcWrap").classList.toggle("hidden", oltcRecords.length === 0);

    $("trHistGasTable").innerHTML = gasRecords.slice().reverse().map((r) => `
      <tr>
        <td>${r.sample_date}</td><td>${escapeHtml(r.pha || "—")}</td><td>${r.lan_do ?? "—"}</td>
        ${DGA.GASES.map((g) => `<td>${recordGases(r)[g] ?? "—"}</td>`).join("")}
      </tr>
    `).join("");

    $("trHistOilTable").innerHTML = oilRecords.slice().reverse().map((r) => `
      <tr>
        <td>${r.sample_date}</td>
        <td>${r.oil_state === "new" ? "Dầu mới" : "Dầu vận hành"}</td>
        <td>${r.moisture_ppm ?? "—"}</td><td>${r.tgd_90c_percent ?? "—"}</td><td>${r.bdv_kv ?? "—"}</td>
      </tr>
    `).join("");

    $("trHistOltcTable").innerHTML = oltcRecords.slice().reverse().map((r) => `
      <tr>
        <td>${r.sample_date}</td>
        <td>${escapeHtml(oltcSamplePointLabel(r.oltc_sample_point))}</td>
        <td>${r.phase ? escapeHtml(r.phase) : "—"}</td>
        <td>${r.oil_state === "new" ? "Dầu mới" : "Dầu vận hành"}</td>
        <td>${r.moisture_ppm ?? "—"}</td><td>${r.tgd_90c_percent ?? "—"}</td><td>${r.bdv_kv ?? "—"}</td>
      </tr>
    `).join("");
  }

  function destroyTrendChart() {
    if (_trendChart) {
      _trendChart.destroy();
      _trendChart = null;
    }
  }

  const TREND_AXIS_DEFS = {
    yGas: { title: "Nồng độ khí (ppm)", position: "left" },
    yTgd: { title: "tgδ 90°C (%)", position: "left" },
    yMoisture: { title: "Độ ẩm dầu (ppm)", position: "right" },
    yBdv: { title: "Điện áp chọc thủng (kV)", position: "right" },
  };

  // Lọc + gom điểm dữ liệu hợp lệ (bỏ qua giá trị rỗng/null) thành mảng {x,y} cho Chart.js.
  function trendPoints(records, valueOf) {
    return records
      .filter((r) => valueOf(r) !== undefined && valueOf(r) !== null && valueOf(r) !== "")
      .map((r) => ({ x: new Date(r.sample_date).getTime(), y: Number(valueOf(r)) }));
  }

  function renderTrendChart(gasRecords, oilRecords, oltcRecords) {
    const canvas = $("trendChart");
    if (typeof Chart === "undefined") {
      $("trChartNoLib").classList.remove("hidden");
      $("trChartEmpty").classList.add("hidden");
      canvas.classList.add("hidden");
      return;
    }
    $("trChartNoLib").classList.add("hidden");

    const hasGas = gasRecords.length > 0;
    const hasOil = oilRecords.length > 0;
    const hasOltc = oltcRecords.length > 0;
    const sourceOk = { gas: hasGas, oil: hasOil, oltc: hasOltc };

    const selectedKeys = Array.from(_trendSelectedParams)
      .filter((k) => TREND_PARAM_DEFS[k])
      .filter((k) => sourceOk[k.split(":")[0]]);

    destroyTrendChart();

    // Khí hòa tan: Storage.addMeasurement() hạ chữ thường các key khí (H2 -> h2, xem
    // normalizeGasKeys trong storage.js) trước khi lưu — dùng recordGases() để đọc lại
    // đúng như phần Lịch sử đo đang làm, thay vì đọc thẳng r[def.field] (viết hoa).
    const gasValueOf = (r, field) => recordGases(r)[field];

    const phases = trendDistinctPhases(gasRecords, oltcRecords);
    const phaseFilterActive = phases.length >= 2;
    const tickedPhases = phases.filter((p) => _trendSelectedPhases.has(p));
    const recordsBySource = { gas: gasRecords, oil: oilRecords, oltc: oltcRecords };

    // Mỗi khóa đã chọn ("gas:H2", "oltc:moisture"...) có thể sinh ra 1 ĐƯỜNG (gộp toàn bộ
    // pha, như trước) hoặc NHIỀU đường (1 đường/pha đã tick) khi thiết bị có ≥2 pha.
    const seriesSpecs = [];
    selectedKeys.forEach((key) => {
      const def = TREND_PARAM_DEFS[key];
      const source = key.split(":")[0];

      if (source === "gas" && phaseFilterActive) {
        tickedPhases.forEach((p) => {
          const recs = gasRecords.filter((r) => (r.pha || "").trim() === p);
          seriesSpecs.push({
            label: `${def.label} - Pha ${p} (${def.unit})`,
            axis: def.axis,
            points: trendPoints(recs, (r) => gasValueOf(r, def.field)),
          });
        });
        return;
      }

      if (source === "oltc" && phaseFilterActive) {
        // Mẫu "Điểm cuối trung tính" (3 pha dùng chung) không gắn với 1 pha cụ thể nào —
        // luôn hiện, không bị lọc theo pha đã tick.
        const trungtinhRecs = oltcRecords.filter((r) => r.oltc_sample_point !== "pharieng");
        const trungtinhPoints = trendPoints(trungtinhRecs, (r) => r[def.field]);
        if (trungtinhPoints.length > 0) {
          seriesSpecs.push({ label: `${def.label} (${def.unit})`, axis: def.axis, points: trungtinhPoints });
        }
        tickedPhases.forEach((p) => {
          const recs = oltcRecords.filter((r) => r.oltc_sample_point === "pharieng" && (r.phase || "").trim() === p);
          const points = trendPoints(recs, (r) => r[def.field]);
          if (points.length > 0) {
            seriesSpecs.push({ label: `${def.label} - Pha ${p} (${def.unit})`, axis: def.axis, points });
          }
        });
        return;
      }

      // Không tách theo pha (thiết bị không có ≥2 pha, hoặc là dầu MBA chính — không có
      // khái niệm pha): gộp toàn bộ bản ghi của nguồn dữ liệu này thành 1 đường như trước.
      const valueOf = source === "gas" ? (r) => gasValueOf(r, def.field) : (r) => r[def.field];
      seriesSpecs.push({ label: `${def.label} (${def.unit})`, axis: def.axis, points: trendPoints(recordsBySource[source], valueOf) });
    });

    if (seriesSpecs.length === 0) {
      $("trChartEmpty").classList.remove("hidden");
      canvas.classList.add("hidden");
      return;
    }
    $("trChartEmpty").classList.add("hidden");
    canvas.classList.remove("hidden");

    const datasets = seriesSpecs.map((spec, idx) => {
      const color = TREND_COLORS[idx % TREND_COLORS.length];
      return {
        label: spec.label,
        data: spec.points,
        borderColor: color,
        backgroundColor: color,
        yAxisID: spec.axis,
        spanGaps: true,
        tension: 0.15,
        pointRadius: 3,
        pointHoverRadius: 5,
      };
    });

    const usedAxes = new Set(datasets.map((d) => d.yAxisID));
    const scales = {
      x: {
        type: "linear",
        ticks: { callback: (val) => new Date(val).toLocaleDateString("vi-VN") },
        title: { display: true, text: "Ngày lấy mẫu" },
      },
    };
    let firstAxis = true;
    Object.entries(TREND_AXIS_DEFS).forEach(([id, cfg]) => {
      if (!usedAxes.has(id)) return;
      scales[id] = {
        type: "linear",
        position: cfg.position,
        title: { display: true, text: cfg.title },
        grid: { drawOnChartArea: firstAxis },
      };
      firstAxis = false;
    });

    _trendChart = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "nearest", axis: "x", intersect: false },
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              title: (items) => (items.length ? new Date(items[0].parsed.x).toLocaleDateString("vi-VN") : ""),
            },
          },
        },
        scales,
      },
    });
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
