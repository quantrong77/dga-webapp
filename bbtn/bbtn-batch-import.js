/* bbtn-batch-import.js — Tùy chọn nhập liệu THỨ 2 ở tab "DGA", BÊN CẠNH tùy chọn nhập
   rời từng lần đo (form "1. Thông tin lần đo" + ô "Biên bản thí nghiệm" 1 file, xem
   onBbtnFileSelected()/onAnalyze() ở ui-dga.js). Dùng khi có SẴN nhiều BBTN (PDF) lịch
   sử của CÙNG 1 thiết bị để chung 1 thư mục — chọn nhiều file/cả thư mục 1 lần, xem lại
   bảng preview rồi lưu thẳng hàng loạt vào Lịch sử đo, phục vụ nhập nhanh dữ liệu backfill
   để phân tích xu hướng (tab "Xu hướng"), không phải lặp lại "chọn file -> Phân tích & Lưu"
   từng file một.

   Dùng ĐÚNG Trạm/Thiết bị/Loại thiết bị/Ngăn OLTC/Nhà sản xuất/Thông số kỹ thuật
   thiết bị đang điền Ở FORM PHÍA TRÊN (đọc trực tiếp $("f_...").value/.checked tại thời
   điểm xử lý/lưu, không sao chép/nhân đôi UI chọn thiết bị) cho TẤT CẢ file trong đợt — chỉ
   Pha/Ngày lấy mẫu/hàm lượng khí đọc RIÊNG từng file qua BbtnImport.extract() (bbtn-import.js,
   pdf.js chạy client-side, không gửi file lên server nào để "đọc"). Việc lưu file đính
   kèm PDF gốc (tùy chọn, xem #batchAttachPdf) vẫn qua đúng Storage.uploadAttachment() như
   nhập từng lần — chỉ khác là gọi lặp lại cho từng file, TUẦN TỰ (không song song) để dễ
   theo dõi tiến độ và không dồn dập quá nhiều request cùng lúc lên Apps Script/Supabase. */

// _batchRows: 1 phần tử / 1 file PDF đã chọn — {id, file, parsed, pha, ngay, gases,
// status, statusKind: "pending"|"ok"|"warn"|"bad", include}. _batchExisting: bản ghi đã
// lưu trong Lịch sử đo TẠI THỜI ĐIỂM đọc batch — dùng để phát hiện trùng lặp, nạp lại 1
// lần khi bắt đầu đọc file (không nạp lại mỗi lần người dùng sửa Pha/Ngày 1 dòng, đỡ gọi
// Storage.listMeasurements() liên tục — đủ dùng vì batch chỉ chạy trong 1 phiên ngắn).
let _batchRows = [];
let _batchExisting = [];

function batchGasesCount(gases) {
  return Object.keys(gases || {}).length;
}

/** Khóa so trùng: Trạm+Thiết bị (đọc từ form phía trên, CHUNG cho cả đợt) + Pha+Ngày
 *  (riêng từng dòng) — khớp đúng tiêu chí "trùng lần đo" đã dùng ở nơi khác trong app
 *  (vd tìm "lần đo liền trước" ở onAnalyze(), ui-dga.js). */
function batchDupKey(tram, thietbi, pha, ngay) {
  return [String(tram || "").trim().toLowerCase(), String(thietbi || "").trim().toLowerCase(), pha || "", ngay || ""].join("|");
}

function resetBatchUI() {
  _batchRows = [];
  $("batchPreviewWrap").classList.add("hidden");
  $("batchTable").innerHTML = "";
  $("batchProgressText").textContent = "";
}

/** Nhận danh sách file (từ input "change" HOẶC "drop") — lọc chỉ giữ PDF (thư mục có
 *  thể lẫn file khác loại/thư mục con khi dùng "Chọn cả thư mục"), báo số file đã bỏ
 *  qua, rồi đọc TUẦN TỰ từng file bằng BbtnImport.extract() và render bảng preview ngay
 *  khi có kết quả từng dòng (không đợi đọc xong hết mới hiện, để người dùng thấy tiến độ
 *  với đợt nhiều file). Gọi lại hàm này (chọn file mới/kéo-thả tiếp) sẽ THAY THẾ hoàn
 *  toàn danh sách cũ, không cộng dồn — giống hành vi input[type=file] thông thường. */
async function handleBatchFileList(fileList) {
  const all = Array.from(fileList || []);
  const files = all.filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
  const skipped = all.length - files.length;
  const skipNote = $("batchSkippedNote");
  if (skipped > 0) {
    skipNote.textContent = `Đã bỏ qua ${skipped} file không phải PDF (kể cả thư mục con nếu chọn cả thư mục).`;
    skipNote.classList.remove("hidden");
  } else {
    skipNote.classList.add("hidden");
  }
  if (!files.length) {
    resetBatchUI();
    return;
  }
  if (!window.BbtnImport) {
    alert("Không đọc được BBTN (thư viện đọc PDF chưa tải xong) — thử lại sau vài giây.");
    return;
  }

  $("batchPreviewWrap").classList.remove("hidden");
  $("batchSummaryText").textContent = `Đang đọc ${files.length} file...`;
  _batchRows = files.map((file, idx) => ({
    id: "brow_" + idx + "_" + Date.now(),
    file,
    parsed: null,
    pha: null,
    ngay: null,
    gases: {},
    status: "Đang đọc...",
    statusKind: "pending",
    include: false,
  }));
  renderBatchTable();

  try {
    _batchExisting = await Storage.listMeasurements();
  } catch (err) {
    _batchExisting = _allMeasurements || [];
  }

  for (const row of _batchRows) {
    try {
      const data = await window.BbtnImport.extract(row.file);
      row.parsed = data;
      row.pha = data.pha || "A";
      row.ngay = data.ngay || "";
      row.gases = data.gases || {};
    } catch (err) {
      row.parsed = null;
      row.parseError = (err && err.message) || String(err);
    }
    recomputeRowStatus(row);
    renderBatchTable();
  }
  updateBatchSummary();
}

/** Xác định trạng thái + có tự động tick chọn nhập hay không cho 1 dòng — chạy lại mỗi
 *  khi: đọc xong file, hoặc người dùng tự sửa Pha/Ngày của dòng đó (2 trường DUY NHẤT
 *  cho sửa tay trên bảng preview; số liệu khí không sửa được ở đây — nếu đọc sai, dùng
 *  ô nhập RỜI TỪNG LẦN ở form phía trên để gõ tay chính xác hơn). */
function recomputeRowStatus(row) {
  if (row.parseError) {
    row.status = "✗ Không đọc được file (có thể là ảnh scan, chưa hỗ trợ OCR) — bỏ qua";
    row.statusKind = "bad";
    row.include = false;
    return;
  }
  if (!row.ngay) {
    row.status = "✗ Không đọc được Ngày lấy mẫu — bỏ qua (đọc file khác hoặc dùng nhập rời từng lần)";
    row.statusKind = "bad";
    row.include = false;
    return;
  }
  if (batchGasesCount(row.gases) === 0) {
    row.status = "✗ Không đọc được khí nào — bỏ qua";
    row.statusKind = "bad";
    row.include = false;
    return;
  }

  const tram = $("f_tram").value.trim();
  const thietbi = $("f_thietbi").value.trim();
  const key = batchDupKey(tram, thietbi, row.pha, row.ngay);
  const dupExisting = _batchExisting.some((r) => batchDupKey(r.tram, r.thiet_bi, r.pha, r.sample_date) === key);
  const dupInBatch = _batchRows.some((r) => r !== row && r.ngay && batchDupKey(tram, thietbi, r.pha, r.ngay) === key);
  if (dupExisting || dupInBatch) {
    row.status = "⚠ Trùng Pha+Ngày với lần đo đã có/dòng khác trong đợt này — đã bỏ chọn, tự tick lại nếu chắc chắn muốn nhập";
    row.statusKind = "warn";
    row.include = false;
    return;
  }
  if (!row.parsed.pha) {
    row.status = "⚠ Không đọc được Pha — mặc định A, kiểm tra lại cột Pha";
    row.statusKind = "warn";
    row.include = true;
    return;
  }
  row.status = "✓ Sẵn sàng nhập";
  row.statusKind = "ok";
  row.include = true;
}

function batchPillClass(kind) {
  return kind === "ok" ? "ok" : kind === "warn" ? "warn" : kind === "bad" ? "bad" : "muted";
}

function renderBatchTable() {
  const tbody = $("batchTable");
  tbody.innerHTML = _batchRows.map((row) => {
    const tcg = row.parsed && batchGasesCount(row.gases) > 0 ? DGA.computeTCG(row.gases).toFixed(1) : "—";
    const checkDisabled = row.statusKind === "bad" || row.statusKind === "pending";
    return `
      <tr data-row-id="${row.id}">
        <td><input type="checkbox" class="batch-row-check" ${row.include ? "checked" : ""} ${checkDisabled ? "disabled" : ""} /></td>
        <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(row.file.name)}">${escapeHtml(row.file.name)}</td>
        <td>
          <select class="batch-row-pha" ${checkDisabled && row.statusKind === "pending" ? "disabled" : ""} style="padding:4px 6px; font-size:12.5px;">
            ${["A", "B", "C", "chung3pha"].map((v) => `<option value="${v}" ${row.pha === v ? "selected" : ""}>${v === "chung3pha" ? "Chung" : v}</option>`).join("")}
          </select>
        </td>
        <td><input type="date" class="batch-row-ngay" value="${row.ngay || ""}" style="padding:4px 6px; font-size:12.5px;" /></td>
        <td style="font-variant-numeric:tabular-nums;">${tcg}</td>
        <td><span class="pill ${batchPillClass(row.statusKind)}" style="font-size:11px; white-space:normal; display:inline-block; line-height:1.4;">${escapeHtml(row.status)}</span></td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("tr").forEach((tr) => {
    const row = _batchRows.find((r) => r.id === tr.dataset.rowId);
    if (!row) return;
    tr.querySelector(".batch-row-check").addEventListener("change", (e) => {
      row.include = e.target.checked;
      updateBatchSummary();
    });
    tr.querySelector(".batch-row-pha").addEventListener("change", (e) => {
      row.pha = e.target.value;
      recomputeRowStatus(row);
      renderBatchTable();
      updateBatchSummary();
    });
    tr.querySelector(".batch-row-ngay").addEventListener("change", (e) => {
      row.ngay = e.target.value;
      recomputeRowStatus(row);
      renderBatchTable();
      updateBatchSummary();
    });
  });
}

function updateBatchSummary() {
  const total = _batchRows.length;
  const included = _batchRows.filter((r) => r.include).length;
  $("batchSummaryText").textContent = total
    ? `${total} file — ${included} dòng sẽ được nhập (bỏ/tích chọn từng dòng nếu cần).`
    : "—";
}

function onBatchSelectAll() {
  _batchRows.forEach((r) => { if (r.statusKind === "ok" || r.statusKind === "warn") r.include = true; });
  renderBatchTable();
  updateBatchSummary();
}

function onBatchSelectNone() {
  _batchRows.forEach((r) => (r.include = false));
  renderBatchTable();
  updateBatchSummary();
}

/** Lưu hàng loạt các dòng đang được tick — TUẦN TỰ từng dòng (không Promise.all) để: (1)
 *  cập nhật tiến độ/trạng thái từng dòng ngay trên bảng, (2) 1 dòng lỗi KHÔNG chặn các
 *  dòng còn lại (khác hẳn onAnalyze() nhập từng lần — ở đó 1 lỗi là dừng hẳn vì chỉ có 1
 *  bản ghi), (3) "Lần đo" tính đúng tuần tự vì bản ghi vừa lưu được cộng dồn vào
 *  danh sách "existing" ngay để dòng tiếp theo CÙNG Trạm+Thiết bị+Pha tính đúng số kế tiếp. */
async function onBatchSave() {
  if (!canSaveEntry()) {
    alert("Bạn cần đăng nhập để lưu lần đo.");
    return;
  }
  const toSave = _batchRows.filter((r) => r.include);
  if (!toSave.length) {
    alert("Chưa có dòng nào được chọn để lưu — tick vào cột đầu bảng preview.");
    return;
  }
  const tram = $("f_tram").value.trim();
  const thietbi = $("f_thietbi").value.trim();
  if (!thietbi) {
    alert('Vui lòng nhập ít nhất "Thiết bị" ở form "1. Thông tin lần đo" phía trên trước khi lưu hàng loạt (áp dụng chung cho cả đợt).');
    return;
  }
  const equipmentType = $("f_loai").value;
  // Checkbox tick = OLTC thông dầu/khí với thùng chính (COMM_OLTC); bỏ tick (mặc định)
  // = NO_OLTC — cùng cách đọc với onAnalyze() (ui-dga.js), xem MBA_SUBTYPES ở dga-logic.js.
  const mbaSubtype = equipmentType === DGA.EQUIPMENT_TYPES.MBA
    ? ($("f_mbasubtype").checked ? DGA.MBA_SUBTYPES.COMM_OLTC : DGA.MBA_SUBTYPES.NO_OLTC)
    : null;
  const manufacturer = $("f_nsx").value || null;
  const attachPdf = $("batchAttachPdf").checked;

  const btn = $("btnBatchSave");
  const originalLabel = btn.textContent;
  btn.disabled = true;

  let existing;
  try {
    existing = await Storage.listMeasurements();
  } catch (err) {
    existing = (_allMeasurements || []).slice();
  }

  let okCount = 0;
  let failCount = 0;
  for (let i = 0; i < toSave.length; i++) {
    const row = toSave[i];
    btn.textContent = `Đang lưu ${i + 1}/${toSave.length}...`;
    $("batchProgressText").textContent = `Đang lưu ${i + 1}/${toSave.length}...`;
    row.status = "Đang lưu...";
    row.statusKind = "pending";
    renderBatchTable();

    // "Lần đo" kế tiếp trong nhóm Trạm+Thiết bị+Pha CHÍNH XÁC CỦA DÒNG NÀY — cùng tiêu
    // chí updateLanDoSuggestion() (ui-dga.js), tính trên "existing" đã gồm cả bản ghi vừa
    // lưu ở vòng lặp trước, nên nhiều dòng cùng Pha trong 1 đợt vẫn được đánh số tăng dần
    // đúng thứ tự xử lý (không nhất thiết đúng thứ tự ngày — nếu cần đúng thứ tự ngày,
    // sắp lại bảng trước khi lưu bằng cách chỉnh Ngày rồi lưu lần lượt theo nhóm Pha).
    const sameGroup = existing.filter(
      (r) => (r.tram || "").trim().toLowerCase() === tram.toLowerCase() &&
        (r.thiet_bi || "").trim().toLowerCase() === thietbi.toLowerCase() &&
        (r.pha || "") === row.pha
    );
    const lanDo = sameGroup.reduce((m, r) => Math.max(m, Number(r.lan_do) || 0), 0) + 1;

    const measurement = {
      id: Storage.newId(),
      tram, thiet_bi: thietbi, equipment_type: equipmentType, mba_subtype: mbaSubtype,
      manufacturer, pha: row.pha, lan_do: lanDo, sample_date: row.ngay,
      ghi_chu: "Nhập hàng loạt từ BBTN (" + row.file.name + ")",
      kieu_may: $("f_kieumay").value.trim(),
      nam_sx: $("f_namsx").value ? Number($("f_namsx").value) : null,
      nam_van_hanh: $("f_namvanhanh").value ? Number($("f_namvanhanh").value) : null,
      dien_ap_dm: $("f_dienapdm").value.trim(),
      so_che_tao: $("f_sochetao").value.trim(),
      loai_dau: $("f_loaidau").value.trim(),
      ket_cau_cach_dien: $("f_ketcaucachdien").value.trim(),
      hien_trang_van_hanh: $("f_hientrangvanhanh").value.trim(),
      ...row.gases,
    };

    let attachWarning = "";
    if (attachPdf) {
      try {
        const uploaded = await Storage.uploadAttachment(measurement.id, row.file);
        Object.assign(measurement, uploaded);
      } catch (err) {
        // Lỗi đính kèm KHÔNG chặn lưu số liệu — cùng cách onAnalyze() xử lý (ui-dga.js).
        attachWarning = " (lỗi đính kèm PDF: " + ((err && err.message) || err) + ")";
      }
    }

    try {
      await Storage.addMeasurement(measurement);
      existing.push(measurement);
      row.status = attachWarning ? "⚠ Đã lưu số liệu, Lần đo " + lanDo + attachWarning : "✓ Đã lưu (Lần đo " + lanDo + ")";
      row.statusKind = attachWarning ? "warn" : "ok";
      row.include = false;
      okCount++;
    } catch (err) {
      row.status = "✗ Lỗi khi lưu: " + ((err && err.message) || err);
      row.statusKind = "bad";
      failCount++;
    }
    renderBatchTable();
  }

  await registerStationIfNew(tram);
  await refreshHistoryUI();
  updateLanDoSuggestion();

  btn.disabled = false;
  btn.textContent = originalLabel;
  $("batchProgressText").textContent = "";
  updateBatchSummary();
  showToast(
    `Đã lưu ${okCount}/${toSave.length} lần đo` + (failCount ? `, ${failCount} lỗi — xem trạng thái từng dòng.` : "."),
    failCount ? "error" : "success"
  );
}
