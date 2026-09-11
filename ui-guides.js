/* ui-guides.js — Các khối nội dung tĩnh/tương tác nhẹ: cẩm nang chẩn đoán + sơ đồ
   tư duy (tab "Quy trình đánh giá"), 7 phương pháp lấy mẫu + lightbox ảnh (tab "Quy
   trình lấy mẫu"). Tách từ app.js — xem ui-auth.js đầu file đó để biết quy ước chia
   sẻ scope giữa các file ui-*.js. */


/** Lightbox phóng to ảnh "Cẩm nang tham khảo nhanh" (tab "Quy trình đánh giá") —
 *  bấm ảnh thu nhỏ để mở, bấm nút đóng/ra ngoài ảnh/phím Esc để đóng. */
function setupHandbookLightbox() {
  const thumb = $("btnOpenHandbook");
  const lightbox = $("handbookLightbox");
  const closeBtn = $("btnCloseHandbook");
  if (!thumb || !lightbox || !closeBtn) return;
  const open = () => {
    lightbox.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  };
  const close = () => {
    lightbox.classList.add("hidden");
    document.body.style.overflow = "";
  };
  thumb.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !lightbox.classList.contains("hidden")) close();
  });
}

/** Sơ đồ tư duy diễn giải DGA (tab "Quy trình đánh giá") — các nhánh dùng thẻ
 *  <details>/<summary> gốc nên tự có hành vi bấm-để-mở/đóng, không cần JS.
 *  Hàm này chỉ nối 2 nút tiện ích "Mở tất cả" / "Thu gọn tất cả". */
function setupMindmap() {
  const root = $("mindmapRoot");
  const btnExpand = $("btnMindmapExpandAll");
  const btnCollapse = $("btnMindmapCollapseAll");
  if (!root) return;
  const allNodes = () => root.querySelectorAll("details.mm-node");
  if (btnExpand) {
    btnExpand.addEventListener("click", () => {
      allNodes().forEach((d) => (d.open = true));
    });
  }
  if (btnCollapse) {
    btnCollapse.addEventListener("click", () => {
      allNodes().forEach((d) => (d.open = false));
    });
  }
}

/** 7 phương pháp lấy mẫu (Điều 8, tab "Quy trình lấy mẫu") — cùng cơ chế "Mở tất
 *  cả"/"Thu gọn tất cả" như setupMindmap(), áp dụng cho khối accordion riêng này. */
function setupSampleMethods() {
  const root = $("sampleMethodsRoot");
  const btnExpand = $("btnSampleExpandAll");
  const btnCollapse = $("btnSampleCollapseAll");
  if (!root) return;
  const allNodes = () => root.querySelectorAll("details.mm-node");
  if (btnExpand) {
    btnExpand.addEventListener("click", () => {
      allNodes().forEach((d) => (d.open = true));
    });
  }
  if (btnCollapse) {
    btnCollapse.addEventListener("click", () => {
      allNodes().forEach((d) => (d.open = false));
    });
  }
}

/** Lightbox phóng to ảnh hướng dẫn (tab "Quy trình lấy mẫu") — dùng chung 1 lightbox
 *  cho mọi ảnh (5 sơ đồ Hình 2-5 + thư viện ảnh thực tế): mỗi nút ".qt-img-btn" khai
 *  báo ảnh gốc/chú thích qua data-full/data-caption, bấm vào sẽ nạp động lên lightbox. */
function setupSamplingLightbox() {
  const lightbox = $("qtLightbox");
  const closeBtn = $("btnCloseQtLightbox");
  const imgEl = $("qtLightboxImg");
  const captionEl = $("qtLightboxCaption");
  if (!lightbox || !closeBtn || !imgEl) return;
  const open = (btn) => {
    const full = btn.getAttribute("data-full");
    const caption = btn.getAttribute("data-caption") || "";
    if (!full) return;
    imgEl.src = full;
    imgEl.alt = caption;
    captionEl.textContent = caption;
    captionEl.classList.toggle("hidden", !caption);
    lightbox.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  };
  const close = () => {
    lightbox.classList.add("hidden");
    document.body.style.overflow = "";
  };
  document.querySelectorAll(".qt-img-btn").forEach((btn) => {
    btn.addEventListener("click", () => open(btn));
  });
  closeBtn.addEventListener("click", close);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !lightbox.classList.contains("hidden")) close();
  });
}
