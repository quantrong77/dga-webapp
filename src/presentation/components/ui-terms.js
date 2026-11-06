/* src/presentation/components/ui-terms.js — Áp dụng "Tên văn bản, điều khoản, bảng, phụ lục" do Admin cấu hình (tab "Cấu hình"
 * > "Quy định", xem mục 10 ở src/domain/dga-logic-regulation-config.js) lên TOÀN BỘ nội dung hiển thị:
 * chữ trong trang, title / aria-label / data-tooltip / placeholder, và nội dung sinh động (kết quả
 * phân tích, bảng lịch sử, khuyến cáo...) nhờ MutationObserver.
 *
 * Luôn thay từ VĂN BẢN GỐC đã ghi nhớ (WeakMap) nên đổi tên nhiều lần / khôi phục mặc định vẫn đúng.
 * Khi không có tên nào bị đổi khác mặc định, module không quét gì cả.
 *
 * KHÔNG thay trong: ô nhập liệu (input/textarea — dữ liệu người dùng), script/style, và vùng có
 * thuộc tính data-no-terms (form cấu hình — để Admin thấy đúng tên gốc đang được ánh xạ; mục
 * "Lấy mẫu dầu" — "Điều 6–10" ở đó là của quy trình lấy mẫu 3856/QĐ-PTC3, không phải QĐ1901). */

const TERMS_ATTRS = ["title", "aria-label", "data-tooltip", "placeholder", "data-caption"];
const _termsTextOrig = new WeakMap(); // Text node -> { orig, out }
const _termsAttrOrig = new WeakMap(); // Element -> { attr: { orig, out } }
let _termsObserver = null;
let _termsDocTitle = null;

function termsSkip(el) {
  if (!el || el.nodeType !== 1) return false;
  return !!el.closest("script, style, textarea, input, [data-no-terms]");
}

function termsApplyText(node) {
  const parent = node.parentElement;
  if (!parent || termsSkip(parent)) return;
  const rec = _termsTextOrig.get(node);
  const orig = rec && node.nodeValue === rec.out ? rec.orig : node.nodeValue;
  if (!orig || !/[A-Za-zĐđ]/.test(orig)) return;
  const out = DGA.applyRegulationTerms(orig);
  if (out !== node.nodeValue) node.nodeValue = out;
  if (out !== orig || rec) _termsTextOrig.set(node, { orig, out });
}

function termsApplyAttrs(el) {
  if (termsSkip(el)) return;
  let recs = _termsAttrOrig.get(el);
  TERMS_ATTRS.forEach((a) => {
    if (!el.hasAttribute(a)) return;
    const cur = el.getAttribute(a);
    const rec = recs && recs[a];
    const orig = rec && cur === rec.out ? rec.orig : cur;
    const out = DGA.applyRegulationTerms(orig);
    if (out !== cur) el.setAttribute(a, out);
    if (out !== orig || rec) {
      recs = recs || {};
      recs[a] = { orig, out };
    }
  });
  if (recs) _termsAttrOrig.set(el, recs);
}

function termsApplyTree(root) {
  if (!root) return;
  if (root.nodeType === 3) { termsApplyText(root); return; }
  if (root.nodeType !== 1 || termsSkip(root)) return;
  termsApplyAttrs(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeType === 1 && termsSkip(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let n = walker.nextNode();
  while (n) {
    if (n.nodeType === 3) termsApplyText(n); else termsApplyAttrs(n);
    n = walker.nextNode();
  }
}

/** Áp dụng lại toàn trang — gọi khi cấu hình tên thay đổi (kể cả khôi phục mặc định). */
function applyRegulationTermsToPage() {
  if (typeof document === "undefined" || !document.body || typeof DGA === "undefined") return;
  const active = DGA.regulationTermsActive();
  if (_termsDocTitle === null) _termsDocTitle = document.title;
  document.title = DGA.applyRegulationTerms(_termsDocTitle);
  // Chưa đổi tên nào và chưa từng thay gì -> không cần quét
  if (!active && !_termsObserver) return;
  termsApplyTree(document.body);
  if (active && !_termsObserver) {
    _termsObserver = new MutationObserver((muts) => {
      if (!DGA.regulationTermsActive()) return;
      muts.forEach((m) => {
        if (m.type === "characterData") termsApplyText(m.target);
        else if (m.type === "attributes") termsApplyAttrs(m.target);
        else m.addedNodes.forEach((nd) => termsApplyTree(nd));
      });
    });
    _termsObserver.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: TERMS_ATTRS });
  }
}

/** Áp dụng tên đã cấu hình lên MỌI chuỗi trong 1 object dữ liệu (dùng trước khi xuất file Word). */
function applyRegulationTermsDeep(value) {
  if (typeof DGA === "undefined" || !DGA.regulationTermsActive()) return value;
  if (typeof value === "string") return DGA.applyRegulationTerms(value);
  if (Array.isArray(value)) return value.map(applyRegulationTermsDeep);
  if (value && typeof value === "object") {
    const out = {};
    Object.keys(value).forEach((k) => { out[k] = applyRegulationTermsDeep(value[k]); });
    return out;
  }
  return value;
}

if (typeof document !== "undefined") {
  document.addEventListener("dga:regulationchange", applyRegulationTermsToPage);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { applyRegulationTermsToPage, applyRegulationTermsDeep, termsApplyTree };
}
