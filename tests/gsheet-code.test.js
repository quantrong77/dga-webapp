// Kiểm thử gsheet/Code.gs (Google Apps Script) bằng cách chạy TOÀN BỘ file trong 1 sandbox
// "vm" giả lập vừa đủ API Apps Script (SpreadsheetApp/CacheService/ContentService/Utilities/
// Session) bằng bộ nhớ trong tiến trình Node — không gọi Google thật, không cần mạng.
//
// Trọng tâm: 4 tính năng phân quyền mới thêm (đổi/đặt lại mật khẩu, khóa đăng ký mở, vai
// trò "viewer") — đây là mã chạy trên server thật, sai ở đây ảnh hưởng trực tiếp tới bảo
// mật, nên xứng đáng có bộ test riêng dù không chạy qua được `dga-logic.js`/Jest thông
// thường như lớp logic DGA. Không test actionGoogleLogin()/actionUploadAttachment() (cần
// UrlFetchApp/DriveApp thật) — ngoài phạm vi đợt này.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const SOURCE_PATH = path.join(__dirname, "..", "gsheet", "Code.gs");
const SOURCE = fs.readFileSync(SOURCE_PATH, "utf8");

/** Dựng 1 "Google Sheet" giả trong bộ nhớ — rows[0] là hàng tiêu đề, rows[i>=1] là dữ liệu.
 *  Chỉ cài đặt đúng tập API Code.gs thực sự dùng (xem liệt kê trong ghi chú đầu file test). */
function makeSheetStub(headers) {
  const rows = [headers.slice()];
  return {
    _rows: rows,
    appendRow(values) { rows.push(values.slice()); },
    setFrozenRows() {},
    getLastColumn() { return rows[0].length; },
    getLastRow() { return rows.length; },
    getRange(r, c, nr, nc) {
      return {
        getValues() {
          const out = [];
          for (let i = 0; i < nr; i++) {
            const row = rows[r - 1 + i] || [];
            out.push(row.slice(c - 1, c - 1 + nc));
          }
          return out;
        },
        setValues(values) {
          for (let i = 0; i < nr; i++) {
            const row = rows[r - 1 + i];
            for (let j = 0; j < nc; j++) row[c - 1 + j] = values[i][j];
          }
        },
      };
    },
    deleteRow(idx) { rows.splice(idx - 1, 1); },
  };
}

/** Dựng sandbox Apps Script tối giản + chạy Code.gs trong đó. `overrides` thay thế trực
 *  tiếp trong TEXT nguồn trước khi chạy (vd đổi REGISTRATION_MODE) — cùng kỹ thuật đã dùng
 *  ở dga-logic.js (nhánh Node dùng vm.runInContext) để mô phỏng "sửa hằng số rồi chạy lại".
 *  Trả về { ctx, sheets }: `ctx` gọi được MỌI hàm top-level (function tự gắn vào global của
 *  vm context), nhưng KHÔNG gọi được hằng số khai báo bằng `const` (VD ctx.USER_HEADERS) —
 *  đặc điểm của vm: top-level const/let sống trong 1 lexical scope RIÊNG của script, không
 *  gắn vào global object như function/var (functions bên trong Code.gs vẫn đọc được các
 *  const đó bình thường vì chúng cùng chung 1 script). Test nào cần soi/sửa trực tiếp dữ
 *  liệu 1 sheet (không qua doGet/doPost) thì dùng `sheets` (Map tên sheet -> sheet stub, xem
 *  makeSheetStub()) thay vì cố truy cập hằng số qua ctx. */
function createSandbox(overrides) {
  const sheets = new Map(); // name -> sheet stub
  const cache = new Map();
  let uuidCounter = 0;

  let source = SOURCE;
  Object.entries(overrides || {}).forEach(([pattern, replacement]) => {
    const before = source;
    source = source.replace(pattern, replacement);
    if (source === before) throw new Error("override không khớp gì trong Code.gs: " + pattern);
  });

  const context = {
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (name) => sheets.get(name) || null,
        insertSheet: (name) => {
          // Code.gs luôn gọi appendRow(headers) NGAY sau insertSheet() trong getOrCreateSheet()
          // — sheet stub cần tiêu đề thật, nên tạo rỗng rồi để getOrCreateSheet() tự appendRow.
          const sh = makeSheetStub([]);
          sh._rows.length = 0; // bỏ hàng tiêu đề rỗng vừa tạo, chờ appendRow(headers) thật
          sheets.set(name, sh);
          return sh;
        },
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cache.has(k) ? cache.get(k) : null),
        put: (k, v) => cache.set(k, v),
        remove: (k) => cache.delete(k),
      }),
    },
    ContentService: {
      MimeType: { JSON: "JSON" },
      createTextOutput: (text) => ({
        _text: text,
        setMimeType() { return this; },
        getContent() { return this._text; },
      }),
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: "SHA_256" },
      computeDigest: (_algo, str) => Array.from(crypto.createHash("sha256").update(str).digest()),
      getUuid: () => { uuidCounter += 1; return "test-uuid-" + uuidCounter; },
      base64Decode: (s) => Buffer.from(s, "base64"),
      newBlob: (bytes, mimeType, name) => ({ bytes, mimeType, name }),
      formatDate: (date) => date.toISOString().slice(0, 10),
    },
    Session: { getScriptTimeZone: () => "Asia/Ho_Chi_Minh" },
    Logger: { log: () => {} },
    DriveApp: {}, // không dùng trong các test này (actionUploadAttachment ngoài phạm vi)
    UrlFetchApp: {}, // không dùng (actionGoogleLogin ngoài phạm vi)
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "Code.gs" });
  return { ctx: context, sheets };
}

/** Thứ tự cột thật của sheet "users" trong Code.gs (USER_HEADERS) — chép lại Ở ĐÂY vì test
 *  không lấy được hằng số này qua ctx (xem ghi chú ở createSandbox()). Nếu Code.gs đổi thứ
 *  tự cột, test "tài khoản Google..." bên dưới sẽ ĐỌC SAI CỘT và lộ ra ngay (assert sai) —
 *  chấp nhận được vì chỉ 1 test dùng tới, không đáng thêm cơ chế trích xuất tự động. */
const USER_HEADERS_COPY = ["id", "email", "password_hash", "password_salt", "role", "created_at", "last_login", "auth_provider"];

/** Gọi doGet(e)/doPost(e) như Apps Script thật gọi, rồi parse JSON trả về. */
function callGet(ctx, action, params) {
  const e = { parameter: Object.assign({ action }, params || {}) };
  return JSON.parse(ctx.doGet(e).getContent());
}
function callPost(ctx, action, body) {
  const e = { postData: { contents: JSON.stringify(Object.assign({ action }, body || {})) } };
  return JSON.parse(ctx.doPost(e).getContent());
}

/** Đăng ký 1 tài khoản mới rồi trả về { token, email, role } — tiện dùng lặp lại. */
function registerUser(ctx, email, password) {
  const res = callPost(ctx, "register", { email, password: password || "matkhau123" });
  if (res.error) throw new Error("registerUser lỗi: " + res.error);
  return res;
}

describe("Đăng ký / đăng nhập cơ bản (hồi quy — không phải tính năng mới)", () => {
  test("email trùng ADMIN_EMAIL trong Code.gs tự được cấp role admin", () => {
    const { ctx } = createSandbox();
    const admin = registerUser(ctx, "quantrong77@gmail.com");
    expect(admin.role).toBe("admin");
  });
  test("email khác mặc định role user; sai mật khẩu/email không đăng nhập được", () => {
    const { ctx } = createSandbox();
    const u = registerUser(ctx, "ky.su.a@vidu.com");
    expect(u.role).toBe("user");
    expect(callPost(ctx, "login", { email: "ky.su.a@vidu.com", password: "sai" }).error).toMatch(/không đúng/);
    expect(callGet(ctx, "listMeasurements", { token: "token-khong-ton-tai" }).error).toBeTruthy();
  });
  test("đăng ký trùng email bị từ chối; mật khẩu < 6 ký tự bị từ chối", () => {
    const { ctx } = createSandbox();
    registerUser(ctx, "a@vidu.com");
    expect(callPost(ctx, "register", { email: "a@vidu.com", password: "matkhau123" }).error).toMatch(/đã được đăng ký/);
    expect(callPost(ctx, "register", { email: "b@vidu.com", password: "123" }).error).toMatch(/ít nhất 6/);
  });
});

describe("Vai trò 'viewer' — chỉ đọc, không ghi dữ liệu thiết bị", () => {
  function setupViewer() {
    const { ctx } = createSandbox();
    const admin = registerUser(ctx, "quantrong77@gmail.com");
    const viewer = registerUser(ctx, "viewer@vidu.com");
    const setRoleRes = callPost(ctx, "setUserRole", { token: admin.token, email: viewer.email, role: "viewer" });
    expect(setRoleRes.role).toBe("viewer");
    return { ctx, admin, viewerEmail: viewer.email };
  }

  test("sau khi đổi role, viewer đăng nhập lại nhận đúng role 'viewer'", () => {
    const { ctx, viewerEmail } = setupViewer();
    const login = callPost(ctx, "login", { email: viewerEmail, password: "matkhau123" });
    expect(login.role).toBe("viewer");
  });

  test("viewer KHÔNG thêm được lần đo/thí nghiệm dầu (bị requireWriter chặn)", () => {
    const { ctx, viewerEmail } = setupViewer();
    const login = callPost(ctx, "login", { email: viewerEmail, password: "matkhau123" });
    const rec = { id: "m1", tram: "T1", thiet_bi: "TI01", sample_date: "2026-01-01", h2: 1 };
    expect(callPost(ctx, "addMeasurement", { token: login.token, record: rec }).error).toMatch(/chỉ có quyền xem/);
    expect(callPost(ctx, "addOilTest", { token: login.token, record: { id: "o1" } }).error).toMatch(/chỉ có quyền xem/);
    expect(callPost(ctx, "addOltcOilTest", { token: login.token, record: { id: "ot1" } }).error).toMatch(/chỉ có quyền xem/);
    expect(callPost(ctx, "addInstrumentOilTest", { token: login.token, record: { id: "it1" } }).error).toMatch(/chỉ có quyền xem/);
  });

  test("viewer VẪN đọc được dữ liệu và gửi được góp ý", () => {
    const { ctx, viewerEmail } = setupViewer();
    const login = callPost(ctx, "login", { email: viewerEmail, password: "matkhau123" });
    expect(callGet(ctx, "listMeasurements", { token: login.token }).error).toBeUndefined();
    const fb = callPost(ctx, "addFeedback", { token: login.token, record: { id: "f1", content: "góp ý" } });
    expect(fb.error).toBeUndefined();
    expect(fb.created_by).toBe(viewerEmail);
  });

  test("user thường (không phải viewer) vẫn nhập bình thường — không bị chặn nhầm", () => {
    const { ctx } = createSandbox();
    const u = registerUser(ctx, "user@vidu.com");
    const rec = { id: "m2", tram: "T1", thiet_bi: "TI02", sample_date: "2026-01-01", h2: 1 };
    const res = callPost(ctx, "addMeasurement", { token: u.token, record: rec });
    expect(res.error).toBeUndefined();
    expect(res.created_by).toBe(u.email);
  });

  test("setUserRole với giá trị role rác tự rơi về 'user' (không tạo role lạ)", () => {
    const { ctx } = createSandbox();
    const admin = registerUser(ctx, "quantrong77@gmail.com");
    const u = registerUser(ctx, "u2@vidu.com");
    const res = callPost(ctx, "setUserRole", { token: admin.token, email: u.email, role: "superadmin" });
    expect(res.role).toBe("user");
  });
});

describe("Chế độ đăng ký (REGISTRATION_MODE)", () => {
  test("registrationInfo mặc định trả 'open' (không cần token)", () => {
    const { ctx } = createSandbox();
    expect(callGet(ctx, "registrationInfo")).toEqual({ mode: "open", domain: "" });
  });

  test("REGISTRATION_MODE='closed': người thường không đăng ký được, ADMIN_EMAIL vẫn đăng ký được", () => {
    const { ctx } = createSandbox({ 'const REGISTRATION_MODE = "open";': 'const REGISTRATION_MODE = "closed";' });
    expect(callGet(ctx, "registrationInfo").mode).toBe("closed");
    expect(callPost(ctx, "register", { email: "ai.do@vidu.com", password: "matkhau123" }).error).toMatch(/đang ĐÓNG/);
    const admin = registerUser(ctx, "quantrong77@gmail.com");
    expect(admin.role).toBe("admin");
  });

  test("REGISTRATION_MODE='domain': chỉ email đúng domain mới đăng ký được", () => {
    const { ctx } = createSandbox({
      'const REGISTRATION_MODE = "open";': 'const REGISTRATION_MODE = "domain";',
      'const ALLOWED_EMAIL_DOMAIN = "";': 'const ALLOWED_EMAIL_DOMAIN = "evn.com.vn";',
    });
    expect(callPost(ctx, "register", { email: "a@gmail.com", password: "matkhau123" }).error).toMatch(/@evn\.com\.vn/);
    const ok = registerUser(ctx, "ky.su@evn.com.vn");
    expect(ok.role).toBe("user");
  });

  test("chế độ 'closed': Admin vẫn tạo được tài khoản mới qua adminCreateUser (đường thay thế)", () => {
    const { ctx } = createSandbox({ 'const REGISTRATION_MODE = "open";': 'const REGISTRATION_MODE = "closed";' });
    const admin = registerUser(ctx, "quantrong77@gmail.com");
    const created = callPost(ctx, "adminCreateUser", { token: admin.token, email: "moi@vidu.com", role: "user" });
    expect(created.error).toBeUndefined();
    expect(created.tempPassword).toMatch(/^[0-9a-f]{10}$/);
    const login = callPost(ctx, "login", { email: "moi@vidu.com", password: created.tempPassword });
    expect(login.error).toBeUndefined();
    expect(login.role).toBe("user");
  });
});

describe("actionAdminCreateUser", () => {
  test("chỉ Admin gọi được; role không hợp lệ rơi về 'user'; trùng email bị từ chối", () => {
    const { ctx } = createSandbox();
    const admin = registerUser(ctx, "quantrong77@gmail.com");
    const u = registerUser(ctx, "thuong@vidu.com");
    expect(callPost(ctx, "adminCreateUser", { token: u.token, email: "x@vidu.com" }).error).toMatch(/Chỉ Admin/);
    const created = callPost(ctx, "adminCreateUser", { token: admin.token, email: "y@vidu.com", role: "vai-tro-la" });
    expect(created.role).toBe("user");
    expect(callPost(ctx, "adminCreateUser", { token: admin.token, email: "quantrong77@gmail.com" }).error).toMatch(/đã có tài khoản/);
  });
  test("tạo được vai trò viewer trực tiếp", () => {
    const { ctx } = createSandbox();
    const admin = registerUser(ctx, "quantrong77@gmail.com");
    const created = callPost(ctx, "adminCreateUser", { token: admin.token, email: "v@vidu.com", role: "viewer" });
    expect(created.role).toBe("viewer");
  });
});

describe("Đổi mật khẩu tự phục vụ (actionChangePassword)", () => {
  test("mật khẩu cũ sai bị từ chối; mật khẩu mới quá ngắn bị từ chối", () => {
    const { ctx } = createSandbox();
    const u = registerUser(ctx, "a@vidu.com", "matkhaucu1");
    expect(callPost(ctx, "changePassword", { token: u.token, oldPassword: "sai", newPassword: "matkhaumoi1" }).error)
      .toMatch(/không đúng/);
    expect(callPost(ctx, "changePassword", { token: u.token, oldPassword: "matkhaucu1", newPassword: "123" }).error)
      .toMatch(/ít nhất/);
  });

  test("đổi đúng: đăng nhập được bằng mật khẩu MỚI, không đăng nhập được bằng mật khẩu CŨ", () => {
    const { ctx } = createSandbox();
    const u = registerUser(ctx, "a@vidu.com", "matkhaucu1");
    const res = callPost(ctx, "changePassword", { token: u.token, oldPassword: "matkhaucu1", newPassword: "matkhaumoi1" });
    expect(res.error).toBeUndefined();
    expect(res.token).toBeTruthy();
    expect(callPost(ctx, "login", { email: "a@vidu.com", password: "matkhaucu1" }).error).toBeTruthy();
    expect(callPost(ctx, "login", { email: "a@vidu.com", password: "matkhaumoi1" }).error).toBeUndefined();
  });

  test("token CŨ bị hủy ngay sau khi đổi mật khẩu; token MỚI trả về dùng được luôn", () => {
    const { ctx } = createSandbox();
    const u = registerUser(ctx, "a@vidu.com", "matkhaucu1");
    const res = callPost(ctx, "changePassword", { token: u.token, oldPassword: "matkhaucu1", newPassword: "matkhaumoi1" });
    expect(callGet(ctx, "listMeasurements", { token: u.token }).error).toMatch(/không hợp lệ/);
    expect(callGet(ctx, "listMeasurements", { token: res.token }).error).toBeUndefined();
  });

  test("tài khoản Google (chưa có mật khẩu) không tự đổi được qua đây", () => {
    const { ctx, sheets } = createSandbox();
    const u = registerUser(ctx, "a@vidu.com", "matkhaucu1");
    // Mô phỏng tài khoản chỉ đăng nhập Google: xóa sạch password_hash trực tiếp trong sheet
    // stub (truy cập qua `sheets`, xem USER_HEADERS_COPY — không lấy được hằng số qua ctx).
    const usersSheet = sheets.get("users");
    const idxHash = USER_HEADERS_COPY.indexOf("password_hash");
    usersSheet._rows[1][idxHash] = "";
    expect(callPost(ctx, "changePassword", { token: u.token, oldPassword: "", newPassword: "matkhaumoi1" }).error)
      .toMatch(/không đúng/);
  });
});

describe("Admin đặt lại mật khẩu cho người khác (actionAdminResetPassword)", () => {
  test("chỉ Admin gọi được; user thường không tự đặt lại mật khẩu người khác", () => {
    const { ctx } = createSandbox();
    const admin = registerUser(ctx, "quantrong77@gmail.com");
    const u = registerUser(ctx, "a@vidu.com");
    expect(callPost(ctx, "adminResetPassword", { token: u.token, email: admin.email }).error).toMatch(/Chỉ Admin/);
  });

  test("mật khẩu tạm đăng nhập được; mật khẩu CŨ hết tác dụng", () => {
    const { ctx } = createSandbox();
    const admin = registerUser(ctx, "quantrong77@gmail.com");
    const u = registerUser(ctx, "a@vidu.com", "matkhaucu1");
    const reset = callPost(ctx, "adminResetPassword", { token: admin.token, email: "a@vidu.com" });
    expect(reset.tempPassword).toMatch(/^[0-9a-f]{10}$/);
    expect(callPost(ctx, "login", { email: "a@vidu.com", password: "matkhaucu1" }).error).toBeTruthy();
    expect(callPost(ctx, "login", { email: "a@vidu.com", password: reset.tempPassword }).error).toBeUndefined();
  });

  test("hủy MỌI phiên cũ của tài khoản đó (đăng xuất khỏi mọi thiết bị)", () => {
    const { ctx } = createSandbox();
    const admin = registerUser(ctx, "quantrong77@gmail.com");
    const session1 = registerUser(ctx, "a@vidu.com", "matkhaucu1");
    const session2 = callPost(ctx, "login", { email: "a@vidu.com", password: "matkhaucu1" });
    expect(callGet(ctx, "listMeasurements", { token: session1.token }).error).toBeUndefined();
    expect(callGet(ctx, "listMeasurements", { token: session2.token }).error).toBeUndefined();
    callPost(ctx, "adminResetPassword", { token: admin.token, email: "a@vidu.com" });
    expect(callGet(ctx, "listMeasurements", { token: session1.token }).error).toMatch(/không hợp lệ/);
    expect(callGet(ctx, "listMeasurements", { token: session2.token }).error).toMatch(/không hợp lệ/);
  });

  test("không tìm thấy email báo lỗi rõ ràng, không ném exception", () => {
    const { ctx } = createSandbox();
    const admin = registerUser(ctx, "quantrong77@gmail.com");
    expect(callPost(ctx, "adminResetPassword", { token: admin.token, email: "khong-ton-tai@vidu.com" }).error)
      .toMatch(/Không tìm thấy/);
  });
});

describe("Không phá vỡ hành vi cũ (prepareOwnedRecord — hồi quy)", () => {
  test("user thường chỉ sửa được bản ghi của chính mình; Admin sửa được mọi bản ghi", () => {
    const { ctx } = createSandbox();
    const admin = registerUser(ctx, "quantrong77@gmail.com");
    const u1 = registerUser(ctx, "u1@vidu.com");
    const u2 = registerUser(ctx, "u2@vidu.com");
    const rec = { id: "m1", tram: "T1", thiet_bi: "TI01", sample_date: "2026-01-01", h2: 1 };
    callPost(ctx, "addMeasurement", { token: u1.token, record: rec });

    expect(callPost(ctx, "addMeasurement", { token: u2.token, record: { ...rec, h2: 2 } }).error)
      .toMatch(/chỉ được sửa bản ghi do chính mình/);
    expect(callPost(ctx, "addMeasurement", { token: admin.token, record: { ...rec, h2: 3 } }).error).toBeUndefined();
  });

  test("xóa bản ghi luôn yêu cầu Admin, kể cả chủ bản ghi", () => {
    const { ctx } = createSandbox();
    const admin = registerUser(ctx, "quantrong77@gmail.com");
    const u1 = registerUser(ctx, "u1@vidu.com");
    const rec = { id: "m1", tram: "T1", thiet_bi: "TI01", sample_date: "2026-01-01", h2: 1 };
    callPost(ctx, "addMeasurement", { token: u1.token, record: rec });
    expect(callPost(ctx, "deleteMeasurement", { token: u1.token, id: "m1" }).error).toMatch(/Chỉ Admin/);
    expect(callPost(ctx, "deleteMeasurement", { token: admin.token, id: "m1" }).deleted).toBe(true);
  });
});
