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
