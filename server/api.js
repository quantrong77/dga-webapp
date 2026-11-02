/* server/api.js — Bộ điều khiển API On-Premise (Localhost / LAN Server) cho DGA-Webapp.
 * Tương thích 100% với giao thức gọi của client (giống hệt Google Apps Script Web App).
 */
const fs = require("fs");
const path = require("path");
const { db, UPLOADS_DIR } = require("./db");
const auth = require("./auth");

// Khởi tạo bảng và Admin mặc định
auth.initDefaultAdmin();

function jsonResponse(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 50 * 1024 * 1024) {
        // Giới hạn 50MB cho tệp đính kèm
        reject(new Error("Dung lượng payload quá lớn (tối đa 50MB)"));
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        resolve({ rawBody: raw });
      }
    });
    req.on("error", reject);
  });
}

function prepareOwnedRecord(user, record, tableName) {
  const existing = record.id ? db.find(tableName, (r) => r.id === record.id) : null;
  const now = new Date().toISOString();
  if (existing) {
    const ownerEmail = String(existing.created_by || "").trim().toLowerCase();
    if (user.role !== "admin" && ownerEmail !== String(user.email || "").trim().toLowerCase()) {
      throw new Error(`Bạn chỉ được sửa bản ghi do chính mình nhập (bản ghi này do ${existing.created_by} nhập).`);
    }
    return {
      ...record,
      created_by: existing.created_by || user.email,
      updated_by: user.email,
      updated_at: now,
    };
  }
  return {
    ...record,
    created_by: user.email,
    updated_by: user.email,
    updated_at: now,
  };
}

async function handleApiRequest(req, res, urlObj) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // Phục vụ tải tệp đính kèm: /api/files/:filename
  if (urlObj.pathname.startsWith("/api/files/")) {
    return handleFileDownload(req, res, urlObj);
  }

  try {
    let action = urlObj.searchParams.get("action");
    let token = urlObj.searchParams.get("token");
    let body = {};

    if (req.method === "POST") {
      body = await parseBody(req);
      if (body.action) action = body.action;
      if (body.token) token = body.token;
    }

    if (!action) {
      return jsonResponse(res, { error: "Thiếu tham số action" }, 400);
    }

    // Health / Status endpoint
    if (action === "health" || action === "info") {
      return jsonResponse(res, {
        status: "ok",
        mode: "on-premise",
        message: "DGA-Webapp On-Premise Local Server đang hoạt động",
        time: new Date().toISOString(),
        tables: {
          measurements: db.getTable("measurements").length,
          oil_tests: db.getTable("oil_tests").length,
          oltc_oil_tests: db.getTable("oltc_oil_tests").length,
          instrument_oil_tests: db.getTable("instrument_oil_tests").length,
          users: db.getTable("users").length,
        },
      });
    }

    // AUTH ACTIONS
    if (action === "login") {
      return jsonResponse(res, auth.login(body.email, body.password));
    }
    if (action === "register") {
      return jsonResponse(res, auth.register(body.email, body.password));
    }
    if (action === "logout") {
      if (token) db.delete("sessions", token, "token");
      return jsonResponse(res, { ok: true });
    }
    if (action === "me") {
      const user = auth.requireSession(token, true);
      return jsonResponse(res, {
        email: user.email,
        role: user.role,
        hasPassword: Boolean(user.password_hash),
        mustChangePassword: String(user.must_change_password) === "1",
      });
    }
    if (action === "changePassword") {
      return jsonResponse(res, auth.changePassword(token, body.oldPassword, body.newPassword));
    }
    if (action === "adminResetPassword") {
      return jsonResponse(res, auth.adminResetPassword(token, body.email));
    }
    if (action === "adminCreateUser") {
      return jsonResponse(res, auth.adminCreateUser(token, body.email, body.role));
    }
    if (action === "listUsers") {
      return jsonResponse(res, auth.listUsers(token));
    }
    if (action === "setUserRole") {
      return jsonResponse(res, auth.setUserRole(token, body.email, body.role));
    }
    if (action === "deleteUser") {
      return jsonResponse(res, auth.deleteUser(token, body.email));
    }

    // TẢI LÊN TỆP ĐÍNH KÈM (PDF / ẢNH) VÀO Ổ ĐĨA MÁY CHỦ NỘI BỘ
    if (action === "uploadAttachment") {
      auth.requireSession(token);
      const filename = String(body.filename || "bien_ban_thi_nghiem.pdf");
      const base64Data = String(body.base64Data || "");
      if (!base64Data) {
        return jsonResponse(res, { error: "Thiếu dữ liệu tệp đính kèm" }, 400);
      }

      // Tạo tên tệp an toàn và lưu vào thư mục data/uploads/
      const cleanName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileId = `${Date.now()}_${cleanName}`;
      const filePath = path.join(UPLOADS_DIR, fileId);

      const buffer = Buffer.from(base64Data, "base64");
      fs.writeFileSync(filePath, buffer);

      const fileUrl = `/api/files/${encodeURIComponent(fileId)}`;
      return jsonResponse(res, {
        id: fileId,
        url: fileUrl,
        name: filename,
        size: buffer.length,
      });
    }

    // CÁC BẢNG DỮ LIỆU ĐO VÀ ĐÁNH GIÁ
    // 1. DGA Measurements
    if (action === "listMeasurements") {
      auth.requireSession(token);
      return jsonResponse(res, db.getTable("measurements"));
    }
    if (action === "addMeasurement") {
      const user = auth.requireSession(token);
      const record = prepareOwnedRecord(user, body.record, "measurements");
      const saved = db.upsert("measurements", record, "id");
      return jsonResponse(res, saved);
    }
    if (action === "deleteMeasurement") {
      auth.requireAdmin(token);
      return jsonResponse(res, db.delete("measurements", body.id, "id"));
    }

    // 2. Oil Tests (Thí nghiệm dầu MBA)
    if (action === "listOilTests") {
      auth.requireSession(token);
      return jsonResponse(res, db.getTable("oil_tests"));
    }
    if (action === "addOilTest") {
      const user = auth.requireSession(token);
      const record = prepareOwnedRecord(user, body.record, "oil_tests");
      const saved = db.upsert("oil_tests", record, "id");
      return jsonResponse(res, saved);
    }
    if (action === "deleteOilTest") {
      auth.requireAdmin(token);
      return jsonResponse(res, db.delete("oil_tests", body.id, "id"));
    }

    // 3. OLTC Oil Tests
    if (action === "listOltcOilTests") {
      auth.requireSession(token);
      return jsonResponse(res, db.getTable("oltc_oil_tests"));
    }
    if (action === "addOltcOilTest") {
      const user = auth.requireSession(token);
      const record = prepareOwnedRecord(user, body.record, "oltc_oil_tests");
      const saved = db.upsert("oltc_oil_tests", record, "id");
      return jsonResponse(res, saved);
    }
    if (action === "deleteOltcOilTest") {
      auth.requireAdmin(token);
      return jsonResponse(res, db.delete("oltc_oil_tests", body.id, "id"));
    }

    // 4. Instrument Oil Tests (TI/TU 3 pha)
    if (action === "listInstrumentOilTests") {
      auth.requireSession(token);
      return jsonResponse(res, db.getTable("instrument_oil_tests"));
    }
    if (action === "addInstrumentOilTest") {
      const user = auth.requireSession(token);
      const record = prepareOwnedRecord(user, body.record, "instrument_oil_tests");
      const saved = db.upsert("instrument_oil_tests", record, "id");
      return jsonResponse(res, saved);
    }
    if (action === "deleteInstrumentOilTest") {
      auth.requireAdmin(token);
      return jsonResponse(res, db.delete("instrument_oil_tests", body.id, "id"));
    }

    // 5. Stations (Danh mục Trạm biến áp)
    if (action === "listStations") {
      return jsonResponse(res, db.getTable("stations"));
    }
    if (action === "saveStation") {
      auth.requireAdmin(token);
      return jsonResponse(res, db.upsert("stations", body.record, "id"));
    }
    if (action === "deleteStation") {
      auth.requireAdmin(token);
      return jsonResponse(res, db.delete("stations", body.id, "id"));
    }

    // 6. Standards (Tiêu chuẩn nhà sản xuất)
    if (action === "listStandards") {
      return jsonResponse(res, db.getTable("standards"));
    }
    if (action === "saveStandard") {
      auth.requireAdmin(token);
      return jsonResponse(res, db.upsert("standards", body.record, "id"));
    }
    if (action === "deleteStandard") {
      auth.requireAdmin(token);
      return jsonResponse(res, db.delete("standards", body.id, "id"));
    }

    // 7. Regulation Config (Cấu hình quy chuẩn 13 bảng QĐ 1901)
    if (action === "listRegulationConfig") {
      return jsonResponse(res, db.getTable("regulation_config"));
    }
    if (action === "saveRegulationConfig") {
      auth.requireAdmin(token);
      return jsonResponse(res, db.upsert("regulation_config", body.record, "id"));
    }
    if (action === "deleteRegulationConfig") {
      auth.requireAdmin(token);
      return jsonResponse(res, db.delete("regulation_config", body.id, "id"));
    }

    // 8. Feedback
    if (action === "listFeedback") {
      auth.requireSession(token);
      return jsonResponse(res, db.getTable("feedback"));
    }
    if (action === "addFeedback") {
      const user = auth.requireSession(token);
      const record = {
        ...body.record,
        created_by: user.email,
        created_at: new Date().toISOString(),
      };
      return jsonResponse(res, db.upsert("feedback", record, "id"));
    }
    if (action === "deleteFeedback") {
      auth.requireAdmin(token);
      return jsonResponse(res, db.delete("feedback", body.id, "id"));
    }

    return jsonResponse(res, { error: `Hành động không xác định: ${action}` }, 400);
  } catch (err) {
    return jsonResponse(res, { error: err.message || String(err) }, 500);
  }
}

function handleFileDownload(req, res, urlObj) {
  const fileId = decodeURIComponent(urlObj.pathname.replace("/api/files/", ""));
  const safePath = path.normalize(path.join(UPLOADS_DIR, fileId));

  if (!safePath.startsWith(UPLOADS_DIR) || !fs.existsSync(safePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Tệp không tồn tại trên máy chủ nội bộ");
    return;
  }

  const ext = path.extname(safePath).toLowerCase();
  const mimeMap = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  const contentType = mimeMap[ext] || "application/octet-stream";

  const stat = fs.statSync(safePath);
  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": stat.size,
    "Content-Disposition": `inline; filename="${encodeURIComponent(path.basename(safePath))}"`,
    "Cache-Control": "public, max-age=3600",
  });
  fs.createReadStream(safePath).pipe(res);
}

module.exports = {
  handleApiRequest,
  handleFileDownload,
};

