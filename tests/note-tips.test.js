// Ghi chú dài ở các tab nhập liệu → tip khi trỏ chuột vào nhãn (setupNoteTips() / noteTipTarget(), ui-layout.js).
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const LAYOUT = fs.readFileSync(path.join(ROOT, "src/presentation/components/ui-layout.js"), "utf8");
const CORE = fs.readFileSync(path.join(ROOT, "src/presentation/app-core.js"), "utf8");

describe("Ghi chú → tip", () => {
  test("các đoạn ghi chú dài đã đánh dấu data-note-tip (kể cả 2 đoạn Nhập BBTN hàng loạt)", () => {
    expect((HTML.match(/data-note-tip/g) || []).length).toBe(17);
    expect(HTML).toMatch(/<p class="note" data-note-tip>Dùng đúng <strong>Trạm \/ Thiết bị/);
    expect(HTML).toMatch(/<p class="note" data-note-tip>Mỗi file là 1 biên bản \(thùng dầu chính \+ OLTC nếu có\)/);
  });

  test("bỏ nút ẩn/hiện hướng dẫn của 2 tab nhập liệu (không còn đoạn hướng dẫn nào để ẩn)", () => {
    expect(HTML).not.toContain('data-guide-toggle="nhap-intro"');
    expect(HTML).not.toContain('data-guide-toggle="dau-intro"');
    expect(HTML).not.toContain('data-guide="nhap-intro"');
    expect(HTML).not.toContain('data-guide="dau-intro"');
  });

  test("setupNoteTips chạy SAU setupBbtnImportPickers; tip có role tooltip + aria-describedby", () => {
    expect(CORE.indexOf("setupNoteTips()")).toBeGreaterThan(CORE.indexOf("setupBbtnImportPickers()"));
    expect(LAYOUT).toContain('tip.setAttribute("role", "tooltip")');
    expect(LAYOUT).toContain('btn.setAttribute("aria-describedby", tip.id)');
  });
});
