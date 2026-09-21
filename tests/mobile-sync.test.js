// Bản di động dùng CHUNG logic với bản web: mobile/dga-logic.js được SINH từ logic/ (scripts/sync-mobile.js).
// Test này bảo đảm (1) file sinh ra không lỗi thời, (2) hai bản cho CÙNG kết luận trên cùng số liệu,
// (3) mọi hàm DGA/Storage/Auth mà giao diện di động gọi đều tồn tại (bắt sớm lệch API).
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { buildMobileLogic, OUTPUT } = require("../scripts/sync-mobile");
const { ROOT, objectLiteralMembers, stripComments } = require("./scripts-helpers");
const { DGA: webDGA, gases } = require("./helpers");

const normalize = (t) => t.replace(/\r\n/g, "\n").replace(/^﻿/, "");

// Nạp mobile/dga-logic.js đúng như trình duyệt (không có module.exports, có window) rồi lấy window.DGA.
function loadMobileDGA() {
  const sandbox = { window: {}, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(OUTPUT, "utf8"), sandbox, { filename: "mobile/dga-logic.js" });
  return sandbox.window.DGA;
}

test("mobile/dga-logic.js khớp đúng logic/ của bản web (nếu lỗi: chạy `npm run sync-mobile`)", () => {
  expect(normalize(fs.readFileSync(OUTPUT, "utf8"))).toBe(buildMobileLogic());
});

describe("hai bản cho cùng kết quả", () => {
  const mobileDGA = loadMobileDGA();
  const T = webDGA.EQUIPMENT_TYPES;

  test("cùng danh sách hàm/hằng số công khai", () => {
    expect(Object.keys(mobileDGA).sort()).toEqual(Object.keys(webDGA).sort());
  });

  const cases = [
    gases({ H2: 200, CH4: 50, C2H6: 20, C2H4: 80, C2H2: 0.5, CO: 300, CO2: 3000 }),
    gases({ H2: 10, CH4: 20, C2H6: 40, C2H4: 20, CO: 100, CO2: 500 }),
    gases({ H2: 5, CH4: 5, C2H6: 5, C2H4: 60, C2H2: 40, CO: 50, CO2: 400 }),
    gases({ H2: 1000, CH4: 300, C2H6: 200, C2H4: 500, C2H2: 30, CO: 2000, CO2: 20000 }),
    gases(),
  ];

  test.each(Object.values(T))("đánh giá %s: chuẩn áp dụng, chẩn đoán, Duval, trạng thái tổng thể giống hệt", (type) => {
    const run = (D, g) => {
      const std = D.resolveStandard({ equipmentType: type }, []);
      const rows = D.evaluateAbsolute(g, std.limits);
      const diagnosis = D.diagnoseGasFault(g, type, std.pdThreshold);
      return {
        limits: std.limits,
        source: std.sourceLabel,
        rows,
        diagnosis,
        duval: D.diagnoseDuval1(g),
        status: D.computeOverallStatus({
          overallOk: D.overallVerdict(rows) === "Đạt",
          exceedCount: D.countExceedTypical(g, type, { equipmentType: type }),
          diagnosis, priorDiagnosis: null, rateRows: null, condemningRows: [],
        }),
      };
    };
    cases.forEach((g) => expect(run(mobileDGA, g)).toEqual(run(webDGA, g)));
  });

  test("dầu MBA/OLTC/TI-TU và dự báo giống hệt", () => {
    const oil = { voltageClass: "220", oilState: "inservice", moisture: 18, tgd90: 4, bdv: 52 };
    expect(mobileDGA.evaluateOilTest(oil)).toEqual(webDGA.evaluateOilTest(oil));
    const oltc = { oltcSamplePoint: "pharieng", voltageClass: "500", oilState: "inservice", bdv: 58, moisture: 22 };
    expect(mobileDGA.evaluateOltcOilTest(oltc)).toEqual(webDGA.evaluateOltcOilTest(oltc));
    const hist = [{ date: "2020-01-01", value: 10 }, { date: "2021-01-01", value: 25 }, { date: "2022-01-01", value: 41 }];
    expect(mobileDGA.forecastGasTrend(hist, 3, 100)).toEqual(webDGA.forecastGasTrend(hist, 3, 100));
  });

  test("cấu hình quy định: ghi đè trên bản di động đổi kết quả và khôi phục được", () => {
    mobileDGA.applyRegulationConfigOverride("BANG64_MBA", { values: { H2: 100 } });
    expect(mobileDGA.resolveStandard({ equipmentType: T.MBA }, []).limits.H2).toBe(100);
    mobileDGA.resetRegulationConfigItem("BANG64_MBA");
    expect(mobileDGA.resolveStandard({ equipmentType: T.MBA }, []).limits.H2).toBe(150);
  });
});

describe("giao diện di động chỉ gọi các hàm có thật", () => {
  const mobileFiles = ["app.js", "bbtn-export.js", "bbtn-import.js", "storage.js"].map((f) => path.join(ROOT, "mobile", f));
  // Bỏ chú thích để không tính các tham chiếu chỉ nằm trong comment (vd "DGA.evaluate*()", "Auth.init()").
  const source = mobileFiles.map((f) => stripComments(f)).join("\n");
  const usedOf = (prefix) => [...new Set((source.match(new RegExp(`\\b${prefix}\\.[A-Za-z0-9_]+`, "g")) || []).map((s) => s.slice(prefix.length + 1)))];

  test("mọi DGA.* mà mobile gọi đều tồn tại trong logic dùng chung", () => {
    const mobileDGA = loadMobileDGA();
    const missing = usedOf("DGA").filter((k) => !(k in mobileDGA));
    expect(missing).toEqual([]);
  });
  test("mọi Storage.* / Auth.* mà mobile gọi đều được khai báo trong mobile/storage.js", () => {
    const storageFile = path.join(ROOT, "mobile", "storage.js");
    const storageMembers = objectLiteralMembers(storageFile, "Storage");
    const authMembers = objectLiteralMembers(storageFile, "Auth");
    expect(storageMembers).not.toBeNull();
    expect(authMembers).not.toBeNull();
    const usedStorage = usedOf("Storage").filter((k) => k !== "mode" && k !== "enabled");
    const usedAuth = usedOf("Auth");
    const isMember = (list, k) => list.includes(k);
    expect(usedStorage.filter((k) => !isMember(storageMembers, k) && k !== "mode")).toEqual([]);
    expect(usedAuth.filter((k) => !isMember(authMembers, k))).toEqual([]);
  });
  test("Storage.listRegulationConfig có sẵn trên di động (áp dụng Cấu hình quy định do Admin chỉnh ở web)", () => {
    expect(objectLiteralMembers(path.join(ROOT, "mobile", "storage.js"), "Storage")).toContain("listRegulationConfig");
  });
});
