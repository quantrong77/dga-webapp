// Bước 5 refactor UI (UX & truy cập): requireFields() (ui-errors.js) báo đúng tên ô thiếu + đánh dấu ô,
// confirmDeleteText() (ui-utils.js) nêu rõ bản ghi sắp xóa, index.html không còn tiêu đề cột rỗng.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const errors = require("../src/presentation/components/ui-errors.js");

function fakeField(id) {
  const listeners = {};
  return {
    id,
    attrs: {},
    classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); } },
    setAttribute(k, v) { this.attrs[k] = v; },
    removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(t, fn) { listeners[t] = fn; },
    removeEventListener(t) { delete listeners[t]; },
    focus: jest.fn(),
    fire(t) { if (listeners[t]) listeners[t](); },
  };
}

describe("requireFields", () => {
  let fields;
  beforeEach(() => {
    jest.spyOn(Date, "now").mockImplementation(() => 5_000_000 + Math.random() * 1e6);
    global.showToast = jest.fn();
    fields = { a: fakeField("a"), b: fakeField("b") };
    global.document = { getElementById: (id) => fields[id] || null };
  });
  afterEach(() => {
    jest.restoreAllMocks();
    delete global.showToast;
    delete global.document;
  });

  test("đủ ô → true, không báo lỗi", () => {
    expect(errors.requireFields([["AT1", "a", "Thiết bị"], ["2026-10-20", "b", "Ngày lấy mẫu"]])).toBe(true);
    expect(showToast).not.toHaveBeenCalled();
  });

  test("thiếu 2 ô → nêu cả 2 tên, đánh dấu cả 2, focus ô thiếu ĐẦU TIÊN", () => {
    expect(errors.requireFields([["", "a", "Thiết bị"], ["  ", "b", "Ngày lấy mẫu"]], "Dầu OLTC: ")).toBe(false);
    expect(showToast).toHaveBeenCalledWith("Dầu OLTC: Vui lòng nhập Thiết bị và Ngày lấy mẫu (bắt buộc để lưu).", "error");
    expect(fields.a.attrs["aria-invalid"]).toBe("true");
    expect(fields.b.attrs["aria-invalid"]).toBe("true");
    const order = (f) => f.focus.mock.invocationCallOrder[0];
    expect(order(fields.a)).toBeGreaterThan(order(fields.b));
  });

  test("chỉ thiếu 1 ô → chỉ ô đó bị đánh dấu; sửa ô thì bỏ đánh dấu", () => {
    expect(errors.requireFields([["AT1", "a", "Thiết bị"], [null, "b", "Ngày lấy mẫu"]])).toBe(false);
    expect(showToast.mock.calls[0][0]).toBe("Vui lòng nhập Ngày lấy mẫu (bắt buộc để lưu).");
    expect(fields.a.attrs["aria-invalid"]).toBeUndefined();
    fields.b.fire("input");
    expect(fields.b.attrs["aria-invalid"]).toBeUndefined();
  });
});

describe("confirmDeleteText", () => {
  const ctx = { DGA: require("../src/domain/dga-logic"), console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src/presentation/components/ui-utils.js"), "utf8"), ctx);

  test("nêu loại, ngày dd/mm/yyyy, thiết bị, trạm, pha", () => {
    const t = ctx.confirmDeleteText("thí nghiệm dầu MBA", { sample_date: "2026-10-20", thiet_bi: "AT1", tram: "Trạm 220kV Di Linh", phase: "A" });
    expect(t).toBe('Xóa thí nghiệm dầu MBA ngày 20/10/2026 của "AT1" (Trạm 220kV Di Linh) — pha A?\n\nThao tác này không hoàn tác được.');
  });

  test('dữ liệu thiếu / "-" / "?" không hiện ra như tên thật; pha "chung" bỏ qua', () => {
    const t = ctx.confirmDeleteText("lần đo khí hòa tan (DGA)", { sample_date: "2026-10-20", thiet_bi: "?", tram: "-", phase: "chung" });
    expect(t).toBe("Xóa lần đo khí hòa tan (DGA) ngày 20/10/2026 của (chưa ghi tên thiết bị)?\n\nThao tác này không hoàn tác được.");
  });
});

describe("index.html — truy cập", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  test("không còn tiêu đề cột rỗng <th></th> (trình đọc màn hình đọc được tên cột)", () => {
    expect(html).not.toMatch(/<th(\s+class="[^"]*")?><\/th>/);
  });
  test('có link "Bỏ qua tới nội dung chính" trỏ tới <main id="mainContent">', () => {
    expect(html).toContain('<a class="skip-link" href="#mainContent">');
    expect(html).toContain('<main id="mainContent" tabindex="-1">');
  });
});
