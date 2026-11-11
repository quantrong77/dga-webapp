/* src/presentation/components/ui-location-picker.js — Bộ chọn "Vị trí thiết bị" theo bậc thang Trạm ▸ Thiết bị ▸ Pha,
 * DÙNG CHUNG cho mọi form nhập liệu (Khí hòa tan, dầu MBA, dầu OLTC, dầu TI/TU — cả tab con "Nhập BBTN cũ" lẫn
 * "Lập BBTN" vì 2 tab con dùng chung 1 form) và cho hộp thoại xuất Excel ở tab Cảnh báo.
 *
 * Nguyên tắc (giống nhau ở mọi nơi):
 *  - Ô sau chỉ gợi ý theo ô trước: Thiết bị gợi ý đúng các thiết bị của Trạm đã chọn; Pha ghi số lần đo đã có của
 *    Thiết bị đó ở từng pha.
 *  - Vẫn gõ được giá trị MỚI (trạm/thiết bị chưa có trong dữ liệu) — không khóa người nhập.
 *  - Chọn Thiết bị khi chưa có Trạm → tự điền Trạm (nếu thiết bị chỉ thuộc 1 trạm).
 *  - Đổi Trạm mà Thiết bị đang ghi không thuộc trạm mới (và trạm mới đã có thiết bị) → xóa ô Thiết bị.
 *  - Thiết bị chỉ có số liệu ở ĐÚNG 1 pha → tự chọn pha đó.
 *
 * buildLocationIndex() là phần lõi (không đụng DOM): gom bản ghi thành cây Trạm → Thiết bị → Pha → số bản ghi. */

/** So khớp tên Trạm/Thiết bị: bỏ khoảng trắng thừa, không phân biệt hoa/thường. */
function locationKey(s) {
  return String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Gom các bản ghi thành cây vị trí.
 * @param {Array<Array<object>>} sources các danh sách bản ghi (đọc tram/thiet_bi)
 * @param {(r:object)=>string} [phaseOf] pha của 1 bản ghi ("" = không tách pha)
 * @returns {Map<string, {name:string, devices: Map<string, {name:string, phases: Map<string, number>, count:number}>}>}
 *   khóa = locationKey(); giữ tên hiển thị của lần gặp đầu tiên
 */
function buildLocationIndex(sources, phaseOf) {
  const stations = new Map();
  (sources || []).forEach((list) => {
    (list || []).forEach((r) => {
      const st = String(r.tram || "").trim();
      const dev = String(r.thiet_bi || "").trim();
      const sk = locationKey(st);
      if (!stations.has(sk)) stations.set(sk, { name: st, devices: new Map() });
      if (!dev) return;
      const devices = stations.get(sk).devices;
      const dk = locationKey(dev);
      if (!devices.has(dk)) devices.set(dk, { name: dev, phases: new Map(), count: 0 });
      const d = devices.get(dk);
      d.count += 1;
      const ph = phaseOf ? String(phaseOf(r) || "").trim() : "";
      d.phases.set(ph, (d.phases.get(ph) || 0) + 1);
    });
  });
  return stations;
}

/** Các trạm có thiết bị tên `deviceName` trong cây vị trí. */
function stationsOfDevice(index, deviceName) {
  const dk = locationKey(deviceName);
  const out = [];
  index.forEach((st) => { if (st.devices.has(dk)) out.push(st.name); });
  return out;
}

/** Nút thiết bị trong cây (theo trạm nếu có, không thì gộp mọi trạm). */
function locationDeviceNode(index, stationName, deviceName) {
  const dk = locationKey(deviceName);
  if (stationName) {
    const st = index.get(locationKey(stationName));
    return st ? st.devices.get(dk) || null : null;
  }
  let merged = null;
  index.forEach((st) => {
    const d = st.devices.get(dk);
    if (!d) return;
    if (!merged) merged = { name: d.name, phases: new Map(), count: 0 };
    merged.count += d.count;
    d.phases.forEach((n, p) => merged.phases.set(p, (merged.phases.get(p) || 0) + n));
  });
  return merged;
}

/**
 * Gắn hành vi bậc thang cho 1 bộ Trạm ▸ Thiết bị ▸ Pha có sẵn trong HTML.
 * @param {object} cfg
 * @param {HTMLInputElement} cfg.stationInput ô Trạm (combo — đã/hoặc sẽ setupCombo với stationComboOptions())
 * @param {HTMLInputElement} cfg.deviceInput ô Thiết bị (combo)
 * @param {HTMLElement} cfg.deviceToggle, cfg.deviceList nút ▼ và danh sách của combo Thiết bị
 * @param {HTMLSelectElement} [cfg.phaseSelect] ô Pha (nếu form có)
 * @param {() => Array<Array<object>>} cfg.sources các danh sách bản ghi làm gợi ý (gọi lại mỗi lần — dữ liệu được nạp lại)
 * @param {(r:object)=>string} [cfg.phaseOf] pha của 1 bản ghi, cùng giá trị với option của phaseSelect
 * @param {(r:object)=>boolean} [cfg.accept] lọc thêm bản ghi làm gợi ý
 */
function setupLocationPicker(cfg) {
  const { stationInput, deviceInput, deviceToggle, deviceList, phaseSelect, sources, phaseOf, accept } = cfg;
  if (!stationInput || !deviceInput) return;
  const index = () => buildLocationIndex(
    sources().map((list) => (accept ? (list || []).filter(accept) : list || [])),
    phaseOf
  );

  // Combo Thiết bị: chỉ gợi ý thiết bị của Trạm đang ghi (trạm trống → mọi thiết bị, kèm tên trạm).
  setupCombo({
    input: deviceInput,
    toggleBtn: deviceToggle,
    listEl: deviceList,
    getOptions: () => {
      const idx = index();
      const st = stationInput.value.trim();
      const out = [];
      idx.forEach((s) => {
        if (st && locationKey(s.name) !== locationKey(st)) return;
        s.devices.forEach((d) => out.push({ value: d.name, label: st || !s.name ? d.name : `${d.name} — ${s.name}` }));
      });
      const seen = new Set();
      return out
        .filter((o) => { const k = locationKey(o.label); if (seen.has(k)) return false; seen.add(k); return true; })
        .sort((a, b) => a.label.localeCompare(b.label, "vi"));
    },
  });

  // Nhãn gốc của từng option Pha — để ghi thêm "(n lần đo)" mà không mất nhãn ban đầu.
  if (phaseSelect) {
    Array.from(phaseSelect.options).forEach((o) => { if (!o.dataset.baseLabel) o.dataset.baseLabel = o.textContent; });
  }

  function refreshPhaseHints(autoSelect) {
    if (!phaseSelect) return;
    const node = deviceInput.value.trim() ? locationDeviceNode(index(), stationInput.value.trim(), deviceInput.value.trim()) : null;
    Array.from(phaseSelect.options).forEach((o) => {
      const n = node ? node.phases.get(o.value) || 0 : 0;
      o.textContent = n > 0 ? `${o.dataset.baseLabel} (${n} lần đo)` : o.dataset.baseLabel;
    });
    if (!autoSelect || !node) return;
    const used = Array.from(node.phases.keys()).filter((p) => p && Array.from(phaseSelect.options).some((o) => o.value === p));
    if (used.length === 1 && phaseSelect.value !== used[0]) {
      phaseSelect.value = used[0];
      phaseSelect.dispatchEvent(new Event("change"));
    }
  }

  stationInput.addEventListener("change", () => {
    const dev = deviceInput.value.trim();
    const st = stationInput.value.trim();
    if (dev && st) {
      const s = index().get(locationKey(st));
      if (s && s.devices.size > 0 && !s.devices.has(locationKey(dev))) {
        deviceInput.value = "";
        deviceInput.dispatchEvent(new Event("change"));
      }
    }
    refreshPhaseHints(false);
  });

  deviceInput.addEventListener("change", () => {
    const dev = deviceInput.value.trim();
    if (dev && !stationInput.value.trim()) {
      const sts = stationsOfDevice(index(), dev).filter(Boolean);
      if (sts.length === 1) {
        stationInput.value = sts[0];
        stationInput.dispatchEvent(new Event("change"));
      }
    }
    refreshPhaseHints(true);
  });
  // Form được điền bằng code (đọc BBTN, Sửa lần đo...) không phát "change" — cập nhật lại khi người dùng chạm vào ô Pha.
  if (phaseSelect) phaseSelect.addEventListener("focus", () => refreshPhaseHints(false));
}
