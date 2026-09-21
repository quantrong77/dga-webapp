// Nhất quán tên cột/trường giữa lớp logic, Supabase (supabase-schema.sql) và Google Sheets (gsheet/Code.gs).
// Cùng 1 bản ghi được lưu ở 1 trong 3 nơi tùy cấu hình; 2 backend lệch tên cột thì dữ liệu sẽ mất/rỗng
// khi chuyển backend. Đây là bước "đồng bộ định nghĩa với nơi lưu trữ" của khuyến cáo TypeScript/kiểu dữ liệu.
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const { ROOT } = require("./scripts-helpers");
const { DGA } = require("./helpers");

const sql = fs.readFileSync(path.join(ROOT, "supabase-schema.sql"), "utf8").replace(/\r\n/g, "\n");
const gsAst = parser.parse(fs.readFileSync(path.join(ROOT, "gsheet", "Code.gs"), "utf8"), { sourceType: "script" });

/** Tập tên cột của 1 bảng trong supabase-schema.sql. */
function sqlColumns(table) {
  const start = sql.search(new RegExp(`create table if not exists ${table}\\s*\\(`, "i"));
  if (start < 0) return null;
  const body = sql.slice(sql.indexOf("(", start) + 1, sql.indexOf("\n);", start));
  const cols = new Set();
  body.split("\n").forEach((line) => {
    const code = line.replace(/--.*$/, "").trim();
    if (!code) return;
    // Mỗi dòng có thể khai báo nhiều cột ngăn bởi dấu phẩy (vd "h2 numeric, ch4 numeric, ...").
    code.split(",").forEach((part) => {
      const token = part.trim().split(/\s+/)[0];
      if (/^[a-z_][a-z_0-9]*$/.test(token) && !["primary", "unique", "constraint", "check", "foreign"].includes(token)) cols.add(token);
    });
  });
  return cols;
}

/** Tập tiêu đề cột của 1 mảng hằng số khai báo ở top-level của Code.gs (vd MEASUREMENT_HEADERS). */
function gsHeaders(name) {
  for (const n of gsAst.program.body) {
    if (n.type !== "VariableDeclaration") continue;
    for (const d of n.declarations) {
      if (d.id.name === name && d.init && d.init.type === "ArrayExpression") return new Set(d.init.elements.map((e) => e.value));
    }
  }
  return null;
}

// Chỉ chế độ Google Sheets có đăng nhập/phân quyền (Auth) và lưu file đính kèm lên Google Drive, nên các cột
// "lưu vết" người tạo/người sửa và id file Drive không có ở Supabase (xem chú thích trong supabase-schema.sql
// và README: Supabase chưa hỗ trợ phân quyền Admin/User). Cột nào KHÁC lệch giữa 2 backend đều bị test bắt.
const GSHEET_ONLY_COLUMNS = new Set(["created_by", "updated_by", "updated_at", "bbtn_file_id"]);

const PAIRS = [
  ["measurements", "MEASUREMENT_HEADERS"],
  ["oil_tests", "OILTEST_HEADERS"],
  ["oltc_oil_tests", "OLTC_OILTEST_HEADERS"],
  ["instrument_oil_tests", "INSTRUMENT_OILTEST_HEADERS"],
  ["manufacturer_standards", "STANDARD_HEADERS"],
  ["regulation_config", "REGULATION_CONFIG_HEADERS"],
];

describe.each(PAIRS)("bảng %s (Supabase) ↔ %s (Google Sheets)", (table, headersName) => {
  const sqlSet = sqlColumns(table);
  const gsSet = gsHeaders(headersName);

  test("đọc được định nghĩa ở cả 2 nơi", () => {
    expect(sqlSet).not.toBeNull();
    expect(gsSet).not.toBeNull();
  });
  test("cột chỉ có ở Supabase (thiếu ở Google Sheets) — nếu có: chỉ được là cột do backend tự sinh", () => {
    const onlySql = [...sqlSet].filter((c) => !gsSet.has(c));
    expect(onlySql).toEqual([]);
  });
  test("cột chỉ có ở Google Sheets (thiếu ở Supabase) — chỉ được là cột 'lưu vết'/Drive của riêng chế độ Google Sheets", () => {
    const onlyGs = [...gsSet].filter((c) => !sqlSet.has(c));
    expect(onlyGs.filter((c) => !GSHEET_ONLY_COLUMNS.has(c))).toEqual([]);
  });
});

describe("bản ghi lần đo khớp lớp logic", () => {
  const sqlSet = sqlColumns("measurements");
  const gsSet = gsHeaders("MEASUREMENT_HEADERS");

  test("7 khí trong DGA.GASES đều là cột chữ thường ở cả Supabase lẫn Google Sheets", () => {
    DGA.GASES.forEach((g) => {
      expect(sqlSet.has(g.toLowerCase())).toBe(true);
      expect(gsSet.has(g.toLowerCase())).toBe(true);
    });
  });
  test("có các cột N2, O2, cấp điện áp Bảng 63 và phân loại OLTC mà logic sử dụng", () => {
    ["n2", "o2", "bang63_voltage_class", "bang63_applicable", "mba_subtype", "equipment_type", "manufacturer"].forEach((c) => {
      expect({ col: c, sql: sqlSet.has(c), gsheet: gsSet.has(c) }).toEqual({ col: c, sql: true, gsheet: true });
    });
  });
});
