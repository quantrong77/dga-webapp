// Kiểm tra bất biến (property-style) trên nhiều tổ hợp khí sinh giả ngẫu nhiên (cố định seed
// nên kết quả lặp lại được) + các trường hợp ĐÃ BIẾT là lệch văn bản gốc (test.failing).
const { DGA, gases } = require("./helpers");
const { EQUIPMENT_TYPES: T, GASES, NO_DIAGNOSIS } = DGA;

// Bộ sinh số giả ngẫu nhiên có seed (LCG) — không dùng Math.random để test tái lập được.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function randomGases(rng) {
  const g = {};
  GASES.forEach((k) => {
    const roll = rng();
    g[k] = roll < 0.2 ? 0 : Math.round(rng() * (k === "CO2" ? 20000 : k === "CO" ? 1500 : 400) * 10) / 10;
  });
  return g;
}

const LEVEL_RANK = { normal: 0, alert: 1, alarm: 2 };
const TYPES = [T.MBA, T.TI, T.TU, T.BUSHING, T.OTHER];

// Đường ống đánh giá 1 lần đo, không có lần đo trước/NSX — giống cách UI ghép các hàm.
function assess(g, type) {
  const measurement = { equipmentType: type };
  const standard = DGA.resolveStandard(measurement, []);
  const rows = DGA.evaluateAbsolute(g, standard.limits);
  return {
    rows,
    ratios: DGA.computeRatios(g),
    diagnosis: DGA.diagnoseGasFault(g, type, standard.pdThreshold),
    duval: DGA.diagnoseDuval1(g),
    status: DGA.computeOverallStatus({
      overallOk: DGA.overallVerdict(rows) === "Đạt",
      exceedCount: DGA.countExceedTypical(g, type, measurement),
      diagnosis: DGA.diagnoseGasFault(g, type, standard.pdThreshold),
      priorDiagnosis: null,
      rateRows: null,
      condemningRows: [],
    }),
  };
}

describe("Bất biến trên 300 tổ hợp khí ngẫu nhiên (seed cố định)", () => {
  const rng = makeRng(20260920);
  const samples = Array.from({ length: 300 }, () => randomGases(rng));

  test("TCG luôn = tổng 6 khí cháy (không có CO2) và không âm", () => {
    samples.forEach((g) => {
      const expected = g.H2 + g.CH4 + g.C2H6 + g.C2H4 + g.C2H2 + g.CO;
      expect(DGA.computeTCG(g)).toBeCloseTo(expected, 6);
      expect(DGA.computeTCG(g)).toBeGreaterThanOrEqual(0);
    });
  });

  test("tỷ số khí và Duval không bao giờ ra NaN/Infinity (kể cả khi khí bằng 0)", () => {
    samples.forEach((g) => {
      Object.values(DGA.computeRatios(g)).filter((v) => v !== null).forEach((v) => expect(Number.isFinite(v)).toBe(true));
      const d = DGA.diagnoseDuval1(g);
      if (d) {
        [d.pctCH4, d.pctC2H4, d.pctC2H2, d.xy.x, d.xy.y].forEach((v) => expect(Number.isFinite(v)).toBe(true));
        expect(d.pctCH4 + d.pctC2H4 + d.pctC2H2).toBeCloseTo(100, 6);
      }
    });
  });

  test("mọi loại thiết bị luôn trả đủ trạng thái hợp lệ, không ném lỗi", () => {
    samples.forEach((g) => {
      TYPES.forEach((type) => {
        const a = assess(g, type);
        expect(["normal", "alert", "alarm"]).toContain(a.status.level);
        expect(a.rows).toHaveLength(7);
        expect(typeof a.diagnosis).toBe("string");
      });
    });
  });

  test("tăng 1 khí KHÔNG BAO GIỜ làm trạng thái tổng thể nhẹ đi (đơn điệu)", () => {
    samples.slice(0, 120).forEach((g) => {
      TYPES.forEach((type) => {
        GASES.forEach((gas) => {
          const before = LEVEL_RANK[assess(g, type).status.level];
          const after = LEVEL_RANK[assess({ ...g, [gas]: g[gas] * 2 + 500 }, type).status.level];
          expect(after).toBeGreaterThanOrEqual(before);
        });
      });
    });
  });

  test("khí đều bằng 0 hoặc rất thấp thì không thể là BÁO ĐỘNG", () => {
    TYPES.forEach((type) => {
      expect(assess(gases(), type).status.level).toBe("normal");
      expect(assess(gases({ H2: 1, CH4: 1, C2H6: 1, C2H4: 1, C2H2: 0, CO: 10, CO2: 100 }), type).status.level).not.toBe("alarm");
    });
  });
});

// ---------------------------------------------------------------------------
// Các trường hợp LỆCH văn bản gốc đã phát hiện khi viết test. Dùng test.failing để:
//  - bộ test vẫn xanh (không chặn CI) nhưng lỗi được ghi nhận có chủ đích;
//  - khi ai đó SỬA code, các test này sẽ ĐỎ ("expected to fail but passed") — lúc đó chỉ
//    cần đổi test.failing thành test thường.
// Chưa tự sửa code chẩn đoán: cần người có thẩm quyền xác nhận trước khi đổi hành vi kết luận.
// ---------------------------------------------------------------------------
describe("Lệch văn bản gốc (đã biết, chờ quyết định)", () => {
  // IEC 60599:2022 Table 1: D1 = C2H2/C2H4 > 1 & CH4/H2 0,1–0,5 & C2H4/C2H6 > 1;
  // D2 = 0,6–2,5 & 0,1–1 & C2H4/C2H6 > 2. Điểm (1,5; 0,3; 1,5) chỉ khớp D1 (C2H4/C2H6 = 1,5 không > 2
  // nên không khớp D2) — nhưng code trả "D1/D2 (vùng chồng lấn)" vì nhánh chồng lấn chỉ xét C2H4/C2H6 > 1.
  test.failing("D1/D2: chỉ gán 'vùng chồng lấn' khi C2H4/C2H6 > 2 (điểm này chỉ là D1)", () => {
    const out = DGA.diagnoseRatios({ c2h2_c2h4: 1.5, ch4_h2: 0.3, c2h4_c2h6: 1.5 });
    expect(out).toMatch(/^D1 -/);
  });

  // computeRatios trả 999 khi mẫu số = 0, kể cả 0/0 (CH4 = H2 = 0). Bộ khí rỗng vì vậy thành
  // CH4/H2 = 999, C2H4/C2H6 = 999, C2H2/C2H4 = 0 => "T3 - Tăng nhiệt > 700°C" (kết luận rõ ràng, sai).
  test.failing("mẫu không có khí nào KHÔNG được chẩn đoán ra mã sự cố cụ thể", () => {
    expect(DGA.diagnoseGasFault(gases(), T.MBA, 0.1)).toBe(NO_DIAGNOSIS);
  });
});
