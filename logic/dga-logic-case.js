// dga-logic-case.js — Đề xuất người dùng #3: "Tìm ca tương tự trong lịch sử đo"
// (case-based reasoning nhẹ, KHÔNG train/lưu model, chạy 100% phía client) — bổ sung
// tiếp sau đề xuất #1 (OCR BBTN), #5 (OCR nameplate) và #2 (so với đàn) đã hoàn tất.
//
// Ý tưởng (theo đúng đề xuất người dùng): khi 1 lần đo có dấu hiệu bất thường, tự tìm
// trong TOÀN BỘ Lịch sử đo — CỦA THIẾT BỊ NÀY HOẶC THIẾT BỊ KHÁC, KHÔNG giới hạn cùng
// loại/cấp điện áp/hãng sản xuất như đề xuất #2 (dga-logic-peer.js) — những lần đo có
// VECTOR 7 KHÍ gần giống nhất (cosine similarity), rồi hiện lại kết luận/chẩn đoán CỦA
// CHÍNH lần đo đó (tính lại tại chỗ ở ui/ui-dga.js bằng ĐÚNG logic đánh giá hiện có,
// theo tiêu chuẩn áp dụng cho CHÍNH thiết bị/hãng của lần đo đó — KHÔNG lưu sẵn 1 "kết
// luận" tĩnh nào, vì kết luận là hàm xác định của số liệu khí + tiêu chuẩn áp dụng, tính
// lại luôn ĐÚNG và không sợ lệch nếu sau này tiêu chuẩn/logic đánh giá được cập nhật).
//
// File này CHỈ làm phần "tìm ca tương tự" (thuần toán học, không phụ thuộc lớp UI nào,
// kiểm thử được qua Node — cùng nguyên tắc tách file như dga-logic-peer.js) — phần
// "tính lại kết luận của ca tìm được" do ui/ui-dga.js đảm nhiệm bằng cách gọi lại
// DGA.resolveStandard/DGA.evaluateAbsolute/DGA.overallVerdict/DGA.diagnoseGasFault
// giống HỆT cách đã làm với "lần đo liền trước" (biến `prior`) — không viết trùng logic.

const CASE_TOP_N = 3; // tối đa hiện bấy nhiêu ca tương tự nhất
const CASE_MIN_SIMILARITY = 0.5; // dưới mức này coi là "không đủ giống" để đáng tham khảo
const CASE_MIN_VECTOR_NORM = 1e-6; // ngưỡng coi vector là "rỗng" (không có số liệu khí)

function caseLog1p(v) {
  return Math.log(1 + Math.max(0, v));
}

function caseGasVector(record) {
  // Đọc cả khóa CHỮ HOA (H2, CH4... — object "gases" đang nhập ở form) lẫn CHỮ THƯỜNG
  // (h2, ch4... — bản ghi đọc từ Storage.listMeasurements(), xem normalizeGasKeys() ở
  // storage.js) — giữ file logic độc lập, không phụ thuộc recordGases() (ui-standards.js).
  return GASES.map((g) => {
    const raw = record[g] ?? record[g.toLowerCase()];
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
}

function caseVectorNorm(v) {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

function caseCosineSimilarity(a, b) {
  const normA = caseVectorNorm(a);
  const normB = caseVectorNorm(b);
  if (normA < CASE_MIN_VECTOR_NORM || normB < CASE_MIN_VECTOR_NORM) return 0;
  const dot = a.reduce((sum, x, i) => sum + x * b[i], 0);
  return dot / (normA * normB);
}

// ---------------------------------------------------------------------------
// Vì sao tính cosine similarity trên thang log1p(ppm) thay vì ppm thô: cosine similarity
// tự nó ĐÃ bất biến với việc nhân 1 vector với hằng số dương (vector [10,1000] và
// [20,2000] cho cosine = 1 dù nhân đôi toàn bộ) — nên KHÔNG cần chuẩn hóa thêm để so
// sánh "cùng hình dạng, khác mức độ nghiêm trọng". Nhưng nếu dùng ppm thô, các khí có
// biên độ tự nhiên LỚN (CO, CO2, thường hàng trăm/nghìn ppm) sẽ áp đảo hoàn toàn tích vô
// hướng so với các khí biên độ NHỎ nhưng lại quan trọng để nhận diện loại lỗi (H2, C2H2,
// C2H4 — thường chỉ vài đến vài chục ppm): 2 lần đo cùng nền CO2 cao nhưng 1 lần MỚI XUẤT
// HIỆN C2H2 (dấu hiệu phóng điện) vẫn sẽ bị tính là "rất giống nhau" nếu so trên ppm thô,
// vì chênh lệch C2H2 quá nhỏ so với CO2 để ảnh hưởng đáng kể tới góc vector. Nén về thang
// log1p trước khi tính cosine giúp các khí biên độ nhỏ có trọng số so sánh tương xứng
// hơn, đúng tinh thần "tìm ca có hình dạng bất thường tương tự" mà đề xuất hướng tới —
// đánh đổi là mức độ nghiêm trọng (không chỉ hình dạng) cũng ảnh hưởng nhẹ tới độ giống
// (log(k·x) ≠ k·log(x)), nhưng đây là điều CÓ LỢI ở đây: ưu tiên ca lịch sử có mức độ
// nghiêm trọng gần tương đương, hữu ích cho tham khảo ra quyết định hơn là 1 ca cùng tỷ
// lệ khí nhưng nghiêm trọng gấp nhiều lần (hoặc nhẹ hơn nhiều lần) so với lần đo hiện tại.
// ---------------------------------------------------------------------------
function findSimilarCases(measurement, gases, allRecords) {
  const targetId = (measurement && measurement.id) || null;
  const targetVectorRaw = GASES.map((g) => Number(gases[g]) || 0);
  const targetVectorLog = targetVectorRaw.map(caseLog1p);

  if (caseVectorNorm(targetVectorLog) < CASE_MIN_VECTOR_NORM) {
    // Lần đo hiện tại chưa có số liệu khí nào (toàn 0) — không có gì để so khớp.
    return { cases: [], insufficient: true, reason: "empty-target" };
  }
  if (!Array.isArray(allRecords) || !allRecords.length) {
    return { cases: [], insufficient: true, reason: "empty-history" };
  }

  const scored = [];
  for (const r of allRecords) {
    if (targetId && r.id === targetId) continue; // không tự so với chính mình khi đang SỬA
    const vec = caseGasVector(r).map(caseLog1p);
    if (caseVectorNorm(vec) < CASE_MIN_VECTOR_NORM) continue; // bỏ bản ghi rỗng khí
    const similarity = caseCosineSimilarity(targetVectorLog, vec);
    scored.push({ record: r, similarity });
  }

  scored.sort((a, b) => b.similarity - a.similarity);
  const cases = scored.filter((c) => c.similarity >= CASE_MIN_SIMILARITY).slice(0, CASE_TOP_N);

  return { cases, insufficient: false };
}
