// Header — nút icon Database (#storageBadge) gộp 2 huy hiệu cũ "Database" + "Đã đồng bộ": dbStatusView() (hàm thuần),
// app-status.js, và markup index.html.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "src/presentation/app-status.js"), "utf8");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function load() {
  const ctx = { console, document: { readyState: "complete", addEventListener() {} }, window: { addEventListener() {} } };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "app-status.js" });
  return ctx;
}

describe("dbStatusView", () => {
  const { dbStatusView } = load();
  const synced = { online: true, syncing: false, pendingCount: 0 };

  test("đã kết nối + đã đồng bộ → xanh (ok); Admin có link → gợi ý bấm mở", () => {
    const v = dbStatusView({ conn: "ok", connTitle: "Đã kết nối database", sync: synced }, "gsheet", "https://sheet");
    expect(v.state).toBe("ok");
    expect(v.label).toBe("Database: đã đồng bộ");
    expect(v.title).toContain("Bấm để mở Google Sheet");
    expect(v.pending).toBe(0);
  });

  test("có mục chờ → đang đồng bộ kèm số; không link → gợi ý bấm đồng bộ ngay", () => {
    const v = dbStatusView({ conn: "ok", sync: { online: true, syncing: false, pendingCount: 3 } }, "supabase", "");
    expect(v.state).toBe("syncing");
    expect(v.label).toBe("Database: đang đồng bộ (3)");
    expect(v.title).toContain("Bấm để đồng bộ ngay");
    expect(v.pending).toBe(3);
  });

  test("offline → cam, vẫn đếm mục chờ", () => {
    const v = dbStatusView({ conn: "ok", sync: { online: false, syncing: false, pendingCount: 2 } }, "supabase", "");
    expect(v.state).toBe("offline");
    expect(v.label).toContain("offline (2)");
  });

  test("mất kết nối ưu tiên hơn trạng thái đồng bộ; Máy chủ nội bộ đổi tên", () => {
    const v = dbStatusView({ conn: "error", errMsg: "timeout", sync: { online: true, syncing: false, pendingCount: 5 } }, "local-server", "");
    expect(v.state).toBe("error");
    expect(v.label).toBe("Máy chủ nội bộ: mất kết nối");
    expect(v.title).toContain("timeout");
  });

  test("chế độ thử nghiệm → local, không đếm mục chờ", () => {
    const v = dbStatusView({ conn: "local", sync: { online: true, syncing: false, pendingCount: 4 } }, "local", "");
    expect(v.state).toBe("local");
    expect(v.label).toBe("Chế độ thử nghiệm");
    expect(v.pending).toBe(0);
  });

  test("chưa có trạng thái đồng bộ → coi như đã đồng bộ", () => {
    expect(dbStatusView({ conn: "ok" }, "gsheet", "").state).toBe("ok");
  });
});

describe("index.html", () => {
  test("bỏ huy hiệu chữ cũ, có nút icon Database + chấm trạng thái", () => {
    expect(HTML).not.toContain('id="syncStatusBadge"');
    expect(HTML).not.toContain('id="syncStatusText"');
    expect(HTML).toMatch(/id="storageBadge" class="header-icon-btn db-status-btn/);
    expect(HTML).toContain('<use href="#icon-database"></use>');
    expect(HTML).toContain('<symbol id="icon-database"');
    expect(HTML).toContain('id="dbPendingCount"');
    expect(HTML).toContain('id="menuDbDot"');
  });
});
