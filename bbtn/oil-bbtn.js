/* oil-bbtn.js — Lõi xử lý BBTN dầu cách điện 3 PHA CHUNG 1 BIÊN BẢN (mẫu PTC3/BM.14: Điện áp
   chọc thủng, tgδ 90°C/20°C, Hàm lượng nước — mỗi hạng mục 1 cột pha A/B/C): đọc số liệu từ
   danh sách dòng chữ của PDF, đánh giá từng pha, tách thành 3 bản ghi instrument_oil_tests,
   và dựng dữ liệu điền template/template-bbtn-dau-3pha.docx.

   Toàn bộ là hàm thuần (không đụng DOM/mạng) để kiểm thử được bằng Jest
   (tests/oil-bbtn.test.js). Giao diện nằm ở ui/ui-ti-oil-3pha.js; việc đọc PDF thành dòng
   nằm ở BbtnImport.readLines() (bbtn/bbtn-import.js). */

const OIL_BBTN_PHASES = ["A", "B", "C"];
const OIL_BBTN_ITEMS = ["bdv", "tgd90", "tgd20", "moisture"];
const OIL_BBTN_ITEM_LABELS = {
  bdv: { name: "Điện áp chọc thủng", unit: "kV" },
  tgd90: { name: "Tổn hao điện môi tgδ 90°C", unit: "%" },
  tgd20: { name: "Tổn hao điện môi tgδ 20°C", unit: "%" },
  moisture: { name: "Độ ẩm dầu", unit: "ppm" },
};
// Xấu nhất đứng đầu — đánh giá 1 hạng mục của cả biên bản lấy theo pha xấu nhất.
const OIL_BBTN_VERDICT_ORDER = ["Không đạt", "Cảnh báo", "Chưa có tiêu chuẩn nhà sản xuất", "Đạt"];

/** Bỏ dấu tiếng Việt, GIỮ NGUYÊN độ dài chuỗi để cắt được đúng vị trí trên chuỗi gốc. */
function oilBbtnFold(s) {
  return Array.from(String(s || "").normalize("NFC"), (ch) => {
    if (ch === "đ") return "d";
    if (ch === "Đ") return "D";
    const base = ch.normalize("NFD")[0];
    return base.length === ch.length ? base : ch;
  }).join("");
}

function oilBbtnToNumber(token) {
  const n = Number(String(token).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Giá trị sau nhãn trên 1 dòng, cắt tới trước stopRe (nếu có) — tìm trên bản bỏ dấu. */
function oilBbtnLabelValue(lines, labelRe, stopRe) {
  for (const raw of lines) {
    const line = raw.normalize("NFC");
    const folded = oilBbtnFold(line);
    const m = labelRe.exec(folded);
    if (!m) continue;
    const start = m.index + m[0].length;
    let end = line.length;
    if (stopRe) {
      const stop = stopRe.exec(folded.slice(start));
      if (stop) end = start + stop.index;
    }
    return line.slice(start, end).trim();
  }
  return "";
}

/** Đoạn văn nhiều dòng: từ nhãn startRe tới trước dòng khớp stopRe (ghép lại thành 1 đoạn). */
function oilBbtnBlock(lines, startRe, stopRe) {
  const out = [];
  let inside = false;
  for (const raw of lines) {
    const line = raw.normalize("NFC");
    const folded = oilBbtnFold(line);
    if (!inside) {
      const m = startRe.exec(folded);
      if (!m) continue;
      inside = true;
      const first = line.slice(m.index + m[0].length).trim();
      if (first) out.push(first);
      continue;
    }
    if (stopRe.test(folded)) break;
    out.push(line.trim());
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

function oilBbtnDateToIso(text) {
  const m = /(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/.exec(text || "");
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}

/** "pha A: 16019123/1, pha B: 16019123/4, ... pha C: 16019123/5" -> { A, B, C }. */
function oilBbtnParseSerials(lines) {
  const startIdx = lines.findIndex((l) => /So che tao/i.test(oilBbtnFold(l)));
  if (startIdx < 0) return { A: "", B: "", C: "" };
  const part = [];
  for (let i = startIdx; i < lines.length && i < startIdx + 4; i++) {
    if (i > startIdx && /Loai dau/i.test(oilBbtnFold(lines[i]))) break;
    part.push(lines[i]);
  }
  const text = part.join(" ").replace(/\s*\/\s*/g, "/");
  const out = { A: "", B: "", C: "" };
  const re = /pha\s*([ABC])\s*:\s*([^\s,;]+)/gi;
  let m;
  while ((m = re.exec(text)) !== null) out[m[1].toUpperCase()] = m[2];
  return out;
}

function oilBbtnGuessEquipment(site) {
  const s = oilBbtnFold(site).trim().toUpperCase();
  if (/^(TI|CT)\b/.test(s)) return "TI (biến dòng điện)";
  if (/^(TU|CVT|VT)\b/.test(s)) return "TU (biến điện áp)";
  return null;
}

// Ô kết quả: số, hoặc gạch ngang (hạng mục không thí nghiệm ở pha đó).
const OIL_BBTN_CELL = "(\\d+(?:[.,]\\d+)?|[-–—])";
const OIL_BBTN_ROW_RE = new RegExp(`(?:^|\\s)(kV|%|ppm)\\s+${OIL_BBTN_CELL}\\s+${OIL_BBTN_CELL}\\s+${OIL_BBTN_CELL}(?=\\s|$)(.*)$`, "i");

function oilBbtnCell(token) {
  return /^[-–—]$/.test(token) ? null : oilBbtnToNumber(token);
}

function oilBbtnPrintedVerdict(text) {
  const f = oilBbtnFold(text).toLowerCase();
  if (/khong dat/.test(f)) return "Không đạt";
  if (/canh bao/.test(f)) return "Cảnh báo";
  if (/\bdat\b/.test(f)) return "Đạt";
  return "";
}

/** Dòng % thuộc tgδ 90°C hay 20°C — xem chính dòng đó và vài dòng ngay trên (nhãn thường nằm
 *  ở dòng riêng, cao hơn dòng số một chút). "0" của "90⁰C" là chỉ số trên nên có thể bị tách. */
function oilBbtnTanKind(foldedLines, idx) {
  for (let i = idx; i >= Math.max(0, idx - 3); i--) {
    const m = /T[gq]\S*\s*([29])\s*0/i.exec(foldedLines[i]);
    if (m) return m[1] === "9" ? "tgd90" : "tgd20";
  }
  return null;
}

/** Đọc số liệu 3 pha ở bảng KẾT QUẢ THÍ NGHIỆM. */
function oilBbtnParseResults(lines) {
  const folded = lines.map(oilBbtnFold);
  const headIdx = folded.findIndex((l) => /KET QUA THI NGHIEM/i.test(l));
  const from = headIdx >= 0 ? headIdx : 0;
  const phases = { A: {}, B: {}, C: {} };
  const printed = {};
  let hasPhaseHeader = false;
  let rowCount = 0;
  for (let i = from; i < folded.length; i++) {
    if (/Pha\s*A\b.*Pha\s*B\b.*Pha\s*C\b/i.test(folded[i])) hasPhaseHeader = true;
    const m = OIL_BBTN_ROW_RE.exec(folded[i]);
    if (!m) continue;
    const unit = m[1].toLowerCase();
    let key = null;
    if (unit === "kv") key = "bdv";
    else if (unit === "ppm") key = "moisture";
    else key = oilBbtnTanKind(folded, i) || (phases.A.tgd90 === undefined ? "tgd90" : "tgd20");
    if (phases.A[key] !== undefined) continue; // chỉ lấy dòng đầu tiên của mỗi hạng mục
    [m[2], m[3], m[4]].forEach((token, j) => { phases[OIL_BBTN_PHASES[j]][key] = oilBbtnCell(token); });
    printed[key] = oilBbtnPrintedVerdict(m[5] || "");
    rowCount++;
  }
  return { phases, printed, rowCount, hasPhaseHeader };
}

/** Đọc toàn bộ 1 BBTN dầu 3 pha từ danh sách dòng chữ. isThreePhase=false nghĩa là file không
 *  có bảng kết quả 3 cột pha — người gọi nên báo lại thay vì lưu số liệu rỗng. */
function parseOilBbtnLines(rawLines) {
  const lines = (rawLines || []).map((l) => String(l).normalize("NFC")).filter((l) => l.trim());
  const { phases, printed, rowCount, hasPhaseHeader } = oilBbtnParseResults(lines);
  const site = oilBbtnLabelValue(lines, /V?i tri lap dat[^:]*:/i);
  const uDmText = oilBbtnLabelValue(lines, /D?ien ap dinh muc[^:]*:/i, /Cong suat/i);
  const uDm = (/(\d+(?:[.,]\d+)?)/.exec(uDmText) || [])[1] || "";
  const congSuatIdx = lines.findIndex((l) => /Cong suat[^:]*:/i.test(oilBbtnFold(l)));
  const congSuat = congSuatIdx < 0 ? "" : oilBbtnLabelValue([lines[congSuatIdx]], /Cong suat[^:]*:/i, /\bVA\b/);
  const ambient = oilBbtnFold(lines.find((l) => /Temp/i.test(l)) || "");
  return {
    isThreePhase: rowCount > 0,
    hasPhaseHeader,
    rowCount,
    tram: oilBbtnLabelValue(lines, /T?en du an\/t?en tram[^:]*:/i),
    thietBi: site,
    equipmentType: oilBbtnGuessEquipment(site),
    viTriLayMau: oilBbtnLabelValue(lines, /V?i tri lay mau[^:]*:/i),
    hangSx: oilBbtnLabelValue(lines, /H?ang san xuat[^:]*:/i, /Nam san xuat/i),
    namSx: (/Nam san xuat[^:]*:\s*(\d{4})/i.exec(lines.map(oilBbtnFold).join("\n")) || [])[1] || "",
    uDm,
    congSuat: congSuat.replace(/\s+/g, ""),
    soCheTao: oilBbtnParseSerials(lines),
    namVanHanh: (/Nam van hanh[^:]*:\s*(\d{4})/i.exec(lines.map(oilBbtnFold).join("\n")) || [])[1] || "",
    loaiDau: oilBbtnLabelValue(lines, /L?oai dau[^:]*:/i, /Ngay lay mau/i),
    ngayLayMau: oilBbtnDateToIso(oilBbtnLabelValue(lines, /Ngay lay mau[^:]*:/i)),
    lyDo: oilBbtnLabelValue(lines, /L?y do thi nghiem[^:]*:/i),
    nhietDo: (/\(Temp\.?\)\s*=\s*(\d+(?:[.,]\d+)?)/i.exec(ambient) || [])[1] || "",
    doAm: (/\(Humidity\)\s*=\s*(\d+(?:[.,]\d+)?)/i.exec(ambient) || [])[1] || "",
    ghiChu: oilBbtnBlock(lines, /GHI CHU[^:]*:/i, /KET LUAN/i),
    ketLuan: oilBbtnBlock(lines, /KET LUAN[^:]*:/i, /,\s*ngay\b|TUQ\.|Nguoi thuc hien/i),
    soBbtn: oilBbtnLabelValue(lines, /\bSo\s*:\s*(?=\S+\/)/i).split(/\s/)[0],
    phases,
    printed,
  };
}

/** Tên NSX trên BBTN ("ARTECHE – SPAIN (CA525)") -> đúng tên đã cấu hình tiêu chuẩn ("Arteche"). */
function matchOilBbtnManufacturer(hangSx, configuredNames) {
  const text = oilBbtnFold(hangSx).toUpperCase();
  let best = null;
  (configuredNames || []).forEach((name) => {
    const key = oilBbtnFold(name).toUpperCase().trim();
    if (key && text.includes(key) && (!best || key.length > oilBbtnFold(best).length)) best = name;
  });
  return best;
}

function oilBbtnHasValue(v) {
  return v !== null && v !== undefined && v !== "";
}

function oilBbtnWorstVerdict(list) {
  for (const v of OIL_BBTN_VERDICT_ORDER) if (list.includes(v)) return v;
  return list.length ? list[0] : "Chưa đủ dữ liệu";
}

/** Đánh giá từng pha bằng DGA.evaluateInstrumentOilTest(), rồi gộp theo hạng mục (lấy pha xấu
 *  nhất) để điền cột Đánh giá của biên bản — hạng mục nào cũng dùng chung 1 tiêu chuẩn NSX. */
function evaluateOilBbtn(DGA, { equipmentType, manufacturer, standards, umKv, phases }) {
  const byPhase = {};
  const items = {};
  OIL_BBTN_PHASES.forEach((ph) => {
    const p = phases[ph] || {};
    if (!OIL_BBTN_ITEMS.some((k) => oilBbtnHasValue(p[k]))) return;
    const result = DGA.evaluateInstrumentOilTest({
      equipmentType, manufacturer, manufacturerOilStandards: standards,
      moisture: p.moisture, tgd90: p.tgd90, tgd20: p.tgd20, bdv: p.bdv, umKv,
    });
    byPhase[ph] = result;
    result.rows.forEach((row) => {
      if (!items[row.key]) items[row.key] = { key: row.key, limit: row.limit, verdicts: {}, ref: row.ref };
      items[row.key].verdicts[ph] = row.verdict;
    });
  });
  Object.values(items).forEach((item) => { item.verdict = oilBbtnWorstVerdict(Object.values(item.verdicts)); });
  return { byPhase, items, overall: oilBbtnWorstVerdict(Object.values(items).map((i) => i.verdict)) };
}

function oilBbtnLimitText(limit) {
  if (!limit) return "";
  return limit.replace("Bình thường ", "").replace(" · Loại bỏ ", "; loại bỏ ").replace(/^Loại bỏ /, "loại bỏ ");
}

/** Câu KẾT LUẬN tự động — chỉ nêu đúng các hạng mục đã đánh giá, người thí nghiệm sửa thêm được. */
function buildOilBbtnConclusion(evaluation, phases, manufacturer) {
  const parts = [];
  const nsx = manufacturer ? `tiêu chuẩn nhà sản xuất ${manufacturer}` : "tiêu chuẩn áp dụng";
  const items = OIL_BBTN_ITEMS.filter((k) => evaluation.items[k]);
  items.filter((k) => evaluation.items[k].verdict !== "Đạt").forEach((k) => {
    const item = evaluation.items[k];
    const { name, unit } = OIL_BBTN_ITEM_LABELS[k];
    const usedPhases = OIL_BBTN_PHASES.filter((ph) => oilBbtnHasValue((phases[ph] || {})[k]));
    const values = usedPhases.map((ph) => phases[ph][k]).join("/");
    const limit = oilBbtnLimitText(item.limit);
    const state = item.verdict === "Cảnh báo" ? "ở mức cảnh báo"
      : item.verdict === "Không đạt" ? "không đạt" : "chưa có tiêu chuẩn để đánh giá";
    parts.push(`${name} pha ${usedPhases.join("/")}: ${values} ${unit}${limit ? ` (${limit})` : ""}, ${state}.`);
  });
  const passed = items.filter((k) => evaluation.items[k].verdict === "Đạt");
  if (passed.length === items.length && items.length > 0) {
    parts.push(`Các hạng mục đã thí nghiệm đạt ${nsx}.`);
  } else if (passed.length > 0) {
    const names = passed.map((k) => OIL_BBTN_ITEM_LABELS[k].name);
    parts.push(`Các hạng mục ${names.map((n) => n[0].toLowerCase() + n.slice(1)).join(", ")} đạt ${nsx}.`);
  }
  return parts.join(" ");
}

/** Tách 1 biên bản thành các bản ghi instrument_oil_tests, mỗi pha có số liệu 1 dòng. Thông tin
 *  chung của biên bản nằm ở bbtn_info (chuỗi JSON) để sau này xuất lại đúng biên bản đó;
 *  bbtn_group_id nối các pha của cùng 1 biên bản. */
function buildOilBbtnRecords(form, groupId, attachment) {
  const info = JSON.stringify({
    so_bbtn: form.soBbtn || "", vi_tri_lay_mau: form.viTriLayMau || "", hang_sx: form.hangSx || "",
    nam_sx: form.namSx || "", u_dm: form.uDm || "", cong_suat: form.congSuat || "", so_che_tao: form.soCheTao || {},
    nam_van_hanh: form.namVanHanh || "", loai_dau: form.loaiDau || "", ly_do_thi_nghiem: form.lyDo || "",
    nhiet_do: form.nhietDo || "", do_am: form.doAm || "", ket_luan: form.ketLuan || "",
  });
  return OIL_BBTN_PHASES
    .filter((ph) => OIL_BBTN_ITEMS.some((k) => oilBbtnHasValue((form.phases[ph] || {})[k])))
    .map((ph) => {
      const p = form.phases[ph];
      const num = (v) => (oilBbtnHasValue(v) ? Number(v) : null);
      return {
        equipment_type: form.equipmentType, tram: form.tram, thiet_bi: form.thietBi, phase: ph,
        manufacturer: form.manufacturer, um_kv: num(form.uDm), sample_date: form.ngayLayMau,
        moisture_ppm: num(p.moisture), tgd_90c_percent: num(p.tgd90), tgd_20c_percent: num(p.tgd20), bdv_kv: num(p.bdv),
        ghi_chu: form.ghiChu || "", bbtn_group_id: groupId, bbtn_info: info,
        ...(attachment || {}),
      };
    });
}

/** Ngược lại với buildOilBbtnRecords(): gom các pha đã lưu về dữ liệu form để xuất lại. */
function oilBbtnFormFromRecords(records) {
  const first = records[0];
  let info = {};
  try { info = JSON.parse(first.bbtn_info || "{}"); } catch (e) { info = {}; }
  const phases = { A: {}, B: {}, C: {} };
  records.forEach((r) => {
    if (!phases[r.phase]) return;
    phases[r.phase] = { bdv: r.bdv_kv, tgd90: r.tgd_90c_percent, tgd20: r.tgd_20c_percent, moisture: r.moisture_ppm };
  });
  return {
    equipmentType: first.equipment_type, tram: first.tram || "", thietBi: first.thiet_bi || "",
    manufacturer: first.manufacturer || "", ngayLayMau: String(first.sample_date || "").slice(0, 10),
    ghiChu: first.ghi_chu || "", soBbtn: info.so_bbtn || "", viTriLayMau: info.vi_tri_lay_mau || "",
    hangSx: info.hang_sx || first.manufacturer || "", namSx: info.nam_sx || "",
    uDm: info.u_dm || (oilBbtnHasValue(first.um_kv) ? String(first.um_kv) : ""),
    congSuat: info.cong_suat || "", soCheTao: info.so_che_tao || { A: "", B: "", C: "" },
    namVanHanh: info.nam_van_hanh || "", loaiDau: info.loai_dau || "", lyDo: info.ly_do_thi_nghiem || "",
    nhietDo: info.nhiet_do || "", doAm: info.do_am || "", ketLuan: info.ket_luan || "", phases,
  };
}

function oilBbtnDateVN(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || "");
}

/** Dữ liệu điền template/template-bbtn-dau-3pha.docx — key khớp đúng tên {tag} trong mẫu. */
function buildOilBbtnExportData(form, evaluation) {
  const serials = form.soCheTao || {};
  const serialText = OIL_BBTN_PHASES.filter((ph) => serials[ph]).map((ph) => `pha ${ph}: ${serials[ph]}`).join(", ");
  const data = {
    tram: form.tram || "", vi_tri_lap_dat: form.thietBi || "", vi_tri_lay_mau: form.viTriLayMau || "",
    hang_sx: form.hangSx || form.manufacturer || "", nam_sx: form.namSx || "", u_dm: form.uDm || "",
    cong_suat: form.congSuat || "", so_che_tao: serialText, nam_van_hanh: form.namVanHanh || "",
    loai_dau: form.loaiDau || "", ngay_lay_mau: oilBbtnDateVN(form.ngayLayMau), ly_do_thi_nghiem: form.lyDo || "",
    nhiet_do: oilBbtnHasValue(form.nhietDo) ? String(form.nhietDo) : "", do_am: oilBbtnHasValue(form.doAm) ? String(form.doAm) : "",
    ghi_chu: form.ghiChu || "", ket_luan: form.ketLuan || buildOilBbtnConclusion(evaluation, form.phases, form.manufacturer),
    nsx_phu_luc: (form.manufacturer || "").toUpperCase(),
  };
  const cellPrefix = { bdv: "U_ct", tgd90: "t_90", tgd20: "t_20", moisture: "am" };
  OIL_BBTN_ITEMS.forEach((k) => {
    const item = evaluation.items[k];
    OIL_BBTN_PHASES.forEach((ph) => {
      const v = (form.phases[ph] || {})[k];
      data[`${cellPrefix[k]}_${ph}`] = oilBbtnHasValue(v) ? String(v) : "";
    });
    data[`tick_${k}`] = item ? "✓" : "";
    data[`tc_${k}`] = item ? oilBbtnLimitText(item.limit) : "";
    data[`dg_${k}`] = item ? (item.verdict === "Chưa có tiêu chuẩn nhà sản xuất" ? "Chưa có TC" : item.verdict) : "";
  });
  return data;
}

const OilBbtn = {
  parseOilBbtnLines, matchOilBbtnManufacturer, evaluateOilBbtn, buildOilBbtnConclusion,
  buildOilBbtnRecords, oilBbtnFormFromRecords, buildOilBbtnExportData,
  PHASES: OIL_BBTN_PHASES, ITEMS: OIL_BBTN_ITEMS, ITEM_LABELS: OIL_BBTN_ITEM_LABELS,
};
if (typeof module !== "undefined" && module.exports) module.exports = OilBbtn;
