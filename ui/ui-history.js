/* ui-history.js — Tab "Lịch sử đo": bảng nhật ký các lần đo đã lưu (đo khí/dầu
   MBA/dầu OLTC), và so sánh tốc độ gia tăng khí giữa 2 lần đo. Tách từ app.js — xem
   ui-auth.js đầu file đó để biết quy ước chia sẻ scope giữa các file ui-*.js. */

// ---------------------------------------------------------------------
// Lịch sử đo
// ---------------------------------------------------------------------
let _allMeasurements = [];
let _allOilTests = [];
let _allOltcOilTests = [];

/** Hiện/ẩn thông báo "Vui lòng chờ! Đang nạp dữ liệu..." (#historyLoadingHint) khi
 *  tải lịch sử đo LẦN ĐẦU lúc mở app (gọi ở initApp(), xem app-core.js) — tránh vừa
 *  vào tab đã thấy "Chưa có lần đo nào được lưu" (#historyEmpty) trong lúc dữ liệu
 *  thật vẫn đang trên đường về, dễ hiểu lầm là mất hết dữ liệu. Ẩn luôn #historyEmpty
 *  trong lúc tải để 2 thông báo không chồng lên nhau. */
function setHistoryLoading(isLoading) {
  const hint = $("historyLoadingHint");
  if (!hint) return;
  hint.classList.toggle("hidden", !isLoading);
  if (isLoading) $("historyEmpty").classList.add("hidden");
}

async function refreshHistoryUI() {
  const all = await Storage.listMeasurements();
  _allMeasurements = all;
  // #lichsu_station/#lichsu_device (combo tự gõ-tìm, xem lichsuFilterValues() bên dưới)
  // — khớp CHÍNH XÁC Trạm/Thiết bị đang chọn, thay cho ô tìm kiếm tự do #historyFilter cũ.
  const filter = lichsuFilterValues();
  // #historyEquipmentFilter (xem index.html) — lọc riêng theo Loại thiết bị (TI/TU/Sứ
  // xuyên/MBA/Kháng dầu/Khác) vì bảng này gộp chung tất cả loại thiết bị vào 1 danh
  // sách; "" (Tất cả loại thiết bị) nghĩa là không lọc theo tiêu chí này.
  const equipmentTypeFilter = ($("historyEquipmentFilter") && $("historyEquipmentFilter").value) || "";
  const filtered = all.filter((r) =>
    lichsuMatchesFilter(r, filter) && (!equipmentTypeFilter || r.equipment_type === equipmentTypeFilter)
  );
  filtered.sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date));

  const tbody = $("historyTable");
  tbody.innerHTML = "";
  $("historyEmpty").classList.toggle("hidden", filtered.length > 0);

  filtered.forEach((rec) => {
    const gases = recordGases(rec);
    const mbaSubtype = rec.mba_subtype ?? rec.mbaSubtype ?? null;
    const standard = DGA.resolveStandard({ equipmentType: rec.equipment_type, manufacturer: rec.manufacturer, mbaSubtype }, toManufacturerStandardsForLogic(_allStandards));
    const evalRows = DGA.evaluateAbsolute(gases, standard.limits);
    const overall = DGA.overallVerdict(evalRows);
    const ratios = DGA.computeRatios(gases);
    // DGA.diagnoseGasFault() tự chọn đúng bảng theo loại thiết bị (Table A.10 cho sứ
    // xuyên, Table 1/Bảng 66 cho các loại còn lại) — xem chú thích đầy đủ ở onAnalyze()
    // (ui-dga.js).
    const diagnosis = DGA.diagnoseGasFault(gases, rec.equipment_type, standard.pdThreshold);
    const duval = DGA.diagnoseDuval1(gases);
    const tcg = DGA.computeTCG(gases);
    const condemnBad = DGA.condemningExceededRows(DGA.evaluateCondemning(gases, standard.condemning)).length > 0;

    // N2, O2 (tùy chọn, KHÔNG thuộc gases/recordGases()) + ô số liệu khí đã bị SỬA so
    // với lần lưu gốc (rec.edited_fields, xem diffTrackedGasFields() ở app-core.js) —
    // gasCellHtml() tô nền đỏ + tooltip "giá trị trước khi sửa/thời điểm sửa" đúng ô đó.
    const editedMap = parseEditedFields(rec.edited_fields);
    const gasCellHtml = (field, value) => {
      const oldVal = editedMap.get(field);
      if (oldVal === undefined) return `<td>${value ?? "—"}</td>`;
      const editedAtText = rec.edited_at ? new Date(rec.edited_at).toLocaleString("vi-VN") : "?";
      const title = `Giá trị trước khi sửa: ${oldVal === "" ? "(trống)" : oldVal} — đã sửa lúc ${editedAtText}`;
      return `<td class="cell-edited-warn" title="${escapeHtml(title)}">${value ?? "—"}</td>`;
    };
    const n2 = rec.n2 ?? rec.N2 ?? null;
    const o2 = rec.o2 ?? rec.O2 ?? null;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${DGA.formatSampleDate(rec.sample_date)}</td>
      <td>${escapeHtml(rec.tram || "—")}</td>
      <td>${escapeHtml(rec.thiet_bi)}</td>
      <td class="nowrap-cell">${escapeHtml(rec.equipment_type)}</td>
      <td>${escapeHtml(DGA.phaLabel(rec.pha) || "—")}</td>
      <td>${rec.lan_do ?? "—"}</td>
      ${DGA.GASES.map((g) => gasCellHtml(g, gases[g])).join("")}
      ${gasCellHtml("N2", n2)}
      ${gasCellHtml("O2", o2)}
      <td>${tcg.toFixed(1)}</td>
      <td>${overall === "Đạt" ? verdictPill("Đạt") : verdictPill("Không đạt")}${condemnBad ? ' <span class="pill bad">⚠ Loại bỏ</span>' : ""}</td>
      <td style="font-size:12px;">${diagnosis}</td>
      <td style="font-size:12px;">${duval ? duval.zone : "—"}</td>
      <td>${ownerCellHtml(rec)}${editLogBadgeHtml(rec)}</td>
      <td class="actions-cell"><div class="btn-row">
        ${rec.bbtn_url ? `<button class="btn ghost" data-action="viewbbtn" title="Xem biên bản thí nghiệm (BBTN) đã đính kèm" style="padding:5px 10px; font-size:12px;">Xem</button>` : ""}
        ${canEditRecord(rec) ? `<button class="btn ghost" data-action="edit" style="padding:5px 10px; font-size:12px;">Sửa</button>` : ""}
        ${canWrite() ? `<button class="btn danger" data-action="del" style="padding:5px 10px; font-size:12px;">Xóa</button>` : ""}
      </div></td>
    `;
    const viewBbtnBtn = tr.querySelector('[data-action="viewbbtn"]');
    if (viewBbtnBtn) viewBbtnBtn.addEventListener("click", () => viewBbtn({ bbtn_url: rec.bbtn_url, bbtn_name: rec.bbtn_name }));
    const editBtn = tr.querySelector('[data-action="edit"]');
    if (editBtn) editBtn.addEventListener("click", () => onEditMeasurement(rec));
    const delBtn = tr.querySelector('[data-action="del"]');
    if (delBtn) {
      delBtn.addEventListener("click", async () => {
        if (confirm("Xóa lần đo này khỏi lịch sử?")) {
          try {
            await Storage.deleteMeasurement(rec.id);
            await refreshHistoryUI();
          } catch (err) {
            notifyError(storageErrorMessage(err));
          }
        }
      });
    }
    tbody.appendChild(tr);
  });

  refreshCompareDeviceOptions();
  refreshTrendDeviceOptions();
  refreshAlertsUI();
}

// ---------------------------------------------------------------------
// Tab "Lịch sử đo" — bộ chọn xem lịch sử Khí hòa tan (DGA)/Dầu (#lichsuTypeToggle, xem
// setupLichSuViewToggle() ở app-core.js đổi class active + ẩn/hiện #lichsuGasWrap/
// #lichsuOilWrap). View "Dầu" gộp CHUNG 2 bảng con #lichsuOilMainSubWrap (Dầu MBA
// chính)/#lichsuOltcSubWrap (Dầu OLTC) — #historyEquipmentFilter (giá trị "main"/"oltc"/
// "" khi ở view này) quyết định hiện 1 hay cả 2, xem toggleLichSuOilSourceWraps() ở
// app-core.js — HÀM RENDER ở đây (refreshLichSuOilTable()/refreshLichSuOltcTable()) vẫn
// LUÔN tính cả 2 bảng bất kể đang ẩn/hiện, đơn giản hơn và đủ nhẹ (chỉ tính lại từ dữ
// liệu ĐÃ CÓ SẴN trong bộ nhớ _allOilTests/_allOltcOilTests, không gọi lại Storage). 2
// bảng dầu ở đây chỉ MIRROR lại dữ liệu đã nạp bởi ui-oil.js/ui-oltc.js — dùng
// renderOilTestRows()/renderOltcOilTestRows() DÙNG CHUNG với bảng gốc ở tab "Dầu cách
// điện" để luôn nhất quán 100% cách tính Kết luận, không định nghĩa lại. Áp dụng CHUNG 1
// ô lọc #historyFilter (Trạm/Thiết bị) cho cả 3 bảng để đổi qua lại giữa DGA/Dầu vẫn giữ
// nguyên bộ lọc đang gõ, khỏi phải gõ lại.
// ---------------------------------------------------------------------
/** Đọc giá trị 2 ô combo lọc "Trạm biến áp"/"Thiết bị" (#lichsu_station/#lichsu_device
 *  — THAY THẾ ô tìm kiếm tự do #historyFilter cũ, xem lichsuStationOptions()/
 *  lichsuDeviceOptions() bên dưới + setupCombo() cho 2 ô này ở initApp(), app-core.js). TRIM CHÍNH XÁC
 *  (không lowercase/substring như #historyFilter cũ) vì giờ chọn từ danh sách gợi ý —
 *  nhưng vẫn cho gõ tự do tên chưa có trong gợi ý (setupCombo() không ép buộc chọn từ
 *  danh sách, đúng quy ước chung mọi combo trong app). Gọi 1 LẦN trước mỗi lượt
 *  .filter() một bảng (không đọc lại DOM trong từng dòng), giữ đúng quy ước hiệu năng
 *  của lichsuFilterText() cũ. */
function lichsuFilterValues() {
  return {
    station: $("lichsu_station") ? $("lichsu_station").value.trim() : "",
    device: $("lichsu_device") ? $("lichsu_device").value.trim() : "",
  };
}
function lichsuMatchesFilter(rec, filter) {
  return (!filter.station || (rec.tram || "").trim() === filter.station) &&
    (!filter.device || (rec.thiet_bi || "").trim() === filter.device);
}

/** Nguồn dữ liệu để tính gợi ý cho #lichsu_station/#lichsu_device — PHỤ THUỘC view đang
 *  xem (currentLichSuView(), xem app-core.js) và lựa chọn hiện tại của
 *  #historyEquipmentFilter (Ý NGHĨA KHÁC NHAU theo view — xem
 *  populateHistoryEquipmentFilterOptions(), app-core.js): view "gas" lọc theo
 *  r.equipment_type (TI/TU/Sứ xuyên/MBA/Khác); view "oil" chọn đúng 1 trong 3 mảng dữ
 *  liệu dầu theo "Nguồn dầu" đang chọn ("main"/"oltc"/1 trong 3 loại TI/TU/Sứ xuyên —
 *  gộp CẢ 3 mảng nếu để "" = Tất cả). Nhờ vậy danh sách gợi ý Trạm/Thiết bị LUÔN khớp
 *  đúng "gom nhóm" đang chọn ở #historyEquipmentFilter — không gợi ý thiết bị/trạm
 *  không thuộc nhóm đang xem, tránh dẫn vào ngõ cụt (0 dòng kết quả). */
function lichsuDeviceSourceRecords() {
  const view = currentLichSuView();
  const equipFilter = ($("historyEquipmentFilter") && $("historyEquipmentFilter").value) || "";
  if (view === "gas") {
    return equipFilter ? _allMeasurements.filter((r) => r.equipment_type === equipFilter) : _allMeasurements;
  }
  if (equipFilter === "main") return _allOilTests;
  if (equipFilter === "oltc") return _allOltcOilTests;
  const instrumentTypes = [DGA.EQUIPMENT_TYPES.TI, DGA.EQUIPMENT_TYPES.TU, DGA.EQUIPMENT_TYPES.BUSHING];
  if (instrumentTypes.includes(equipFilter)) {
    return (_allTioOilTests || []).filter((r) => r.equipment_type === equipFilter);
  }
  return [..._allOilTests, ..._allOltcOilTests, ...(_allTioOilTests || [])];
}

/** Danh sách gợi ý cho ô combo "Trạm biến áp" (#lichsu_station) — CHỈ liệt kê các trạm
 *  THỰC SỰ có ít nhất 1 bản ghi trong nhóm đang xem (xem lichsuDeviceSourceRecords()
 *  trên) — cùng lý do đã áp dụng cho trendStationOptions() (ui-trend.js)/
 *  alertStationOptions() (ui-alerts.js): tránh gợi ý trạm không có dữ liệu ở nhóm này,
 *  dẫn vào ngõ cụt. setupCombo() tự gọi lại hàm này mỗi lần mở/gõ nên danh sách luôn
 *  theo đúng dữ liệu + nhóm đang chọn mới nhất. */
function lichsuStationOptions() {
  const names = new Set();
  lichsuDeviceSourceRecords().forEach((r) => { const n = (r.tram || "").trim(); if (n) names.add(n); });
  return Array.from(names).sort((a, b) => a.localeCompare(b, "vi")).map((name) => ({ value: name, label: name }));
}

/** Danh sách gợi ý cho ô combo "Thiết bị" (#lichsu_device) — khi #lichsu_station đang
 *  có giá trị, CHỈ gợi ý thiết bị THUỘC đúng trạm đó (cùng ràng buộc trendDeviceOptions()
 *  đang áp dụng ở tab "Xu hướng"); để trống Trạm thì gợi ý thiết bị của TẤT CẢ các trạm
 *  trong nhóm đang xem, kèm tên trạm trong nhãn hiển thị để phân biệt thiết bị trùng
 *  tên giữa nhiều trạm. Vẫn cho gõ tự do tên chưa có trong gợi ý. */
function lichsuDeviceOptions() {
  const station = $("lichsu_station") ? $("lichsu_station").value.trim() : "";
  const matchesStation = (r) => !station || (r.tram || "").trim() === station;
  const byName = new Map();
  lichsuDeviceSourceRecords().filter(matchesStation).forEach((r) => {
    const name = (r.thiet_bi || "").trim();
    if (!name || byName.has(name)) return;
    byName.set(name, (r.tram || "").trim());
  });
  return Array.from(byName.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "vi"))
    .map(([name, tram]) => ({ value: name, label: station || !tram ? name : `${name} — ${tram}` }));
}

function refreshLichSuOilTable() {
  if (!$("lichsuOilHistoryTable")) return; // phòng khi gọi trước khi DOM sẵn sàng
  const filter = lichsuFilterValues();
  const sorted = _allOilTests
    .filter((r) => lichsuMatchesFilter(r, filter))
    .slice()
    .sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date));
  renderOilTestRows("lichsuOilHistoryTable", "lichsuOilHistoryEmpty", sorted);
}

function refreshLichSuOltcTable() {
  if (!$("lichsuOltcHistoryTable")) return;
  const filter = lichsuFilterValues();
  const sorted = _allOltcOilTests
    .filter((r) => lichsuMatchesFilter(r, filter))
    .slice()
    .sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date));
  renderOltcOilTestRows("lichsuOltcHistoryTable", "lichsuOltcHistoryEmpty", sorted);
}

/** Bảng con "Dầu TI/TU/Sứ xuyên" ở tab "Lịch sử đo" — KHÁC 2 bảng dầu MBA/OLTC ở trên: cả
 *  3 loại thiết bị (TI/TU/Sứ xuyên) dùng CHUNG 1 nguồn dữ liệu (_allTioOilTests, nạp bởi
 *  refreshTioOilTestsUI() ở ui-ti-oil.js) nên phải LỌC theo r.equipment_type khi
 *  #historyEquipmentFilter đang chọn đúng 1 trong 3 giá trị đó — nếu để "" (Tất cả) hoặc
 *  "main"/"oltc" (không thuộc về bảng này) thì hiện đủ cả TI+TU+Sứ xuyên không lọc thêm
 *  (ẩn/hiện cả bảng đã do toggleLichSuOilSourceWraps() lo). DÙNG CHUNG
 *  renderTioOilTestRows() với bảng gốc #tioOilHistoryTable ở tab "Dầu cách điện" để nhất
 *  quán 100% cách tính Kết luận. */
function refreshLichSuInstrumentOilTable() {
  if (!$("lichsuInstrumentOilHistoryTable")) return; // phòng khi gọi trước khi DOM sẵn sàng
  const filter = lichsuFilterValues();
  const equipTypeFilter = ($("historyEquipmentFilter") && $("historyEquipmentFilter").value) || "";
  const instrumentTypes = [DGA.EQUIPMENT_TYPES.TI, DGA.EQUIPMENT_TYPES.TU, DGA.EQUIPMENT_TYPES.BUSHING];
  const isInstrumentType = instrumentTypes.includes(equipTypeFilter);
  const sorted = (_allTioOilTests || [])
    .filter((r) => lichsuMatchesFilter(r, filter))
    .filter((r) => !isInstrumentType || r.equipment_type === equipTypeFilter)
    .slice()
    .sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date));
  renderTioOilTestRows("lichsuInstrumentOilHistoryTable", "lichsuInstrumentOilHistoryEmpty", sorted);
}

// ---------------------------------------------------------------------
// So sánh tốc độ gia tăng khí giữa 2 lần đo CHỌN được (không chỉ tự động lấy lần
// liền trước) — dùng chung DGA.computeRateOfChange()/DGA.resolveStandard().
// ---------------------------------------------------------------------
function deviceKey(rec) {
  return `${rec.tram || ""}|||${rec.thiet_bi || ""}|||${rec.pha || ""}`;
}

/** Tính danh sách "Lần đo" cần đổi để đúng thứ tự thời gian (lần 1 = Ngày lấy mẫu XA
 *  NHẤT, tăng dần) cho 1 nhóm bản ghi CỦA CÙNG 1 THIẾT BỊ (records — đã lọc sẵn theo
 *  Trạm+Thiết bị, có thể gồm cả 3 Pha trộn lẫn) — dùng cho nút "Sắp xếp lại Lần đo" ở
 *  cả tab "DGA" (khối nhập hàng loạt BBTN, xem onBatchRenumber() ở bbtn-batch-import.js)
 *  lẫn tab "Lịch sử đo" (xem onHistoryRenumber() bên dưới). Nhóm RIÊNG theo Pha (đúng
 *  quy ước "Lần đo" hiện có — xem updateLanDoSuggestion() ở ui-dga.js) rồi sắp theo
 *  sample_date tăng dần; 2 bản ghi TRÙNG NGÀY giữ nguyên thứ tự tương đối theo "Lần đo"
 *  hiện tại (không đảo lộn vô cớ khi ngày bằng nhau). Chỉ trả về các bản ghi có "Lần đo"
 *  THỰC SỰ đổi số — bản ghi đã đúng thứ tự thì bỏ qua, không tạo thay đổi thừa. */
function computeLanDoRenumberChanges(records) {
  const byPha = new Map();
  (records || []).forEach((r) => {
    const pha = r.pha || "";
    if (!byPha.has(pha)) byPha.set(pha, []);
    byPha.get(pha).push(r);
  });

  const changes = [];
  byPha.forEach((group) => {
    const sorted = group.slice().sort((a, b) => {
      const da = a.sample_date || "";
      const db = b.sample_date || "";
      if (da !== db) return da < db ? -1 : 1;
      return (Number(a.lan_do) || 0) - (Number(b.lan_do) || 0);
    });
    sorted.forEach((rec, idx) => {
      const newLanDo = idx + 1;
      const oldLanDo = Number(rec.lan_do) || 0;
      if (oldLanDo !== newLanDo) changes.push({ record: rec, oldLanDo: rec.lan_do ?? null, newLanDo });
    });
  });
  return changes;
}

/** Sắp xếp lại "Lần đo" cho ĐÚNG 1 thiết bị (khớp Trạm+Thiết bị, TRIM chính xác — cùng
 *  quy ước updateLanDoSuggestion()/deviceKey() ở trên, KHÔNG lowercase để tránh gộp
 *  nhầm 2 thiết bị viết hoa/thường khác nhau) theo thời gian thực (lần 1 = Ngày lấy mẫu
 *  xa nhất), gồm CẢ 3 PHA. Luôn tải lại "Lịch sử đo" MỚI NHẤT từ Storage (không dùng
 *  _allMeasurements đang cache trên UI) để không bỏ sót bản ghi ai đó vừa thêm ở máy
 *  khác. Xác nhận (confirm()) trước khi ghi, xem trước tối đa 8 dòng sẽ đổi. Ghi TUẦN
 *  TỰ từng bản ghi qua Storage.addMeasurement() (upsert theo id, xem storage.js) — 1
 *  dòng lỗi KHÔNG chặn các dòng còn lại, vì ở chế độ gsheet server chỉ cho SỬA bản ghi
 *  do chính người đang đăng nhập nhập vào hoặc Admin (prepareOwnedRecord(), Code.gs) —
 *  nếu lịch sử thiết bị có bản ghi do người khác nhập từ trước, user thường có thể chỉ
 *  sắp xếp lại được MỘT PHẦN, cần Admin xử lý nốt phần còn lại. */
async function renumberLanDoForDevice(tramRaw, thietbiRaw) {
  const tram = (tramRaw || "").trim();
  const thietbi = (thietbiRaw || "").trim();
  if (!thietbi) {
    notifyError('Cần biết đúng Thiết bị để sắp xếp lại "Lần đo".');
    return;
  }

  let fresh;
  try {
    fresh = await Storage.listMeasurements();
  } catch (err) {
    notifyError('Không tải được Lịch sử đo để sắp xếp lại: ' + storageErrorMessage(err));
    return;
  }

  const records = fresh.filter((r) => (r.tram || "").trim() === tram && (r.thiet_bi || "").trim() === thietbi);
  if (!records.length) {
    notifyError(`Không tìm thấy lần đo nào của thiết bị "${thietbi}"${tram ? " (Trạm " + tram + ")" : ""} trong Lịch sử đo.`);
    return;
  }

  const changes = computeLanDoRenumberChanges(records);
  if (!changes.length) {
    showToast(`"Lần đo" của thiết bị "${thietbi}" đã đúng thứ tự thời gian — không cần sắp xếp lại.`, "success");
    return;
  }

  const PREVIEW_MAX = 8;
  const previewLines = changes.slice(0, PREVIEW_MAX).map((c) =>
    `${DGA.phaLabelWithPrefix(c.record.pha) || "Pha ?"}: ${DGA.formatSampleDate(c.record.sample_date)} — Lần ${c.oldLanDo ?? "—"} → Lần ${c.newLanDo}`
  );
  const moreLine = changes.length > PREVIEW_MAX ? `
… và ${changes.length - PREVIEW_MAX} dòng khác` : "";
  const confirmed = confirm(
    `Sắp xếp lại "Lần đo" của thiết bị "${thietbi}"${tram ? " (Trạm " + tram + ")" : ""} theo đúng thứ tự thời gian.\n` +
    `${changes.length} bản ghi sẽ được cập nhật:\n${previewLines.join("\n")}${moreLine}\n\nTiếp tục?`
  );
  if (!confirmed) return;

  let okCount = 0;
  let failCount = 0;
  for (const c of changes) {
    try {
      await Storage.addMeasurement({ ...c.record, lan_do: c.newLanDo });
      okCount++;
    } catch (err) {
      failCount++;
    }
  }

  await refreshHistoryUI();
  if (typeof updateLanDoSuggestion === "function") updateLanDoSuggestion();
  showToast(
    `Đã sắp xếp lại "Lần đo": ${okCount}/${changes.length} bản ghi được cập nhật` +
      (failCount ? `, ${failCount} lỗi (thường do bản ghi được nhập bởi người khác — cần Admin xử lý nốt).` : "."),
    failCount ? "error" : "success"
  );
}

/** Nút "Sắp xếp lại Lần đo..." ở tab "Lịch sử đo" (#btnHistoryRenumber, xem index.html) —
 *  dùng TRỰC TIẾP giá trị 2 ô combo #lichsu_station/#lichsu_device đang chọn (khớp
 *  CHÍNH XÁC 1 thiết bị vì chọn/gõ từ combo, khác #historyFilter cũ chỉ lọc gần đúng
 *  theo substring nên trước đây phải tự dò xem có đang khớp ĐÚNG 1 thiết bị hay không —
 *  nay không cần nữa). Chỉ cần bắt buộc #lichsu_device không được để trống. */
function onHistoryRenumber() {
  const thietbi = $("lichsu_device") ? $("lichsu_device").value.trim() : "";
  if (!thietbi) {
    notifyError('Chọn (hoặc gõ) Thiết bị ở ô lọc bên trên trước khi sắp xếp lại "Lần đo".');
    return;
  }
  const tram = $("lichsu_station") ? $("lichsu_station").value.trim() : "";
  renumberLanDoForDevice(tram, thietbi);
}

function measurementOptionLabel(rec) {
  return `${DGA.formatSampleDate(rec.sample_date)} (Lần ${rec.lan_do ?? "?"})`;
}

function refreshCompareDeviceOptions() {
  const sel = $("cmp_device");
  if (!sel) return;
  const currentVal = sel.value;

  const byKey = new Map();
  _allMeasurements.forEach((r) => {
    const key = deviceKey(r);
    if (!byKey.has(key)) byKey.set(key, { tram: r.tram, thiet_bi: r.thiet_bi, pha: r.pha, count: 0 });
    byKey.get(key).count++;
  });

  sel.innerHTML = '<option value="">— Chọn thiết bị —</option>';
  Array.from(byKey.entries())
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => (a[1].thiet_bi || "").localeCompare(b[1].thiet_bi || ""))
    .forEach(([key, v]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = `${v.thiet_bi || "?"} — ${v.tram || "?"} — ${v.pha ? DGA.phaLabelWithPrefix(v.pha) : "Pha ?"} (${v.count} lần đo)`;
      sel.appendChild(opt);
    });

  if (Array.from(byKey.keys()).includes(currentVal)) sel.value = currentVal;
  refreshCompareMeasurementOptions();
}

function refreshCompareMeasurementOptions() {
  const key = $("cmp_device").value;
  const beforeSel = $("cmp_before");
  const afterSel = $("cmp_after");
  beforeSel.innerHTML = "";
  afterSel.innerHTML = "";

  if (!key) {
    // Chưa chọn thiết bị: chỉ hiện ghi chú "chưa đủ dữ liệu" nếu dropdown thiết bị
    // không có lựa chọn nào ngoài placeholder (tức chưa có thiết bị nào đủ 2 lần đo).
    $("cmpEmpty").classList.toggle("hidden", $("cmp_device").options.length > 1);
    $("cmpResultWrap").classList.add("hidden");
    return;
  }
  const list = _allMeasurements.filter((r) => deviceKey(r) === key).sort((a, b) => new Date(a.sample_date) - new Date(b.sample_date));
  if (list.length < 2) {
    $("cmpEmpty").classList.remove("hidden");
    $("cmpResultWrap").classList.add("hidden");
    return;
  }
  $("cmpEmpty").classList.add("hidden");
  list.forEach((r) => {
    const o1 = document.createElement("option"); o1.value = r.id; o1.textContent = measurementOptionLabel(r);
    beforeSel.appendChild(o1);
    const o2 = document.createElement("option"); o2.value = r.id; o2.textContent = measurementOptionLabel(r);
    afterSel.appendChild(o2);
  });
  // Mặc định chọn sẵn 2 lần đo gần nhất — người dùng có thể đổi sang mốc bất kỳ khác
  beforeSel.value = list[list.length - 2].id;
  afterSel.value = list[list.length - 1].id;
}

/** Làm tròn tối đa 4 chữ số thập phân để HIỂN THỊ (JS tự bỏ số 0 thừa ở cuối khi
 *  chuyển sang chuỗi) — tránh hiện số lẻ nhiễu do sai số dấu phẩy động (VD
 *  1.3333333000000002) ở cột before/after/delta của bảng so sánh tốc độ gia tăng
 *  khí (tab "Lịch sử đo" > So sánh 2 lần đo). Chỉ áp dụng lúc hiển thị — KHÔNG
 *  dùng giá trị đã làm tròn này để so sánh ngưỡng (verdict đã được tính trước đó
 *  trong DGA.computeRateOfChange() bằng giá trị chưa làm tròn). */
function fmt4(n) {
  if (n === null || n === undefined || !isFinite(n)) return n;
  return Math.round(n * 10000) / 10000;
}

function onCompareRate() {
  const key = $("cmp_device").value;
  if (!key) { notifyError("Vui lòng chọn thiết bị."); return; }
  const list = _allMeasurements.filter((r) => deviceKey(r) === key);
  const beforeRec = list.find((r) => String(r.id) === $("cmp_before").value);
  const afterRec = list.find((r) => String(r.id) === $("cmp_after").value);
  if (!beforeRec || !afterRec) { notifyError("Vui lòng chọn đủ 2 lần đo."); return; }
  if (beforeRec.id === afterRec.id) { notifyError("Vui lòng chọn 2 lần đo khác nhau."); return; }

  // Luôn xếp theo thời gian thực tế, bất kể người dùng chọn ở ô "thứ nhất"/"thứ hai" nào
  const [prevRec, currRec] = new Date(beforeRec.sample_date) <= new Date(afterRec.sample_date)
    ? [beforeRec, afterRec] : [afterRec, beforeRec];

  const deltaDays = Math.round((new Date(currRec.sample_date) - new Date(prevRec.sample_date)) / 86400000);
  if (deltaDays <= 0) { notifyError("2 lần đo phải có ngày lấy mẫu khác nhau."); return; }

  const mbaSubtype = currRec.mba_subtype ?? currRec.mbaSubtype ?? null;
  const standard = DGA.resolveStandard(
    { equipmentType: currRec.equipment_type, manufacturer: currRec.manufacturer, mbaSubtype },
    toManufacturerStandardsForLogic(_allStandards)
  );
  const rateRows = DGA.computeRateOfChange(recordGases(prevRec), recordGases(currRec), deltaDays, standard.rate, currRec.equipment_type);
  const usingCustomRate = standard.rate !== DGA.QD1901_BANG65_RATE;

  $("cmpResultWrap").classList.remove("hidden");
  $("cmpNote").textContent =
    `${DGA.formatSampleDate(prevRec.sample_date)} → ${DGA.formatSampleDate(currRec.sample_date)} (${deltaDays} ngày) — Tiêu chuẩn tốc độ: ` +
    (usingCustomRate ? "khoảng tốc độ riêng của nhà sản xuất" : "Bảng 65 QĐ1901 (Điều 54, tương ứng mục 8.3 IEC 60599:2022)") + ". " +
    (rateRows[0].officialForEquipment
      ? "Áp dụng CHÍNH THỨC cho MBA/Kháng dầu."
      : "Chỉ QĐ1901 quy định chính thức cho MBA — với loại thiết bị này chỉ dùng để THAM KHẢO.");
  $("cmpTable").innerHTML = rateRows.map((r) => `
    <tr>
      <td>${gasLabelIcon(r.gas)}${r.gas}</td><td>${fmt4(r.before)}</td><td>${fmt4(r.after)}</td><td>${fmt4(r.delta)}</td>
      <td>${r.ratePerYear}</td><td>${r.rangeLo} – ${r.rangeHi}</td>
      <td>${r.verdict.startsWith("⚠") ? `<span class="pill warn">${r.verdict}</span>` : r.verdict}</td>
    </tr>
  `).join("");
}

// ---------------------------------------------------------------------
// Tab "Xu hướng" — đồ thị xu hướng theo thời gian cho 1 thiết bị, gộp cả 3
// nguồn dữ liệu đã lưu: khí hòa tan (đo DGA), dầu MBA chính, dầu OLTC. Gom
// theo TÊN thiết bị (thiet_bi) — giống cách các ô combo "Thiết bị" khác trong
// app đang gộp gợi ý (bỏ qua Trạm/Pha để đơn giản, nhất quán với phần còn lại).
// Dùng Chart.js (tải trong index.html, kiểm tra typeof Chart trước khi dùng —
// nếu CDN lỗi/mất mạng thì chỉ phần đồ thị bị ẩn, không chặn phần còn lại).
// ---------------------------------------------------------------------
