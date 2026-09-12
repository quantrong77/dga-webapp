/* ui-dga.js — Tab "DGA": form "1. Thông tin lần đo" (đính kèm BBTN, tự động điền
   từ bbtn-import.js), phân tích & lưu (onAnalyze), hiển thị kết quả (renderResults),
   và vẽ Tam giác Duval. Tách từ app.js — xem ui-auth.js đầu file đó để biết quy ước
   chia sẻ scope giữa các file ui-*.js. */


// _editingMeasurementId: id của lần đo đang SỬA (null = đang nhập MỚI). Cùng cơ chế
// với _editingStandardId (xem onEditStandard/resetStandardForm bên dưới).
let _editingMeasurementId = null;
// _editingMeasurementAttachment: { bbtn_url, bbtn_name, bbtn_file_id } của BBTN đã lưu
// trên bản ghi đang sửa (null = chưa có/đang nhập mới) — giữ nguyên khi lưu lại NẾU
// người dùng không chọn file mới và không bấm "Bỏ file" (xem onAnalyze()).
let _editingMeasurementAttachment = null;
// _removeBbtnOnSave: true khi người dùng bấm "Bỏ file" trong lúc sửa — lần lưu kế
// tiếp sẽ xóa bbtn_url/bbtn_name/bbtn_file_id khỏi bản ghi thay vì giữ nguyên.
let _removeBbtnOnSave = false;
// _lastAnalysis: toàn bộ dữ liệu + kết quả tính toán của lần "Phân tích & Lưu" gần nhất
// (gán ở cuối onAnalyze(), ngay trước khi gọi renderResults() — cùng 1 nguồn dữ liệu
// với những gì đang hiển thị trên màn hình) — dùng để xuất BBTN (docx), xem
// onExportBbtn() bên dưới và bbtn-export.js. null khi chưa phân tích lần nào trong
// phiên làm việc này (bấm "Xuất BBTN" lúc đó sẽ báo yêu cầu phân tích trước).
let _lastAnalysis = null;

// f_kieumay..f_hientrangvanhanh: 8 trường "thông số kỹ thuật thiết bị" (nameplate) —
// không dùng để tính toán DGA, chỉ lưu kèm bản ghi để điền vào Báo cáo phân tích kỹ
// thuật (docx), xem tech-report-export.js.
const TECH_SPEC_FIELD_IDS = [
  "f_kieumay", "f_namsx", "f_namvanhanh", "f_dienapdm",
  "f_sochetao", "f_loaidau", "f_ketcaucachdien", "f_hientrangvanhanh",
];

function clearForm() {
  ["f_tram", "f_thietbi", "f_ghichu"].forEach((id) => ($(id).value = ""));
  TECH_SPEC_FIELD_IDS.forEach((id) => ($(id).value = ""));
  DGA.GASES.forEach((g) => ($("g_" + g).value = ""));
  $("f_landocount").value = 1;
  $("f_bbtn").value = "";
  $("resultsPanel").classList.add("hidden");
  resetMeasurementEditState();
}

function resetMeasurementEditState() {
  _editingMeasurementId = null;
  _editingMeasurementAttachment = null;
  _removeBbtnOnSave = false;
  $("f_bbtn").value = "";
  $("editingMeasurementNote").classList.add("hidden");
  $("btnCancelEditMeasurement").classList.add("hidden");
  $("btnAnalyze").textContent = "Phân tích & Lưu";
  $("bbtnImportNote").classList.add("hidden");
  renderBbtnCurrent();
}

/** Gợi ý "Lần đo" kế tiếp — chạy khi Trạm/Thiết bị/Pha trên form đổi (xem
 *  addEventListener("change", ...) ở app-core.js initApp()) và sau khi lưu xong 1
 *  lần đo MỚI (xem onAnalyze()), để nếu người dùng nhập tiếp lần đo kế tiếp của
 *  CÙNG thiết bị (không xóa form, chỉ đổi ngày/số liệu) thì "Lần đo" tự nhảy lên.
 *  Khớp theo đúng Trạm + Thiết bị + Pha, giống hệt tiêu chí tìm "lần đo liền trước"
 *  để tính tốc độ sinh khí ở onAnalyze() (và deviceKey() ở ui-history.js). Không
 *  chạy khi đang SỬA 1 bản ghi có sẵn (_editingMeasurementId) — số "Lần đo" gốc của
 *  bản ghi đó phải giữ nguyên dù người dùng có sửa lại Trạm/Thiết bị/Pha hay không,
 *  xem onEditMeasurement(). Nếu chưa có lần đo lịch sử nào khớp, mặc định là 1. */
function updateLanDoSuggestion() {
  if (_editingMeasurementId) return;
  const tram = $("f_tram").value.trim();
  const thietbi = $("f_thietbi").value.trim();
  const pha = $("f_pha").value;
  if (!thietbi) {
    $("f_landocount").value = 1;
    return;
  }
  const matches = (_allMeasurements || []).filter(
    (r) => (r.tram || "").trim() === tram && (r.thiet_bi || "").trim() === thietbi && (r.pha || "") === pha
  );
  const maxLan = matches.reduce((max, r) => Math.max(max, Number(r.lan_do) || 0), 0);
  $("f_landocount").value = maxLan + 1;
}

/** Hiện/ẩn khối "đã đính kèm BBTN: <tên file>" bên dưới ô chọn file, theo
 *  _editingMeasurementAttachment hiện tại (xem onEditMeasurement()/onAnalyze()). */
function renderBbtnCurrent() {
  const wrap = $("bbtnCurrentWrap");
  if (_editingMeasurementAttachment && _editingMeasurementAttachment.bbtn_url) {
    $("bbtnCurrentName").textContent = _editingMeasurementAttachment.bbtn_name || "Biên bản thí nghiệm.pdf";
    wrap.classList.remove("hidden");
  } else {
    wrap.classList.add("hidden");
  }
}

/** Mở BBTN (PDF) đã lưu ở tab mới — att = { bbtn_url, bbtn_name }. Chế độ Google
 *  Sheets/Supabase: bbtn_url là link thật, mở thẳng. Chế độ localStorage: bbtn_url có
 *  dạng "local:<measurementId>", chỉ là khóa tra lại qua Storage.getLocalAttachment()
 *  (file thật nằm trong localStorage, base64) — dựng lại thành Blob URL rồi mới mở. */
async function viewBbtn(att) {
  if (!att || !att.bbtn_url) {
    alert("Lần đo này chưa có Biên bản thí nghiệm đính kèm.");
    return;
  }
  const url = String(att.bbtn_url);
  if (!url.startsWith("local:")) {
    window.open(url, "_blank", "noopener");
    return;
  }
  const measurementId = url.slice("local:".length);
  const local = Storage.getLocalAttachment(measurementId);
  if (!local) {
    alert("Không tìm thấy file đính kèm trong bộ nhớ trình duyệt này (file chỉ lưu được ở máy/trình duyệt đã tải lên).");
    return;
  }
  try {
    const res = await fetch(local.dataUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank", "noopener");
  } catch (err) {
    alert("Không mở được file: " + ((err && err.message) || err));
  }
}

/** Khi người dùng CHỌN file BBTN (PDF) ở form "1. Thông tin lần đo" — thử đọc PDF
 *  ngay trong trình duyệt (bbtn-import.js, KHÔNG gửi file lên server nào để "đọc")
 *  và tự động điền Trạm/Thiết bị/Loại thiết bị/Pha/Ngày lấy mẫu/Nhà sản xuất/hàm
 *  lượng khí nếu nhận diện được — đỡ phải gõ tay lại khi nhập bổ sung các lần đo
 *  LỊCH SỬ đã có sẵn biên bản PDF (mẫu PTC3/BM.15). Chỉ là gợi ý điền sẵn: mọi
 *  trường vẫn xem/sửa tay được bình thường trước khi lưu, không có gì bị khóa. Việc
 *  lưu file đính kèm thật sự vẫn xảy ra riêng lúc bấm "Phân tích & Lưu" (onAnalyze()). */
async function onBbtnFileSelected(e) {
  const file = e.target.files && e.target.files[0];
  const note = $("bbtnImportNote");
  if (!file) {
    note.classList.add("hidden");
    return;
  }
  if (!window.BbtnImport) {
    note.textContent = "Không tự động đọc được BBTN (thư viện đọc PDF chưa tải xong) — vui lòng nhập tay các trường bên dưới.";
    note.classList.remove("hidden");
    return;
  }
  note.textContent = "Đang đọc Biên bản thí nghiệm để tự động điền form...";
  note.classList.remove("hidden");
  let data;
  try {
    data = await window.BbtnImport.extract(file);
  } catch (err) {
    note.textContent =
      "Không đọc được nội dung file này để tự động điền (có thể file là ảnh scan, chưa hỗ trợ OCR) — " +
      "vui lòng nhập tay các trường bên dưới. (" + ((err && err.message) || err) + ")";
    return;
  }
  if (!data || !data.matchedCount) {
    note.textContent = "Không nhận diện được thông tin nào từ file này — vui lòng nhập tay các trường bên dưới.";
    return;
  }

  const filled = [];
  if (data.tram) {
    $("f_tram").value = data.tram;
    filled.push("Trạm");
  }
  if (data.thietbi) {
    $("f_thietbi").value = data.thietbi;
    filled.push("Thiết bị");
  }
  if (data.loai) {
    $("f_loai").value = data.loai;
    refreshManufacturerOptions();
    toggleMbaSubtypeField();
    filled.push("Loại thiết bị");
    if (data.hangSanXuat) {
      const match = Array.from($("f_nsx").options).find(
        (o) => o.value && o.value.toLowerCase().includes(data.hangSanXuat.toLowerCase())
      );
      if (match) {
        $("f_nsx").value = match.value;
        filled.push("Nhà sản xuất");
      }
    }
  }
  if (data.pha) {
    $("f_pha").value = data.pha;
    filled.push("Pha");
  }
  if (data.ngay) {
    $("f_ngay").value = data.ngay;
    filled.push("Ngày lấy mẫu");
  }
  const gasNames = [];
  Object.keys(data.gases || {}).forEach((g) => {
    const input = $("g_" + g);
    if (input) {
      input.value = data.gases[g];
      gasNames.push(g);
    }
  });
  if (gasNames.length) filled.push("Hàm lượng khí (" + gasNames.join(", ") + ")");

  // Trạm/Thiết bị/Pha vừa điền bằng JS (không bắn "change" tự nhiên như khi người
  // dùng gõ tay/chọn combo) — gọi lại thủ công để "Lần đo" cũng được gợi ý đúng theo
  // lịch sử đã lưu, đúng tinh thần của tính năng này (nhập bổ sung lần đo LỊCH SỬ).
  updateLanDoSuggestion();

  note.textContent = filled.length
    ? "Đã tự động điền từ BBTN: " + filled.join(", ") + " — vui lòng kiểm tra lại số liệu trước khi lưu."
    : "Không nhận diện được thông tin nào từ file này — vui lòng nhập tay các trường bên dưới.";
}

/** Nạp 1 lần đo đã lưu lên form tab "DGA" để sửa — bấm "Cập nhật & Lưu" sẽ
 *  ghi đè đúng bản ghi này (giữ nguyên id), thay vì tạo thêm 1 bản ghi mới. Chỉ gọi
 *  được khi canEditRecord(rec) đã xác nhận (nút "Sửa" chỉ hiện khi đủ quyền) — server
 *  (Code.gs) vẫn kiểm tra lại quyền này, đây chỉ là gợi ý hiển thị phía client. */
function onEditMeasurement(rec) {
  if (!canEditRecord(rec)) return;
  _editingMeasurementId = rec.id;
  _editingMeasurementAttachment = rec.bbtn_url
    ? { bbtn_url: rec.bbtn_url, bbtn_name: rec.bbtn_name, bbtn_file_id: rec.bbtn_file_id }
    : null;
  _removeBbtnOnSave = false;
  $("f_bbtn").value = "";
  $("bbtnImportNote").classList.add("hidden");
  renderBbtnCurrent();
  $("f_tram").value = rec.tram || "";
  $("f_thietbi").value = rec.thiet_bi || "";
  $("f_loai").value = rec.equipment_type || "";
  refreshManufacturerOptions();
  toggleMbaSubtypeField();
  $("f_mbasubtype").value = rec.mba_subtype || "";
  $("f_nsx").value = rec.manufacturer || "";
  $("f_pha").value = rec.pha || "";
  $("f_landocount").value = rec.lan_do ?? 1;
  $("f_ngay").value = rec.sample_date || "";
  $("f_ghichu").value = rec.ghi_chu || "";
  $("f_kieumay").value = rec.kieu_may || "";
  $("f_namsx").value = rec.nam_sx || "";
  $("f_namvanhanh").value = rec.nam_van_hanh || "";
  $("f_dienapdm").value = rec.dien_ap_dm || "";
  $("f_sochetao").value = rec.so_che_tao || "";
  $("f_loaidau").value = rec.loai_dau || "";
  $("f_ketcaucachdien").value = rec.ket_cau_cach_dien || "";
  $("f_hientrangvanhanh").value = rec.hien_trang_van_hanh || "";
  const gasesRec = recordGases(rec);
  DGA.GASES.forEach((g) => { $("g_" + g).value = gasesRec[g] ?? ""; });
  $("editingMeasurementNote").classList.remove("hidden");
  $("btnCancelEditMeasurement").classList.remove("hidden");
  $("btnAnalyze").textContent = "Cập nhật & Lưu";
  document.querySelector('button.tab-btn[data-tab="nhap"]').click();
  $("f_tram").scrollIntoView({ behavior: "smooth", block: "center" });
}

// ---------------------------------------------------------------------
// Tam giác Duval — vẽ khung tam giác + đường phân vùng (theo bảng "Limits of
// zones", Annex B, Figure B.3, IEC 60599:1999) và điểm chẩn đoán bằng SVG.
// Hệ tọa độ: đỉnh CH4 ở trên (50, 0 khi lật trục y), C2H2 dưới-trái (0, H),
// C2H4 dưới-phải (100, H), với H = 100*sqrt(3)/2 ≈ 86,6. viewBox lật trục y
// (y_svg = H - y_toan_hoc) để đỉnh CH4 hiển thị ở trên.
// ---------------------------------------------------------------------
function duvalToSvgY(y) { return 86.602540378 - y; }

function duvalEdgePoint(pct) {
  const h = 86.602540378;
  const x = (pct.pctCH4 / 100) * 50 + (pct.pctC2H4 / 100) * 100;
  const y = (pct.pctCH4 / 100) * h;
  return { x, y: duvalToSvgY(y) };
}

function drawDuvalTriangleBase() {
  const svg = $("duvalSvg");
  if (!svg) return;
  const h = 86.602540378;
  let s = "";

  // Viền tam giác chính
  s += `<polygon class="duval-tri-line" points="0,${h} 100,${h} 50,0" />`;

  // Lưới phần trăm (10% một nấc) song song 3 cạnh — chỉ vẽ nhẹ để tham khảo
  for (let k = 10; k < 100; k += 10) {
    // đường song song cạnh đáy (ứng với %CH4 = k)
    const y = duvalToSvgY((k / 100) * h);
    const xL = (k / 100) * 50;
    const xR = 100 - (k / 100) * 50;
    s += `<line class="duval-grid-line" x1="${xL}" y1="${y}" x2="${xR}" y2="${y}" />`;
  }

  // Đường phân vùng chính theo bảng "Limits of zones" gốc (Annex B, Figure B.3):
  const P = (m, e, a) => duvalEdgePoint({ pctCH4: m, pctC2H4: e, pctC2H2: a });
  const zoneLines = [
    // PD: %CH4 = 98 (đường song song đáy gần đỉnh)
    [P(98, 2, 0), P(98, 0, 2)],
    // T1/T2 biên trên C2H2=4: đoạn từ C2H4=0..~96
    [P(96, 0, 4), P(46, 50, 4)],
    // T1/T2 biên C2H4=10 (trong dải C2H2<=4)
    [P(90, 10, 0), P(86, 10, 4)],
    // T2/T3 biên C2H4=50 (trong dải C2H2<=4)
    [P(50, 50, 0), P(46, 50, 4)],
    // D1/D2 biên C2H4=23 (trong dải C2H2>=13)
    [P(64, 23, 13), P(0, 23, 77)],
    // D1/T1 & D2 biên C2H2=13
    [P(64, 23, 13), P(87, 0, 13)],
    // D2/T3(vùng cao C2H4) biên C2H4=38 (trong dải C2H2>=13)
    [P(49, 38, 13), P(0, 38, 62)],
  ];
  zoneLines.forEach(([a, b]) => {
    s += `<line class="duval-zone-line" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`;
  });

  // Nhãn đỉnh
  s += `<text class="duval-label" x="50" y="-2" text-anchor="middle">CH4</text>`;
  s += `<text class="duval-label" x="-2" y="${h + 4}" text-anchor="start">C2H2</text>`;
  s += `<text class="duval-label" x="102" y="${h + 4}" text-anchor="end">C2H4</text>`;
  s += `<text class="duval-label" x="50" y="${h * 0.35}" text-anchor="middle">D1</text>`;
  s += `<text class="duval-label" x="30" y="${h * 0.6}" text-anchor="middle">D2</text>`;
  s += `<text class="duval-label" x="70" y="${h * 0.85}" text-anchor="middle">T3</text>`;
  s += `<text class="duval-label" x="35" y="${h * 0.92}" text-anchor="middle">T2</text>`;
  s += `<text class="duval-label" x="15" y="${h * 0.97}" text-anchor="middle">T1</text>`;

  svg.innerHTML = s;
}

function drawDuvalPoint(xyMath) {
  const svg = $("duvalSvg");
  if (!svg) return;
  const pt = { x: xyMath.x, y: duvalToSvgY(xyMath.y) };
  svg.innerHTML += `<circle class="duval-point" cx="${pt.x}" cy="${pt.y}" r="2.2" />`;
}

// ---------------------------------------------------------------------
// Phân tích & lưu 1 lần đo
// ---------------------------------------------------------------------
async function onAnalyze() {
  const gases = {};
  DGA.GASES.forEach((g) => (gases[g] = $("g_" + g).value === "" ? 0 : Number($("g_" + g).value)));

  const equipmentType = $("f_loai").value;
  const mbaSubtype = equipmentType === DGA.EQUIPMENT_TYPES.MBA ? $("f_mbasubtype").value : null;

  const measurement = {
    id: _editingMeasurementId || undefined,
    tram: $("f_tram").value.trim(),
    thiet_bi: $("f_thietbi").value.trim(),
    equipment_type: equipmentType,
    mba_subtype: mbaSubtype,
    manufacturer: $("f_nsx").value || null,
    pha: $("f_pha").value,
    lan_do: Number($("f_landocount").value) || 1,
    sample_date: $("f_ngay").value,
    ghi_chu: $("f_ghichu").value.trim(),
    // Thông số kỹ thuật thiết bị (tùy chọn) — xem TECH_SPEC_FIELD_IDS ở clearForm().
    kieu_may: $("f_kieumay").value.trim(),
    nam_sx: $("f_namsx").value ? Number($("f_namsx").value) : null,
    nam_van_hanh: $("f_namvanhanh").value ? Number($("f_namvanhanh").value) : null,
    dien_ap_dm: $("f_dienapdm").value.trim(),
    so_che_tao: $("f_sochetao").value.trim(),
    loai_dau: $("f_loaidau").value.trim(),
    ket_cau_cach_dien: $("f_ketcaucachdien").value.trim(),
    hien_trang_van_hanh: $("f_hientrangvanhanh").value.trim(),
    ...gases,
  };

  if (!measurement.thiet_bi || !measurement.sample_date) {
    alert("Vui lòng nhập ít nhất Thiết bị và Ngày lấy mẫu.");
    return;
  }

  // 1) Xác định tiêu chuẩn áp dụng: NSX nếu có cấu hình đầy đủ; ngược lại, tiêu chuẩn
  //    CHẶT HƠN giữa QĐ1901 và bảng tham khảo tương ứng của IEC 60599:1999 Annex A
  //    (hoặc trực tiếp IEC Annex A khi QĐ1901 chưa có bảng riêng — sứ xuyên).
  const logicMeasurement = { equipmentType: measurement.equipment_type, manufacturer: measurement.manufacturer, mbaSubtype };
  const standard = DGA.resolveStandard(logicMeasurement, toManufacturerStandardsForLogic(_allStandards));

  // 2) TCG + đánh giá tuyệt đối
  const tcg = DGA.computeTCG(gases);
  const evalRows = DGA.evaluateAbsolute(gases, standard.limits);
  const overall = DGA.overallVerdict(evalRows);
  const exceedCount = DGA.countExceedTypical(gases, measurement.equipment_type, logicMeasurement);

  // 3) Ba tỷ số khí cơ bản + chẩn đoán Bảng 66 (ngưỡng PD theo loại thiết bị — 0,1 mặc
  //    định, 0,2 cho TI/TU theo Annex A.3.3, 0,07 cho sứ xuyên theo Annex A.4.3)
  const ratios = DGA.computeRatios(gases);
  const diagnosis = DGA.diagnoseRatios(ratios, standard.pdThreshold);
  const applicability = DGA.ratioApplicability(exceedCount);

  // 3bis) Chẩn đoán Tam giác Duval 1 (Annex B, Figure B.3)
  const duval = DGA.diagnoseDuval1(gases);

  // 3ter) Ngưỡng LOẠI BỎ riêng của nhà sản xuất (nếu có cấu hình) — cảnh báo nghiêm
  //    trọng hơn mức "không đạt" thông thường, độc lập với ngưỡng tuyệt đối ở trên.
  const condemningRows = DGA.evaluateCondemning(gases, standard.condemning);

  // 4) Tốc độ sinh khí — tìm lần đo gần nhất trước đó cùng Trạm+Thiết bị+Pha
  let all;
  try {
    all = await Storage.listMeasurements();
  } catch (err) {
    alert(storageErrorMessage(err));
    return;
  }
  const prior = all
    .filter((r) => r.tram === measurement.tram && r.thiet_bi === measurement.thiet_bi && r.pha === measurement.pha)
    .filter((r) => new Date(r.sample_date) < new Date(measurement.sample_date))
    .sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date))[0];

  let rateRows = null;
  let priorDiagnosis = null;
  if (prior) {
    // prior đọc từ Storage.listMeasurements() nên khí lưu key CHỮ THƯỜNG (h2, ch4...
    // xem normalizeGasKeys() ở storage.js) — phải chuẩn hóa lại về chữ HOA (H2, CH4...)
    // bằng recordGases() (ui-standards.js) trước khi đưa vào computeRateOfChange()/
    // computeRatios(), nếu không mọi giá trị "trước" sẽ luôn đọc ra 0 (khóa không khớp
    // "H2" != "h2"), làm sai lệch tốc độ sinh khí và cả priorDiagnosis bên dưới — cùng
    // cách chuẩn hóa đã dùng đúng ở ui-history.js (renderRateTable()).
    const priorGases = recordGases(prior);
    const deltaDays = Math.round((new Date(measurement.sample_date) - new Date(prior.sample_date)) / 86400000);
    rateRows = DGA.computeRateOfChange(priorGases, gases, deltaDays, standard.rate, measurement.equipment_type);
    // Chẩn đoán Bảng 66 của lần đo liền trước — dùng để phát hiện "đổi loại lỗi"
    // (điều kiện ALARM riêng của lưu đồ IEC 60599, xem computeOverallStatus()).
    priorDiagnosis = DGA.diagnoseRatios(DGA.computeRatios(priorGases), standard.pdThreshold);
  }

  // 5) Khuyến cáo tổng hợp
  const recs = DGA.buildRecommendations({ overallOk: overall === "Đạt", exceedCount, diagnosis, duval, rateRows, condemningRows });

  // 5bis) Trạng thái tổng thể (Bình thường/Cảnh báo/Báo động) — số hóa lưu đồ Hình 1
  //    IEC 60599:1999; xem giải thích đầy đủ ở tab "Quy trình đánh giá".
  const overallStatus = DGA.computeOverallStatus({
    overallOk: overall === "Đạt", exceedCount, diagnosis, priorDiagnosis, rateRows, condemningRows,
  });

  _lastAnalysis = { measurement, tcg, evalRows, overall, diagnosis, standard, ratios, applicability, duval, rateRows, prior, recs, condemningRows, overallStatus };
  renderResults({ tcg, evalRows, overall, diagnosis, standard, ratios, applicability, duval, rateRows, prior, recs, condemningRows, overallStatus });

  // 6) Lưu vào lịch sử — mọi user đã đăng nhập đều lưu được (xem canSaveEntry()); khi
  //    đang SỬA 1 bản ghi có sẵn (_editingMeasurementId), server chỉ chấp nhận nếu là
  //    Admin hoặc đúng người đã nhập bản ghi đó (prepareOwnedRecord() ở Code.gs) — lỗi
  //    nếu có sẽ hiện nguyên văn ở khối catch bên dưới.
  if (!canSaveEntry()) return;
  const wasEditing = !!_editingMeasurementId;

  // 6bis) Biên bản thí nghiệm (BBTN, PDF) đính kèm — xem storage.js/uploadAttachment().
  // measurement.id phải cố định TRƯỚC khi tải file lên (đặc biệt ở chế độ localStorage,
  // nơi file được khóa theo measurementId) nên sinh id ở đây nếu là bản ghi MỚI, thay vì
  // để Storage.addMeasurement() tự sinh như trước.
  measurement.id = measurement.id || Storage.newId();
  const bbtnFile = $("f_bbtn").files[0] || null;
  if (bbtnFile) {
    const originalLabel = $("btnAnalyze").textContent;
    $("btnAnalyze").disabled = true;
    $("btnAnalyze").textContent = "Đang tải lên Biên bản...";
    try {
      const uploaded = await Storage.uploadAttachment(measurement.id, bbtnFile);
      Object.assign(measurement, uploaded);
    } catch (err) {
      alert(
        "Tải lên Biên bản thí nghiệm (PDF) thất bại: " + ((err && err.message) || err) +
        "\n\nLần đo vẫn sẽ được lưu, nhưng KHÔNG kèm file — bấm \"Sửa\" ở Lịch sử đo để đính kèm lại sau."
      );
    } finally {
      $("btnAnalyze").disabled = false;
      $("btnAnalyze").textContent = originalLabel;
    }
  } else if (wasEditing && _removeBbtnOnSave) {
    Object.assign(measurement, { bbtn_url: null, bbtn_name: null, bbtn_file_id: null });
  } else if (wasEditing && _editingMeasurementAttachment) {
    Object.assign(measurement, _editingMeasurementAttachment);
  }

  try {
    await Storage.addMeasurement(measurement);
    await registerStationIfNew(measurement.tram);
    resetMeasurementEditState();
    await refreshHistoryUI();
    // Form KHÔNG bị xóa Trạm/Thiết bị/Pha sau khi lưu (xem resetMeasurementEditState())
    // để nhập nhanh lần đo kế tiếp của cùng thiết bị — cập nhật lại gợi ý "Lần đo" cho
    // đúng với bản ghi vừa lưu (_allMeasurements đã có sẵn qua refreshHistoryUI() ở trên).
    updateLanDoSuggestion();
    if (wasEditing) showToast("Đã cập nhật lần đo.");
  } catch (err) {
    alert("Đã hiển thị kết quả đánh giá, nhưng LƯU THẤT BẠI: " + storageErrorMessage(err));
  }
}

function storageErrorMessage(err) {
  const base = (err && err.message) || String(err);
  if (Storage.mode === "gsheet") {
    return "Lỗi kết nối Google Sheets: " + base +
      "\n\nKiểm tra: URL trong config.js đúng chưa, Apps Script đã Deploy > New deployment với " +
      "\"Who has access: Anyone\" chưa, và Google Sheet chưa bị xóa/đổi quyền.";
  }
  if (Storage.mode === "supabase") {
    return "Lỗi kết nối Supabase: " + base;
  }
  return "Lỗi lưu dữ liệu: " + base;
}

function verdictPill(v) {
  if (v === "Đạt") return `<span class="pill ok">Đạt</span>`;
  if (v === "Không có ngưỡng") return `<span class="pill muted">Không có ngưỡng</span>`;
  return `<span class="pill bad">Không đạt</span>`;
}

function renderResults({ tcg, evalRows, overall, diagnosis, standard, ratios, applicability, duval, rateRows, prior, recs, condemningRows, overallStatus }) {
  $("resultsPanel").classList.remove("hidden");

  if (overallStatus) {
    const STATUS_ICON = { normal: "check-circle", alert: "alert-triangle", alarm: "alert-octagon" };
    $("overallStatusBanner").className = "status-banner status-" + overallStatus.level;
    $("statusBadgeText").innerHTML =
      `<svg class="status-icon" aria-hidden="true"><use href="#icon-${STATUS_ICON[overallStatus.level] || "check-circle"}"></use></svg>` +
      escapeHtml(overallStatus.label);
    $("statusReasonsList").innerHTML = overallStatus.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
    $("statusActionText").textContent = overallStatus.action;
    // Nút "Xuất báo cáo phân tích kỹ thuật" chỉ dành cho thiết bị CÓ BẤT THƯỜNG (mức
    // Cảnh báo/Báo động) — theo đúng yêu cầu tính năng ("đối với thiết bị có bất
    // thường"), tránh lạm dụng cho mọi lần đo Bình thường không cần báo cáo riêng.
    $("btnExportTechReport").classList.toggle("hidden", overallStatus.level === "normal");
  }

  $("r_tcg").textContent = tcg.toFixed(1) + " ppm";
  $("r_overall").innerHTML = overall === "Đạt" ? `<span class="pill ok">Đạt</span>` : `<span class="pill bad">Không đạt</span>`;
  $("r_diag").textContent = diagnosis;
  $("r_duval").textContent = duval ? duval.zone : "—";
  $("r_standard").textContent = standard.sourceLabel;

  const condemnMap = {};
  (condemningRows || []).forEach((r) => (condemnMap[r.gas] = r));
  const condemnExceeded = DGA.condemningExceededRows(condemningRows);
  if (condemnExceeded.length > 0) {
    $("condemnBanner").classList.remove("hidden");
    $("condemnBanner").innerHTML =
      `⚠ CẢNH BÁO NGHIÊM TRỌNG — VƯỢT NGƯỠNG LOẠI BỎ (do nhà sản xuất quy định) ở ${condemnExceeded.length} khí: ` +
      condemnExceeded.map((r) => `${r.gas} (${r.value} &gt; ${r.limit} ppm)`).join(", ") +
      `. Đây là mức nghiêm trọng hơn "Không đạt" thông thường — khuyến cáo báo cáo ngay cấp có thẩm quyền.`;
  } else {
    $("condemnBanner").classList.add("hidden");
  }

  $("r_gasTable").innerHTML = evalRows.map((r) => {
    const c = condemnMap[r.gas];
    const condemnCell = !c ? "—" : c.exceeded ? `<strong style="color:var(--bad);">${c.limit} ⚠</strong>` : c.limit;
    return `<tr><td>${r.gas}</td><td>${r.value}</td><td>${r.limit ?? "—"}</td><td>${condemnCell}</td><td>${verdictPill(r.verdict)}</td></tr>`;
  }).join("");

  $("r_ratio1").textContent = ratios.c2h2_c2h4.toFixed(3);
  $("r_ratio2").textContent = ratios.ch4_h2.toFixed(3);
  $("r_ratio3").textContent = ratios.c2h4_c2h6.toFixed(3);
  $("r_pdthreshold").textContent = "< " + standard.pdThreshold;
  $("r_applicability").textContent = applicability;

  if (duval) {
    $("r_pctch4").textContent = duval.pctCH4.toFixed(1) + "%";
    $("r_pctc2h4").textContent = duval.pctC2H4.toFixed(1) + "%";
    $("r_pctc2h2").textContent = duval.pctC2H2.toFixed(1) + "%";
    $("r_duvalzone").innerHTML = `<strong>${duval.zone}</strong> — ${duval.label}`;
    drawDuvalTriangleBase();
    drawDuvalPoint(duval.xy);
  } else {
    $("r_pctch4").textContent = $("r_pctc2h4").textContent = $("r_pctc2h2").textContent = "—";
    $("r_duvalzone").textContent = "Không đủ dữ liệu (cần CH4/C2H4/C2H2 > 0)";
    drawDuvalTriangleBase();
  }

  if (rateRows) {
    $("rateSection").classList.remove("hidden");
    $("rateNote").textContent = `So với lần đo trước (${prior.sample_date}) — ` +
      (rateRows[0].officialForEquipment
        ? "Bảng 65 áp dụng CHÍNH THỨC cho MBA/Kháng dầu."
        : "Bảng 65 chỉ QĐ1901 quy định chính thức cho MBA — với loại thiết bị này chỉ dùng để THAM KHẢO.");
    $("r_rateTable").innerHTML = rateRows.map((r) => `
      <tr>
        <td>${r.gas}</td><td>${r.before}</td><td>${r.after}</td><td>${r.delta}</td>
        <td>${r.ratePerYear}</td><td>${r.rangeLo} – ${r.rangeHi}</td>
        <td>${r.verdict.startsWith("⚠") ? `<span class="pill warn">${r.verdict}</span>` : r.verdict}</td>
      </tr>
    `).join("");
  } else {
    $("rateSection").classList.add("hidden");
  }

  $("r_recs").innerHTML = recs.map((r) => `<li>${r}</li>`).join("");
  if (typeof $("resultsPanel").scrollIntoView === "function") {
    $("resultsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// ---------------------------------------------------------------------
// Xuất Biên bản thí nghiệm (BBTN, .docx) đã điền sẵn số liệu — xem bbtn-export.js.
// Nút "Xuất BBTN (docx)" chỉ hiện trong #resultsPanel (đã ẩn cho tới khi phân tích lần
// đầu) nên về lý thuyết _lastAnalysis luôn có giá trị khi hàm này chạy được — vẫn kiểm
// tra lại cho chắc (phòng trường hợp DOM bị thao tác khác thường/lỗi khác).
// ---------------------------------------------------------------------
async function onExportBbtn() {
  if (!_lastAnalysis) {
    alert('Vui lòng bấm "Phân tích & Lưu" trước khi xuất Biên bản thí nghiệm.');
    return;
  }
  const btn = $("btnExportBbtn");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = "Đang tạo file...";
  try {
    await BbtnExport.exportBbtnDocx(_lastAnalysis);
  } catch (err) {
    alert("Xuất BBTN (docx) thất bại: " + ((err && err.message) || err));
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

// ---------------------------------------------------------------------
// Xuất Báo cáo phân tích kỹ thuật (docx) — cho thiết bị CÓ BẤT THƯỜNG, xem
// tech-report-export.js. Nút chỉ hiện khi overallStatus.level !== "normal" (xem
// renderResults() ở trên) nên _lastAnalysis luôn có giá trị khi hàm này chạy được —
// vẫn kiểm tra lại cho chắc, cùng cách làm với onExportBbtn().
// ---------------------------------------------------------------------
async function onExportTechReport() {
  if (!_lastAnalysis) {
    alert('Vui lòng bấm "Phân tích & Lưu" trước khi xuất Báo cáo phân tích kỹ thuật.');
    return;
  }
  const btn = $("btnExportTechReport");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = "Đang tạo file...";
  try {
    await TechReportExport.exportTechReportDocx(_lastAnalysis);
  } catch (err) {
    alert("Xuất báo cáo phân tích kỹ thuật (docx) thất bại: " + ((err && err.message) || err));
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}
