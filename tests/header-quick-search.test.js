// Header — tìm nhanh thiết bị (src/presentation/components/ui-header.js): gom theo Trạm + Thiết bị, khớp không dấu,
// xếp hạng, avatar chữ cái.
global.DGA = require("../src/domain/dga-logic");
const h = require("../src/presentation/components/ui-header.js");

const sources = [
  { label: "Khí hòa tan", records: [
    { tram: "TBA 220kV Di Linh", thiet_bi: "AT1", sample_date: "2026-03-01" },
    { tram: "TBA 220kV Di Linh", thiet_bi: "AT1", sample_date: "2026-05-01" },
    { tram: "TBA 110kV Bảo Lộc", thiet_bi: "T2", sample_date: "2026-02-01" },
    { tram: "-", thiet_bi: "?", sample_date: "2026-01-01" },
    { tram: "TBA 500kV Đắk Nông", thiet_bi: "KH500 Đông", sample_date: "2026-04-01" },
  ] },
  { label: "Dầu MBA", records: [{ tram: "TBA 220kV Di Linh", thiet_bi: "AT1", sample_date: "2026-06-01" }] },
];

describe("quickSearchIndex", () => {
  const idx = h.quickSearchIndex(sources);
  test("gom theo Trạm + Thiết bị, bỏ thiết bị trống/“?”", () => {
    expect(idx.map((e) => e.device).sort()).toEqual(["AT1", "KH500 Đông", "T2"]);
  });
  test("đếm bản ghi, ghi loại dữ liệu, lấy ngày đo mới nhất", () => {
    const at1 = idx.find((e) => e.device === "AT1");
    expect(at1.count).toBe(3);
    expect(Array.from(at1.kinds)).toEqual(["Khí hòa tan", "Dầu MBA"]);
    expect(at1.lastDate).toBe("2026-06-01");
  });
});

describe("quickSearchMatch", () => {
  const idx = h.quickSearchIndex(sources);
  test("không phân biệt dấu / hoa thường", () => {
    expect(h.quickSearchMatch(idx, "dong").map((e) => e.device)).toEqual(["KH500 Đông"]);
    expect(h.quickSearchMatch(idx, "BAO LOC").map((e) => e.device)).toEqual(["T2"]);
  });
  test("tìm theo tên trạm; nhiều từ phải khớp đủ", () => {
    expect(h.quickSearchMatch(idx, "di linh").map((e) => e.device)).toEqual(["AT1"]);
    expect(h.quickSearchMatch(idx, "di linh t2")).toEqual([]);
  });
  test("tên thiết bị bắt đầu bằng từ khóa xếp trước khớp theo trạm", () => {
    const r = h.quickSearchMatch(idx, "t").map((e) => e.device);
    expect(r[0]).toBe("T2");
  });
  test("từ khóa rỗng → không có kết quả; giới hạn số kết quả", () => {
    expect(h.quickSearchMatch(idx, "   ")).toEqual([]);
    expect(h.quickSearchMatch(idx, "tba", 2)).toHaveLength(2);
  });
});

describe("qsHighlight", () => {
  test("tô phần khớp, giữ nguyên dấu gốc, escape HTML", () => {
    expect(h.qsHighlight("KH500 Đông", "dong")).toBe("KH500 <mark>Đông</mark>");
    expect(h.qsHighlight("<b>x</b>", "zz")).toBe("&lt;b&gt;x&lt;/b&gt;");
  });
});

describe("renderUserChip", () => {
  test("chữ cái đầu từ email", () => {
    const els = {};
    global.document = { getElementById: (id) => (els[id] ||= { textContent: "", title: "" }) };
    h.renderUserChip("nguyen.van.an@ptc3.evnnpt.vn", "Quản trị viên");
    expect(els.userAvatar.textContent).toBe("NA");
    h.renderUserChip("admin@local", "Người dùng");
    expect(els.userAvatar.textContent).toBe("AD");
    expect(els.userRole.textContent).toBe("Người dùng");
    delete global.document;
  });
});
