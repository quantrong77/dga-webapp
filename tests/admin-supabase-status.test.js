// Lỗi #1 (BUGS_FOUND.md): tab Quản trị gọi Auth.supabaseSyncStatus() ở MỌI chế độ — máy chủ nội bộ không có action
// này nên trả HTTP 400 (lỗi console). Nay chỉ gọi ở chế độ gsheet (Code.gs mới có bản sao Supabase).
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = fs.readFileSync(path.join(__dirname, "..", "src", "presentation", "tabs", "ui-admin.js"), "utf8");

function makeEl() {
  const cls = new Set(["hidden"]);
  return {
    disabled: false,
    textContent: "",
    innerHTML: "",
    classList: {
      add: (c) => cls.add(c),
      remove: (c) => cls.delete(c),
      toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)),
      contains: (c) => cls.has(c),
    },
  };
}

function run(mode, statusImpl) {
  const els = { sbSyncStatus: makeEl(), btnSyncSupabase: makeEl(), sbSyncErrorsWrap: makeEl(), sbSyncErrors: makeEl() };
  let calls = 0;
  const ctx = {
    console,
    document: { addEventListener() {}, getElementById: (id) => els[id] || null },
    window: {},
    $: (id) => els[id],
    escapeHtml: (s) => String(s == null ? "" : s),
    storageErrorMessage: (e) => e.message,
    Storage: { mode },
    Auth: {
      supabaseSyncStatus: () => {
        calls++;
        return statusImpl();
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "ui-admin.js" });
  return ctx.refreshSupabaseSyncUI().then(() => ({ els, calls }));
}

describe("refreshSupabaseSyncUI (lỗi #1)", () => {
  test.each(["local-server", "local", "supabase"])("chế độ %s → KHÔNG gọi supabaseSyncStatus, báo không áp dụng", async (mode) => {
    const { els, calls } = await run(mode, () => Promise.reject(new Error("HTTP 400")));
    expect(calls).toBe(0);
    expect(els.btnSyncSupabase.disabled).toBe(true);
    expect(els.sbSyncStatus.textContent).toMatch(/Không áp dụng/);
    expect(els.sbSyncErrorsWrap.classList.contains("hidden")).toBe(true);
  });

  test("chế độ gsheet, Supabase đang bật → gọi và hiện trạng thái như cũ", async () => {
    const { els, calls } = await run("gsheet", () => Promise.resolve({ enabled: true, url: "https://x.supabase.co", recentErrors: [] }));
    expect(calls).toBe(1);
    expect(els.btnSyncSupabase.disabled).toBe(false);
    expect(els.sbSyncStatus.textContent).toContain("Đang bật");
  });

  test("chế độ gsheet, Supabase chưa cấu hình → nút khóa, báo chưa bật", async () => {
    const { els } = await run("gsheet", () => Promise.resolve({ enabled: false }));
    expect(els.btnSyncSupabase.disabled).toBe(true);
    expect(els.sbSyncStatus.textContent).toContain("Chưa bật");
  });
});
