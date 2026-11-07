// Hỏi xác nhận lọc/thay dầu khi khí giảm đột ngột (tab Xu hướng + sau khi lưu ở tab DGA): render khối hỏi,
// lưu xu_ly_dau qua Storage.addMeasurement() khi bấm nút, ẩn nút khi không có quyền sửa bản ghi.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { DGA } = require("./helpers");

const SRC = fs.readFileSync(path.join(__dirname, "..", "src", "presentation", "tabs", "ui-trend.js"), "utf8");

const BEFORE = { h2: 40, ch4: 30, c2h6: 20, c2h4: 10, c2h2: 0, co: 300, co2: 2500 };
const AFTER = { h2: 3, ch4: 2, c2h6: 1, c2h4: 1, c2h2: 0, co: 30, co2: 400 };

// Phần tử giả tối thiểu (môi trường test là node, không có jsdom): innerHTML là chuỗi; querySelectorAll /
// querySelector chỉ hỗ trợ nút <button data-oil-treat-id data-oil-treat-value> mà ui-trend.js sinh ra.
function makeEl() {
  const cls = new Set(["hidden"]);
  let html = "";
  let buttons = [];
  const el = {
    classList: {
      add: (c) => cls.add(c),
      remove: (c) => cls.delete(c),
      contains: (c) => cls.has(c),
    },
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = v;
      buttons = [...v.matchAll(/<button[^>]*data-oil-treat-id="([^"]*)"[^>]*data-oil-treat-value="([^"]*)"[^>]*>/g)].map((m) => {
        const handlers = [];
        return {
          dataset: { oilTreatId: m[1], oilTreatValue: m[2] },
          disabled: false,
          addEventListener: (t, fn) => handlers.push(fn),
          click: () => handlers.forEach((fn) => fn()),
        };
      });
    },
    get textContent() { return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " "); },
    querySelectorAll: (sel) => (sel.startsWith("button") ? buttons : []),
    querySelector: (sel) => {
      const m = sel.match(/data-oil-treat-value="([^"]*)"/);
      return buttons.find((b) => !m || b.dataset.oilTreatValue === m[1]) || null;
    },
  };
  return el;
}

function setup({ records, canEdit = true }) {
  const els = { trOilTreatWrap: makeEl(), dgaOilTreatPrompt: makeEl() };
  const saved = [];
  const toasts = [];
  const ctx = {
    console, Date, Map, Set,
    document: { addEventListener() {}, getElementById: (id) => els[id] || null },
    window: {},
    DGA,
    $: (id) => els[id] || null,
    escapeHtml: (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
    canEditRecord: () => canEdit,
    recordGases: (r) => ({ H2: r.h2, CH4: r.ch4, C2H6: r.c2h6, C2H4: r.c2h4, C2H2: r.c2h2, CO: r.co, CO2: r.co2 }),
    Storage: { addMeasurement: async (m) => { saved.push(m); return m; } },
    refreshHistoryUI: async () => {},
    showToast: (m) => toasts.push(m),
    notifyError: (m) => { throw new Error(m); },
    storageErrorMessage: (e) => e.message,
  };
  vm.createContext(ctx);
  // _allMeasurements là biến `let` toàn cục của ui-history.js — giả lập bằng 1 khai báo cùng tên.
  vm.runInContext("let _allMeasurements = [];\n" + SRC + "\nthis._setAll = (v) => { _allMeasurements = v; };", ctx, { filename: "ui-trend.js" });
  ctx._setAll(records);
  return { ctx, saved, toasts, wrap: els.trOilTreatWrap };
}

const recs = () => [
  { id: "m1", sample_date: "2023-01-10", pha: "", ...BEFORE },
  { id: "m2", sample_date: "2024-01-10", pha: "", ...AFTER },
];

describe("renderTrendOilTreatment", () => {
  test("lần đo giảm đột ngột chưa xác nhận → hiện khối hỏi 3 nút", () => {
    const { ctx, wrap } = setup({ records: recs() });
    ctx.renderTrendOilTreatment(recs());
    expect(wrap.classList.contains("hidden")).toBe(false);
    expect(wrap.textContent).toMatch(/Khí giảm đột ngột/);
    expect(wrap.textContent).toMatch(/TDCG giảm 90,8%/);
    const values = [...wrap.querySelectorAll("button[data-oil-treat-id]")].map((b) => b.dataset.oilTreatValue);
    expect(values).toEqual(["loc_dau", "thay_dau", "khong"]);
  });

  test("bấm 'Đã lọc dầu' → lưu nguyên bản ghi kèm xu_ly_dau = loc_dau", async () => {
    const records = recs();
    const { ctx, wrap, saved, toasts } = setup({ records });
    ctx.renderTrendOilTreatment(records);
    wrap.querySelector('button[data-oil-treat-value="loc_dau"]').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ id: "m2", co: 30, xu_ly_dau: "loc_dau" });
    expect(toasts[0]).toMatch(/lọc dầu/);
  });

  test("đã xác nhận → không hỏi lại; lọc/thay dầu hiện trong danh sách đã ghi nhận kèm nút Đổi", () => {
    const records = recs();
    records[1].xu_ly_dau = "thay_dau";
    const { ctx, wrap } = setup({ records });
    ctx.renderTrendOilTreatment(records);
    expect(wrap.textContent).not.toMatch(/Khí giảm đột ngột/);
    expect(wrap.textContent).toMatch(/Thay dầu trước lần đo/);
    expect(wrap.querySelector('button[data-oil-treat-value=""]')).not.toBeNull();
  });

  test("không có lần giảm nào và chưa ghi nhận → ẩn khối", () => {
    const records = [recs()[0], { ...recs()[0], id: "m3", sample_date: "2024-01-10" }];
    const { ctx, wrap } = setup({ records });
    ctx.renderTrendOilTreatment(records);
    expect(wrap.classList.contains("hidden")).toBe(true);
  });

  test("không có quyền sửa bản ghi → không có nút, chỉ ghi chú", () => {
    const { ctx, wrap } = setup({ records: recs(), canEdit: false });
    ctx.renderTrendOilTreatment(recs());
    expect(wrap.querySelectorAll("button").length).toBe(0);
    expect(wrap.textContent).toMatch(/Chỉ Admin hoặc người đã nhập/);
  });
});
