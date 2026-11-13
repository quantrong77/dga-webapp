// Vòng tải có % (src/presentation/components/ui-busy.js): busyEstimatePct() — % theo số lượt gọi đã xong + lượt đang
// chờ nhích dần theo thời gian, không bao giờ tự chạm mốc kế tiếp.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = { console, Date, Math };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src/presentation/components/ui-busy.js"), "utf8"), ctx);
const pct = (...a) => ctx.busyEstimatePct(...a);

describe("busyEstimatePct", () => {
  test("chưa có lượt gọi → 0", () => {
    expect(pct(0, 0, [])).toBe(0);
  });
  test("mọi lượt xong → 100", () => {
    expect(pct(4, 4, [])).toBe(100);
  });
  test("vừa bắt đầu → 0; 2/4 xong, 2 lượt vừa gọi → 50", () => {
    expect(pct(1, 0, [0])).toBe(0);
    expect(pct(4, 2, [0, 0])).toBe(50);
  });
  test("lượt đang chờ nhích dần nhưng không vượt 90% phần của nó", () => {
    const a = pct(1, 0, [500]);
    const b = pct(1, 0, [3000]);
    const c = pct(1, 0, [600000]);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeLessThanOrEqual(90);
    // 1/2 xong + lượt còn lại chờ rất lâu → dưới 100 (chỉ đạt 100 khi xong thật).
    expect(pct(2, 1, [600000])).toBeLessThan(100);
  });
});

describe("Chỉ báo tải dạng mũi tên trên header", () => {
  const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const CSS = fs.readFileSync(path.join(__dirname, "..", "src/presentation/styles/style-components.css"), "utf8");
  test("nằm ngay trước nút Database, có mũi tên xuống (tải) + lên (lưu), giữ progressbar", () => {
    const i = HTML.indexOf('<div id="busyIndicator"');
    const j = HTML.indexOf('<button type="button" id="storageBadge"');
    expect(i).toBeGreaterThan(0);
    expect(j).toBeGreaterThan(i);
    expect(HTML.slice(i, j)).toContain('class="busy-arrow-dn"');
    expect(HTML.slice(i, j)).toContain('class="busy-arrow-up"');
    expect(HTML.slice(i, j)).toContain('role="progressbar"');
    expect(HTML).not.toContain("busyRingPct");
  });
  test("đang ghi (body.is-saving) → đổi sang mũi tên lên", () => {
    expect(CSS).toContain("body.is-saving .busy-arrow-dn { display: none; }");
    expect(CSS).toContain("body.is-saving .busy-arrow-up { display: inline; }");
  });
  test("mũi tên tích hợp vào góc icon Database; số % bên trái; xong giữ 100% rồi ẩn", () => {
    const JS = fs.readFileSync(path.join(__dirname, "..", "src/presentation/components/ui-busy.js"), "utf8");
    const start = HTML.indexOf('<button type="button" id="storageBadge"');
    const btn = HTML.slice(start, HTML.indexOf("</button>", start));
    expect(btn).toContain('class="db-busy"');
    expect(HTML).toContain('id="busyPct"');
    expect(CSS).toContain("body.is-busy .db-busy { display: grid; }");
    expect(JS).toMatch(/BUSY_DONE_HOLD_MS = \d+/);
    expect(JS).toContain('el.classList.toggle("is-done", !active)');
  });
});
