/* Bộ chọn bậc thang Trạm ▸ Thiết bị ▸ Pha (src/presentation/components/ui-location-picker.js) — phần lõi không DOM,
 * Trạm phụ trách của user ở backend máy chủ nội bộ, và các phần tử giao diện mới (Viewer, hộp thoại xuất Excel). */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "src", "presentation", "components", "ui-location-picker.js"), "utf8"), ctx);

const meas = [
  { tram: "E1.1 Đồng Hòa", thiet_bi: "T1", pha: "A" },
  { tram: "E1.1 Đồng Hòa", thiet_bi: "T1", pha: "A" },
  { tram: "E1.1 Đồng Hòa", thiet_bi: "T1", pha: "B" },
  { tram: "e1.1  đồng hòa", thiet_bi: "t1 ", pha: "C" },
  { tram: "E1.2", thiet_bi: "T1", pha: "A" },
  { tram: "E1.2", thiet_bi: "TI174", pha: "chung3pha" },
];

describe("buildLocationIndex", () => {
  const idx = ctx.buildLocationIndex([meas], (r) => r.pha);

  test("gộp trạm/thiết bị không phân biệt hoa thường, khoảng trắng thừa", () => {
    expect(idx.size).toBe(2);
    const st = idx.get(ctx.locationKey("E1.1 Đồng Hòa"));
    expect(st.name).toBe("E1.1 Đồng Hòa");
    expect(st.devices.size).toBe(1);
    const t1 = st.devices.get("t1");
    expect(t1.count).toBe(4);
    expect(Object.fromEntries(t1.phases)).toEqual({ A: 2, B: 1, C: 1 });
  });

  test("stationsOfDevice: thiết bị trùng tên ở nhiều trạm", () => {
    expect(ctx.stationsOfDevice(idx, "T1").sort()).toEqual(["E1.1 Đồng Hòa", "E1.2"]);
    expect(ctx.stationsOfDevice(idx, "TI174")).toEqual(["E1.2"]);
  });

  test("locationDeviceNode: theo trạm, hoặc gộp mọi trạm khi chưa chọn trạm", () => {
    expect(Object.fromEntries(ctx.locationDeviceNode(idx, "E1.2", "T1").phases)).toEqual({ A: 1 });
    expect(Object.fromEntries(ctx.locationDeviceNode(idx, "", "T1").phases)).toEqual({ A: 3, B: 1, C: 1 });
    expect(ctx.locationDeviceNode(idx, "E1.2", "Không có")).toBeNull();
  });
});

describe("Trạm phụ trách — backend máy chủ nội bộ", () => {
  test("normalizeStations: mảng hoặc chuỗi nhiều dòng, bỏ trống/trùng", () => {
    const auth = require("../backend/onpremise/auth.js");
    expect(auth.normalizeStations(["A", " A ", "", "B\nC"])).toEqual(["A", "B C"]);
    expect(auth.normalizeStations("X\r\nY\n\nX")).toEqual(["X", "Y"]);
    expect(auth.normalizeStations(undefined)).toEqual([]);
  });
});

describe("Giao diện", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  test.each(["f", "o", "ot", "tio"])("form %s có khối Vị trí thiết bị chứa đủ Trạm, Thiết bị, Pha", (p) => {
    const start = html.indexOf(`id="${p}_location"`);
    expect(start).toBeGreaterThan(0);
    const end = html.indexOf("</div>\r\n", html.indexOf(p === "f" ? 'id="f_pha"' : p === "tio" ? 'id="tio_phase"' : `id="${p}_phase"`));
    const block = html.slice(start, end);
    expect(block).toContain(`id="${p}_tram"`);
    expect(block).toContain(`id="${p}_thietbi"`);
  });
  test("thông báo Tài khoản chỉ xem ở 2 tab nhập liệu, hộp thoại gán trạm và xuất Excel", () => {
    expect(html.split('class="panel viewer-readonly-note"').length - 1).toBe(2);
    ["stationAssignOverlay", "alertsExportOverlay", "xl_station", "xl_device", "xl_phase", "xl_type"].forEach((id) => {
      expect(html).toContain(`id="${id}"`);
    });
  });
});
