// Tài liệu hướng dẫn người dùng: user_manual.md là nguồn duy nhất; tab "Hướng dẫn" trong index.html được SINH từ đó
// (scripts/build-user-guide.js, cần pandoc). Test bảo đảm cấu trúc tài liệu đúng và tab trong app không lỗi thời.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { ROOT } = require("./scripts-helpers");
const { parseSections } = require("../scripts/build-user-guide");

const manual = fs.readFileSync(path.join(ROOT, "user_manual.md"), "utf8").replace(/\r\n/g, "\n");
const sections = parseSections(manual);

function pandocAvailable() {
  const r = spawnSync("pandoc", ["--version"], { encoding: "utf8" });
  return !r.error && r.status === 0;
}

describe("user_manual.md", () => {
  test("có 19 mục đánh số liên tục 1..19", () => {
    expect(sections.map((s) => parseInt(s.title, 10))).toEqual(Array.from({ length: 19 }, (_, i) => i + 1));
  });
  test("mục lục liệt kê đúng các mục và link nội bộ trỏ đúng tiêu đề", () => {
    const toc = manual.split("## Mục lục")[1].split("\n---")[0];
    const items = [...toc.matchAll(/^\d+\. \[(.+?)\]\(#(.+?)\)$/gm)];
    expect(items).toHaveLength(19);
    items.forEach((m, i) => {
      // Tiêu đề mục i+1 trong tài liệu phải bằng chữ trong mục lục (bỏ số thứ tự đầu dòng).
      expect(sections[i].title.replace(/^\d+\.\s*/, "")).toBe(m[1]);
    });
  });
  test("không còn tên file/tab đã đổi và các file được nhắc đến đều tồn tại", () => {
    expect(manual).not.toMatch(/HUONG-DAN-SU-DUNG|Quy trình lấy mẫu\b.*Quy trình đánh giá\b/);
    ["README.md", "Features-web-app.md", "mobile/README.md"].forEach((f) => {
      if (manual.includes("`" + f + "`")) expect(fs.existsSync(path.join(ROOT, f))).toBe(true);
    });
  });
  test("tên các tab được nhắc trong mục 3.1 khớp với thanh tab thật của index.html", () => {
    const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    const realTabs = [...html.matchAll(/class="tab-btn[^"]*"[^>]*data-tab="[a-z]+"[^>]*title="([^"]+)"/g)].map((m) => m[1]);
    const table = manual.split("### 3.1. Các tab")[1].split("### 3.2")[0];
    const documented = [...table.matchAll(/^\| \*\*(.+?)\*\* \|/gm)].map((m) => m[1]);
    // "Hướng dẫn" là nhãn ngắn của tab có title "Hướng dẫn sử dụng".
    const normalizeTab = (t) => (t === "Hướng dẫn sử dụng" ? "Hướng dẫn" : t);
    const missingInManual = realTabs.map(normalizeTab).filter((t) => !documented.includes(t));
    expect(missingInManual).toEqual([]);
  });
});

const maybe = pandocAvailable() ? test : test.skip;
describe("tab Hướng dẫn trong app", () => {
  maybe("index.html khớp user_manual.md (nếu lỗi: chạy `npm run build-guide`)", () => {
    const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", "build-user-guide.js"), "--check"], { encoding: "utf8" });
    expect({ status: r.status, out: r.stderr.replace(/\(node:\d+\)[^\n]*\n?/g, "").trim() }).toEqual({ status: 0, out: "" });
  });
  test("index.html có cặp dấu USER-GUIDE:BEGIN/END và đúng 19 khối mục", () => {
    const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    const b = html.indexOf("<!-- USER-GUIDE:BEGIN");
    const e = html.indexOf("<!-- USER-GUIDE:END -->");
    expect(b).toBeGreaterThan(0);
    expect(e).toBeGreaterThan(b);
    expect(html.slice(b, e).split('<details class="mm-node">').length - 1).toBe(19);
  });
});
