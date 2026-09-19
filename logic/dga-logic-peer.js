// dga-logic-peer.js — Đề xuất người dùng #2: "Phát hiện bất thường theo nhóm thiết bị
// tương tự" (thống kê nhẹ, KHÔNG train/lưu model, chạy 100% phía client, không cần
// server ML riêng — đúng theo yêu cầu gốc của người dùng).
//
// BỔ SUNG một lớp so sánh "SO VỚI ĐÀN" (peer comparison) BÊN CẠNH đánh giá theo ngưỡng
// TUYỆT ĐỐI cố định đã có sẵn (Bảng 64/66/Annex A... ở dga-logic-gas.js/dga-logic-core.js)
// — KHÔNG thay thế, KHÔNG làm thay đổi overallStatus (Bình thường/Cảnh báo/Báo động)
// hay kết quả Đạt/Không đạt chính thức theo QĐ1901/IEC. Đây LUÔN LÀ THAM KHẢO BỔ SUNG —
// không được dùng để tự ý kết luận thay cho các bảng/ngưỡng chính thức (xem ghi chú ở
// evaluatePeerAnomaly() và cách renderPeerAnomaly() ở ui/ui-dga.js hiển thị rõ nhãn này).
//
// Ý tưởng: với 1 lần đo cụ thể, tìm các LẦN ĐO KHÁC (của thiết bị này hoặc thiết bị
// khác, đã lưu trong Lịch sử đo) CÙNG NHÓM — ưu tiên cùng loại thiết bị + cùng cấp điện
// áp + cùng nhà sản xuất, nới dần tiêu chí nếu không đủ dữ liệu — làm "quần thể tham
// chiếu" (peer set), rồi tính:
//   (a) z-score từng khí, trên thang log1p — nồng độ khí hòa tan thực tế lệch phải rõ
//       rệt (đa số thiết bị khỏe mạnh có giá trị rất nhỏ, một số ít có giá trị lớn hơn
//       nhiều lần chứ không phân bố đối xứng kiểu chuẩn) nên z-score trên giá trị PPM
//       thô dễ bị vài lần đo giá trị lớn kéo lệch trung bình/độ lệch chuẩn, làm mất độ
//       nhạy — tính trên log1p(ppm) cho z-score phản ánh đúng "khác biệt bao nhiêu lần"
//       hơn là "khác biệt bao nhiêu ppm tuyệt đối".
//   (b) điểm bất thường tổng hợp bằng Isolation Forest ĐƠN GIẢN tự dựng NGAY LÚC ĐÁNH
//       GIÁ bằng chính quần thể "đàn" hiện có (không lưu lại, không phải model đã huấn
//       luyện theo nghĩa ML thông thường) — xét ĐỒNG THỜI cả 7 khí, phát hiện được kiểu
//       bất thường mà z-score từng khí riêng lẻ dễ bỏ sót (VD: nhiều khí cùng tăng nhẹ
//       một lúc, không khí nào tự nó vượt ngưỡng cảnh báo riêng).
// Thuật toán gốc: Liu, Ting, Zhou (2008), "Isolation Forest".

const PEER_MIN_SAMPLES = 5; // tối thiểu bấy nhiêu lần đo CÙNG NHÓM (không tính lần đo đang xét)
                             // mới đủ tin cậy để tính thống kê — dưới mức này chỉ báo "thiếu dữ liệu".
const PEER_Z_ALERT = 3; // |z-score| từ mức này trở lên: lệch RÕ RỆT khỏi số đông cùng nhóm
const PEER_Z_WARN = 2; // |z-score| từ mức này trở lên: lệch NHẸ, nên theo dõi thêm
const PEER_IF_ALERT = 0.62; // điểm Isolation Forest từ mức này trở lên: khả năng bất thường CAO
const PEER_IF_WARN = 0.55; // từ mức này trở lên: hơi lệch khỏi số đông, nên theo dõi thêm

// Cấp điện áp truyền tải/phân phối phổ biến ở Việt Nam — dùng để gom "cùng cấp điện
// áp" dù ô nhập "Điện áp định mức" là text tự do (VD "220kV", "220 kV", nhãn máy có
// khi ghi lệch chút như "230 kV" cho cùng 1 cấp hệ thống 220kV). Sai lệch trong khoảng
// PEER_VOLTAGE_TOLERANCE so với 1 cấp chuẩn vẫn coi là cùng cấp.
const PEER_VOLTAGE_CLASSES = [22, 35, 66, 110, 220, 500];
const PEER_VOLTAGE_TOLERANCE = 0.15;

function peerParseVoltageKV(dienApDmText) {
  if (!dienApDmText) return null;
  const m = String(dienApDmText).replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const kv = parseFloat(m[1]);
  return Number.isFinite(kv) && kv > 0 ? kv : null;
}

function peerVoltageClass(dienApDmText) {
  const kv = peerParseVoltageKV(dienApDmText);
  if (kv === null) return null;
  let nearest = null;
  let nearestDiff = Infinity;
  for (const vc of PEER_VOLTAGE_CLASSES) {
    const diff = Math.abs(kv - vc) / vc;
    if (diff < nearestDiff) { nearestDiff = diff; nearest = vc; }
  }
  if (nearest !== null && nearestDiff <= PEER_VOLTAGE_TOLERANCE) return nearest;
  // Không khớp cấp chuẩn nào (VD sứ hạ thế, kết cấu đặc biệt/thử nghiệm) — vẫn gom
  // theo giá trị thô làm tròn đến hàng chục, còn hơn bỏ hẳn tiêu chí điện áp.
  return Math.round(kv / 10) * 10;
}

function peerGasVector(record) {
  // Bản ghi đọc từ Storage.listMeasurements() có thể ở dạng khóa CHỮ THƯỜNG (h2, ch4...
  // xem normalizeGasKeys() ở storage.js) trong khi "measurement"/"gases" đang nhập ở
  // form dùng khóa CHỮ HOA — đọc cả 2 dạng cho chắc, KHÔNG phụ thuộc lớp UI nào (giữ
  // file logic độc lập, kiểm thử được qua Node như các file logic/dga-logic-*.js khác).
  return GASES.map((g) => {
    const raw = record[g] ?? record[g.toLowerCase()];
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
}

function peerLog1p(v) {
  return Math.log(1 + Math.max(0, v));
}

// ---------------------------------------------------------------------------
// Gom nhóm "đàn" — nới lỏng dần tiêu chí (loại+cấp điện áp+hãng SX → loại+cấp điện áp
// → chỉ loại) nếu tiêu chí chặt hơn không đủ PEER_MIN_SAMPLES lần đo, để LUÔN cố tính
// được thống kê khi có thể thay vì báo "thiếu dữ liệu" quá sớm chỉ vì tiêu chí ban đầu
// quá chặt (thực tế 1 đơn vị truyền tải thường không có nhiều thiết bị TRÙNG cả 3 tiêu
// chí). Trả về tier ĐẦU TIÊN đạt đủ PEER_MIN_SAMPLES; nếu không tier nào đạt, trả về
// tier có nhiều lần đo nhất kèm sufficient=false.
// ---------------------------------------------------------------------------
function peerBuildGroup(allRecords, target) {
  const targetType = target.equipment_type || null;
  const targetVoltage = peerVoltageClass(target.dien_ap_dm);
  const targetMfr = (target.manufacturer || "").trim() || null;
  const targetId = target.id || null;

  const others = allRecords.filter((r) => r.id !== targetId);

  const tiers = [];
  if (targetMfr && targetVoltage !== null) {
    tiers.push({
      key: "loai+capdienap+hangsx",
      label: `${targetType || "?"}, ${targetVoltage} kV, hãng ${targetMfr}`,
      match: (r) =>
        r.equipment_type === targetType &&
        peerVoltageClass(r.dien_ap_dm) === targetVoltage &&
        (r.manufacturer || "").trim() === targetMfr,
    });
  }
  if (targetVoltage !== null) {
    tiers.push({
      key: "loai+capdienap",
      label: `${targetType || "?"}, ${targetVoltage} kV (mọi hãng sản xuất)`,
      match: (r) => r.equipment_type === targetType && peerVoltageClass(r.dien_ap_dm) === targetVoltage,
    });
  }
  tiers.push({
    key: "loai",
    label: `${targetType || "?"} (mọi cấp điện áp, mọi hãng sản xuất)`,
    match: (r) => r.equipment_type === targetType,
  });

  let best = null;
  for (const tier of tiers) {
    const peers = others.filter(tier.match);
    if (!best || peers.length > best.peers.length) best = { tier: tier.key, label: tier.label, peers };
    if (peers.length >= PEER_MIN_SAMPLES) return { tier: tier.key, label: tier.label, peers, sufficient: true };
  }
  return { ...best, sufficient: false };
}

function peerComputeStats(peerVectorsLog) {
  const n = peerVectorsLog.length;
  return GASES.map((_, i) => {
    const vals = peerVectorsLog.map((v) => v[i]);
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    const variance = n > 1 ? vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
    return { mean, std: Math.sqrt(variance), n };
  });
}

function peerZScores(targetVectorLog, stats) {
  // Sàn tối thiểu cho std (thang log1p) — tránh chia gần-0 phóng đại z ảo khi cả nhóm
  // có giá trị gần như giống hệt nhau (std thật quá nhỏ do quần thể quá đồng nhất).
  const MIN_STD = 0.05;
  return stats.map((s, i) => (targetVectorLog[i] - s.mean) / Math.max(s.std, MIN_STD));
}

// ---------------------------------------------------------------------------
// Isolation Forest ĐƠN GIẢN, tự dựng ngay lúc đánh giá bằng chính quần thể "đàn" hiện
// có (KHÔNG lưu lại, KHÔNG phải model đã huấn luyện trước theo nghĩa ML thông thường).
// Ý tưởng gốc: điểm CÀNG BẤT THƯỜNG thì càng dễ bị "cô lập" (tách khỏi phần còn lại)
// bằng ÍT LẦN CHIA NGẪU NHIÊN hơn → độ sâu trung bình càng NGẮN. Seed cố định (suy ra
// từ kích thước quần thể + tier) để tính lại đúng cùng 1 tập dữ liệu cho kết quả ổn
// định, thay vì nhảy số ngẫu nhiên mỗi lần bấm "Tính toán & đánh giá".
// ---------------------------------------------------------------------------
function peerMulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function peerSampleWithoutReplacement(arr, k, rng) {
  const pool = arr.slice();
  const limit = Math.min(k, pool.length);
  const result = [];
  for (let i = 0; i < limit; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    result.push(pool[i]);
  }
  return result;
}

function peerBuildIsolationTree(data, depth, maxDepth, rng) {
  if (depth >= maxDepth || data.length <= 1) return { size: data.length, depth };
  const nFeatures = data[0].length;
  const feature = Math.floor(rng() * nFeatures);
  let min = Infinity, max = -Infinity;
  for (const row of data) {
    const v = row[feature];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) return { size: data.length, depth };
  const splitValue = min + rng() * (max - min);
  const left = data.filter((row) => row[feature] < splitValue);
  const right = data.filter((row) => row[feature] >= splitValue);
  if (!left.length || !right.length) return { size: data.length, depth };
  return {
    feature,
    splitValue,
    left: peerBuildIsolationTree(left, depth + 1, maxDepth, rng),
    right: peerBuildIsolationTree(right, depth + 1, maxDepth, rng),
  };
}

function peerAvgPathLengthUnsuccessful(n) {
  if (n <= 1) return 0;
  return 2 * (Math.log(n - 1) + 0.5772156649015329) - (2 * (n - 1)) / n;
}

function peerPathLength(vector, node, depth) {
  if (node.feature === undefined) {
    // Nút lá — cộng thêm ước lượng độ sâu trung bình nếu vẫn còn >1 điểm dồn lại đây
    // (cắt sớm do chạm maxDepth), đúng theo công thức gốc của thuật toán.
    return depth + peerAvgPathLengthUnsuccessful(node.size);
  }
  return vector[node.feature] < node.splitValue
    ? peerPathLength(vector, node.left, depth + 1)
    : peerPathLength(vector, node.right, depth + 1);
}

function peerIsolationForestScore(targetVectorLog, peerVectorsLog, seed) {
  // QUAN TRỌNG: cây phải được dựng từ tập BAO GỒM CẢ điểm đang xét (targetVectorLog),
  // không chỉ riêng "đàn" — đây là cách thuật toán Isolation Forest gốc thực sự tạo ra
  // độ nhạy phát hiện bất thường: khi 1 điểm có giá trị cực đoan so với phần còn lại,
  // chính giá trị cực đoan CỦA NÓ mới kéo giãn khoảng [min,max] dùng để chọn ngẫu nhiên
  // điểm chia ở mỗi nút — nhờ vậy 1 lần chia ngẫu nhiên có xác suất cao rơi vào đúng
  // khoảng trống giữa nó và phần còn lại, cô lập nó chỉ sau rất ít lần chia. Nếu dựng
  // cây CHỈ từ "đàn" (không có điểm đang xét) như bản đầu tiên đã làm, khoảng chia
  // không bao giờ vượt quá giá trị lớn nhất của "đàn" nên KHÔNG có hiệu ứng kéo giãn
  // này — đã kiểm chứng bằng thực nghiệm (điểm bất thường rõ rệt vẫn cho điểm số ngang
  // bằng điểm bình thường), nên đây KHÔNG phải chi tiết cài đặt tuỳ chọn mà là điều
  // kiện bắt buộc để thuật toán hoạt động đúng. Ở quy mô đàn thực tế (vài chục đến vài
  // trăm lần đo), n <= 256 nên "lấy mẫu con" (subsampleSize) gần như luôn bằng CHÍNH
  // TOÀN BỘ tập — không phải bootstrap 1 phần nhỏ như dùng cho dữ liệu lớn.
  const full = peerVectorsLog.concat([targetVectorLog]);
  const n = full.length;
  if (n < 3) return null;
  const NUM_TREES = 100;
  const subsampleSize = Math.min(256, n);
  const maxDepth = Math.ceil(Math.log2(Math.max(2, subsampleSize)));
  const rng = peerMulberry32(seed);

  const trees = [];
  for (let t = 0; t < NUM_TREES; t++) {
    const sample = peerSampleWithoutReplacement(full, subsampleSize, rng);
    trees.push(peerBuildIsolationTree(sample, 0, maxDepth, rng));
  }

  const avgPath = trees.reduce((sum, tree) => sum + peerPathLength(targetVectorLog, tree, 0), 0) / trees.length;
  const c = peerAvgPathLengthUnsuccessful(subsampleSize) || 1;
  return Math.pow(2, -avgPath / c);
}

// ---------------------------------------------------------------------------
// Hàm chính — gọi ở ui/ui-dga.js NGAY SAU khi đã có `all` (Storage.listMeasurements(),
// vốn đã phải gọi sẵn cho bước "tốc độ sinh khí" ở trên) nên KHÔNG tốn thêm 1 lần gọi
// mạng nào. `measurement` là object đang chuẩn bị lưu (đã có equipment_type/dien_ap_dm/
// manufacturer/id), `gases` là object khóa CHỮ HOA (H2, CH4...) đã đọc từ form.
//
// Trả về sufficient=false kèm groupLabel/groupSize khi CHƯA ĐỦ PEER_MIN_SAMPLES lần đo
// cùng nhóm (kể cả sau khi đã nới lỏng hết tiêu chí) — ui-dga.js hiện rõ thông báo này
// thay vì suy diễn thống kê từ quá ít dữ liệu.
// ---------------------------------------------------------------------------
function evaluatePeerAnomaly(measurement, gases, allRecords) {
  if (!Array.isArray(allRecords) || !allRecords.length || !measurement.equipment_type) {
    return { sufficient: false, groupLabel: null, groupSize: 0, minSamples: PEER_MIN_SAMPLES };
  }

  const group = peerBuildGroup(allRecords, measurement);
  if (!group.sufficient) {
    return { sufficient: false, groupLabel: group.label, groupSize: group.peers.length, minSamples: PEER_MIN_SAMPLES };
  }

  const targetVectorRaw = GASES.map((g) => Number(gases[g]) || 0);
  const targetVectorLog = targetVectorRaw.map(peerLog1p);
  const peerVectorsLog = group.peers.map((r) => peerGasVector(r).map(peerLog1p));

  const stats = peerComputeStats(peerVectorsLog);
  const zScores = peerZScores(targetVectorLog, stats);

  const gasRows = GASES.map((g, i) => {
    const absZ = Math.abs(zScores[i]);
    const level = absZ >= PEER_Z_ALERT ? "alert" : absZ >= PEER_Z_WARN ? "warn" : "normal";
    return {
      gas: g,
      value: targetVectorRaw[i],
      peerMean: Math.expm1(stats[i].mean), // đổi lại về đơn vị ppm cho dễ đọc (đã log1p hoá lúc tính)
      z: zScores[i],
      level,
    };
  });
  const flaggedGases = gasRows.filter((r) => r.level !== "normal").map((r) => r.gas);

  const seed = 1000003 * (group.peers.length + 1) + group.tier.length;
  const isolationScore = peerIsolationForestScore(targetVectorLog, peerVectorsLog, seed);
  const isolationLevel =
    isolationScore === null ? null :
    isolationScore >= PEER_IF_ALERT ? "alert" :
    isolationScore >= PEER_IF_WARN ? "warn" : "normal";

  return {
    sufficient: true,
    groupLabel: group.label,
    groupTier: group.tier,
    groupSize: group.peers.length,
    gasRows,
    flaggedGases,
    isolationScore,
    isolationLevel,
  };
}
