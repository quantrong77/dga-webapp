/* server/db.js — Trình quản lý Cơ sở dữ liệu nội bộ (On-Premise Embedded Database) cho DGA-Webapp.
 * Lưu trữ dữ liệu chuẩn JSON dạng bảng có kiểm soát tính toàn vẹn (Atomic File Writes).
 * Dữ liệu đặt trong thư mục ./data/ của dự án hoặc máy chủ nội bộ.
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "..", "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "database.json");

const INITIAL_TABLES = {
  measurements: [],
  oil_tests: [],
  oltc_oil_tests: [],
  instrument_oil_tests: [],
  stations: [],
  standards: [],
  regulation_config: [],
  feedback: [],
  users: [],
  sessions: [],
};

class LocalDatabase {
  constructor() {
    this.data = { ...INITIAL_TABLES };
    this.isLoaded = false;
    this.writeLock = false;
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    // Tạo .gitignore trong data để tránh vô tình commit file rác hoặc biên bản nội bộ dung lượng lớn
    const gitignorePath = path.join(DATA_DIR, ".gitignore");
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(
        gitignorePath,
        "# Bỏ qua file nhị phân đính kèm và file tạm\nuploads/*\n!uploads/.gitkeep\n*.tmp\n",
        "utf8"
      );
    }
    const gitkeepPath = path.join(UPLOADS_DIR, ".gitkeep");
    if (!fs.existsSync(gitkeepPath)) {
      fs.writeFileSync(gitkeepPath, "", "utf8");
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, "utf8");
        const parsed = JSON.parse(raw);
        this.data = { ...INITIAL_TABLES, ...parsed };
      } catch (err) {
        console.error("Lỗi khi đọc database.json, khởi tạo bảng mặc định:", err);
        this.data = { ...INITIAL_TABLES };
        this.save();
      }
    } else {
      this.data = { ...INITIAL_TABLES };
      this.save();
    }
    this.isLoaded = true;
    return this;
  }

  save() {
    try {
      const tempFile = `${DB_FILE}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
      const jsonStr = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(tempFile, jsonStr, "utf8");
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.error("Lỗi khi lưu database.json:", err);
      throw err;
    }
  }

  getTable(tableName) {
    if (!this.isLoaded) this.init();
    if (!this.data[tableName]) {
      this.data[tableName] = [];
    }
    return this.data[tableName];
  }

  find(tableName, predicate) {
    const list = this.getTable(tableName);
    return list.find(predicate) || null;
  }

  filter(tableName, predicate) {
    const list = this.getTable(tableName);
    return list.filter(predicate);
  }

  upsert(tableName, record, keyField = "id") {
    const list = this.getTable(tableName);
    const keyVal = String(record[keyField] || "").trim();
    if (!keyVal) {
      throw new Error(`Bản ghi thiếu trường khóa chính: ${keyField}`);
    }

    const idx = list.findIndex(
      (item) => String(item[keyField] || "").trim().toLowerCase() === keyVal.toLowerCase()
    );

    if (idx >= 0) {
      list[idx] = { ...list[idx], ...record };
    } else {
      list.push({ ...record });
    }
    this.save();
    return idx >= 0 ? list[idx] : record;
  }

  delete(tableName, keyVal, keyField = "id") {
    const list = this.getTable(tableName);
    const target = String(keyVal || "").trim().toLowerCase();
    const initialLen = list.length;
    this.data[tableName] = list.filter(
      (item) => String(item[keyField] || "").trim().toLowerCase() !== target
    );
    const removedCount = initialLen - this.data[tableName].length;
    if (removedCount > 0) {
      this.save();
    }
    return { ok: true, removedCount };
  }
}

const dbInstance = new LocalDatabase();

module.exports = {
  db: dbInstance,
  DATA_DIR,
  UPLOADS_DIR,
  DB_FILE,
};
