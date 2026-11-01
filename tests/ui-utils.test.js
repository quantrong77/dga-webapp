/**
 * Unit Test Suite for ui/ui-utils.js
 * Senior QA Engineer & Test Automation Specialist
 * Structure: AAA (Arrange - Act - Assert)
 * Coverage: XSS prevention, SSRF/protocol injection, negative validation, diff tracking, edge cases
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function createUiUtilsContext() {
  const code = fs.readFileSync(path.join(__dirname, "../ui/ui-utils.js"), "utf8");
  const notifyErrorMock = jest.fn();
  const alertMock = jest.fn();
  const domMock = jest.fn((id) => ({
    value: "",
    classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn() },
  }));

  const ctx = {
    location: { href: "http://localhost:8080/index.html" },
    URL: global.URL,
    DGA: { GASES: ["H2", "CH4", "C2H6", "C2H4", "C2H2", "CO", "CO2"] },
    recordGases: (r) => ({
      H2: r.h2 ?? r.H2 ?? 0,
      CH4: r.ch4 ?? r.CH4 ?? 0,
      C2H6: r.c2h6 ?? r.C2H6 ?? 0,
      C2H4: r.c2h4 ?? r.C2H4 ?? 0,
      C2H2: r.c2h2 ?? r.C2H2 ?? 0,
      CO: r.co ?? r.CO ?? 0,
      CO2: r.co2 ?? r.CO2 ?? 0,
    }),
    notifyError: notifyErrorMock,
    alert: alertMock,
    $: domMock,
  };

  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx;
}

describe("ui-utils: escapeHtml (XSS Sanitization & Edge Cases)", () => {
  let utils;
  beforeEach(() => {
    utils = createUiUtilsContext();
  });

  test("Arrange/Act/Assert: converts dangerous characters & < > \" ' to HTML entities", () => {
    // Arrange
    const input = `<script>alert("XSS & attack")</script> and 'quotes'`;

    // Act
    const result = utils.escapeHtml(input);

    // Assert
    expect(result).toBe("&lt;script&gt;alert(&quot;XSS &amp; attack&quot;)&lt;/script&gt; and &#39;quotes&#39;");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
  });

  test("Edge case: handles null and undefined safely by returning empty string", () => {
    // Arrange & Act & Assert
    expect(utils.escapeHtml(null)).toBe("");
    expect(utils.escapeHtml(undefined)).toBe("");
  });

  test("Edge case: handles empty string, numbers and booleans", () => {
    // Arrange & Act & Assert
    expect(utils.escapeHtml("")).toBe("");
    expect(utils.escapeHtml(0)).toBe("0");
    expect(utils.escapeHtml(123.45)).toBe("123.45");
    expect(utils.escapeHtml(false)).toBe("false");
    expect(utils.escapeHtml(true)).toBe("true");
  });

  test("Security: sanitizes common XSS injection vectors", () => {
    // Arrange
    const vectors = [
      '<img src=x onerror="fetch(\'http://attacker.com\')">',
      '"><svg onload=alert(1)>',
      "javascript:/*--></title></style></textarea></script></xmp>",
      "'; DROP TABLE measurements; --",
    ];

    // Act & Assert
    vectors.forEach((v) => {
      const sanitized = utils.escapeHtml(v);
      expect(sanitized).not.toContain("<");
      expect(sanitized).not.toContain(">");
      expect(sanitized).not.toContain('"');
    });
  });
});

describe("ui-utils: safeHttpUrl (Protocol Validation & Security)", () => {
  let utils;
  beforeEach(() => {
    utils = createUiUtilsContext();
  });

  test("Arrange/Act/Assert: allows valid https and http URLs", () => {
    // Arrange
    const httpsUrl = "https://drive.google.com/file/d/123/view";
    const httpUrl = "http://example.com/report.pdf";

    // Act & Assert
    expect(utils.safeHttpUrl(httpsUrl)).toBe(httpsUrl);
    expect(utils.safeHttpUrl(httpUrl)).toBe(httpUrl);
  });

  test("Edge case: preserves query params, hash and port numbers", () => {
    // Arrange
    const fullUrl = "https://sub.domain.vn:8443/api/view?id=456&type=dga#section1";

    // Act
    const result = utils.safeHttpUrl(fullUrl);

    // Assert
    expect(result).toBe(fullUrl);
  });

  test("Security: blocks pseudo-protocols and dangerous schemes", () => {
    // Arrange
    const dangerous = [
      "javascript:alert(document.cookie)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///C:/Windows/System32/cmd.exe",
      "blob:http://localhost:8080/uuid-here",
    ];

    // Act & Assert
    dangerous.forEach((url) => {
      expect(utils.safeHttpUrl(url)).toBeNull();
    });
  });

  test("Edge case: handles null, undefined, empty string and non-string inputs", () => {
    // Arrange & Act & Assert
    expect(utils.safeHttpUrl(null)).toBeNull();
    expect(utils.safeHttpUrl(undefined)).toBeNull();
    expect(utils.safeHttpUrl("")).toBeNull();
    expect(utils.safeHttpUrl("   ")).toBeNull();
    expect(utils.safeHttpUrl("not-a-valid-url")).toBeNull();
  });
});

describe("ui-utils: findNegativeValueField & alertIfNegative (Input Validation)", () => {
  let utils;
  beforeEach(() => {
    utils = createUiUtilsContext();
  });

  test("Arrange/Act/Assert: returns null when all fields are valid positive numbers or zero", () => {
    // Arrange
    const fields = [
      { label: "Khí H2", value: 0 },
      { label: "Khí CH4", value: 15.5 },
      { label: "Điện áp", value: 220 },
      { label: "Chưa nhập", value: null },
      { label: "Bỏ trống", value: undefined },
      { label: "NaN", value: NaN },
    ];

    // Act
    const result = utils.findNegativeValueField(fields);

    // Assert
    expect(result).toBeNull();
    expect(utils.alertIfNegative(fields)).toBe(false);
    expect(utils.notifyError).not.toHaveBeenCalled();
  });

  test("Arrange/Act/Assert: identifies negative number and triggers notification", () => {
    // Arrange
    const fields = [
      { label: "Khí H2", value: 10 },
      { label: "Khí C2H2", value: -0.5 },
      { label: "Khí CO", value: 100 },
    ];

    // Act
    const found = utils.findNegativeValueField(fields);
    const alerted = utils.alertIfNegative(fields);

    // Assert
    expect(found).toBe("Khí C2H2");
    expect(alerted).toBe(true);
    expect(utils.notifyError).toHaveBeenCalledWith(
      expect.stringContaining('Giá trị "Khí C2H2" không hợp lệ: không được nhập số âm.')
    );
  });

  test("Edge case: identifies negative value at the first field and handles -0", () => {
    // Arrange
    const fieldsFirstNeg = [{ label: "H2", value: -1 }];
    const fieldsMinusZero = [{ label: "H2", value: -0 }];

    // Act & Assert
    expect(utils.findNegativeValueField(fieldsFirstNeg)).toBe("H2");
    // -0 in JS is === 0, not < 0
    expect(utils.findNegativeValueField(fieldsMinusZero)).toBeNull();
  });
});

describe("ui-utils: numOrNullForDiff & diffTrackedGasFields (Audit Trail)", () => {
  let utils;
  beforeEach(() => {
    utils = createUiUtilsContext();
  });

  test("numOrNullForDiff: parses numbers and handles null/undefined/empty string", () => {
    // Arrange & Act & Assert
    expect(utils.numOrNullForDiff(null)).toBeNull();
    expect(utils.numOrNullForDiff(undefined)).toBeNull();
    expect(utils.numOrNullForDiff("")).toBeNull();
    expect(utils.numOrNullForDiff(0)).toBe(0);
    expect(utils.numOrNullForDiff("0")).toBe(0);
    expect(utils.numOrNullForDiff(15.2)).toBe(15.2);
    expect(utils.numOrNullForDiff("42.5")).toBe(42.5);
  });

  test("diffTrackedGasFields: returns empty strings when no fields were modified", () => {
    // Arrange
    const oldRec = { h2: 10, ch4: 20, c2h6: 5, c2h4: 15, c2h2: 0, co: 100, co2: 500, n2: 5000, o2: 1500 };
    const gases = { H2: 10, CH4: 20, C2H6: 5, C2H4: 15, C2H2: 0, CO: 100, CO2: 500 };

    // Act
    const diff = utils.diffTrackedGasFields(oldRec, gases, 5000, 1500);

    // Assert
    expect(diff.editedFields).toBe("");
    expect(diff.editLogEntry).toBe("");
  });

  test("diffTrackedGasFields: detects single and multiple field modifications with audit trail", () => {
    // Arrange
    const oldRec = { h2: 10, ch4: 20, c2h6: 5, c2h4: 15, c2h2: 0, co: 100, co2: 500, n2: 5000, o2: 1500 };
    const gases = { H2: 25, CH4: 20, C2H6: 5, C2H4: 15, C2H2: 2.5, CO: 100, CO2: 500 };

    // Act
    const diff = utils.diffTrackedGasFields(oldRec, gases, 5000, 1800);

    // Assert
    expect(diff.editedFields).toBe("H2:10|C2H2:0|O2:1500");
    expect(diff.editLogEntry).toContain("H2: 10 → 25");
    expect(diff.editLogEntry).toContain("C2H2: 0 → 2.5");
    expect(diff.editLogEntry).toContain("O2: 1500 → 1800");
  });

  test("diffTrackedGasFields: handles transition between null and value", () => {
    // Arrange
    const oldRec = { h2: 0, ch4: 20, c2h6: 0, c2h4: 0, c2h2: 0, co: 0, co2: 0, n2: null, o2: null };
    const gases = { H2: 15, CH4: 20, C2H6: 0, C2H4: 0, C2H2: 0, CO: 0, CO2: 0 };

    // Act
    const diff = utils.diffTrackedGasFields(oldRec, gases, null, null);

    // Assert
    expect(diff.editedFields).toBe("H2:0");
    expect(diff.editLogEntry).toContain("H2: 0 → 15");
  });

  test("parseEditedFields: parses formatted string back to Map", () => {
    // Arrange
    const str = "H2:10|C2H2:0|O2:1500";

    // Act
    const map = utils.parseEditedFields(str);

    // Assert
    expect(map.size).toBe(3);
    expect(map.get("H2")).toBe("10");
    expect(map.get("C2H2")).toBe("0");
    expect(map.get("O2")).toBe("1500");
    expect(map.has("CH4")).toBe(false);
  });

  test("parseEditedFields: edge case with empty string, null, or malformed input", () => {
    // Arrange & Act & Assert
    expect(utils.parseEditedFields("").size).toBe(0);
    expect(utils.parseEditedFields(null).size).toBe(0);
    expect(utils.parseEditedFields(undefined).size).toBe(0);
    expect(utils.parseEditedFields("MALFORMED_NO_COLON").size).toBe(0);
  });
});

describe("ui-utils: gasLabelIcon (Icon rendering)", () => {
  let utils;
  beforeEach(() => {
    utils = createUiUtilsContext();
  });

  test("renders book icon for CO and CO2, flask icon for hydrocarbon gases", () => {
    // Arrange & Act & Assert
    expect(utils.gasLabelIcon("CO")).toContain("#icon-book");
    expect(utils.gasLabelIcon("CO2")).toContain("#icon-book");
    expect(utils.gasLabelIcon("H2")).toContain("#icon-flask");
    expect(utils.gasLabelIcon("C2H2")).toContain("#icon-flask");
    expect(utils.gasLabelIcon("CH4")).toContain("#icon-flask");
  });
});
