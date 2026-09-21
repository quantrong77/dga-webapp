// Xử lý lỗi tập trung (ui/ui-errors.js): toast lỗi, chống lặp, handler toàn cục, dự phòng.
// File là script trình duyệt nhưng có nhánh module.exports nên nạp được trong Node; window/showToast giả lập.
const errors = require("../ui/ui-errors.js");

let now;
beforeEach(() => {
  now = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => now);
  jest.spyOn(console, "error").mockImplementation(() => {});
  global.showToast = jest.fn();
  global.alert = jest.fn();
});
afterEach(() => {
  jest.restoreAllMocks();
  delete global.showToast;
  delete global.alert;
});

describe("errorMessageOf", () => {
  test("Error, chuỗi, object có message, null/undefined/chuỗi rỗng", () => {
    expect(errors.errorMessageOf(new Error("hỏng"))).toBe("hỏng");
    expect(errors.errorMessageOf("chuỗi")).toBe("chuỗi");
    expect(errors.errorMessageOf({ message: "obj" })).toBe("obj");
    expect(errors.errorMessageOf(null)).toBe("Lỗi không xác định.");
    expect(errors.errorMessageOf(undefined)).toBe("Lỗi không xác định.");
    expect(errors.errorMessageOf("")).toBe("Lỗi không xác định.");
  });
  test("đối tượng không chuyển được thành chuỗi vẫn không ném lỗi", () => {
    const evil = Object.create(null); // không có toString
    expect(() => errors.errorMessageOf(evil)).not.toThrow();
    expect(errors.errorMessageOf(evil)).toBe("Lỗi không xác định.");
  });
});

describe("notifyError", () => {
  test("hiện toast loại 'error'", () => {
    errors.notifyError("Vui lòng nhập Thiết bị");
    expect(showToast).toHaveBeenCalledWith("Vui lòng nhập Thiết bị", "error");
    expect(alert).not.toHaveBeenCalled();
  });
  test("cùng thông điệp lặp lại trong 2 giây chỉ hiện 1 toast; sau 2 giây hiện lại", () => {
    errors.notifyError("lỗi A");
    errors.notifyError("lỗi A");
    errors.notifyError("lỗi A");
    expect(showToast).toHaveBeenCalledTimes(1);
    now += errors.ERROR_TOAST_DEDUPE_MS + 1;
    errors.notifyError("lỗi A");
    expect(showToast).toHaveBeenCalledTimes(2);
  });
  test("thông điệp KHÁC nhau không bị gộp", () => {
    errors.notifyError("lỗi B1");
    errors.notifyError("lỗi B2");
    expect(showToast).toHaveBeenCalledTimes(2);
  });
  test("showToast chưa có (lỗi rất sớm) => console.error + đúng 1 alert duy nhất", () => {
    delete global.showToast;
    errors.notifyError("lỗi sớm 1");
    errors.notifyError("lỗi sớm 2");
    expect(alert).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();
  });
  test("showToast tự ném lỗi => không ném tiếp (tránh vòng lặp vô hạn)", () => {
    global.showToast = jest.fn(() => { throw new Error("toast hỏng"); });
    expect(() => errors.notifyError("lỗi C")).not.toThrow();
  });
  test("nhận cả giá trị không phải chuỗi", () => {
    errors.notifyError(12345);
    expect(showToast).toHaveBeenCalledWith("12345", "error");
  });
});

describe("reportError", () => {
  test("ghi console.error kèm ngữ cảnh và hiện toast 'ngữ cảnh: thông điệp'", () => {
    const err = new Error("mất mạng");
    errors.reportError(err, "Lưu lần đo");
    expect(console.error).toHaveBeenCalledWith("[DGA] Lưu lần đo", err);
    expect(showToast).toHaveBeenCalledWith("Lưu lần đo: mất mạng", "error");
  });
  test("không có ngữ cảnh => chỉ hiện thông điệp lỗi", () => {
    errors.reportError(new Error("xyz"));
    expect(showToast).toHaveBeenCalledWith("xyz", "error");
  });
});

describe("installGlobalErrorHandlers", () => {
  function fakeWindow() {
    const handlers = {};
    return { handlers, addEventListener: (type, fn) => { handlers[type] = fn; } };
  }

  test("đăng ký cả 'error' và 'unhandledrejection'; target không hợp lệ => false", () => {
    const w = fakeWindow();
    expect(errors.installGlobalErrorHandlers(w)).toBe(true);
    expect(typeof w.handlers.error).toBe("function");
    expect(typeof w.handlers.unhandledrejection).toBe("function");
    expect(errors.installGlobalErrorHandlers({})).toBe(false);
  });
  test("lỗi chạy (error) => toast", () => {
    const w = fakeWindow();
    errors.installGlobalErrorHandlers(w);
    w.handlers.error({ error: new Error("undefined is not a function") });
    expect(showToast).toHaveBeenCalledWith("Đã xảy ra lỗi không lường trước: undefined is not a function", "error");
  });
  test("Promise bị từ chối mà không catch (unhandledrejection) => toast", () => {
    const w = fakeWindow();
    errors.installGlobalErrorHandlers(w);
    w.handlers.unhandledrejection({ reason: new Error("fetch thất bại") });
    expect(showToast).toHaveBeenCalledWith("Thao tác không hoàn tất: fetch thất bại", "error");
  });
  test("bỏ qua nhiễu ResizeObserver; 'Script error.' của CDN chỉ ghi log, không làm phiền người dùng", () => {
    const w = fakeWindow();
    errors.installGlobalErrorHandlers(w);
    w.handlers.error({ message: "ResizeObserver loop completed with undelivered notifications." });
    w.handlers.error({ message: "Script error." });
    expect(showToast).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled(); // "Script error." vẫn được ghi log
  });
  test("handler không bao giờ ném lỗi, kể cả sự kiện rỗng", () => {
    const w = fakeWindow();
    errors.installGlobalErrorHandlers(w);
    expect(() => w.handlers.error(undefined)).not.toThrow();
    expect(() => w.handlers.unhandledrejection(undefined)).not.toThrow();
  });
});
