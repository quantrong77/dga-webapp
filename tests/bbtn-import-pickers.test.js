// Khung "Nhập BBTN" thu gọn mặc định — 2 nút "Một BBTN" / "Nhiều BBTN" (setupBbtnImportPickers(), ui-layout.js) + CSS.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const LAYOUT = fs.readFileSync(path.join(ROOT, "src/presentation/components/ui-layout.js"), "utf8");
const CSS = fs.readFileSync(path.join(ROOT, "src/presentation/styles/style-components.css"), "utf8");
const CORE = fs.readFileSync(path.join(ROOT, "src/presentation/app-core.js"), "utf8");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

describe("Nhập BBTN thu gọn", () => {
  test("3 khung Nhập BBTN (khí hòa tan, dầu, dầu 3 pha) đều có cấu trúc h2 + lưới z1/z2", () => {
    const panels = HTML.split('class="panel mode-import bbtn-import-panel"').slice(1);
    expect(panels).toHaveLength(3);
    panels.forEach((p) => {
      expect(p.trimStart().startsWith(">\n        <h2>") || p.trimStart().startsWith(">\r\n        <h2>")).toBe(true);
      expect(p).toContain("bbtn-import-z1");
      expect(p).toContain("bbtn-import-z2");
    });
  });

  test("setupBbtnImportPickers được gọi khi khởi tạo; 2 nút bật/tắt show-one / show-many, aria-pressed", () => {
    expect(CORE).toContain("setupBbtnImportPickers()");
    expect(LAYOUT).toMatch(/function setupBbtnImportPickers\(\)/);
    expect(LAYOUT).toContain('panel.classList.toggle("show-" + key, on)');
    expect(LAYOUT).toContain('b.setAttribute("aria-pressed", String(on))');
  });

  test("CSS: mặc định ẩn ô 1 BBTN và ô nhiều BBTN; phần phụ x1 (file đang đính kèm) vẫn hiện", () => {
    expect(CSS).toContain(".bbtn-import-panel:not(.show-one) :is(.bbtn-import-t1, .bbtn-import-z1)");
    expect(CSS).toContain(".bbtn-import-panel:not(.show-many) :is(.bbtn-import-t2, .bbtn-import-z2, .bbtn-import-x2)");
    expect(CSS).not.toMatch(/:not\(\.show-one[^)]*\)[^{]*\.bbtn-import-x1[^{]*\{\s*display:\s*none/);
  });
});
