/* ui-history.js — Tab "Lịch sử đo": bảng nhật ký các lần đo đã lưu (đo khí/dầu
   MBA/dầu OLTC), và so sánh tốc độ gia tăng khí giữa 2 lần đo. Tách từ app.js — xem
   ui-auth.js đầu file đó để biết quy ước chia sẻ scope giữa các file ui-*.js. */

// ---------------------------------------------------------------------
// Lịch sử đo
// ---------------------------------------------------------------------
let _allMeasurements = [];
let _allOilTests = [];
let _allOltcOilTests = [];

async function refreshHistoryUI() {
  const all = await Storage.listMeasurements();
  _allMeasurements = all;
  const filterText = ($("historyFilter").value || "").toLowerCase();
  const filtered = all.filter((r) =>
    !filterText || (r.tram || "").toLowerCase().includes(filterText) || (r.thiet_bi || "").toLowerCase().includes(filterText)
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
    const diagnosis = DGA.diagnoseRatios(ratios, standard.pdThreshold);
    const duval = DGA.diagnoseDuval1(gases);
    const tcg = DGA.computeTCG(gases);
    const condemnBad = DGA.condemningExceededRows(DGA.evaluateCondemning(gases, standard.condemning)).length > 0;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rec.sample_date}</td>
      <td>${escapeHtml(rec.tram || "—")}</td>
      <td>${escapeHtml(rec.thiet_bi)}</td>
      <td>${escapeHtml(rec.equipment_type)}</td>
      <td>${escapeHtml(DGA.phaLabel(rec.pha) || "—")}</td>
      <td>${rec.lan_do ?? "—"}</td>
      <td>${tcg.toFixed(1)}</td>
      <td>${overall === "Đạt" ? verdictPill("Đạt") : verdictPill("Không đạt")}${condemnBad ? ' <span class="pill bad">⚠ Loại bỏ</span>' : ""}</td>
      <td style="font-size:12px;">${diagnosis}</td>
      <td style="font-size:12px;">${duval ? duval.zone : "—"}</td>
      <td>${ownerCellHtml(rec)}</td>
      <td class="actions-cell"><div class="btn-row">
        ${rec.bbtn_url ? `<button class="btn ghost" data-action="viewbbtn" style="padding:5px 10px; font-size:12px;">Xem BBTN</button>` : ""}
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
            alert(storageErrorMessage(err));
          }
        }
      });
    }
    tbody.appendChild(tr);
  });

  refreshCompareDeviceOptions();
  refreshTrendDeviceOptions();
}

// ---------------------------------------------------------------------
// So sánh tốc độ gia tăng khí giữa 2 lần đo CHỌN được (không chỉ tự động lấy lần
// liền trước) — dùng chung DGA.computeRateOfChange()/DGA.resolveStandard().
// ---------------------------------------------------------------------
function deviceKey(rec) {
  return `${rec.tram || ""}|||${rec.thiet_bi || ""}|||${rec.pha || ""}`;
}

function measurementOptionLabel(rec) {
  return `${rec.sample_date} (Lần ${rec.lan_do ?? "?"})`;
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

function onCompareRate() {
  const key = $("cmp_device").value;
  if (!key) { alert("Vui lòng chọn thiết bị."); return; }
  const list = _allMeasurements.filter((r) => deviceKey(r) === key);
  const beforeRec = list.find((r) => String(r.id) === $("cmp_before").value);
  const afterRec = list.find((r) => String(r.id) === $("cmp_after").value);
  if (!beforeRec || !afterRec) { alert("Vui lòng chọn đủ 2 lần đo."); return; }
  if (beforeRec.id === afterRec.id) { alert("Vui lòng chọn 2 lần đo khác nhau."); return; }

  // Luôn xếp theo thời gian thực tế, bất kể người dùng chọn ở ô "thứ nhất"/"thứ hai" nào
  const [prevRec, currRec] = new Date(beforeRec.sample_date) <= new Date(afterRec.sample_date)
    ? [beforeRec, afterRec] : [afterRec, beforeRec];

  const deltaDays = Math.round((new Date(currRec.sample_date) - new Date(prevRec.sample_date)) / 86400000);
  if (deltaDays <= 0) { alert("2 lần đo phải có ngày lấy mẫu khác nhau."); return; }

  const mbaSubtype = currRec.mba_subtype ?? currRec.mbaSubtype ?? null;
  const standard = DGA.resolveStandard(
    { equipmentType: currRec.equipment_type, manufacturer: currRec.manufacturer, mbaSubtype },
    toManufacturerStandardsForLogic(_allStandards)
  );
  const rateRows = DGA.computeRateOfChange(recordGases(prevRec), recordGases(currRec), deltaDays, standard.rate, currRec.equipment_type);
  const usingCustomRate = standard.rate !== DGA.QD1901_BANG65_RATE;

  $("cmpResultWrap").classList.remove("hidden");
  $("cmpNote").textContent =
    `${prevRec.sample_date} → ${currRec.sample_date} (${deltaDays} ngày) — Tiêu chuẩn tốc độ: ` +
    (usingCustomRate ? "khoảng tốc độ riêng của nhà sản xuất" : "Bảng 65 QĐ1901 (Điều 54, tương ứng mục 8.4 IEC 60599:1999)") + ". " +
    (rateRows[0].officialForEquipment
      ? "Áp dụng CHÍNH THỨC cho MBA/Kháng dầu."
      : "Chỉ QĐ1901 quy định chính thức cho MBA — với loại thiết bị này chỉ dùng để THAM KHẢO.");
  $("cmpTable").innerHTML = rateRows.map((r) => `
    <tr>
      <td>${r.gas}</td><td>${r.before}</td><td>${r.after}</td><td>${r.delta}</td>
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
