// Ranh giới 3 lớp (docs/refactor/ARCHITECTURE.md mục 4): presentation → data → domain.
//  - src/domain/  : KHÔNG DOM, KHÔNG storage, KHÔNG fetch/gsheet/supabase, không gọi tên của data/presentation.
//  - src/data/    : KHÔNG chạm DOM trang (document), KHÔNG showToast/notifyError/$ /alert/confirm, không gọi tên của presentation.
// Quét AST (bỏ chú thích, bỏ tên thuộc tính/khóa object) — tham chiếu thật tới tên toàn cục mới bị tính.
// Vi phạm hiện có nằm trong EXCEPTIONS (có ghi chú, mã V1–V10 như ARCHITECTURE.md mục 5). Mỗi ngoại lệ phải
// CÒN xảy ra thật: gỡ xong vi phạm ở Bước 4 mà quên xóa ngoại lệ thì test cũng đỏ.
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const { ROOT, localScripts, topLevelNames } = require("./scripts-helpers");

const listJs = (dir) =>
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listJs(`${dir}/${e.name}`) : e.name.endsWith(".js") ? [`${dir}/${e.name}`] : []
  );
const DOMAIN = listJs("src/domain");
const DATA = listJs("src/data");
const PRESENTATION = listJs("src/presentation");

/** Tên được TRUY CẬP như biến (không tính khai báo cục bộ, tên thuộc tính `a.b`, khóa `{ b: 1 }`). */
function referencedNames(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const ast = parser.parse(src, { sourceType: "unambiguous", allowImportExportEverywhere: true });
  const declared = new Set();
  const refs = new Map(); // name -> [line]
  const visit = (node, parent, key) => {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "Identifier") {
      const isProp = (parent.type === "MemberExpression" || parent.type === "OptionalMemberExpression") && key === "property" && !parent.computed;
      const isKey = (parent.type === "ObjectProperty" || parent.type === "ObjectMethod" || parent.type === "ClassMethod" || parent.type === "ClassProperty") && key === "key" && !parent.computed;
      const isDecl = ["VariableDeclarator", "FunctionDeclaration", "FunctionExpression", "ClassDeclaration", "CatchClause"].includes(parent.type) && (key === "id" || key === "param");
      const isParam = key === "params";
      const isLabel = ["LabeledStatement", "BreakStatement", "ContinueStatement"].includes(parent.type);
      const isImport = parent.type.startsWith("Import");
      if (isDecl || isParam || isImport) declared.add(node.name);
      else if (!isProp && !isKey && !isLabel) {
        if (!refs.has(node.name)) refs.set(node.name, []);
        refs.get(node.name).push(node.loc.start.line);
      }
      return;
    }
    for (const k of Object.keys(node)) {
      if (k === "loc" || k === "start" || k === "end" || k === "leadingComments" || k === "trailingComments" || k === "innerComments") continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === "string" && visit(c, node, k));
      else if (v && typeof v.type === "string") visit(v, node, k);
    }
  };
  // tham số hàm / mẫu destructuring: thu tên vào declared
  const collectPattern = (p) => {
    if (!p) return;
    if (p.type === "Identifier") declared.add(p.name);
    else if (p.type === "ObjectPattern") p.properties.forEach((q) => collectPattern(q.value || q.argument));
    else if (p.type === "ArrayPattern") p.elements.forEach(collectPattern);
    else if (p.type === "AssignmentPattern") collectPattern(p.left);
    else if (p.type === "RestElement") collectPattern(p.argument);
  };
  const walkDecl = (node) => {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "VariableDeclarator") collectPattern(node.id);
    if (/Function/.test(node.type) && node.params) node.params.forEach(collectPattern);
    if (node.type === "CatchClause") collectPattern(node.param);
    for (const k of Object.keys(node)) {
      if (k === "loc") continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach(walkDecl);
      else if (v && typeof v.type === "string") walkDecl(v);
    }
  };
  walkDecl(ast.program);
  visit(ast.program, { type: "File" }, "program");
  for (const d of declared) refs.delete(d);
  return refs;
}

// Tên toàn cục do lớp presentation khai báo (hàm/biến cấp cao nhất của file script cổ điển)
const presentationNames = new Set(PRESENTATION.flatMap((f) => topLevelNames(path.join(ROOT, f))));

const DOMAIN_BANNED = ["document", "window", "localStorage", "sessionStorage", "fetch", "navigator", "alert", "confirm", "gsheetGet", "gsheetPost", "sb", "Storage", "Auth"];
const DATA_BANNED = ["document", "showToast", "notifyError", "$", "alert", "confirm"];

/** Ngoại lệ có ghi chú — xem ARCHITECTURE.md mục 5. "Bước 4" = phải gỡ; "cho phép" = giữ lâu dài. */
const EXCEPTIONS = {
  "src/domain/dga-logic.js": { window: "V10 cho phép — facade UMD gán window.DGA = DGA" },
  "src/data/io/bbtn-import.js": {
    document: "V8 cho phép — <canvas> NGOÀI trang để render PDF cho OCR",
    // V1 đã gỡ ở Bước 4.3: tiêu chuẩn NSX đến qua setManufacturerStandardsProvider() do giao diện đăng ký
  },
  "src/data/io/nameplate-import.js": { document: "V9 cho phép — <canvas> NGOÀI trang để render PDF cho OCR" },
  // V2–V7 đã gỡ ở Bước 4.3: applyRegulationTermsDeep → domain; 3 hàm xuất .docx trả {blob, fileName}, tải xuống ở presentation.
};

const violationsOf = (rel, banned, extraBanned) => {
  const refs = referencedNames(rel);
  const out = {};
  for (const [name, lines] of refs) {
    if (banned.includes(name) || (extraBanned && extraBanned.has(name))) out[name] = lines;
  }
  return out;
};

describe("Ranh giới lớp", () => {
  test("đủ 3 lớp và mọi file của src/ đều được index.html nạp", () => {
    expect(DOMAIN.length).toBeGreaterThan(0);
    expect(DATA.length).toBeGreaterThan(0);
    expect(PRESENTATION.length).toBeGreaterThan(0);
    const loaded = new Set(localScripts("index.html").map((s) => s.rel));
    expect([...DOMAIN, ...DATA, ...PRESENTATION].filter((f) => !loaded.has(f))).toEqual([]);
  });

  const dataNames = new Set(DATA.flatMap((f) => {
    try {
      return topLevelNames(path.join(ROOT, f));
    } catch (_) {
      return []; // 2 ES module io/: không xuất tên toàn cục kiểu script
    }
  }));

  test.each(DOMAIN)("domain %s: không DOM/storage/fetch, không gọi data/presentation", (rel) => {
    const v = violationsOf(rel, DOMAIN_BANNED, new Set([...dataNames, ...presentationNames]));
    const allowed = EXCEPTIONS[rel] || {};
    const unexpected = Object.fromEntries(Object.entries(v).filter(([n]) => !allowed[n]));
    expect(unexpected).toEqual({});
  });

  test.each(DATA)("data %s: không chạm DOM trang, không toast, không gọi presentation", (rel) => {
    const v = violationsOf(rel, DATA_BANNED, presentationNames);
    const allowed = EXCEPTIONS[rel] || {};
    const unexpected = Object.fromEntries(Object.entries(v).filter(([n]) => !allowed[n]));
    expect(unexpected).toEqual({});
  });

  test("mọi ngoại lệ vẫn còn cần (gỡ vi phạm xong thì xóa ngoại lệ tương ứng)", () => {
    const stale = [];
    for (const [rel, names] of Object.entries(EXCEPTIONS)) {
      const refs = referencedNames(rel);
      for (const n of Object.keys(names)) if (!refs.has(n)) stale.push(`${rel}: ${n}`);
    }
    expect(stale).toEqual([]);
  });

  test("số ngoại lệ 'Bước 4' còn lại (giảm dần về 0 ở Bước 4)", () => {
    const step4 = Object.values(EXCEPTIONS).flatMap((m) => Object.values(m)).filter((note) => note.includes("Bước 4"));
    expect(step4.length).toBeLessThanOrEqual(8);
  });
});
