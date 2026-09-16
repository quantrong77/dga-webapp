/**
 * Code.gs — biến 1 Google Sheet thành "database" cho web app đánh giá DGA.
 *
 * CÁCH DÙNG (xem chi tiết trong README.md, mục "Dùng Google Sheets thay Supabase"):
 *  1. Tạo 1 Google Sheet mới (trống) tại sheets.google.com.
 *  2. Vào Tiện ích mở rộng (Extensions) > Apps Script.
 *  3. Xóa hết code mẫu trong Code.gs, dán TOÀN BỘ nội dung file này vào.
 *  4. Bấm biểu tượng đĩa mềm (Lưu dự án).
 *  5. Bấm Deploy (Triển khai) > New deployment (Triển khai mới):
 *     - Select type (chọn loại): Web app
 *     - Execute as (thực thi với quyền của): Me (tài khoản của bạn)
 *     - Who has access (ai được truy cập): Anyone (Bất kỳ ai) — bắt buộc, để web app
 *       gọi được mà không cần đăng nhập Google
 *     - Bấm Deploy, cấp quyền khi được hỏi (Authorize access)
 *  6. Copy "Web app URL" (dạng https://script.google.com/macros/s/AKfycb.../exec)
 *     dán vào GSHEET_WEBAPP_URL trong file config.js của web app.
 *
 * Script này TỰ TẠO các sheet (measurements, manufacturer_standards, stations,
 * users, sessions) kèm tiêu đề cột trong chính Google Sheet bạn vừa tạo — không
 * cần tạo tay.
 *
 * ĐĂNG NHẬP / PHÂN QUYỀN (thêm ở bản này):
 *  - Mọi người dùng phải Đăng ký (email + mật khẩu) rồi Đăng nhập mới xem được
 *    dữ liệu. Mật khẩu được băm (SHA-256 + salt ngẫu nhiên riêng từng user)
 *    trước khi lưu vào sheet "users" — KHÔNG lưu mật khẩu gốc.
 *  - Email trong hằng số ADMIN_EMAIL bên dưới sẽ TỰ ĐỘNG được cấp quyền "admin"
 *    ngay khi đăng ký (chỉ áp dụng đúng email đó). Mọi email khác mặc định là
 *    "user" — Admin có thể nâng quyền cho người khác sau trong tab "Quản trị"
 *    của web app.
 *  - Đăng nhập thành công trả về 1 "token" phiên (lưu 30 ngày). Token này bắt
 *    buộc phải gửi kèm mọi request đọc/ghi dữ liệu sau đó.
 *  - PHÂN QUYỀN GHI cho measurements/oil_tests/oltc_oil_tests (xem prepareOwnedRecord()):
 *    role "user" được TỰ NHẬP bản ghi mới, và SỬA lại bản ghi do chính mình đã
 *    nhập (không sửa được bản ghi của người khác); role "admin" sửa được TẤT
 *    CẢ bản ghi. XÓA (deleteMeasurement/deleteOilTest/deleteOltcOilTest) luôn
 *    yêu cầu "admin", bất kể ai đã tạo bản ghi đó. Mỗi bản ghi được "lưu vết":
 *    cột created_by (người nhập, không đổi sau khi tạo), updated_by/updated_at
 *    (người sửa gần nhất, lúc nào) — hiển thị ở cột "Người nhập" trong bảng
 *    lịch sử trên web app. Các thao tác GHI khác (Tiêu chuẩn, Trạm, Quản trị
 *    user) vẫn yêu cầu "admin" như cũ (requireAdmin).
 *
 * LƯU Ý BẢO MẬT: vì "Who has access" phải để "Anyone" để web app gọi được từ
 * trình duyệt, ai có URL này về lý thuyết vẫn gọi được API thô (giống cơ chế
 * "anon key" của Supabase) — nhưng giờ mọi thao tác ĐỌC/GHI đều bị chặn ở phía
 * server (hàm này) nếu không có token hợp lệ / không đủ quyền, nên không thể
 * bỏ qua màn hình đăng nhập để đọc/ghi dữ liệu được nữa. Mật khẩu vẫn nên đủ
 * mạnh vì đây không phải hạ tầng bảo mật cấp doanh nghiệp như Supabase Auth.
 */

const SHEET_MEASUREMENTS = "measurements";
const SHEET_STANDARDS = "manufacturer_standards";
const SHEET_STATIONS = "stations";

const MEASUREMENT_HEADERS = [
  "id", "tram", "thiet_bi", "equipment_type", "mba_subtype", "manufacturer",
  "pha", "lan_do", "sample_date", "h2", "ch4", "c2h6", "c2h4", "c2h2", "co", "co2",
  "ghi_chu", "created_at",
  // "Lưu vết" (audit) — thêm ở CUỐI (xem lưu ý ở STANDARD_HEADERS): created_by = email
  // người đã NHẬP bản ghi này (không đổi sau khi tạo, kể cả khi Admin sửa lại số liệu);
  // updated_by/updated_at = email + thời điểm SỬA gần nhất (bằng created_by/created_at
  // ở lần lưu đầu tiên). Xem prepareOwnedRecord(). Bản ghi cũ trước khi có 2 cột này sẽ
  // để trống — hiển thị "—" ở cột "Người nhập" trên web app, không suy diễn ngược.
  "created_by", "updated_by", "updated_at",
  // Biên bản thí nghiệm (BBTN, file PDF) đính kèm — thêm ở CUỐI (xem lưu ý ở
  // STANDARD_HEADERS). bbtn_file_id/bbtn_url là id/link Google Drive của file (xem
  // actionUploadAttachment()); bbtn_name là tên file gốc lúc tải lên, hiển thị lại ở
  // web app. Cả 3 để trống nếu lần đo chưa đính kèm BBTN nào.
  "bbtn_file_id", "bbtn_url", "bbtn_name",
  // Thông số kỹ thuật thiết bị (nameplate, tùy chọn) — thêm ở CUỐI (xem lưu ý ngay
  // trên) — chỉ dùng để điền vào "Báo cáo phân tích kỹ thuật (docx)" phía web app
  // (xem tech-report-export.js), KHÔNG dùng để tính toán/đánh giá DGA. Bản ghi lưu
  // trước khi có 8 cột này sẽ để trống — web app hiển thị "—"/bỏ trống dòng tương
  // ứng trong báo cáo, không suy diễn ngược.
  "kieu_may", "nam_sx", "nam_van_hanh", "dien_ap_dm",
  "so_che_tao", "loai_dau", "ket_cau_cach_dien", "hien_trang_van_hanh",
  // Thông tin thí nghiệm bổ sung (tùy chọn) — thêm ở CUỐI (xem lưu ý ngay trên) — tự
  // đọc được từ BBTN (bbtn-import.js) hoặc nhập tay, dùng để điền vào "Xuất BBTN (docx)"
  // phía web app (xem bbtn-export.js), KHÔNG dùng để tính toán/đánh giá DGA. Khác nhóm
  // 8 cột "nameplate" ở trên vì đây là thông tin của TỪNG LẦN đo (ngày thí nghiệm/lý do/
  // điều kiện môi trường có thể khác nhau giữa các lần đo cùng thiết bị). Bản ghi lưu
  // trước khi có 4 cột này sẽ để trống — không suy diễn ngược.
  "ngay_thi_nghiem", "ly_do_thi_nghiem", "nhiet_do", "do_am",
];

// QUAN TRỌNG: mọi cột MỚI phải thêm vào CUỐI mảng này, KHÔNG bao giờ chèn giữa —
// getOrCreateSheet() bên dưới chỉ tự nâng cấp HÀNG TIÊU ĐỀ (đổi tên cột theo vị trí
// cột), KHÔNG dịch chuyển dữ liệu các dòng đã có; chèn giữa sẽ làm toàn bộ dữ liệu
// từ cột đó trở đi bị lệch/sai nghĩa ở các dòng đã lưu trước đó trên Google Sheet.
const STANDARD_HEADERS = [
  "id", "manufacturer", "equipment_type", "source",
  "h2", "ch4", "c2h6", "c2h4", "c2h2", "co", "co2",
  // Ngưỡng LOẠI BỎ (condemning limit) — nghiêm trọng hơn ngưỡng tuyệt đối ở trên, không
  // bắt buộc điền đủ 7 khí. QĐ1901/IEC60599 không quy định mức này.
  "loaibo_h2", "loaibo_ch4", "loaibo_c2h6", "loaibo_c2h4", "loaibo_c2h2", "loaibo_co", "loaibo_co2",
  "rate_h2_lo", "rate_h2_hi", "rate_ch4_lo", "rate_ch4_hi",
  "rate_c2h6_lo", "rate_c2h6_hi", "rate_c2h4_lo", "rate_c2h4_hi",
  "rate_c2h2_lo", "rate_c2h2_hi", "rate_co_lo", "rate_co_hi",
  "rate_co2_lo", "rate_co2_hi",
  // Tiêu chuẩn DẦU (chỉ dùng khi standard_type = "dau") — 1 bản ghi ứng với 1 tổ hợp
  // cấp điện áp + trạng thái dầu cụ thể, giống cấu trúc Bảng 54/55/58 QĐ1901.
  "oil_voltage_class", "oil_state", "oil_moisture_ppm", "oil_tgd_90c_percent", "oil_bdv_kv",
  // "standard_type": "khi" (khí hòa tan — record cũ trước khi có cột này, hoặc để
  // trống, cũng được coi là "khi") hoặc "dau" (dầu cách điện). Thêm ở CUỐI (xem lưu ý trên).
  "standard_type",
  "created_at",
];

// Danh mục Trạm (MaTram/TenTram) — dùng để gợi ý/tìm kiếm ở ô "Trạm".
const STATION_HEADERS = ["id", "ma_tram", "ten_tram", "created_at"];

// Thí nghiệm dầu MBA — Độ ẩm (Điều 50/Bảng 58), tgδ ở 90°C (Điều 47/Bảng 55),
// điện áp chọc thủng (Điều 46/Bảng 54). Chỉ áp dụng MBA/Kháng dầu theo QĐ1901.
const SHEET_OILTESTS = "oil_tests";
const OILTEST_HEADERS = [
  "id", "tram", "thiet_bi", "voltage_class", "oil_state", "has_membrane_n2",
  "sample_date", "moisture_ppm", "tgd_90c_percent", "bdv_kv", "ghi_chu",
  // "manufacturer": thêm ở CUỐI, trước created_at (xem lưu ý ở STANDARD_HEADERS).
  "manufacturer", "created_at",
  // "Lưu vết" (audit) — xem chú thích đầy đủ ở MEASUREMENT_HEADERS, cùng cơ chế.
  "created_by", "updated_by", "updated_at",
];

// Thí nghiệm dầu khoang điều áp dưới tải (OLTC) — Điều 37/Bảng 49. Sheet TÁCH RIÊNG
// khỏi oil_tests (dầu thùng dầu chính) vì cấu trúc dữ liệu khác nhau (thêm điểm lấy
// mẫu + pha) — đây là sheet MỚI hoàn toàn nên không có rủi ro lệch cột như đã gặp ở
// STANDARD_HEADERS/OILTEST_HEADERS trước đây (xem ghi chú cảnh báo ở STANDARD_HEADERS).
const SHEET_OLTC_OILTESTS = "oltc_oil_tests";
const OLTC_OILTEST_HEADERS = [
  "id", "tram", "thiet_bi",
  // "oltc_sample_point": "trungtinh" (điểm cuối trung tính, 3 pha chung 1 mẫu) hoặc
  // "pharieng" (một pha / điểm không trung tính, mỗi pha A/B/C 1 mẫu riêng).
  "oltc_sample_point",
  // "phase": "A"/"B"/"C" khi oltc_sample_point="pharieng", để trống khi "trungtinh".
  "phase",
  "voltage_class", "oil_state", "has_membrane_n2",
  "sample_date", "moisture_ppm", "tgd_90c_percent", "bdv_kv", "ghi_chu",
  "manufacturer", "created_at",
  // "Lưu vết" (audit) — xem chú thích đầy đủ ở MEASUREMENT_HEADERS, cùng cơ chế.
  "created_by", "updated_by", "updated_at",
];

// Tài khoản người dùng — mật khẩu KHÔNG lưu gốc, chỉ lưu password_hash (SHA-256
// của salt+mật khẩu) và password_salt (chuỗi ngẫu nhiên riêng từng user). Tài khoản
// đăng nhập bằng Google (auth_provider = "google") không có password_hash/salt.
const SHEET_USERS = "users";
const USER_HEADERS = [
  "id", "email", "password_hash", "password_salt", "role", "created_at", "last_login",
  // "auth_provider": thêm ở CUỐI (xem lưu ý ở STANDARD_HEADERS) — "password" (mặc định,
  // record cũ/để trống cũng hiểu là "password") hoặc "google".
  "auth_provider",
];

// Phiên đăng nhập — mỗi lần Đăng nhập/Đăng ký thành công tạo 1 dòng token mới.
const SHEET_SESSIONS = "sessions";
const SESSION_HEADERS = ["token", "email", "created_at", "expires_at"];

// Email này TỰ ĐỘNG được cấp quyền "admin" ngay khi đăng ký (dù đăng ký bằng mật khẩu
// hay bằng Google) — đổi thành email Admin thật của bạn nếu khác. Mọi email khác mặc
// định là "user" (tự nhập/sửa được bản ghi của chính mình — xem prepareOwnedRecord()).
const ADMIN_EMAIL = "quantrong77@gmail.com";

// OAuth 2.0 Client ID cho "Đăng nhập bằng Google" (Google Identity Services) — tạo tại
// https://console.cloud.google.com/apis/credentials (loại "OAuth client ID" > "Web
// application"). Để TRỐNG ("") thì nút "Đăng nhập bằng Google" sẽ tự ẩn ở giao diện,
// mọi thứ khác hoạt động bình thường như trước (chỉ đăng nhập email/mật khẩu).
const GOOGLE_CLIENT_ID = "";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // phiên đăng nhập hết hạn sau 30 ngày

function doGet(e) {
  try {
    const action = e.parameter.action;
    const token = e.parameter.token;

    if (action === "me") return jsonOut(actionMe(token));

    // Các action ĐỌC dữ liệu: chỉ cần đã đăng nhập (bất kỳ role nào).
    if (action === "listMeasurements") { requireSession(token); return jsonOut(listRows(SHEET_MEASUREMENTS, MEASUREMENT_HEADERS)); }
    if (action === "listStandards") { requireSession(token); return jsonOut(listRows(SHEET_STANDARDS, STANDARD_HEADERS)); }
    if (action === "listStations") { requireSession(token); return jsonOut(listRows(SHEET_STATIONS, STATION_HEADERS)); }
    if (action === "listOilTests") { requireSession(token); return jsonOut(listRows(SHEET_OILTESTS, OILTEST_HEADERS)); }
    if (action === "listOltcOilTests") { requireSession(token); return jsonOut(listRows(SHEET_OLTC_OILTESTS, OLTC_OILTEST_HEADERS)); }
    // Danh sách user: chỉ Admin xem được (dùng cho tab "Quản trị").
    if (action === "listUsers") { requireAdmin(token); return jsonOut(listPublicUsers()); }

    return jsonOut({ error: "unknown action: " + action });
  } catch (err) {
    return jsonOut({ error: String((err && err.message) || err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const token = body.token;
    let result;

    // Đăng ký/đăng nhập/đăng xuất: không cần token sẵn có.
    if (action === "register") result = actionRegister(body);
    else if (action === "login") result = actionLogin(body);
    else if (action === "googleLogin") result = actionGoogleLogin(body);
    else if (action === "logout") result = actionLogout(body);
    // measurements/oil_tests/oltc_oil_tests: NHẬP MỚI cho mọi role đã đăng nhập, SỬA bị
    // giới hạn theo chủ bản ghi (Admin sửa được tất cả) — xem prepareOwnedRecord(). XÓA
    // vẫn luôn yêu cầu "admin" (requireAdmin), bất kể ai đã tạo bản ghi đó.
    else if (action === "addMeasurement") { result = upsertRow(SHEET_MEASUREMENTS, MEASUREMENT_HEADERS, prepareOwnedRecord(token, SHEET_MEASUREMENTS, MEASUREMENT_HEADERS, body.record)); }
    else if (action === "deleteMeasurement") { requireAdmin(token); result = deleteRow(SHEET_MEASUREMENTS, body.id); }
    // Tải lên 1 file Biên bản thí nghiệm (BBTN, PDF) đính kèm 1 lần đo — bất kỳ ai đã
    // đăng nhập đều tải lên được (cùng quyền với "tự nhập lần đo mới"), KHÔNG cần là
    // Admin hay chủ bản ghi — xem actionUploadAttachment(). Client tự ghép bbtn_url/
    // bbtn_name/bbtn_file_id trả về vào record rồi mới gọi addMeasurement().
    else if (action === "uploadAttachment") { result = actionUploadAttachment(token, body); }
    else if (action === "saveStandard") { requireAdmin(token); result = upsertRow(SHEET_STANDARDS, STANDARD_HEADERS, body.record); }
    else if (action === "deleteStandard") { requireAdmin(token); result = deleteRow(SHEET_STANDARDS, body.id); }
    else if (action === "saveStation") { requireAdmin(token); result = upsertRow(SHEET_STATIONS, STATION_HEADERS, body.record); }
    else if (action === "deleteStation") { requireAdmin(token); result = deleteRow(SHEET_STATIONS, body.id); }
    else if (action === "addOilTest") { result = upsertRow(SHEET_OILTESTS, OILTEST_HEADERS, prepareOwnedRecord(token, SHEET_OILTESTS, OILTEST_HEADERS, body.record)); }
    else if (action === "deleteOilTest") { requireAdmin(token); result = deleteRow(SHEET_OILTESTS, body.id); }
    else if (action === "addOltcOilTest") { result = upsertRow(SHEET_OLTC_OILTESTS, OLTC_OILTEST_HEADERS, prepareOwnedRecord(token, SHEET_OLTC_OILTESTS, OLTC_OILTEST_HEADERS, body.record)); }
    else if (action === "deleteOltcOilTest") { requireAdmin(token); result = deleteRow(SHEET_OLTC_OILTESTS, body.id); }
    else if (action === "setUserRole") { requireAdmin(token); result = actionSetUserRole(body); }
    else if (action === "deleteUser") { requireAdmin(token); result = actionDeleteUser(body); }
    else result = { error: "unknown action: " + action };
    return jsonOut(result);
  } catch (err) {
    return jsonOut({ error: String((err && err.message) || err) });
  }
}

// ---------------------------------------------------------------------------
// Đăng ký / đăng nhập / phiên đăng nhập / phân quyền
// ---------------------------------------------------------------------------

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/** Chuỗi hex ngẫu nhiên (dùng làm salt và token) — không cần bảo mật cấp mật mã. */
function randomHex(byteLen) {
  let out = "";
  for (let i = 0; i < byteLen; i++) {
    out += ("0" + Math.floor(Math.random() * 256).toString(16)).slice(-2);
  }
  return out;
}

function hashPassword(password, salt) {
  const digestBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + "|" + password);
  return digestBytes.map((b) => ("0" + (b & 0xff).toString(16)).slice(-2)).join("");
}

function findUserByEmail(email) {
  const norm = normalizeEmail(email);
  return listRows(SHEET_USERS, USER_HEADERS).find((u) => normalizeEmail(u.email) === norm) || null;
}

function listPublicUsers() {
  return listRows(SHEET_USERS, USER_HEADERS).map((u) => ({
    email: u.email, role: u.role, created_at: u.created_at, last_login: u.last_login,
  }));
}

function actionRegister(body) {
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Email không hợp lệ." };
  if (password.length < 6) return { error: "Mật khẩu phải có ít nhất 6 ký tự." };
  if (findUserByEmail(email)) return { error: "Email này đã được đăng ký." };

  const salt = randomHex(16);
  const role = email === normalizeEmail(ADMIN_EMAIL) ? "admin" : "user";
  const record = {
    id: "u_" + Utilities.getUuid(),
    email: email,
    password_hash: hashPassword(password, salt),
    password_salt: salt,
    role: role,
    created_at: new Date().toISOString(),
    last_login: new Date().toISOString(),
  };
  upsertRow(SHEET_USERS, USER_HEADERS, record);
  return createSession(email, role);
}

function actionLogin(body) {
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const user = findUserByEmail(email);
  if (!user || hashPassword(password, user.password_salt) !== user.password_hash) {
    return { error: "Email hoặc mật khẩu không đúng." };
  }
  upsertRow(SHEET_USERS, USER_HEADERS, Object.assign({}, user, { last_login: new Date().toISOString() }));
  return createSession(email, user.role);
}

/**
 * Đăng nhập/Đăng ký bằng Google — nhận 1 ID token (JWT) do thư viện Google Identity
 * Services (GIS) ở trình duyệt trả về sau khi người dùng chọn tài khoản Google và
 * đồng ý. Xác thực token bằng chính endpoint "tokeninfo" của Google (không cần thư
 * viện giải mã JWT/kiểm tra chữ ký riêng — Apps Script gọi thẳng qua UrlFetchApp).
 * Nếu email đăng nhập lần đầu qua Google, TỰ ĐỘNG tạo tài khoản (không cần mật khẩu,
 * password_hash/salt để trống) — coi như "đăng ký" luôn, không cần bước riêng.
 */
function actionGoogleLogin(body) {
  const idToken = String(body.idToken || "");
  if (!idToken) return { error: "Thiếu Google ID token." };
  if (!GOOGLE_CLIENT_ID) {
    return { error: "Server chưa cấu hình GOOGLE_CLIENT_ID — Admin cần điền hằng số này ở đầu Code.gs rồi Deploy lại." };
  }

  let payload;
  try {
    const res = UrlFetchApp.fetch(
      "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken),
      { muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) {
      return { error: "Xác thực Google thất bại (token không hợp lệ hoặc đã hết hạn) — vui lòng thử đăng nhập lại." };
    }
    payload = JSON.parse(res.getContentText());
  } catch (err) {
    return { error: "Không gọi được máy chủ xác thực Google: " + String((err && err.message) || err) };
  }

  if (payload.aud !== GOOGLE_CLIENT_ID) {
    return { error: "Token Google không khớp với ứng dụng này (sai Client ID)." };
  }
  if (payload.email_verified !== "true" && payload.email_verified !== true) {
    return { error: "Email Google chưa được xác minh." };
  }

  const email = normalizeEmail(payload.email);
  if (!email) return { error: "Không lấy được email từ tài khoản Google." };

  const now = new Date().toISOString();
  let user = findUserByEmail(email);
  if (!user) {
    const role = email === normalizeEmail(ADMIN_EMAIL) ? "admin" : "user";
    user = {
      id: "u_" + Utilities.getUuid(),
      email: email,
      password_hash: "",
      password_salt: "",
      role: role,
      created_at: now,
      last_login: now,
      auth_provider: "google",
    };
    upsertRow(SHEET_USERS, USER_HEADERS, user);
  } else {
    upsertRow(SHEET_USERS, USER_HEADERS, Object.assign({}, user, {
      last_login: now,
      auth_provider: user.auth_provider || "google",
    }));
  }
  return createSession(email, user.role);
}

function actionLogout(body) {
  if (body && body.token) deleteRow(SHEET_SESSIONS, body.token);
  return { ok: true };
}

function createSession(email, role) {
  const token = randomHex(24);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_MS);
  const sh = getOrCreateSheet(SHEET_SESSIONS, SESSION_HEADERS);
  sh.appendRow([token, email, now.toISOString(), expires.toISOString()]);
  return { token: token, email: email, role: role };
}

/** Ném lỗi nếu token thiếu/không hợp lệ/hết hạn; trả về bản ghi user nếu hợp lệ. */
function requireSession(token) {
  if (!token) throw new Error("Chưa đăng nhập.");
  const session = listRows(SHEET_SESSIONS, SESSION_HEADERS).find((s) => String(s.token) === String(token));
  if (!session) throw new Error("Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại.");
  if (new Date(session.expires_at) < new Date()) throw new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
  const user = findUserByEmail(session.email);
  if (!user) throw new Error("Tài khoản không tồn tại.");
  return user;
}

function requireAdmin(token) {
  const user = requireSession(token);
  if (user.role !== "admin") throw new Error("Chỉ Admin mới được thực hiện thao tác này.");
  return user;
}

/** Chuẩn bị 1 bản ghi measurements/oil_tests/oltc_oil_tests trước khi upsertRow(), áp
 *  dụng đúng quy tắc phân quyền + "lưu vết" mô tả ở đầu file: bất kỳ user nào đã đăng
 *  nhập (role "user" hay "admin") đều được NHẬP bản ghi MỚI (record.id chưa có dòng nào
 *  trùng); khi record.id trùng 1 dòng đã có (tức đang SỬA), chỉ Admin hoặc đúng người có
 *  email trùng created_by của dòng đó mới được phép — nếu không, ném lỗi (client hiển thị
 *  nguyên văn qua storageErrorMessage()). created_by luôn giữ nguyên giá trị gốc khi sửa
 *  (không cho "đổi chủ" bản ghi); updated_by/updated_at luôn được ghi đè bằng người/lúc
 *  đang thực hiện lần lưu này — kể cả lần tạo mới (updated_by = updated_at = như lúc tạo). */
function prepareOwnedRecord(token, sheetName, headers, record) {
  const user = requireSession(token);
  if (!record || !record.id) throw new Error("Thiếu id bản ghi.");
  const sh = getOrCreateSheet(sheetName, headers);
  const idx = findRowIndexById(sh, record.id);
  const now = new Date().toISOString();
  if (idx > 0) {
    const existing = rowToObject(headers, sh.getRange(idx, 1, 1, headers.length).getValues()[0]);
    const ownerEmail = normalizeEmail(existing.created_by);
    // Bản ghi CŨ (trước khi có created_by, ownerEmail rỗng) coi như không ai "sở hữu"
    // được — chỉ Admin sửa được, an toàn hơn là mở cho bất kỳ user nào nhận là của mình.
    if (user.role !== "admin" && ownerEmail !== normalizeEmail(user.email)) {
      throw new Error(
        existing.created_by
          ? "Bạn chỉ được sửa bản ghi do chính mình nhập (bản ghi này do " + existing.created_by + " nhập)."
          : "Bản ghi này được nhập trước khi có tính năng phân quyền theo người nhập — chỉ Admin sửa được."
      );
    }
    return Object.assign({}, record, {
      created_by: existing.created_by || user.email, // giữ nguyên người nhập gốc
      updated_by: user.email,
      updated_at: now,
    });
  }
  return Object.assign({}, record, { created_by: user.email, updated_by: user.email, updated_at: now });
}

function actionMe(token) {
  const user = requireSession(token);
  return { email: user.email, role: user.role };
}

function actionSetUserRole(body) {
  const email = normalizeEmail(body.email);
  const role = body.role === "admin" ? "admin" : "user";
  const user = findUserByEmail(email);
  if (!user) return { error: "Không tìm thấy user." };
  upsertRow(SHEET_USERS, USER_HEADERS, Object.assign({}, user, { role: role }));
  return { email: email, role: role };
}

function actionDeleteUser(body) {
  const email = normalizeEmail(body.email);
  const user = findUserByEmail(email);
  if (!user) return { error: "Không tìm thấy user." };
  return deleteRow(SHEET_USERS, user.id);
}

// ---------------------------------------------------------------------------
// Biên bản thí nghiệm (BBTN, file PDF) đính kèm lần đo — lưu vào 1 thư mục riêng
// trên Google Drive của tài khoản đã Deploy Web App này (Execute as "Me"), chia sẻ
// "Anyone with link, Viewer" để web app mở/xem được mà không cần đăng nhập Drive.
// ---------------------------------------------------------------------------
const BBTN_FOLDER_NAME = "DGA_BBTN_DinhKem";
const MAX_BBTN_BASE64_CHARS = 20 * 1024 * 1024; // ~15MB file gốc (base64 dài hơn ~1.37 lần)

function getOrCreateBbtnFolder() {
  const folders = DriveApp.getFoldersByName(BBTN_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(BBTN_FOLDER_NAME);
}

/** Nhận { token, measurementId, filename, mimeType, base64Data } — yêu cầu ĐÃ đăng
 *  nhập (bất kỳ role nào, giống quyền "tự nhập lần đo mới" — xem prepareOwnedRecord()),
 *  KHÔNG yêu cầu là chủ bản ghi vì tại thời điểm tải lên, lần đo có thể còn chưa được
 *  lưu (client tải file lên TRƯỚC, rồi mới gọi addMeasurement() với bbtn_url trả về).
 *  Trả về { id, url, name } — client tự gộp vào record dưới tên bbtn_file_id/bbtn_url/
 *  bbtn_name trước khi lưu measurement. */
function actionUploadAttachment(token, body) {
  requireSession(token);
  const filename = String(body.filename || "bien_ban_thi_nghiem.pdf");
  const mimeType = String(body.mimeType || "application/pdf");
  const base64Data = String(body.base64Data || "");
  if (!base64Data) return { error: "Thiếu dữ liệu file." };
  if (base64Data.length > MAX_BBTN_BASE64_CHARS) {
    return { error: "File quá lớn (giới hạn khoảng 15MB)." };
  }
  let file;
  try {
    const bytes = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(bytes, mimeType, filename);
    const folder = getOrCreateBbtnFolder();
    file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    const msg = String((err && err.message) || err);
    // Lỗi "không có quyền ... DriveApp" nghĩa là script CHƯA được cấp quyền truy cập
    // Google Drive (thường gặp lần đầu sau khi thêm tính năng đính kèm BBTN, vì code cũ
    // chưa từng gọi DriveApp nên chưa từng xin quyền này). Dán thêm hướng dẫn khắc phục
    // ngay trong thông báo lỗi để người dùng tự xử lý được mà không cần hỏi lại.
    if (/quyền|permission|authoriz/i.test(msg) && /Drive/i.test(msg)) {
      return {
        error:
          "Tải file lên Google Drive thất bại: " + msg +
          "\n\nCÁCH KHẮC PHỤC: Mở script.google.com, vào đúng dự án Apps Script đang deploy web app này → " +
          "chọn hàm \"getOrCreateBbtnFolder\" ở ô dropdown trên thanh công cụ → bấm nút Run (▶) → " +
          "khi hiện \"Authorization required\", bấm Continue/Review permissions rồi Allow (chấp nhận quyền Google Drive) → " +
          "sau đó vào Deploy > Manage deployments > sửa (biểu tượng bút chì) deployment đang dùng > Version chọn \"New version\" > Deploy lại " +
          "(chỉ chạy thử trong editor KHÔNG tự cập nhật bản deploy /exec đang chạy).",
      };
    }
    return { error: "Tải file lên Google Drive thất bại: " + msg };
  }
  return { id: file.getId(), url: file.getUrl(), name: filename };
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    return sh;
  }
  // Tự nâng cấp hàng tiêu đề nếu code đã thêm cột mới (vd: loaibo_*) sau khi sheet này
  // đã tồn tại từ trước — chỉ ghi lại hàng tiêu đề, KHÔNG đụng đến dữ liệu các dòng dưới.
  const existingHeaders = sh.getLastColumn() > 0 ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  const needsUpdate = headers.some((h, i) => existingHeaders[i] !== h);
  if (needsUpdate) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sh;
}

function listRows(sheetName, headers) {
  const sh = getOrCreateSheet(sheetName, headers);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const values = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values
    .filter((row) => row[0] !== "" && row[0] !== null) // bỏ dòng trống (id rỗng)
    .map((row) => rowToObject(headers, row));
}

function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = row[i] === "" ? null : row[i];
  });
  return obj;
}

function findRowIndexById(sh, id) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sh.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2; // +2: header row + 1-index
  }
  return -1;
}

/** Thêm mới nếu id chưa tồn tại, cập nhật (ghi đè cả dòng) nếu đã tồn tại. */
function upsertRow(sheetName, headers, record) {
  if (!record || !record.id) return { error: "missing record.id" };
  const sh = getOrCreateSheet(sheetName, headers);
  const rowValues = headers.map((h) => {
    const v = record[h];
    return v === undefined || v === null ? "" : v;
  });
  const existingRowIdx = findRowIndexById(sh, record.id);
  if (existingRowIdx > 0) {
    sh.getRange(existingRowIdx, 1, 1, headers.length).setValues([rowValues]);
  } else {
    sh.appendRow(rowValues);
  }
  return record;
}

function headersForSheet(sheetName) {
  if (sheetName === SHEET_MEASUREMENTS) return MEASUREMENT_HEADERS;
  if (sheetName === SHEET_STATIONS) return STATION_HEADERS;
  if (sheetName === SHEET_USERS) return USER_HEADERS;
  if (sheetName === SHEET_SESSIONS) return SESSION_HEADERS;
  if (sheetName === SHEET_OILTESTS) return OILTEST_HEADERS;
  if (sheetName === SHEET_OLTC_OILTESTS) return OLTC_OILTEST_HEADERS;
  return STANDARD_HEADERS;
}

/** id có thể là cột "id" (measurements/standards/stations/users) hoặc cột "token"
 *  (sessions) — findRowIndexById luôn so khớp theo CỘT ĐẦU TIÊN của sheet đó. */
function deleteRow(sheetName, id) {
  const headers = headersForSheet(sheetName);
  const sh = getOrCreateSheet(sheetName, headers);
  const idx = findRowIndexById(sh, id);
  if (idx > 0) sh.deleteRow(idx);
  return { deleted: idx > 0, id: id };
}
