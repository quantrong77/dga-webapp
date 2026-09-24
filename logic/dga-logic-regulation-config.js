/* dga-logic-regulation-config.js — Phần 6/6 của dga-logic.js sau khi tách theo miền
   (xem dga-logic.js). Đăng ký + đọc/ghi đè các bảng ngưỡng "đơn giản" có thể cấu hình
   qua tab "Cấu hình" — mục "Quy định" (ui/ui-regulation-config.js), KHÔNG bao gồm
   logic rẽ nhánh (Bảng 66/Table A.10/Tam giác Duval — cố định theo văn bản gốc). Mỗi
   mục registry giữ tham chiếu TRỰC TIẾP tới 1 object hằng số khai báo ở
   dga-logic-core.js — sửa qua applyRegulationConfigOverride() là ghi đè property của
   CHÍNH object đó, mọi hàm ở các module khác tự động thấy giá trị mới mà không cần
   sửa lại bản thân các hàm đó. */

// ---------------------------------------------------------------------------
// 9) Cấu hình quy định (regulation config) — làm các bảng ngưỡng ĐƠN GIẢN ở trên (không
//    có logic rẽ nhánh phức tạp) có thể XEM/SỬA qua giao diện (mục "Quy định" trong tab
//    "Cấu hình", xem ui/ui-regulation-config.js), để khi QĐ1901/IEC 60599 có bản cập nhật trong
//    tương lai, người dùng KHÔNG cần sửa code — chỉ cần sửa số + tham chiếu nguồn qua
//    giao diện. CỐ Ý KHÔNG đưa vào đây (theo đúng phạm vi người dùng đã xác nhận): Bảng
//    66/Table 1 (diagnoseRatios() — logic rẽ nhánh 6 mã loại trừ nhau), Table A.10 sứ
//    xuyên (diagnoseBushingRatios()), ranh giới Tam giác Duval (classifyDuval1()), và
//    các enum thuần key/nhãn (EQUIPMENT_TYPES/MBA_SUBTYPES/INSTRUMENT_SUBTYPES — không
//    phải ngưỡng số).
//
// CƠ CHẾ: mỗi bảng hằng số ở các mục 2/2bis/7bis/8 phía trên VẪN LÀ nguồn "mặc định"
// (khai báo bằng const, nhưng object literal nên PROPERTY của nó vẫn sửa được —
// applyRegulationConfigOverride() bên dưới ghi đè trực tiếp lên property của chính các
// object đó, KHÔNG tạo bản sao mới) — nghĩa là mọi hàm ở các mục trên (resolveStandard(),
// computeRateOfChange(), evaluateOltcOilTest()...) tự động dùng số liệu đã ghi đè mà
// KHÔNG cần sửa lại bản thân các hàm đó. _regulationConfigDefaults chụp lại giá trị gốc
// NGAY LÚC file này được nạp (TRƯỚC khi áp dụng bất kỳ override nào từ Google Sheets/
// Supabase/localStorage) để phục vụ nút "Khôi phục mặc định" ở giao diện.
// ---------------------------------------------------------------------------

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function deepClone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

/** Ghi đè property của target theo source — CHỈ đệ quy khi CẢ 2 phía đều là object
 *  thuần (không phải mảng/null); còn lại (kể cả khi target đang là null, ví dụ
 *  BANG49_OLTC.pharieng.tren35duoi110 — QĐ1901 hiện chưa có số liệu) thì GÁN THẲNG giá
 *  trị từ source — cho phép người dùng "điền vào chỗ trống" khi quy định có số liệu mới
 *  mà không cần sửa code. Bỏ qua key nào source không có (giữ nguyên mặc định/override cũ). */
function deepMergeInto(target, source) {
  if (!isPlainObject(target) || !isPlainObject(source)) return;
  Object.keys(source).forEach((k) => {
    if (source[k] === undefined) return;
    if (isPlainObject(source[k]) && isPlainObject(target[k])) {
      deepMergeInto(target[k], source[k]);
    } else {
      target[k] = deepClone(source[k]);
    }
  });
}

/** Đọc giá trị tại 1 "đường dẫn" (mảng key) trong object lồng nhau — trả về undefined
 *  an toàn nếu đi qua null/undefined giữa đường (vd tren35duoi110 hiện đang là null). */
function getValueAtPath(obj, path) {
  let cur = obj;
  for (const key of path) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[key];
  }
  return cur;
}

/** Ghi giá trị tại 1 "đường dẫn" vào object — TỰ TẠO object rỗng ở các cấp trung gian
 *  còn thiếu (kể cả khi cấp đó hiện là null), dùng để build lại object override đầy đủ
 *  từ giá trị các ô nhập trên form (xem ui/ui-regulation-config.js). */
function setValueAtPath(obj, path, value) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!isPlainObject(cur[key])) cur[key] = {};
    cur = cur[key];
  }
  cur[path[path.length - 1]] = value;
}

function gasMapFields(unit) {
  return GASES.map((g) => ({ path: [g], label: g, unit, kind: "number" }));
}

function gasRangeFields(unit) {
  return GASES.map((g) => ({ path: [g], label: g, unit, kind: "range" }));
}

const OIL_STATE_LABELS = { new: "Mới/sau lắp đặt/sau sửa chữa", inservice: "Đang vận hành" };

function voltageStateFields(unit) {
  const fields = [];
  OIL_VOLTAGE_CLASSES.forEach((vc) => {
    ["new", "inservice"].forEach((state) => {
      fields.push({ path: [vc.value, state], label: `${vc.label} — ${OIL_STATE_LABELS[state]}`, unit, kind: "number" });
    });
  });
  return fields;
}

/**
 * Đăng ký toàn bộ các bảng ngưỡng "đơn giản" có thể cấu hình qua tab "Cấu hình quy
 * định". Mỗi mục:
 *  - key: định danh DUY NHẤT, dùng làm "id" khi lưu xuống Google Sheets/Supabase/
 *    localStorage (xem storage.js: listRegulationConfig/saveRegulationConfig).
 *  - category: PHÂN LOẠI áp dụng — hiển thị để nhóm các bảng theo loại thiết bị/bối
 *    cảnh, đúng yêu cầu "có phân loại áp dụng trong giao diện cấu hình".
 *  - title: tên bảng hiển thị.
 *  - citationKey: key trong REGULATION_CITATIONS — chuỗi tham chiếu nguồn, CÓ THỂ SỬA.
 *  - target: tham chiếu TRỰC TIẾP tới object hằng số tương ứng ở các mục trên — sửa
 *    property của target = mọi nơi dùng hằng số đó tự động thấy giá trị mới.
 *  - fields: danh sách trường có thể sửa (path/label/unit/kind) — dùng để tự render
 *    form + đọc/ghi giá trị (generic, không cần code UI riêng cho từng bảng).
 */
function buildRegulationConfigRegistry() {
  return [
    {
      key: "BANG64_MBA", category: "MBA/Kháng dầu — Khí hòa tan (ngưỡng, phối hợp cùng IEC Annex A.2)",
      title: "QĐ1901 Bảng 64 — Cận trên khoảng giá trị điển hình khí hòa tan (MBA)",
      citationKey: "BANG64_MBA", target: QD1901_BANG64_MBA, fields: gasMapFields("ppm"),
    },
    {
      key: "IEC_A2", category: "MBA/Kháng dầu — Khí hòa tan (ngưỡng, phối hợp cùng QĐ1901 Bảng 64)",
      title: "IEC 60599:2022 Annex A.2.4 Table A.2 — Khoảng giá trị điển hình 90% (MBA lực), theo loại OLTC",
      citationKey: "IEC_A2", target: IEC_A2_POWER_TRANSFORMER,
      fields: [MBA_SUBTYPES.NO_OLTC, MBA_SUBTYPES.COMM_OLTC].flatMap((subtype) =>
        GASES.map((g) => ({ path: [subtype, g], label: `${subtype} — ${g}`, unit: "ppm", kind: "number" }))
      ),
    },
    {
      key: "BANG12_TI", category: "TI/TU — Khí hòa tan (giá trị tối đa cho phép)",
      title: "QĐ1901 Bảng 12 — Giá trị hàm lượng khí hòa tan cực đại (TI kiểu kín)",
      citationKey: "BANG12_TI", target: QD1901_BANG12_TI, fields: gasMapFields("ppm"),
    },
    {
      key: "IEC_A8", category: "TI/TU — Khí hòa tan (giá trị tối đa cho phép)",
      title: "IEC 60599:2022 Annex A.4.4 Table A.8 — Giá trị tối đa cho phép (máy biến áp đo lường kiểu kín)",
      citationKey: "IEC_A8", target: IEC_A8_INSTRUMENT_MAX, fields: gasMapFields("ppm"),
    },
    {
      key: "IEC_A7", category: "TI/TU — Khí hòa tan (khoảng điển hình tham khảo, CT/VT)",
      title: "IEC 60599:2022 Annex A.4.4 Table A.7 — Khoảng giá trị điển hình 90%, theo CT/VT",
      citationKey: "IEC_A7", target: IEC_A7_INSTRUMENT_TYPICAL,
      fields: [INSTRUMENT_SUBTYPES.CT, INSTRUMENT_SUBTYPES.VT].flatMap((subtype) =>
        GASES.map((g) => ({ path: [subtype, g], label: `${subtype} — ${g}`, unit: "ppm", kind: "number" }))
      ),
    },
    {
      key: "IEC_A11_BUSHING", category: "Sứ xuyên (Bushing) — Khí hòa tan (khoảng điển hình = ngưỡng áp dụng)",
      title: "IEC 60599:2022 Annex A.5.4 Table A.11 — Khoảng giá trị điển hình 90% (sứ xuyên)",
      citationKey: "IEC_A11_BUSHING", target: IEC_A11_BUSHING, fields: gasMapFields("ppm"),
    },
    {
      key: "BANG65_RATE", category: "MBA/Kháng dầu — Tốc độ tăng hàm lượng khí",
      title: "QĐ1901 Bảng 65 — Khoảng tốc độ tăng hàm lượng khí điển hình (ppm/năm)",
      citationKey: "BANG65_RATE", target: QD1901_BANG65_RATE, fields: gasRangeFields("ppm/năm"),
    },
    {
      key: "PD_THRESHOLD", category: "Ngưỡng tỷ lệ CH4/H2 cho mã PD (theo loại thiết bị) — dùng chung cho Bảng 66/Table A.10",
      title: "Ngưỡng CH4/H2 xác định mã Phóng điện cục bộ (PD), theo loại thiết bị",
      citationKey: "PD_THRESHOLD", target: PD_THRESHOLD_BY_TYPE,
      fields: Object.values(EQUIPMENT_TYPES).map((t) => ({ path: [t], label: t, unit: "", kind: "number" })),
    },
    {
      key: "BANG63_TDGC", category: "MBA/Kháng dầu — Tổng hàm lượng khí hòa tan (dầu mới/sau xử lý)",
      title: "QĐ1901 Bảng 63 — Ngưỡng tổng hàm lượng khí hòa tan (%)",
      citationKey: "BANG63_TDGC", target: QD1901_BANG63_TDGC,
      fields: [
        { path: ["110-220"], label: "Cấp điện áp 110–220 kV", unit: "%", kind: "number" },
        { path: ["500"], label: "Cấp điện áp 500 kV", unit: "%", kind: "number" },
      ],
    },
    {
      key: "BANG54_BDV", category: "Dầu MBA — Điện áp chọc thủng",
      title: "QĐ1901 Bảng 54 — Điện áp chọc thủng dầu (kV, khe hở 2,5mm), không thấp hơn",
      citationKey: "BANG54_BDV", target: BANG54_BDV, fields: voltageStateFields("kV"),
    },
    {
      key: "BANG55_TGD90", category: "Dầu MBA — Tổn hao điện môi tgδ ở 90°C",
      title: "QĐ1901 Bảng 55 — Tổn hao điện môi tgδ dầu ở 90°C (%), không lớn hơn",
      citationKey: "BANG55_TGD90", target: BANG55_TGD90, fields: voltageStateFields("%"),
    },
    {
      key: "BANG58_WATER", category: "Dầu MBA — Hàm lượng nước",
      title: "QĐ1901 Bảng 58 — Hàm lượng nước trong dầu (ppm), không lớn hơn",
      citationKey: "BANG58_WATER", target: BANG58_WATER,
      fields: [
        { path: ["den110_comMangN2", "new"], label: "≤110kV, có màng/N2 — Mới/sau lắp đặt/sau sửa chữa", unit: "ppm", kind: "number" },
        { path: ["den110_comMangN2", "inservice"], label: "≤110kV, có màng/N2 — Đang vận hành", unit: "ppm", kind: "number" },
        { path: ["den110_khongMangN2", "new"], label: "≤110kV, không có màng/N2 — Mới/sau lắp đặt/sau sửa chữa", unit: "ppm", kind: "number" },
        { path: ["den110_khongMangN2", "inservice"], label: "≤110kV, không có màng/N2 — Đang vận hành", unit: "ppm", kind: "number" },
        { path: ["tren110", "new"], label: "220kV/500kV — Mới/sau lắp đặt/sau sửa chữa", unit: "ppm", kind: "number" },
        { path: ["tren110", "inservice"], label: "220kV/500kV — Đang vận hành", unit: "ppm", kind: "number" },
      ],
    },
    {
      key: "BANG49_OLTC", category: "Dầu OLTC (đang vận hành) — Độ ẩm & điện áp chọc thủng",
      title: "QĐ1901 Bảng 49 — Ngưỡng dầu khoang điều áp dưới tải (OLTC) khi đang vận hành",
      citationKey: "BANG49_OLTC", target: BANG49_OLTC,
      fields: [
        { path: ["trungtinh", "bdv"], label: "Điểm cuối trung tính — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["trungtinh", "moisture"], label: "Điểm cuối trung tính — Hàm lượng nước", unit: "ppm", kind: "number" },
        { path: ["pharieng", "duoi15", "bdv"], label: "Một pha/không trung tính, <15kV — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["pharieng", "duoi15", "moisture"], label: "Một pha/không trung tính, <15kV — Hàm lượng nước (QĐ1901 hiện chưa có số liệu)", unit: "ppm", kind: "number" },
        { path: ["pharieng", "15den35", "bdv"], label: "Một pha/không trung tính, 15–35kV — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["pharieng", "15den35", "moisture"], label: "Một pha/không trung tính, 15–35kV — Hàm lượng nước (QĐ1901 hiện chưa có số liệu)", unit: "ppm", kind: "number" },
        { path: ["pharieng", "tren35duoi110", "bdv"], label: "Một pha/không trung tính, >35–<110kV — Điện áp chọc thủng (QĐ1901 hiện chưa có số liệu)", unit: "kV", kind: "number" },
        { path: ["pharieng", "tren35duoi110", "moisture"], label: "Một pha/không trung tính, >35–<110kV — Hàm lượng nước (QĐ1901 hiện chưa có số liệu)", unit: "ppm", kind: "number" },
        { path: ["pharieng", "110", "bdv"], label: "Một pha/không trung tính, 110kV — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["pharieng", "110", "moisture"], label: "Một pha/không trung tính, 110kV — Hàm lượng nước", unit: "ppm", kind: "number" },
        { path: ["pharieng", "220", "bdv"], label: "Một pha/không trung tính, 220kV — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["pharieng", "220", "moisture"], label: "Một pha/không trung tính, 220kV — Hàm lượng nước", unit: "ppm", kind: "number" },
        { path: ["pharieng", "500", "bdv"], label: "Một pha/không trung tính, 500kV — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["pharieng", "500", "moisture"], label: "Một pha/không trung tính, 500kV — Hàm lượng nước", unit: "ppm", kind: "number" },
      ],
    },
    {
      key: "IEC60422_2024_TABLE5_MBA", category: "Dầu MBA/Kháng — IEC 60422:2024 (tham khảo, song song QĐ1901)",
      title: "IEC 60422:2024 Bảng 5 — Ngưỡng Tốt/Kém dầu MBA/Kháng vận hành, theo Category A/B/C",
      citationKey: "IEC60422_2024_TABLE5_MBA", target: IEC60422_2024_TABLE5_MBA,
      fields: ["A", "B", "C"].flatMap((cat) => [
        { path: [cat, "bdv", "good"], label: `Category ${cat} — Điện áp chọc thủng, biên "Tốt" (≥)`, unit: "kV", kind: "number" },
        { path: [cat, "bdv", "poor"], label: `Category ${cat} — Điện áp chọc thủng, biên "Kém" (<)`, unit: "kV", kind: "number" },
        { path: [cat, "moisture", "good"], label: `Category ${cat} — Độ ẩm dầu, biên "Tốt" (≤)`, unit: "mg/kg", kind: "number" },
        { path: [cat, "moisture", "poor"], label: `Category ${cat} — Độ ẩm dầu, biên "Kém" (>)`, unit: "mg/kg", kind: "number" },
        { path: [cat, "tgd90", "good"], label: `Category ${cat} — tgδ 90°C, biên "Tốt" (≤)`, unit: "%", kind: "number" },
        { path: [cat, "tgd90", "poor"], label: `Category ${cat} — tgδ 90°C, biên "Kém" (>)`, unit: "%", kind: "number" },
      ]),
    },
    {
      key: "IEC60422_2024_TABLE7_TITU", category: "Dầu TI/TU — IEC 60422:2024 (tham khảo, song song tiêu chuẩn NSX)",
      title: "IEC 60422:2024 Bảng 7 — Ngưỡng Tốt/Kém dầu TI/TU vận hành, theo Category D/E (Độ ẩm, tgδ 90°C — số liệu tường minh)",
      citationKey: "IEC60422_2024_TABLE7_TITU", target: IEC60422_2024_TABLE7_TITU,
      fields: ["D", "E"].flatMap((cat) => [
        { path: [cat, "moisture", "good"], label: `Category ${cat} — Độ ẩm dầu, biên "Tốt" (≤)`, unit: "mg/kg", kind: "number" },
        { path: [cat, "moisture", "poor"], label: `Category ${cat} — Độ ẩm dầu, biên "Kém" (>)`, unit: "mg/kg", kind: "number" },
        { path: [cat, "tgd90", "good"], label: `Category ${cat} — tgδ 90°C, biên "Tốt" (≤)`, unit: "%", kind: "number" },
        { path: [cat, "tgd90", "poor"], label: `Category ${cat} — tgδ 90°C, biên "Kém" (>)`, unit: "%", kind: "number" },
      ]),
    },
  ];
}

const REGULATION_CONFIG_REGISTRY = buildRegulationConfigRegistry();

// Chụp lại NGAY LÚC nạp file (trước khi bất kỳ override nào từ storage được áp dụng) để
// phục vụ resetRegulationConfigItem() ("Khôi phục mặc định"). Registry được build 1 LẦN
// DUY NHẤT ở trên nên target luôn đúng là hằng số gốc tại thời điểm chụp này.
const _regulationConfigDefaults = {};
REGULATION_CONFIG_REGISTRY.forEach((item) => {
  _regulationConfigDefaults[item.key] = {
    citation: REGULATION_CITATIONS[item.citationKey],
    values: deepClone(item.target),
  };
});

function getRegulationConfigRegistry() {
  return REGULATION_CONFIG_REGISTRY;
}

function findRegulationConfigItem(key) {
  return REGULATION_CONFIG_REGISTRY.find((it) => it.key === key) || null;
}

/**
 * Áp dụng 1 bản ghi cấu hình đã lưu (Storage.listRegulationConfig()) lên đúng object
 * hằng số target — gọi 1 lần lúc khởi động app (initApp(), xem ui/ui-regulation-
 * config.js: applyAllRegulationConfigOverrides()) SAU KHI đã tải xong danh sách từ
 * storage. Ghi đè CẢ citation (REGULATION_CITATIONS[item.citationKey]) lẫn giá trị số
 * (deep-merge vào item.target — xem deepMergeInto()).
 * @param {string} key
 * @param {{citation?: string, values?: object}} override
 */
function applyRegulationConfigOverride(key, override) {
  const item = findRegulationConfigItem(key);
  if (!item || !override) return;
  if (override.citation) REGULATION_CITATIONS[item.citationKey] = override.citation;
  if (override.values) deepMergeInto(item.target, override.values);
}

/** Khôi phục 1 bảng về ĐÚNG giá trị/citation mặc định gốc (lúc app khởi động). */
function resetRegulationConfigItem(key) {
  const item = findRegulationConfigItem(key);
  const snap = _regulationConfigDefaults[key];
  if (!item || !snap) return;
  REGULATION_CITATIONS[item.citationKey] = snap.citation;
  // Xóa hết property hiện có trên target rồi gán lại nguyên bản snapshot — deepMergeInto()
  // không tự XÓA property (chỉ ghi đè/thêm), nên cần xóa sạch trước để không sót lại phần
  // ghi đè cũ khi khôi phục mặc định.
  Object.keys(item.target).forEach((k) => delete item.target[k]);
  Object.assign(item.target, deepClone(snap.values));
}

function regulationConfigDefaultCitation(key) {
  const snap = _regulationConfigDefaults[key];
  return snap ? snap.citation : null;
}

/** Trạng thái HIỆN TẠI (đã áp dụng override, nếu có) của 1 bảng — dùng để hiển thị lên
 *  form khi mở mục "Quy định" trong tab "Cấu hình". */
function getRegulationConfigCurrentValues(key) {
  const item = findRegulationConfigItem(key);
  if (!item) return null;
  return { citation: REGULATION_CITATIONS[item.citationKey], values: deepClone(item.target) };
}

// Export cho cả trình duyệt (global) lẫn Node (module.exports, dùng để test)
