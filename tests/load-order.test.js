// Bảo vệ "thứ tự nạp là kiến thức ngầm" và ô nhiễm namespace của các script cổ điển (không phải ES module).
// Web nạp ~30 file bằng <script> thường dùng chung global scope: 2 file khai báo cùng 1 tên top-level sẽ
// hoặc gây SyntaxError (const/let) hoặc âm thầm ghi đè nhau (function/var) — test này bắt lỗi đó SỚM.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
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
        if (owner.has(name)) dups.push(owner.get(name) === s.rel ? `${name}: khai báo trùng trong ${s.rel}` : `${name}: ${owner.get(name)} và ${s.rel}`);
        else owner.set(name, s.rel);
      });
    });
    expect(dups).toEqual([]);
  });

  test("mọi script cổ điển đều parse được (không lỗi cú pháp)", () => {
    classic.forEach((s) => {
      expect(() => topLevelNames(s.file)).not.toThrow();
      expect(() => new vm.Script(fs.readFileSync(s.file, "utf8"), { filename: s.file })).not.toThrow();
    });
  });
});

describe("index.html (web) — thứ tự nạp", () => {
  const scripts = localScripts("index.html");
  const order = scripts.map((s) => s.rel);
  const idx = (rel) => order.indexOf(rel);

  test("src/presentation/components/ui-errors.js nạp SỚM (trước src/domain/) để bắt cả lỗi lúc khởi động", () => {
    expect(idx("src/presentation/components/ui-errors.js")).toBeGreaterThanOrEqual(0);
    expect(idx("src/presentation/components/ui-errors.js")).toBeLessThan(idx("src/domain/dga-logic-core.js"));
  });
  test("src/domain/dga-logic-core.js là file logic đầu tiên; dga-logic.js (lắp ráp) nạp SAU mọi file logic", () => {
    const logicFiles = order.filter((f) => f.startsWith("src/domain/") && f !== "src/domain/dga-logic.js");
    expect(logicFiles[0]).toBe("src/domain/dga-logic-core.js");
    logicFiles.forEach((f) => expect(idx("src/domain/dga-logic.js")).toBeGreaterThan(idx(f)));
  });
  test("config.js → logic → src/data/storage.js → src/presentation/* → app-core.js (app-core.js cuối cùng)", () => {
    expect(idx("config.js")).toBeLessThan(idx("src/domain/dga-logic.js"));
    expect(idx("src/domain/dga-logic.js")).toBeLessThan(idx("src/data/storage.js"));
    order.filter((f) => f.startsWith("src/presentation/") && f !== "src/presentation/components/ui-errors.js" && f !== "src/presentation/early-layout.js" && f !== "src/presentation/boot-guard.js").forEach((f) => expect(idx(f)).toBeGreaterThan(idx("src/data/storage.js")));
    expect(order[order.length - 1]).toBe("src/presentation/app-core.js");
  });
  test("src/presentation/tabs/ui-auth.js (định nghĩa showToast) nạp trước các ui/* khác dùng nó", () => {
    order.filter((f) => /^src\/presentation\/(components|tabs)\//.test(f) && !["src/presentation/components/ui-errors.js", "src/presentation/tabs/ui-auth.js"].includes(f)).forEach((f) => {
      expect(idx("src/presentation/tabs/ui-auth.js")).toBeLessThan(idx(f));
    });
  });
  test("không bỏ sót file: mọi file trong src/ đều được index.html tham chiếu", () => {
    const referenced = new Set(order);
    const missing = [];
    ["src/domain", "src/data", "src/data/drivers", "src/data/io", "src/presentation", "src/presentation/components", "src/presentation/tabs"].forEach((dir) => {
      fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".js")).forEach((f) => {
        if (!referenced.has(`${dir}/${f}`)) missing.push(`${dir}/${f}`);
      });
    });
    expect(missing).toEqual([]);
  });
});

describe("Lớp logic thuần (src/domain/*.js) không phụ thuộc trình duyệt", () => {
  const files = localScripts("index.html").map((s) => s.rel).filter((f) => f.startsWith("src/domain/"));

  test.each(files)("%s không dùng document/localStorage/fetch/alert", (rel) => {
    const code = stripComments(path.join(ROOT, rel));
    expect(code).not.toMatch(/\bdocument\b|\blocalStorage\b|\bsessionStorage\b|\bfetch\s*\(|\balert\s*\(|\bnavigator\b/);
  });
  test.each(files.filter((f) => f !== "src/domain/dga-logic.js"))("%s không tự gắn vào window (chỉ dga-logic.js được gắn window.DGA)", (rel) => {
    expect(stripComments(path.join(ROOT, rel))).not.toMatch(/\bwindow\b/);
  });
});
