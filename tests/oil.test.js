// Thí nghiệm dầu: MBA chính (Bảng 54/55/58), OLTC (Bảng 49), TI/TU (2 tầng NSX).
const { DGA } = require("./helpers");
const { EQUIPMENT_TYPES: T } = DGA;

const row = (res, key) => res.rows.find((r) => r.key === key);

describe("evaluateOilTest — dầu MBA chính", () => {
  // 220 kV, dầu vận hành: BDV ≥ 55 (Bảng 54), tgδ ≤ 10 (Bảng 55), nước ≤ 20 (Bảng 58)
  const inservice = (v) => DGA.evaluateOilTest({ voltageClass: "220", oilState: "inservice", ...v });

  test("BDV: càng cao càng tốt — đúng bằng 55 kV => Đạt; 54,9 => Không đạt", () => {
    expect(row(inservice({ bdv: 55 }), "bdv").verdict).toBe("Đạt");
    expect(row(inservice({ bdv: 54.9 }), "bdv").verdict).toBe("Không đạt");
  });
  test("độ ẩm: đúng bằng 20 ppm => Đạt; 20,1 => Không đạt", () => {
    expect(row(inservice({ moisture: 20 }), "moisture").verdict).toBe("Đạt");
    expect(row(inservice({ moisture: 20.1 }), "moisture").verdict).toBe("Không đạt");
  });
  test("tgδ 90°C: đúng bằng 10% => Đạt; 10,1 => Không đạt", () => {
    expect(row(inservice({ tgd90: 10 }), "tgd90").verdict).toBe("Đạt");
    expect(row(inservice({ tgd90: 10.1 }), "tgd90").verdict).toBe("Không đạt");
  });
  test("dầu mới 220 kV: BDV ≥ 60, tgδ ≤ 1,0, nước ≤ 10", () => {
    const r = DGA.evaluateOilTest({ voltageClass: "220", oilState: "new", bdv: 59, tgd90: 1.0, moisture: 10 });
    expect(row(r, "bdv").verdict).toBe("Không đạt");
    expect(row(r, "tgd90").verdict).toBe("Đạt");
    expect(row(r, "moisture").verdict).toBe("Đạt");
    expect(r.overall).toBe("Không đạt");
  });
  test("500 kV: BDV mới ≥ 70, vận hành ≥ 60", () => {
    expect(row(DGA.evaluateOilTest({ voltageClass: "500", oilState: "new", bdv: 69 }), "bdv").verdict).toBe("Không đạt");
    expect(row(DGA.evaluateOilTest({ voltageClass: "500", oilState: "inservice", bdv: 60 }), "bdv").verdict).toBe("Đạt");
  });
  test("≤110 kV: ngưỡng nước phụ thuộc bảo vệ màng/N2 (dầu mới: 10 có màng, 20 không màng)", () => {
    const noMem = DGA.evaluateOilTest({ voltageClass: "110", oilState: "new", hasMembraneN2: false, moisture: 15 });
    const mem = DGA.evaluateOilTest({ voltageClass: "110", oilState: "new", hasMembraneN2: true, moisture: 15 });
    expect(row(noMem, "moisture").verdict).toBe("Đạt");
    expect(row(mem, "moisture").verdict).toBe("Không đạt");
  });
  test("chưa nhập hạng mục nào => 'Chưa đủ dữ liệu'; chỉ đánh giá hạng mục có nhập", () => {
    expect(inservice({}).overall).toBe("Chưa đủ dữ liệu");
    const r = inservice({ bdv: 60 });
    expect(r.rows).toHaveLength(1);
    expect(r.overall).toBe("Đạt");
  });
  test("giá trị 0 vẫn được đánh giá (không bị coi là rỗng)", () => {
    expect(row(inservice({ moisture: 0 }), "moisture").verdict).toBe("Đạt");
    expect(row(inservice({ bdv: 0 }), "bdv").verdict).toBe("Không đạt");
  });
  test("tiêu chuẩn NSX ghi đè từng hạng mục riêng lẻ, hạng mục khác dùng QĐ1901", () => {
    const std = [{ manufacturer: "X", voltageClass: "220", oilState: "inservice", moisture: 5 }];
    const r = inservice({ manufacturer: "X", manufacturerOilStandards: std, moisture: 6, bdv: 55 });
    expect(row(r, "moisture").verdict).toBe("Không đạt");
    expect(row(r, "moisture").isManufacturer).toBe(true);
    expect(row(r, "bdv").isManufacturer).toBe(false);
    expect(row(r, "bdv").verdict).toBe("Đạt");
  });
  test("NSX khác cấp điện áp/trạng thái dầu => không áp dụng", () => {
    const std = [{ manufacturer: "X", voltageClass: "500", oilState: "inservice", moisture: 5 }];
    expect(row(inservice({ manufacturer: "X", manufacturerOilStandards: std, moisture: 6 }), "moisture").isManufacturer).toBe(false);
  });
});

describe("evaluateOltcOilTest — dầu OLTC (Điều 37, Bảng 49)", () => {
  test("điểm cuối trung tính: BDV ≥ 40, độ ẩm ≤ 30", () => {
    const ok = DGA.evaluateOltcOilTest({ oltcSamplePoint: "trungtinh", voltageClass: "220", oilState: "inservice", bdv: 40, moisture: 30 });
    expect(ok.overall).toBe("Đạt");
    const bad = DGA.evaluateOltcOilTest({ oltcSamplePoint: "trungtinh", voltageClass: "220", oilState: "inservice", bdv: 39.9, moisture: 30.1 });
    expect(bad.overall).toBe("Không đạt");
    expect(row(bad, "bdv").verdict).toBe("Không đạt");
    expect(row(bad, "moisture").verdict).toBe("Không đạt");
  });
  test("pha riêng theo cấp điện áp: 500 kV BDV ≥ 60, độ ẩm ≤ 20", () => {
    const r = DGA.evaluateOltcOilTest({ oltcSamplePoint: "pharieng", voltageClass: "500", oilState: "inservice", bdv: 59, moisture: 20 });
    expect(row(r, "bdv").verdict).toBe("Không đạt");
    expect(row(r, "moisture").verdict).toBe("Đạt");
  });
  test("bậc điện áp Bảng 49 không có số liệu (35–110 kV, pha riêng) => không tự bịa ngưỡng", () => {
    const r = DGA.evaluateOltcOilTest({ oltcSamplePoint: "pharieng", voltageClass: "tren35duoi110", oilState: "inservice", bdv: 10 });
    expect(row(r, "bdv").verdict).toBe("Không có ngưỡng");
    expect(row(r, "bdv").ref).toMatch(/không có số liệu/);
  });
  test("tgδ dầu OLTC vận hành: chỉ ghi nhận, không có ngưỡng", () => {
    const r = DGA.evaluateOltcOilTest({ oltcSamplePoint: "trungtinh", voltageClass: "220", oilState: "inservice", tgd90: 99 });
    expect(row(r, "tgd90").verdict).toBe("Không có ngưỡng");
    expect(r.overall).toBe("Đạt"); // 'Không có ngưỡng' không làm Không đạt
  });
  test("dầu OLTC mới: áp dụng như dầu chính MBA (Bảng 54/55/58) và gắn nhãn OLTC", () => {
    const r = DGA.evaluateOltcOilTest({ voltageClass: "220", oilState: "new", bdv: 59 });
    expect(row(r, "bdv").verdict).toBe("Không đạt"); // 60 kV cho dầu mới, không phải 40/50 của Bảng 49
    expect(row(r, "bdv").label).toMatch(/\(OLTC\)$/);
  });
});

describe("evaluateInstrumentOilTest — dầu TI/TU (chỉ theo NSX, 2 tầng)", () => {
  const std = {
    manufacturer: "H", equipmentType: T.TI,
    moisture: 10, moistureReject: 20,
    bdv: 50, bdvReject: 40,
    tgd90: 1, // chỉ có 1 mức (không có tgd90Reject)
  };
  const run = (v, standards = [std]) => DGA.evaluateInstrumentOilTest({ equipmentType: T.TI, manufacturer: "H", manufacturerOilStandards: standards, ...v });

  test("KHÔNG có tiêu chuẩn NSX => 'Chưa có tiêu chuẩn nhà sản xuất', không tự đánh giá Đạt", () => {
    const r = DGA.evaluateInstrumentOilTest({ equipmentType: T.TI, manufacturer: "", manufacturerOilStandards: [], moisture: 5, bdv: 60 });
    expect(r.overall).toBe("Chưa có tiêu chuẩn nhà sản xuất");
    r.rows.forEach((x) => expect(x.verdict).toBe("Chưa có tiêu chuẩn nhà sản xuất"));
  });
  test("độ ẩm: ≤ bình thường => Đạt; giữa 2 tầng => Cảnh báo; > loại bỏ => Không đạt", () => {
    expect(row(run({ moisture: 10 }), "moisture").verdict).toBe("Đạt");
    expect(row(run({ moisture: 15 }), "moisture").verdict).toBe("Cảnh báo");
    expect(row(run({ moisture: 20 }), "moisture").verdict).toBe("Cảnh báo"); // đúng bằng ngưỡng loại bỏ chưa vượt
    expect(row(run({ moisture: 20.1 }), "moisture").verdict).toBe("Không đạt");
  });
  test("BDV (ngược hướng): ≥ 50 Đạt; 40 ≤ BDV < 50 Cảnh báo; < 40 Không đạt", () => {
    expect(row(run({ bdv: 50 }), "bdv").verdict).toBe("Đạt");
    expect(row(run({ bdv: 45 }), "bdv").verdict).toBe("Cảnh báo");
    expect(row(run({ bdv: 40 }), "bdv").verdict).toBe("Cảnh báo");
    expect(row(run({ bdv: 39.9 }), "bdv").verdict).toBe("Không đạt");
  });
  test("chỉ cấu hình 1 mức => vượt là Không đạt luôn (không có Cảnh báo)", () => {
    expect(row(run({ tgd90: 1 }), "tgd90").verdict).toBe("Đạt");
    expect(row(run({ tgd90: 1.01 }), "tgd90").verdict).toBe("Không đạt");
  });
  test("overall lấy mức xấu nhất: Không đạt > Cảnh báo > Đạt", () => {
    expect(run({ moisture: 15, bdv: 60 }).overall).toBe("Cảnh báo");
    expect(run({ moisture: 15, bdv: 10 }).overall).toBe("Không đạt");
    expect(run({ moisture: 5, bdv: 60 }).overall).toBe("Đạt");
  });
  test("NSX cấu hình cho TU không áp dụng cho TI", () => {
    const r = run({ moisture: 5 }, [{ ...std, equipmentType: T.TU }]);
    expect(r.overall).toBe("Chưa có tiêu chuẩn nhà sản xuất");
  });
  test("không nhập hạng mục nào => 'Chưa đủ dữ liệu'", () => {
    expect(run({}).overall).toBe("Chưa đủ dữ liệu");
  });
});
