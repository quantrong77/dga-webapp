// scripts/build-pages-site.js — artifact GitHub Pages chỉ gồm file web (danh sách cho phép), không lộ dữ liệu.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { build } = require("../scripts/build-pages-site");

let out;
let files;
beforeAll(() => {
  out = fs.mkdtempSync(path.join(os.tmpdir(), "dga-pages-site-"));
  const res = build(out);
  expect(res.missing).toEqual([]);
  files = [];
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), r);
      else files.push(r);
    }
  };
  walk(out, "");
});
afterAll(() => fs.rmSync(out, { recursive: true, force: true }));

describe("build-pages-site", () => {
  test("có đủ file khởi động app", () => {
    ["index.html", "sw.js", "manifest.webmanifest", "config.js", "src/presentation/app-core.js", "mobile/index.html"].forEach((f) =>
      expect(files).toContain(f)
    );
    expect(files.some((f) => f.startsWith("template/template-") && f.endsWith(".docx"))).toBe(true);
  });

  test("không chứa dữ liệu / mã máy chủ / tài liệu nội bộ", () => {
    const forbiddenDirs = ["data/", "server/", "tests/", "scripts/", "docs/", "gsheet/", "supabase/", "pdf/", "node_modules/", ".git/", ".github/"];
    forbiddenDirs.forEach((d) => expect(files.filter((f) => f.startsWith(d))).toEqual([]));
    expect(files.filter((f) => /\.md$/i.test(f))).toEqual([]);
    expect(files.filter((f) => /(^|\/)~\$/.test(f))).toEqual([]);
    expect(files.filter((f) => /database\.json|\.tmp$|\.bak$/i.test(f))).toEqual([]);
    expect(files.filter((f) => f.endsWith(".gs") || f.endsWith(".sql"))).toEqual([]);
  });

  test("template/ chỉ gồm mẫu template-*.docx (không có BBTN thật)", () => {
    files
      .filter((f) => f.startsWith("template/"))
      .forEach((f) => expect(path.basename(f)).toMatch(/^template-[\w.-]+\.docx$/));
  });

  test("từ chối thư mục ra là gốc dự án", () => {
    expect(() => build(path.resolve(__dirname, ".."))).toThrow(/không hợp lệ/);
  });
});
