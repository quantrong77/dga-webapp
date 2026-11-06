// Lỗi #3 (BUGS_FOUND.md): đọc khối "Thông số kỹ thuật thiết bị" của BBTN mẫu NPTS/BM.01 — "Điện áp định mức" lấy
// nhầm cả dòng "Hãng sản xuất…" (nhãn khớp nhầm "Máy biến áp" ở dòng Vị trí lắp đặt), "Hãng sản xuất" lẫn
// "Số chế tạo (Serial No): …". Dòng chữ dưới đây theo đúng thứ tự pdf.js đọc từ BBTN thật (số liệu đã đổi).
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadHelpers() {
  const code = fs.readFileSync(path.join(__dirname, "..", "src", "data", "io", "bbtn-import.js"), "utf8");
  const sub = code.slice(code.indexOf("const VN_DIACRITICS_RE ="), code.indexOf('// Các trường "Thông số kỹ thuật'));
  const sb = {};
  vm.createContext(sb);
  vm.runInContext(
    sub + "\nthis.extractDienApDm = extractDienApDm; this.extractHangSanXuat = extractHangSanXuat; this.extractSoCheTao = extractSoCheTao; this.stripVnDiacritics = stripVnDiacritics;",
    sb
  );
  return sb;
}
const { extractDienApDm, extractHangSanXuat, extractSoCheTao, stripVnDiacritics } = loadHelpers();

const NPTS_BM01 = [
  "NPTS/BM.01",
  "Số biên bản: 01234/2023/NPTS3-CA",
  "CÔNG TY DỊCH VỤ KỸ THUẬT TRUYỀN TẢI ĐIỆN",
  "Điện thoại (Tel): 0258.0000000 - Email: x@npt.com.vn",
  "BIÊN BẢN KIỂM ĐỊNH VÀ THÍ NGHIỆM MÁY BIẾN ÁP LỰC (220KV/500KV)",
  "Tên dự án/tên trạm (Project): Trạm 220kV Thử Nghiệm",
  "Vị trí lắp đặt (Site): Máy biến áp AT2 (Thử Nghiệm)",
  "Hãng sản xuất (Manufacturer): EEMC Số chế tạo (Serial No): 194000-124",
  "Năm sản xuất (Year of manufacture): 2019 Kiểu loại (Type): AUTO",
  "Công suất (Rated power): 150/200/250 (MVA) Điện áp định mức (Rated voltage): 225/115/23 (kV)",
  "Dòng định mức (Rated current): 641,5/1255,1/1581,4",
];

describe("BBTN NPTS/BM.01 — thông số thiết bị (lỗi #3)", () => {
  test("Điện áp định mức = đúng ô giá trị, không lấy dòng Hãng sản xuất", () => {
    expect(extractDienApDm(NPTS_BM01)).toBe("225/115/23 (kV)");
  });
  test("Hãng sản xuất dừng trước 'Số chế tạo (Serial No)'", () => {
    expect(extractHangSanXuat(NPTS_BM01)).toBe("EEMC");
  });
  test("Số chế tạo vẫn đọc đúng", () => {
    expect(extractSoCheTao(NPTS_BM01, NPTS_BM01.map(stripVnDiacritics), null)).toBe("194000-124");
  });
});

describe("không đổi các mẫu đã đọc đúng trước đây", () => {
  test("PTC3/BM.15: 'Hãng sản xuất: HAEFELY  Năm sản xuất: 2000'", () => {
    expect(extractHangSanXuat(["Hãng sản xuất (Manufacturer): HAEFELY    Năm sản xuất: 2000"])).toBe("HAEFELY");
  });
  test("Hãng sản xuất đứng riêng 1 dòng", () => {
    expect(extractHangSanXuat(["Hãng sản xuất: ABB"])).toBe("ABB");
  });
  test("OCR rụng ký tự đầu ô: 'iện áp định mức: 220 kV' vẫn đọc được", () => {
    expect(extractDienApDm(["iện áp định mức: 220 kV"])).toBe("220 kV");
  });
  test("nhãn ở hàng trên, giá trị (không có ':') ở hàng dưới", () => {
    expect(extractDienApDm(["Điện áp định mức (Rated voltage):", "5 5 0 kV"])).toBe("550 kV");
  });
  test("'Máy biến áp' trong tiêu đề không bị coi là nhãn điện áp; dự phòng tìm cụm kV trong văn bản", () => {
    expect(extractDienApDm(["BIÊN BẢN THÍ NGHIỆM MÁY BIẾN ÁP", "Trạm 110 kV Thử"])).toBe("110 kV");
  });
});
