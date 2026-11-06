// Bảo mật dữ liệu (REFACTOR_PLAN Bước 0): data/database.json KHÔNG còn được git theo dõi.
// - backend/onpremise/db.js phải tự tạo database.json rỗng (đủ bảng) khi chưa có file;
// - data/database.example.json (bản mẫu trong repo) phải đúng cấu trúc bảng mặc định và không chứa dữ liệu;
// - .gitignore của thư mục dữ liệu phải bỏ qua database.json.
const fs = require("fs");
const path = require("path");
const { db, DATA_DIR, DB_FILE } = require("../backend/onpremise/db");

const ROOT = path.resolve(__dirname, "..");

describe("Khởi tạo database on-premise", () => {
  test("mặc định (không đặt DGA_DATA_DIR) thư mục dữ liệu là data/ ở GỐC dự án", () => {
    const { execFileSync } = require("child_process");
    const env = { ...process.env };
    delete env.DGA_DATA_DIR;
    const out = execFileSync(process.execPath, ["-e", 'process.stdout.write(require("./backend/onpremise/db").DATA_DIR)'], { cwd: ROOT, env, encoding: "utf8" });
    expect(path.resolve(out)).toBe(path.join(ROOT, "data"));
  });

  test("dùng thư mục dữ liệu tạm của bộ test, không phải data/ thật", () => {
    expect(path.resolve(DATA_DIR)).not.toBe(path.join(ROOT, "data"));
  });

  test("chưa có database.json → tự tạo file với đủ các bảng rỗng", () => {
    expect(fs.existsSync(DB_FILE)).toBe(false);
    db.init();
    expect(fs.existsSync(DB_FILE)).toBe(true);
    const created = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    const example = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "database.example.json"), "utf8"));
    expect(Object.keys(created).sort()).toEqual(Object.keys(example).sort());
    Object.values(created).forEach((rows) => expect(rows).toEqual([]));
  });

  test("database.example.json chỉ có bảng rỗng (không lộ users/sessions)", () => {
    const example = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "database.example.json"), "utf8"));
    expect(example).toHaveProperty("users");
    expect(example).toHaveProperty("sessions");
    Object.values(example).forEach((rows) => expect(rows).toEqual([]));
  });

  test(".gitignore (repo và bản tự sinh) bỏ qua database.json", () => {
    const lines = (p) => fs.readFileSync(p, "utf8").split(/\r?\n/).map((l) => l.trim());
    expect(lines(path.join(ROOT, "data", ".gitignore"))).toContain("database.json");
    expect(lines(path.join(DATA_DIR, ".gitignore"))).toContain("database.json");
  });
});
