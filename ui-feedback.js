/* ui-feedback.js — Tab "Người dùng phản hồi": góp ý tự do (nội dung + 1 ảnh minh họa
   tùy chọn) cho ứng dụng, KHÁC hoàn toàn dữ liệu thí nghiệm (measurements/oil_tests...).
   Lưu qua Storage.listFeedback()/addFeedback()/deleteFeedback()/uploadFeedbackImage()
   (xem storage.js) — cùng 3 chế độ lưu trữ như mọi phần khác của app. Không có tính
   năng SỬA lại góp ý đã gửi (chỉ tạo mới + Admin xóa được, xem canWrite() ở ui-auth.js),
   nên file này đơn giản hơn ui-standards.js/ui-oil.js (không có luồng "đang sửa dở"). */

let _allFeedback = [];

/** Cập nhật nhãn #fbDropzoneText + class "has-file" theo file đang chọn ở #fb_image —
 *  cùng cơ chế với renderBbtnDropzoneLabel() (ui-dga.js), tách riêng vì khác id/tab. */
function renderFeedbackDropzoneLabel() {
  const zone = $("fbDropzone");
  const label = $("fbDropzoneText");
  if (!zone || !label) return;
  const file = $("fb_image").files && $("fb_image").files[0];
  if (file) {
    label.textContent = file.name;
    zone.classList.add("has-file");
  } else {
    label.innerHTML = 'Kéo thả ảnh vào đây, <span class="file-dropzone-link">bấm để chọn ảnh</span>, hoặc dán ảnh đã chụp/copy (Ctrl+V)';
    zone.classList.remove("has-file");
  }
}

/** Đọc file ảnh vừa chọn (#fb_image) thành data URL để xem trước ngay (#fbImagePreview*)
 *  — KHÔNG tải lên đâu cả ở bước này, chỉ tải lên thật khi bấm "Gửi góp ý" (xem
 *  onSubmitFeedback()), để tránh tốn băng thông/lưu rác nếu người dùng đổi ý. */
function onFeedbackImageSelected() {
  renderFeedbackDropzoneLabel();
  const file = $("fb_image").files && $("fb_image").files[0];
  if (!file) {
    $("fbImagePreviewWrap").classList.add("hidden");
    return;
  }
  if (!file.type || !file.type.startsWith("image/")) {
    alert(`"${file.name}" không phải file ảnh — vui lòng chọn lại (jpg, png, webp...).`);
    clearFeedbackImage();
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    $("fbImagePreviewImg").src = reader.result;
    $("fbImagePreviewName").textContent = file.name;
    $("fbImagePreviewWrap").classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

function clearFeedbackImage() {
  $("fb_image").value = "";
  $("fbImagePreviewWrap").classList.add("hidden");
  renderFeedbackDropzoneLabel();
}

function clearFeedbackForm() {
  $("fb_content").value = "";
  clearFeedbackImage();
}

/** Kéo-thả ảnh vào #fbDropzone — cùng cơ chế với setupBbtnDropzone() (app-core.js):
 *  gán file thả vào lại input thật bằng DataTransfer rồi tự bắn "change" để tái dùng
 *  đúng luồng xử lý ở onFeedbackImageSelected(), không viết trùng logic xem trước. */
function setupFeedbackDropzone() {
  const zone = $("fbDropzone");
  const input = $("fb_image");
  if (!zone || !input) return;

  ["dragenter", "dragover"].forEach((evt) => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add("dragover");
    });
  });
  ["dragleave", "dragend"].forEach((evt) => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove("dragover");
    });
  });
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove("dragover");
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** Cho phép DÁN ảnh (Ctrl+V) trực tiếp vào tab "Người dùng phản hồi" — tiện khi người
 *  dùng vừa chụp màn hình (PrintScreen/Snipping Tool...) xong, không cần lưu file ra
 *  đĩa rồi mới "bấm để chọn ảnh" như trước. Gắn sự kiện "paste" lên CẢ khung
 *  #tab-phanhoi (không chỉ riêng #fbDropzone) vì lúc dán, con trỏ thường đang ở trong ô
 *  "Ý kiến góp ý" (#fb_content) chứ không phải trong khung ảnh — nghe ở cấp cha để bắt
 *  được dù đang focus ở đâu trong tab này. Chỉ can thiệp (preventDefault + gán file) khi
 *  clipboard THẬT SỰ có ảnh; dán văn bản bình thường vào #fb_content không bị ảnh hưởng
 *  gì (clipboard lúc đó không có "item" kiểu file nên vòng lặp bên dưới bỏ qua). Cùng cơ
 *  chế tái dùng input thật qua DataTransfer như setupFeedbackDropzone() (kéo-thả). */
function setupFeedbackPaste() {
  const panel = $("tab-phanhoi");
  const input = $("fb_image");
  if (!panel || !input) return;
  panel.addEventListener("paste", (e) => {
    const items = (e.clipboardData || window.clipboardData || {}).items;
    if (!items) return;
    for (const item of items) {
      if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) continue;
      e.preventDefault();
      // Ảnh dán từ clipboard thường KHÔNG có tên file (hoặc tên chung chung "image.png")
      // — đặt lại tên kèm thời điểm dán để dễ phân biệt nếu người dùng lỡ dán nhiều lần.
      const ext = (file.type.split("/")[1] || "png").split("+")[0];
      const named = new File([file], `dan-anh-${Date.now()}.${ext}`, { type: file.type });
      const dt = new DataTransfer();
      dt.items.add(named);
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      break;
    }
  });
}

/** Gửi 1 góp ý mới: validate nội dung không rỗng → sinh id TRƯỚC (giống cách BBTN làm,
 *  xem uploadFeedbackImage() ở storage.js) → tải ảnh lên (nếu có chọn) → lưu bản ghi →
 *  hiện lời cảm ơn (showToast, xem ui-auth.js) → xóa trắng form → tải lại danh sách. */
async function onSubmitFeedback() {
  const content = $("fb_content").value.trim();
  if (!content) {
    alert("Vui lòng nhập ý kiến góp ý trước khi gửi.");
    $("fb_content").focus();
    return;
  }
  const btn = $("btnSubmitFeedback");
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Đang gửi...";
  try {
    const id = Storage.newId();
    const record = { id, content };
    const file = $("fb_image").files && $("fb_image").files[0];
    if (file) {
      const uploaded = await Storage.uploadFeedbackImage(id, file);
      Object.assign(record, uploaded);
    }
    await Storage.addFeedback(record);
    showToast("Cảm ơn anh/chị đã góp ý, admin sẽ tiếp thu và cập nhật sớm nhất!", "success");
    clearFeedbackForm();
    await refreshFeedbackUI();
  } catch (err) {
    alert(storageErrorMessage(err));
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

/** Nguồn ảnh hiển thị được cho 1 bản ghi góp ý — rec.image_url là link thật ở chế độ
 *  Google Sheets/Supabase, mở thẳng được; ở chế độ localStorage có dạng
 *  "local:<feedbackId>", phải tra lại qua Storage.getLocalAttachment() (cùng cơ chế với
 *  BBTN, xem viewBbtn() ở ui-dga.js) vì file thật nằm trong localStorage (base64), không
 *  phải URL. Trả về null nếu không có ảnh hoặc không tìm thấy (đã xóa/khác trình duyệt). */
function feedbackImageSrc(rec) {
  if (!rec.image_url) return null;
  const url = String(rec.image_url);
  if (!url.startsWith("local:")) return url;
  const local = Storage.getLocalAttachment(url.slice("local:".length));
  return local ? local.dataUrl : null;
}

function openFeedbackLightbox(src) {
  if (!src) return;
  $("fbLightboxImg").src = src;
  $("fbLightbox").classList.remove("hidden");
}

/** Lightbox phóng to ảnh minh họa góp ý (#fbLightbox) — cùng cơ chế đóng (nút ×, bấm ra
 *  ngoài ảnh, phím Escape) với setupSamplingLightbox()/setupHandbookLightbox() (ui-guides.js). */
function setupFeedbackLightbox() {
  const lightbox = $("fbLightbox");
  const closeBtn = $("btnCloseFbLightbox");
  const imgEl = $("fbLightboxImg");
  if (!lightbox || !closeBtn || !imgEl) return;
  const close = () => {
    lightbox.classList.add("hidden");
    imgEl.src = "";
  };
  closeBtn.addEventListener("click", close);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !lightbox.classList.contains("hidden")) close();
  });
}

/** Vẽ lại toàn bộ danh sách góp ý (#feedbackList) từ _allFeedback — mới nhất lên đầu
 *  (Storage.listFeedback() trả về theo thứ tự tạo, cũ→mới, giống mọi list* khác trong
 *  app, nên đảo lại ở đây cho hợp lý với 1 "bảng tin" góp ý). Nút "Xóa" chỉ hiện với
 *  Admin (canWrite(), xem ui-auth.js) — góp ý không có khái niệm "chủ bản ghi" như
 *  measurements nên không dùng canEditRecord()/isOwnRecord(). */
function renderFeedbackList() {
  const wrap = $("feedbackList");
  const empty = $("feedbackEmpty");
  wrap.innerHTML = "";
  const items = _allFeedback.slice().reverse();
  empty.classList.toggle("hidden", items.length > 0);
  items.forEach((rec) => {
    const imgSrc = feedbackImageSrc(rec);
    const dateStr = rec.created_at ? new Date(rec.created_at).toLocaleString("vi-VN") : "";
    const who = rec.created_by ? String(rec.created_by) : "Ẩn danh";
    const card = document.createElement("div");
    card.className = "feedback-card";
    card.innerHTML = `
      ${imgSrc ? `<img class="feedback-card-thumb" src="${imgSrc}" alt="Ảnh minh họa góp ý" data-action="zoom" />` : ""}
      <div class="feedback-card-body">
        <div class="feedback-card-meta">
          <span>${escapeHtml(who)}</span>
          <span>·</span>
          <span>${escapeHtml(dateStr)}</span>
        </div>
        <p class="feedback-card-content">${escapeHtml(rec.content || "")}</p>
        ${canWrite() ? `<div class="feedback-card-actions"><button type="button" class="btn danger" data-action="del">Xóa</button></div>` : ""}
      </div>
    `;
    const thumb = card.querySelector('[data-action="zoom"]');
    if (thumb) thumb.addEventListener("click", () => openFeedbackLightbox(imgSrc));
    const delBtn = card.querySelector('[data-action="del"]');
    if (delBtn) {
      delBtn.addEventListener("click", async () => {
        if (!confirm("Xóa góp ý này? Không thể hoàn tác.")) return;
        try {
          await Storage.deleteFeedback(rec.id);
          await refreshFeedbackUI();
        } catch (err) {
          alert(storageErrorMessage(err));
        }
      });
    }
    wrap.appendChild(card);
  });
}

async function refreshFeedbackUI() {
  _allFeedback = await Storage.listFeedback();
  renderFeedbackList();
}
