/* Tên văn bản / điều khoản / bảng / phụ lục cấu hình được (Cấu hình > Quy định) — applyRegulationTerms(). */
const { DGA } = require("./helpers");

afterEach(() => ["TERMS_DOCS", "TERMS_QD_ARTICLES", "TERMS_IEC"].forEach((k) => DGA.resetRegulationConfigItem(k)));

const SAMPLE = "Bảng 66, Điều 54 QĐ1901/QĐ-EVNNPT (= Table 1, IEC 60599:2022 mục 5.4); Bảng 64, Bảng 65; Điều 5; QĐ 1901; Annex A.2.4 Table A.2; IEC60599 Annex B, Figure B.3";

test("chưa cấu hình gì -> văn bản giữ nguyên, bộ thay thế không chạy", () => {
  expect(DGA.regulationTermsActive()).toBe(false);
  expect(DGA.applyRegulationTerms(SAMPLE)).toBe(SAMPLE);
});

test("đổi tên quy định, phiên bản IEC, số điều/bảng -> thay đúng chỗ, không ăn nhầm số gần giống", () => {
  DGA.applyRegulationConfigOverride("TERMS_DOCS", { values: { QD_FULL: "QĐ2050/QĐ-EVNNPT", QD_SHORT: "QĐ2050", IEC60599_YEAR: "2030" } });
  DGA.applyRegulationConfigOverride("TERMS_QD_ARTICLES", { values: { B66: "Bảng 70", D54: "Điều 60" } });
  DGA.applyRegulationConfigOverride("TERMS_IEC", { values: { T1: "Table 3", TA2: "Table A.4", FIG_B3: "Figure C.1" } });
  expect(DGA.applyRegulationTerms(SAMPLE)).toBe(
    "Bảng 70, Điều 60 QĐ2050/QĐ-EVNNPT (= Table 3, IEC 60599:2030 mục 5.4); Bảng 64, Bảng 65; Điều 5; QĐ2050; Annex A.2.4 Table A.4; IEC60599 Annex B, Figure C.1"
  );
});

test("đổi tên tiêu chuẩn (không kèm năm) và phụ lục", () => {
  DGA.applyRegulationConfigOverride("TERMS_DOCS", { values: { IEC60599_NAME: "IEC 61234" } });
  DGA.applyRegulationConfigOverride("TERMS_IEC", { values: { ANNEX_B: "Annex D" } });
  expect(DGA.applyRegulationTerms("IEC 60599:2022 Annex B; IEC 60599 mục 9")).toBe("IEC 61234:2022 Annex D; IEC 61234 mục 9");
});

test("khôi phục mặc định -> trở lại nguyên văn; ô trống bị chặn khi lưu", () => {
  DGA.applyRegulationConfigOverride("TERMS_QD_ARTICLES", { values: { B66: "Bảng 70" } });
  expect(DGA.applyRegulationTerms("Bảng 66")).toBe("Bảng 70");
  DGA.resetRegulationConfigItem("TERMS_QD_ARTICLES");
  expect(DGA.applyRegulationTerms("Bảng 66")).toBe("Bảng 66");
  expect(DGA.validateRegulationConfigValues("TERMS_DOCS", { ...DGA.getRegulationConfigCurrentValues("TERMS_DOCS").values, QD_SHORT: " " })).toHaveLength(1);
});

test("áp dụng cho câu khuyến cáo sinh từ logic", () => {
  DGA.applyRegulationConfigOverride("TERMS_DOCS", { values: { QD_SHORT: "QĐ2050" } });
  const recs = DGA.buildRecommendations({ overallOk: true, exceedCount: 0, diagnosis: null, duval: null, rateRows: null, condemningRows: [] });
  expect(recs.join(" ")).toContain("QĐ1901"); // logic sinh văn bản gốc...
  expect(DGA.applyRegulationTerms(recs.join(" "))).toContain("QĐ2050"); // ...giao diện/xuất Word thay khi hiển thị
});
