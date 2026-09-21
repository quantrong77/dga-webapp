/* ui-guides.js — Các khối nội dung tĩnh/tương tác nhẹ: cẩm nang chẩn đoán + sơ đồ
   tư duy (tab "Quy trình đánh giá"), 7 phương pháp lấy mẫu + lightbox ảnh (tab "Quy
   trình lấy mẫu"). Tách từ app.js — xem ui-auth.js đầu file đó để biết quy ước chia
   sẻ scope giữa các file ui-*.js. */


/** Lightbox phóng to ảnh trong "Cẩm nang tham khảo nhanh" (tab "Quy trình đánh giá",
 *  ".handbook-gallery" — có thể nhiều áp phích) — bấm ảnh thu nhỏ để mở, bấm nút
 *  đóng/ra ngoài ảnh/phím Esc để đóng. Ảnh/caption phóng to được gán động theo
 *  data-full/data-caption của đúng nút vừa bấm, giống hệt cơ chế setupSamplingLightbox()
 *  bên dưới (tab "Quy trình lấy mẫu") — tách riêng 2 hàm vì 2 lightbox khác id/tab. */
function setupHandbookLightbox() {
  const lightbox = $("handbookLightbox");
  const closeBtn = $("btnCloseHandbook");
  const imgEl = $("handbookLightboxImg");
  const captionEl = $("handbookLightboxCaption");
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
  document.querySelectorAll(".handbook-thumb").forEach((btn) => {
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

/** Sơ đồ tư duy tổng quan thứ 2 (tab "Quy trình đánh giá", "#overviewMindmapRoot") —
 *  góc nhìn khác/bổ sung cho sơ đồ ở setupMindmap() (Cơ chế hình thành khí, 7 loại khí,
 *  khí chỉ thị theo lỗi, phương pháp chẩn đoán, quy trình) — cùng cơ chế "Mở tất cả"/
 *  "Thu gọn tất cả" như setupMindmap(), tách hàm riêng vì 2 sơ đồ khác id/nút bấm. */
function setupOverviewMindmap() {
  const root = $("overviewMindmapRoot");
  const btnExpand = $("btnOverviewMindmapExpandAll");
  const btnCollapse = $("btnOverviewMindmapCollapseAll");
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

/** 19 mục của tab "Hướng dẫn sử dụng" (chuyển thể từ user_manual.md) — cùng cơ
 *  chế "Mở tất cả"/"Thu gọn tất cả" như setupMindmap()/setupSampleMethods() ở trên,
 *  áp dụng cho khối #userGuideRoot. */
function setupUserGuideExpandCollapse() {
  const root = $("userGuideRoot");
  const btnExpand = $("btnGuideExpandAll");
  const btnCollapse = $("btnGuideCollapseAll");
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
