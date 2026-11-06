/**
 * @jest-environment node
 */
/* tests/local-server-storage.test.js
 * Kiểm thử toàn diện Tầng Lưu trữ & Máy chủ nội bộ On-Premise (Localhost / LAN Server).
 */
const fs = require("fs");
const path = require("path");
const { db, DATA_DIR, UPLOADS_DIR } = require("../server/db");
const auth = require("../server/auth");
const { handleApiRequest, handleFileDownload } = require("../server/api");

describe("1. Embedded Database (server/db.js)", () => {
  beforeAll(() => {
    db.init();
  });

  test("Khởi tạo thành công thư mục data và các bảng CSDL mặc định", () => {
    expect(fs.existsSync(DATA_DIR)).toBe(true);
    expect(fs.existsSync(UPLOADS_DIR)).toBe(true);
    const tables = [
      "measurements",
      "oil_tests",
      "oltc_oil_tests",
      "instrument_oil_tests",
      "stations",
      "standards",
      "regulation_config",
      "feedback",
      "users",
      "sessions",
    ];
    tables.forEach((t) => {
      expect(Array.isArray(db.getTable(t))).toBe(true);
    });
  });

  test("Thao tác CRUD cơ bản trên bảng measurements", () => {
    const testId = "test_m_" + Date.now();
    const testRec = {
      id: testId,
      station: "TBA 500kV Di Linh",
      device: "AT2",
      sample_date: "2026-10-15",
      h2: 12.5,
      ch4: 8.2,
      c2h2: 0.5,
    };
    db.upsert("measurements", testRec, "id");
    const found = db.find("measurements", (r) => r.id === testId);
    expect(found).toBeTruthy();
    expect(found.station).toBe("TBA 500kV Di Linh");
    expect(found.h2).toBe(12.5);

    // Cập nhật
    db.upsert("measurements", { id: testId, h2: 15.0 }, "id");
    const updated = db.find("measurements", (r) => r.id === testId);
    expect(updated.h2).toBe(15.0);

    // Xóa
    const res = db.delete("measurements", testId, "id");
    expect(res.ok).toBe(true);
    expect(db.find("measurements", (r) => r.id === testId)).toBeNull();
  });
});

describe("2. On-Premise Authentication & RBAC (server/auth.js)", () => {
  let adminToken = null;

  beforeAll(() => {
    auth.initDefaultAdmin();
  });

  test("Đăng nhập bằng tài khoản quản trị nội bộ mặc định", () => {
    const res = auth.login("admin@ptc3.evnnpt.vn", "admin123456");
    expect(res.error).toBeUndefined();
    expect(res.token).toBeDefined();
    expect(res.role).toBe("admin");
    adminToken = res.token;
  });

  test("Từ chối mật khẩu không đúng", () => {
    const res = auth.login("admin@ptc3.evnnpt.vn", "wrong_password");
    expect(res.error).toBeDefined();
    expect(res.error).toContain("không chính xác");
  });

  test("Tạo tài khoản người dùng mới (Register)", () => {
    const testEmail = "kythuat_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6) + "@ptc3.evnnpt.vn";
    const res = auth.register(testEmail, "password123");
    expect(res.error).toBeUndefined();
    expect(res.token).toBeDefined();
    expect(res.role).toBe("user");

    const session = auth.requireSession(res.token);
    expect(session.email).toBe(testEmail);
  });

  test("Khóa tài khoản (Throttle) sau 5 lần nhập sai liên tiếp", () => {
    const targetEmail = "throttle_" + Date.now() + "@ptc3.evnnpt.vn";
    auth.register(targetEmail, "validpass123");

    for (let i = 0; i < 5; i++) {
      auth.login(targetEmail, "wrongpass");
    }

    const lockedRes = auth.login(targetEmail, "wrongpass");
    expect(lockedRes.error).toContain("tạm khóa đăng nhập");
  });

  test("Admin có quyền cấp lại mật khẩu tạm và đổi role", () => {
    const userEmail = "role_" + Date.now() + "@ptc3.evnnpt.vn";
    auth.register(userEmail, "initialpass123");

    // Đổi role
    const roleRes = auth.setUserRole(adminToken, userEmail, "viewer");
    expect(roleRes.ok).toBe(true);
    expect(roleRes.role).toBe("viewer");

    // Reset mật khẩu
    const resetRes = auth.adminResetPassword(adminToken, userEmail);
    expect(resetRes.ok).toBe(true);
    expect(resetRes.tempPassword).toBeDefined();

    // Đăng nhập bằng mật khẩu tạm
    const loginTemp = auth.login(userEmail, resetRes.tempPassword);
    expect(loginTemp.mustChangePassword).toBe(true);
  });
});

describe("3. API Endpoints & File Uploads (server/api.js)", () => {
  let sessionToken = null;

  beforeAll(() => {
    const loginRes = auth.login("admin@ptc3.evnnpt.vn", "admin123456");
    sessionToken = loginRes.token;
  });

  // Mock Request / Response helper
  function mockReqRes(method, urlStr, body = null) {
    const urlObj = new URL(urlStr, "http://localhost:8080");
    const EventEmitter = require("events");
    const req = new EventEmitter();
    req.method = method;
    req.url = urlObj.pathname + urlObj.search;
    req.headers = { host: "localhost:8080" };

    const res = {
      statusCode: 200,
      headers: {},
      body: "",
      writeHead(code, h) {
        this.statusCode = code;
        this.headers = h || {};
      },
      end(chunk) {
        if (chunk) this.body += chunk;
      },
    };

    setImmediate(() => {
      if (body) {
        req.emit("data", typeof body === "string" ? body : JSON.stringify(body));
      }
      req.emit("end");
    });

    return { req, res, urlObj };
  }

  test("GET /api?action=health trả về thông tin máy chủ nội bộ", async () => {
    const { req, res, urlObj } = mockReqRes("GET", "/api?action=health");
    await handleApiRequest(req, res, urlObj);
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.status).toBe("ok");
    expect(data.mode).toBe("on-premise");
    expect(data.tables).toBeDefined();
  });

  test("POST /api action=uploadAttachment lưu file PDF vào thư mục data/uploads/", async () => {
    const samplePdfBase64 = Buffer.from("%PDF-1.4 test DGA content for internal server").toString("base64");
    const payload = {
      action: "uploadAttachment",
      token: sessionToken,
      filename: "Bien_ban_DGA_2026_AT2.pdf",
      mimeType: "application/pdf",
      base64Data: samplePdfBase64,
    };

    const { req, res, urlObj } = mockReqRes("POST", "/api", payload);
    await handleApiRequest(req, res, urlObj);

    expect(res.statusCode).toBe(200);
    const result = JSON.parse(res.body);
    expect(result.id).toBeDefined();
    expect(result.url).toContain("/api/files/");
    expect(result.name).toBe("Bien_ban_DGA_2026_AT2.pdf");

    // Kiểm tra file có thực sự nằm trên ổ cứng máy chủ nội bộ
    const savedFilePath = path.join(UPLOADS_DIR, result.id);
    expect(fs.existsSync(savedFilePath)).toBe(true);

    const fileContent = fs.readFileSync(savedFilePath, "utf8");
    expect(fileContent).toContain("%PDF-1.4 test DGA content");
  });

  test("Thao tác Thêm và Liệt kê Measurements qua API", async () => {
    const testMId = "api_test_m_" + Date.now();
    const mRecord = {
      id: testMId,
      station: "TBA 500kV Pleiku 2",
      device: "572",
      sample_date: "2026-10-20",
      h2: 5.0,
      ch4: 10.0,
      c2h4: 15.0,
    };

    // 1. Thêm bản ghi
    const addPayload = {
      action: "addMeasurement",
      token: sessionToken,
      record: mRecord,
    };
    const { req: addReq, res: addRes, urlObj: addUrl } = mockReqRes("POST", "/api", addPayload);
    await handleApiRequest(addReq, addRes, addUrl);
    expect(addRes.statusCode).toBe(200);

    // 2. Đọc lại danh sách
    const { req: listReq, res: listRes, urlObj: listUrl } = mockReqRes(
      "GET",
      `/api?action=listMeasurements&token=${sessionToken}`
    );
    await handleApiRequest(listReq, listRes, listUrl);
    expect(listRes.statusCode).toBe(200);
    const list = JSON.parse(listRes.body);
    const found = list.find((item) => item.id === testMId);
    expect(found).toBeDefined();
    expect(found.station).toBe("TBA 500kV Pleiku 2");
    expect(found.created_by).toBe("admin@ptc3.evnnpt.vn");
  });
});

describe("Cô lập dữ liệu test", () => {
  test("database của test nằm trong thư mục tạm riêng, không phải data/ của dự án", () => {
    const path = require("path");
    const projectData = path.resolve(__dirname, "..", "data");
    expect(path.resolve(DATA_DIR)).not.toBe(projectData);
    expect(path.resolve(DATA_DIR)).toBe(path.resolve(process.env.DGA_DATA_DIR));
  });
});
