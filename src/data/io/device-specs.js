/* device-specs.js — THÔNG SỐ KỸ THUẬT THIẾT BỊ cho tab con "Lập BBTN" (tab Khí hòa tan + Lý-Hóa dầu):
     1. deviceSpecsCollect(): gom thông số đã lưu của 1 thiết bị (Trạm + Thiết bị) từ mọi nguồn — lần đo khí hòa
        tan (kieu_may, nam_sx...), thí nghiệm dầu MBA (device_info JSON), dầu OLTC, dầu TI/TU (bbtn_info JSON) —
        mỗi thông số lấy giá trị MỚI NHẤT khác rỗng, kèm ngày + nguồn để người dùng biết lấy từ đâu.
     2. deviceSpecsFromHeader(): thông số đọc được từ phần thông tin chung của 1 file BBTN/biên bản cũ
        (MbaOilBbtn.parseMbaOilBbtnLines().header, src/data/io/mba-oil-bbtn.js) — dùng cho tiện ích "Nhập thông số kỹ
        thuật từ file" (chỉ lấy thông số, không đọc số liệu đo).
   Khóa thông số chuẩn (DEVICE_SPEC_KEYS) độc lập với id ô nhập của từng form (ánh xạ ở ui/ui-device-specs.js).
   Hàm thuần — kiểm thử bằng Jest (tests/device-specs.test.js). */

const DEVICE_SPEC_KEYS = [
  "hang_sx", "kieu_may", "nam_sx", "nam_van_hanh", "dien_ap_dm", "cong_suat", "so_che_tao", "so_che_tao_pha",
  "loai_dau", "ket_cau_cach_dien", "voltage_class", "um_kv", "oil_inhibited",
  // "Nhà sản xuất" dùng để chọn TIÊU CHUẨN đánh giá — mỗi loại thí nghiệm có danh sách riêng nên tách khóa
  "manufacturer_dga", "manufacturer_oil", "manufacturer_instrument",
];

/** Các trường thông số lưu kèm bản ghi dầu MBA (cột device_info, chuỗi JSON). */
const OIL_DEVICE_INFO_KEYS = ["hang_sx", "nam_sx", "dien_ap_dm", "cong_suat", "so_che_tao", "nam_van_hanh", "loai_dau"];

function deviceSpecHasValue(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "object") return Object.values(v).some(deviceSpecHasValue);
  return String(v).trim() !== "";
}

function deviceSpecParseJson(s) {
  if (!s) return {};
  if (typeof s === "object") return s;
  try { const o = JSON.parse(s); return o && typeof o === "object" ? o : {}; } catch (_) { return {}; }
}

/** Số kV lớn nhất ghi trong chuỗi điện áp định mức ("(225/√3±8x1,25%)/115/√3/23 (kV)" → 225), hoặc null. */
function deviceSpecMaxKv(text) {
  const nums = (String(text || "").match(/\d+(?:[.,]\d+)?/g) || []).map((s) => Number(s.replace(",", "."))).filter((n) => n >= 1 && n <= 1200);
  return nums.length ? Math.max(...nums) : null;
}

/**
 * @param {{measurements?:Object[], oilTests?:Object[], oltcTests?:Object[], instrumentTests?:Object[]}} sources
 * @param {string} tram  để trống = không ràng buộc trạm
 * @param {string} thietBi bắt buộc (khớp CHÍNH XÁC sau khi bỏ khoảng trắng 2 đầu, như tab Lịch sử đo)
 * @returns {{ found:boolean, ambiguous?:boolean, stations?:string[], values:Object<string,{value:*, date:string, source:string}> }}
 */
function deviceSpecsCollect(sources, tram, thietBi) {
  const norm = (s) => String(s === null || s === undefined ? "" : s).trim();
  const T = norm(tram);
  const D = norm(thietBi);
  const out = { found: false, values: {} };
  if (!D) return out;
  const match = (r) => r && norm(r.thiet_bi) === D && (!T || norm(r.tram) === T);
  if (!T) {
    // Chưa chọn Trạm: tên thiết bị (AT1, T1...) trùng ở nhiều trạm → không đoán, yêu cầu chọn Trạm
    const st = new Set();
    ["measurements", "oilTests", "oltcTests", "instrumentTests"].forEach((k) => ((sources && sources[k]) || []).filter(match).forEach((r) => st.add(norm(r.tram))));
    if (st.size > 1) return { found: false, ambiguous: true, stations: Array.from(st).filter(Boolean).sort(), values: {} };
  }
  const items = [];
  const push = (r, source, specs) => items.push({ date: String(r.sample_date || r.created_at || ""), source, specs });

  ((sources && sources.measurements) || []).filter(match).forEach((r) => push(r, "lần đo khí hòa tan", {
    kieu_may: r.kieu_may, nam_sx: r.nam_sx, nam_van_hanh: r.nam_van_hanh, dien_ap_dm: r.dien_ap_dm,
    so_che_tao: r.so_che_tao, loai_dau: r.loai_dau, ket_cau_cach_dien: r.ket_cau_cach_dien, manufacturer_dga: r.manufacturer,
  }));
  ((sources && sources.oilTests) || []).filter(match).forEach((r) => {
    const info = deviceSpecParseJson(r.device_info);
    const specs = { voltage_class: r.voltage_class, manufacturer_oil: r.manufacturer, oil_inhibited: r.oil_inhibited };
    OIL_DEVICE_INFO_KEYS.forEach((k) => { specs[k] = info[k]; });
    push(r, "thí nghiệm dầu MBA", specs);
  });
  ((sources && sources.oltcTests) || []).filter(match).forEach((r) => push(r, "thí nghiệm dầu OLTC", { voltage_class: r.voltage_class }));
  ((sources && sources.instrumentTests) || []).filter(match).forEach((r) => {
    const info = deviceSpecParseJson(r.bbtn_info);
    const serial = info.so_che_tao;
    push(r, "thí nghiệm dầu TI/TU", {
      manufacturer_instrument: r.manufacturer, hang_sx: info.hang_sx, nam_sx: info.nam_sx, nam_van_hanh: info.nam_van_hanh,
      cong_suat: info.cong_suat, loai_dau: info.loai_dau, dien_ap_dm: info.u_dm,
      um_kv: deviceSpecHasValue(r.um_kv) ? r.um_kv : deviceSpecMaxKv(info.u_dm),
      so_che_tao_pha: serial && typeof serial === "object" ? serial : null,
      so_che_tao: serial && typeof serial !== "object" ? serial : null,
    });
  });

  items.sort((a, b) => b.date.localeCompare(a.date));
  items.forEach((it) => {
    Object.entries(it.specs).forEach(([k, v]) => {
      if (out.values[k] || !deviceSpecHasValue(v)) return;
      out.values[k] = { value: v, date: it.date.slice(0, 10), source: it.source };
    });
  });
  out.found = items.length > 0;
  return out;
}

/** Thông số đọc được từ phần thông tin chung của biên bản (header của parseMbaOilBbtnLines). */
function deviceSpecsFromHeader(h) {
  h = h || {};
  const specs = {
    hang_sx: h.hangSx, kieu_may: h.kieuMay, nam_sx: h.namSx, nam_van_hanh: h.namVanHanh, dien_ap_dm: h.dienApDm,
    cong_suat: h.congSuat, so_che_tao: h.serial, loai_dau: h.loaiDau, voltage_class: h.voltageClass,
    um_kv: deviceSpecMaxKv(h.dienApDm),
  };
  Object.keys(specs).forEach((k) => { if (!deviceSpecHasValue(specs[k])) delete specs[k]; });
  return specs;
}

const DeviceSpecs = { DEVICE_SPEC_KEYS, OIL_DEVICE_INFO_KEYS, deviceSpecsCollect, deviceSpecsFromHeader, deviceSpecHasValue, deviceSpecMaxKv, deviceSpecParseJson };
if (typeof window !== "undefined") window.DeviceSpecs = DeviceSpecs;
if (typeof module !== "undefined" && module.exports) module.exports = DeviceSpecs;
