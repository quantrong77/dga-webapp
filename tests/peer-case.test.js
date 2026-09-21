// So sánh với nhóm thiết bị tương tự (z-score thang log + Isolation Forest) và ca tương tự trong lịch sử
// (cosine similarity). Cả hai chỉ mang tính THAM KHẢO — không đổi trạng thái Bình thường/Cảnh báo/Báo động.
const { DGA, gases } = require("./helpers");
const { EQUIPMENT_TYPES: T } = DGA;

/** Bản ghi lịch sử (khóa chữ thường như dữ liệu đọc từ storage). */
function rec(id, overrides = {}, meta = {}) {
  return {
    id,
    equipment_type: T.MBA,
    dien_ap_dm: "220 kV",
    manufacturer: "ABB",
    h2: 10, ch4: 8, c2h6: 6, c2h4: 5, c2h2: 0.5, co: 100, co2: 1000,
    ...overrides,
    ...meta,
  };
}
/** 6 thiết bị khỏe mạnh, khí biến thiên nhẹ quanh cùng mức. */
const healthyPeers = () => [
  rec("p1", { h2: 9, co: 95 }), rec("p2", { h2: 11, co: 105 }), rec("p3", { h2: 10, ch4: 9 }),
  rec("p4", { h2: 12, co2: 1100 }), rec("p5", { h2: 8, ch4: 7 }), rec("p6", { h2: 10.5, c2h4: 6 }),
];
const target = (over = {}) => ({ id: "t", equipment_type: T.MBA, dien_ap_dm: "220 kV", manufacturer: "ABB", ...over });
const typicalGases = gases({ H2: 10, CH4: 8, C2H6: 6, C2H4: 5, C2H2: 0.5, CO: 100, CO2: 1000 });

describe("Hằng số ngưỡng của nhóm thiết bị tương tự", () => {
  test("tối thiểu 5 lần đo cùng nhóm; z-score cảnh báo ≥ 2, báo động ≥ 3; Isolation Forest 0,55 / 0,62", () => {
    expect(DGA.PEER_MIN_SAMPLES).toBe(5);
    expect(DGA.PEER_Z_WARN).toBe(2);
    expect(DGA.PEER_Z_ALERT).toBe(3);
    expect(DGA.PEER_IF_WARN).toBe(0.55);
    expect(DGA.PEER_IF_ALERT).toBe(0.62);
  });
});

describe("evaluatePeerAnomaly — điều kiện đủ dữ liệu", () => {
  test("không có lịch sử hoặc thiếu loại thiết bị => không đủ dữ liệu, không ném lỗi", () => {
    expect(DGA.evaluatePeerAnomaly(target(), typicalGases, [])).toMatchObject({ sufficient: false, groupSize: 0, minSamples: 5 });
    expect(DGA.evaluatePeerAnomaly(target(), typicalGases, null)).toMatchObject({ sufficient: false });
    expect(DGA.evaluatePeerAnomaly({ id: "t" }, typicalGases, healthyPeers())).toMatchObject({ sufficient: false });
  });
  test("dưới 5 lần đo cùng nhóm => sufficient:false kèm số lượng đang có", () => {
    const r = DGA.evaluatePeerAnomaly(target(), typicalGases, healthyPeers().slice(0, 4));
    expect(r.sufficient).toBe(false);
    expect(r.groupSize).toBe(4);
    expect(r.gasRows).toBeUndefined();
  });
  test("đúng 5 lần đo => đủ dữ liệu", () => {
    expect(DGA.evaluatePeerAnomaly(target(), typicalGases, healthyPeers().slice(0, 5)).sufficient).toBe(true);
  });
  test("chính lần đo đang xét (trùng id) không được tính vào nhóm", () => {
    const withSelf = healthyPeers().slice(0, 5).concat([rec("t", { h2: 9999 })]);
    const r = DGA.evaluatePeerAnomaly(target(), typicalGases, withSelf);
    expect(r.groupSize).toBe(5);
  });
  test("chỉ so với CÙNG loại thiết bị", () => {
    const mixed = healthyPeers().slice(0, 3).concat([rec("x1", {}, { equipment_type: T.TI }), rec("x2", {}, { equipment_type: T.TI }), rec("x3", {}, { equipment_type: T.TI })]);
    expect(DGA.evaluatePeerAnomaly(target(), typicalGases, mixed).sufficient).toBe(false);
  });
});

describe("evaluatePeerAnomaly — gom nhóm nới dần tiêu chí", () => {
  test("đủ 5 thiết bị cùng loại + cùng cấp điện áp + cùng hãng => dùng tiêu chí chặt nhất", () => {
    const r = DGA.evaluatePeerAnomaly(target(), typicalGases, healthyPeers());
    expect(r.groupTier).toBe("loai+capdienap+hangsx");
    expect(r.groupSize).toBe(6);
  });
  test("khác hãng nhưng cùng cấp điện áp => nới xuống 'loai+capdienap'; '230 kV' vẫn coi là cấp 220 kV", () => {
    const peers = healthyPeers().map((p, i) => ({ ...p, manufacturer: "Siemens", dien_ap_dm: i % 2 ? "220kV" : "230 kV" }));
    expect(DGA.evaluatePeerAnomaly(target(), typicalGases, peers).groupTier).toBe("loai+capdienap");
  });
  test("khác cả hãng và cấp điện áp => nới xuống chỉ theo loại thiết bị", () => {
    const peers = healthyPeers().map((p) => ({ ...p, manufacturer: "Siemens", dien_ap_dm: "110 kV" }));
    expect(DGA.evaluatePeerAnomaly(target(), typicalGases, peers).groupTier).toBe("loai");
  });
  test("đọc được cả khóa chữ hoa (H2) lẫn chữ thường (h2) của bản ghi", () => {
    const upper = healthyPeers().map((p) => ({ ...p, H2: p.h2, h2: undefined }));
    const a = DGA.evaluatePeerAnomaly(target(), typicalGases, upper);
    const b = DGA.evaluatePeerAnomaly(target(), typicalGases, healthyPeers());
    expect(a.gasRows[0].peerMean).toBeCloseTo(b.gasRows[0].peerMean, 6);
  });
});

describe("evaluatePeerAnomaly — nhận định bất thường", () => {
  test("lần đo điển hình (đúng mức của nhóm) => mọi khí 'normal', không khí nào bị đánh dấu", () => {
    const r = DGA.evaluatePeerAnomaly(target(), typicalGases, healthyPeers());
    expect(r.flaggedGases).toEqual([]);
    r.gasRows.forEach((row) => expect(Math.abs(row.z)).toBeLessThan(DGA.PEER_Z_WARN));
  });
  test("H2 = 1000 ppm khi cả nhóm quanh 10 ppm => H2 bị 'alert', các khí khác bình thường", () => {
    const r = DGA.evaluatePeerAnomaly(target(), { ...typicalGases, H2: 1000 }, healthyPeers());
    const h2 = r.gasRows.find((x) => x.gas === "H2");
    expect(h2.level).toBe("alert");
    expect(h2.z).toBeGreaterThan(DGA.PEER_Z_ALERT);
    expect(r.flaggedGases).toContain("H2");
    expect(r.gasRows.find((x) => x.gas === "CH4").level).toBe("normal");
  });
  test("trung bình nhóm được đổi về ppm (≈ 10), không phải thang log", () => {
    const r = DGA.evaluatePeerAnomaly(target(), typicalGases, healthyPeers());
    const h2 = r.gasRows.find((x) => x.gas === "H2");
    expect(h2.peerMean).toBeGreaterThan(9);
    expect(h2.peerMean).toBeLessThan(12);
    expect(h2.value).toBe(10);
  });
  test("Isolation Forest: điểm nằm trong (0; 1), lần đo lạ có điểm CAO hơn lần đo điển hình", () => {
    const normal = DGA.evaluatePeerAnomaly(target(), typicalGases, healthyPeers());
    const odd = DGA.evaluatePeerAnomaly(target(), { H2: 3000, CH4: 900, C2H6: 600, C2H4: 1200, C2H2: 200, CO: 5000, CO2: 40000 }, healthyPeers());
    [normal, odd].forEach((r) => {
      expect(r.isolationScore).toBeGreaterThan(0);
      expect(r.isolationScore).toBeLessThan(1);
    });
    expect(odd.isolationScore).toBeGreaterThan(normal.isolationScore);
    expect(odd.isolationScore).toBeGreaterThanOrEqual(DGA.PEER_IF_ALERT);
    expect(odd.isolationLevel).toBe("alert");
  });
  test("kết quả TÁI LẬP được (seed cố định — cùng đầu vào luôn ra cùng điểm)", () => {
    const a = DGA.evaluatePeerAnomaly(target(), { ...typicalGases, H2: 60 }, healthyPeers());
    const b = DGA.evaluatePeerAnomaly(target(), { ...typicalGases, H2: 60 }, healthyPeers());
    expect(a.isolationScore).toBe(b.isolationScore);
  });
  test("không bao giờ ra NaN/Infinity, kể cả khi mọi khí của nhóm giống hệt nhau (độ lệch chuẩn = 0)", () => {
    const identical = Array.from({ length: 6 }, (_, i) => rec("q" + i));
    const r = DGA.evaluatePeerAnomaly(target(), { ...typicalGases, H2: 50 }, identical);
    r.gasRows.forEach((row) => expect(Number.isFinite(row.z)).toBe(true));
    expect(Number.isFinite(r.isolationScore)).toBe(true);
  });
});

describe("findSimilarCases — ca tương tự trong lịch sử", () => {
  const t = { id: "t" };
  const base = gases({ H2: 100, CH4: 50, C2H2: 5 });

  test("lần đo không có khí nào (toàn 0) => không đủ dữ liệu, reason 'empty-target'", () => {
    expect(DGA.findSimilarCases(t, gases(), [rec("a")])).toEqual({ cases: [], insufficient: true, reason: "empty-target" });
  });
  test("chưa có lịch sử => reason 'empty-history'", () => {
    expect(DGA.findSimilarCases(t, base, [])).toEqual({ cases: [], insufficient: true, reason: "empty-history" });
    expect(DGA.findSimilarCases(t, base, null).reason).toBe("empty-history");
  });
  test("xếp theo độ giống giảm dần; bản ghi giống hệt = 1; không giống (trực giao) và bản ghi rỗng khí bị loại", () => {
    const history = [
      rec("same", { h2: 100, ch4: 50, c2h2: 5, c2h6: 0, c2h4: 0, co: 0, co2: 0 }),
      rec("near", { h2: 90, ch4: 60, c2h2: 4, c2h6: 0, c2h4: 0, co: 0, co2: 0 }),
      rec("ortho", { h2: 0, ch4: 0, c2h2: 0, c2h6: 0, c2h4: 0, co: 500, co2: 5000 }),
      rec("empty", { h2: 0, ch4: 0, c2h2: 0, c2h6: 0, c2h4: 0, co: 0, co2: 0 }),
    ];
    const r = DGA.findSimilarCases(t, base, history);
    expect(r.insufficient).toBe(false);
    expect(r.cases.map((c) => c.record.id)).toEqual(["same", "near"]);
    expect(r.cases[0].similarity).toBeCloseTo(1, 6);
    expect(r.cases[1].similarity).toBeLessThan(1);
    expect(r.cases[1].similarity).toBeGreaterThanOrEqual(DGA.CASE_MIN_SIMILARITY);
  });
  test("chính lần đo đang sửa (trùng id) không được so với chính nó", () => {
    const history = [rec("t", { h2: 100, ch4: 50, c2h2: 5 }), rec("other", { h2: 95, ch4: 55, c2h2: 5 })];
    expect(DGA.findSimilarCases(t, base, history).cases.map((c) => c.record.id)).toEqual(["other"]);
  });
  test("tối đa CASE_TOP_N (3) ca", () => {
    const history = Array.from({ length: 8 }, (_, i) => rec("h" + i, { h2: 100 + i, ch4: 50, c2h2: 5 }));
    expect(DGA.findSimilarCases(t, base, history).cases).toHaveLength(DGA.CASE_TOP_N);
    expect(DGA.CASE_TOP_N).toBe(3);
  });
  test("chỉ lấy ca có độ giống ≥ CASE_MIN_SIMILARITY (0,5)", () => {
    const history = [rec("far", { h2: 0, ch4: 0, c2h2: 0, c2h6: 0, c2h4: 0, co: 1000, co2: 30000 })];
    expect(DGA.findSimilarCases(t, base, history).cases).toEqual([]);
    expect(DGA.CASE_MIN_SIMILARITY).toBe(0.5);
  });
  test("đọc được khóa chữ hoa lẫn chữ thường", () => {
    const history = [{ id: "u", H2: 100, CH4: 50, C2H2: 5 }];
    expect(DGA.findSimilarCases(t, base, history).cases[0].similarity).toBeCloseTo(1, 6);
  });
});
