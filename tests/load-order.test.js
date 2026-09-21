// Bảo vệ "thứ tự nạp là kiến thức ngầm" và ô nhiễm namespace của các script cổ điển (không phải ES module).
// Web nạp ~30 file bằng <script> thường dùng chung global scope: 2 file khai báo cùng 1 tên top-level sẽ
// hoặc gây SyntaxError (const/let) hoặc âm thầm ghi đè nhau (function/var) — test này bắt lỗi đó SỚM.
const fs = require("fs");
const path = require("path");
const { ROOT, localScripts, topLevelNames, stripComments } = require("./scripts-helpers");

describe.each(["index.html", "mobile/index.html"])("%s", (html) => {
  const classic = localScripts(html).filter((s) => !s.isModule);

  test("mọi file script cục bộ được tham chiếu đều tồn tại", () => {
    localScripts(html).forEach((s) => expect({ file: s.rel, exists: fs.existsSync(s.file) }).toEqual({ file: s.rel, exists: true }));
  });

  test("không có tên top-level nào bị khai báo ở 2 file khác nhau (không đè namespace)", () => {
    const owner = new Map();
    const dups = [];
    classic.forEach((s) => {
      topLevelNames(s.file).forEach((name) => {
        if (owner.has(name) && owner.get(name) !== s.rel) dups.push(`${name}: ${owner.get(name)} và ${s.rel}`);
        else owner.set(name, s.rel);
      });
    });
    expect(dups).toEqual([]);
  });

  test("mọi script cổ điển đều parse được (không lỗi cú pháp)", () => {
    classic.forEach((s) => expect(() => topLevelNames(s.file)).not.toThrow());
  });
});

describe("index.html (web) — thứ tự nạp", () => {
  const scripts = localScripts("index.html");
  const order = scripts.map((s) => s.rel);
  const idx = (rel) => order.indexOf(rel);

  test("ui/ui-errors.js nạp SỚM (trước logic/) để bắt cả lỗi lúc khởi động", () => {
    expect(idx("ui/ui-errors.js")).toBeGreaterThanOrEqual(0);
    expect(idx("ui/ui-errors.js")).toBeLessThan(idx("logic/dga-logic-core.js"));
  });
  test("logic/dga-logic-core.js là file logic đầu tiên; dga-logic.js (lắp ráp) nạp SAU mọi file logic/", () => {
    const logicFiles = order.filter((f) => f.startsWith("logic/"));
    expect(logicFiles[0]).toBe("logic/dga-logic-core.js");
    logicFiles.forEach((f) => expect(idx("dga-logic.js")).toBeGreaterThan(idx(f)));
  });
  test("config.js → logic → storage.js → ui/* → app-core.js (app-core.js cuối cùng)", () => {
    expect(idx("config.js")).toBeLessThan(idx("dga-logic.js"));
    expect(idx("dga-logic.js")).toBeLessThan(idx("storage.js"));
    order.filter((f) => f.startsWith("ui/") && f !== "ui/ui-errors.js").forEach((f) => expect(idx(f)).toBeGreaterThan(idx("storage.js")));
    expect(order[order.length - 1]).toBe("app-core.js");
  });
  test("ui/ui-auth.js (định nghĩa showToast) nạp trước các ui/* khác dùng nó", () => {
    order.filter((f) => f.startsWith("ui/") && !["ui/ui-errors.js", "ui/ui-auth.js"].includes(f)).forEach((f) => {
      expect(idx("ui/ui-auth.js")).toBeLessThan(idx(f));
    });
  });
  test("không bỏ sót file: mọi file trong logic/, ui/, bbtn/ đều được index.html tham chiếu", () => {
    const referenced = new Set(order);
    const missing = [];
    ["logic", "ui", "bbtn"].forEach((dir) => {
      fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".js")).forEach((f) => {
        if (!referenced.has(`${dir}/${f}`)) missing.push(`${dir}/${f}`);
      });
    });
    expect(missing).toEqual([]);
  });
});

describe("Lớp logic thuần (logic/*.js + dga-logic.js) không phụ thuộc trình duyệt", () => {
  const files = localScripts("index.html").map((s) => s.rel).filter((f) => f.startsWith("logic/") || f === "dga-logic.js");

  test.each(files)("%s không dùng document/localStorage/fetch/alert", (rel) => {
    const code = stripComments(path.join(ROOT, rel));
    expect(code).not.toMatch(/\bdocument\b|\blocalStorage\b|\bsessionStorage\b|\bfetch\s*\(|\balert\s*\(|\bnavigator\b/);
  });
  test.each(files.filter((f) => f !== "dga-logic.js"))("%s không tự gắn vào window (chỉ dga-logic.js được gắn window.DGA)", (rel) => {
    expect(stripComments(path.join(ROOT, rel))).not.toMatch(/\bwindow\b/);
  });
});
