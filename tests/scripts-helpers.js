// Tiện ích phân tích tĩnh các thẻ <script> của index.html (web) và mobile/index.html (di động).
// Dùng cho tests/load-order.test.js và tests/mobile-sync.test.js.
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");

const ROOT = path.resolve(__dirname, "..");

/** Các thẻ <script src="..."> cục bộ (bỏ CDN http(s), bỏ vendor/), theo đúng thứ tự trong HTML. */
function localScripts(htmlRelPath) {
  const htmlPath = path.join(ROOT, htmlRelPath);
  const dir = path.dirname(htmlPath);
  const html = fs.readFileSync(htmlPath, "utf8");
  const out = [];
  const re = /<script\b([^>]*)>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const src = (attrs.match(/\bsrc="([^"]+)"/) || [])[1];
    if (!src || /^https?:/.test(src) || /(^|\/)vendor\//.test(src)) continue;
    out.push({
      src,
      file: path.join(dir, src),
      rel: path.relative(ROOT, path.join(dir, src)).replace(/\\/g, "/"),
      isModule: /type="module"/.test(attrs),
    });
  }
  return out;
}

function parseScript(file) {
  return parser.parse(fs.readFileSync(file, "utf8"), { sourceType: "script", errorRecovery: false });
}

function collectBindingNames(id, names) {
  if (!id) return;
  if (id.type === "Identifier") names.push(id.name);
  else if (id.type === "ObjectPattern") id.properties.forEach((p) => collectBindingNames(p.value || p.argument, names));
  else if (id.type === "ArrayPattern") id.elements.forEach((e) => collectBindingNames(e, names));
  else if (id.type === "AssignmentPattern") collectBindingNames(id.left, names);
  else if (id.type === "RestElement") collectBindingNames(id.argument, names);
}

/** Tên khai báo ở top-level của 1 script cổ điển — chính là các tên đi vào global scope khi nạp bằng <script>. */
function topLevelNames(file) {
  const names = [];
  for (const n of parseScript(file).program.body) {
    if ((n.type === "FunctionDeclaration" || n.type === "ClassDeclaration") && n.id) names.push(n.id.name);
    else if (n.type === "VariableDeclaration") n.declarations.forEach((d) => collectBindingNames(d.id, names));
  }
  return names;
}

/** Trả về mã nguồn đã bỏ comment (để dò việc dùng document/window mà không dính chú thích). */
function stripComments(file) {
  const src = fs.readFileSync(file, "utf8");
  // "unambiguous": nhận cả script cổ điển lẫn ES module (vd mobile/bbtn-import.js dùng import).
  const ast = parser.parse(src, { sourceType: "unambiguous", errorRecovery: false, allowImportExportEverywhere: true });
  let out = "";
  let last = 0;
  (ast.comments || []).forEach((c) => {
    out += src.slice(last, c.start);
    last = c.end;
  });
  return out + src.slice(last);
}

/** Tên thuộc tính khai báo trực tiếp trong `const <name> = { ... }` ở top-level (vd Storage, Auth). */
function objectLiteralMembers(file, name) {
  for (const n of parseScript(file).program.body) {
    if (n.type !== "VariableDeclaration") continue;
    for (const d of n.declarations) {
      if (d.id.type === "Identifier" && d.id.name === name && d.init && d.init.type === "ObjectExpression") {
        return d.init.properties.filter((p) => p.key).map((p) => p.key.name || p.key.value);
      }
    }
  }
  return null;
}

module.exports = { ROOT, localScripts, topLevelNames, stripComments, objectLiteralMembers };
