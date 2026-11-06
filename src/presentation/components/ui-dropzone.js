/* src/presentation/components/ui-dropzone.js — Điều khiển vùng kéo-thả (Drag & Drop) và tải file PDF/Ảnh. */

/** Gắn sự kiện kéo-thả (drag & drop) cho ô chọn BBTN (PDF) ở tab "DGA" — #bbtnDropzone */
function setupBbtnDropzone() {
  const zone = $("bbtnDropzone");
  const input = $("f_bbtn");
  if (!zone || !input) return;

  // Bàn phím: chính <input type="file"> phủ trong ô nhận focus và mở hộp chọn file (Enter/Space) — xem
  // enhanceDropzoneA11y() cuối file; viền focus hiện trên ô nhờ :focus-within (style-components.css).

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
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      const note = $("bbtnImportNote");
      note.textContent = `Chỉ nhận file PDF — "${file.name}" không phải PDF, vui lòng kéo-thả lại đúng file Biên bản thí nghiệm (PDF).`;
      note.classList.remove("hidden");
      return;
    }
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** Kéo-thả ẢNH CHỤP TẤM NHÃN THIẾT BỊ (nameplate) vào ô #nameplateDropzone */
function setupNameplateDropzone() {
  const zone = $("nameplateDropzone");
  const input = $("f_nameplate_file");
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
    const isImg = file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|bmp|tiff?)$/i.test(file.name);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isImg && !isPdf) {
      const note = $("nameplateNote");
      note.textContent = `Chỉ nhận file ảnh hoặc PDF — "${file.name}" không hợp lệ.`;
      note.classList.remove("hidden");
      return;
    }
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** Kéo-thả NHIỀU file cùng lúc cho panel "Nhập hàng loạt" (#batchDropzone) */
function setupBatchDropzone() {
  const zone = $("batchDropzone");
  if (!zone) return;

  // Bàn phím: <input type="file"> phủ trong ô nhận focus (xem enhanceDropzoneA11y() cuối file).

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
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    if (typeof handleBatchFileList === "function") {
      handleBatchFileList(files);
    }
  });
}

/**
 * Truy cập bàn phím / trình đọc màn hình cho MỌI ô kéo-thả (.file-dropzone) — gọi 1 lần lúc khởi động.
 * <input type="file"> phủ trong suốt lên cả ô (để bấm chuột / thả file đều trúng). Trước đây 4 ô còn được đánh dấu
 * role=button + tabindex=0 → mỗi ô 2 điểm dừng Tab, input không có nhãn, axe báo "nested-interactive" / "label".
 * Nay CHỈ input là control: nó nhận Tab, Enter/Space mở hộp chọn file (hành vi gốc của trình duyệt); tên truy cập
 * = đúng chữ hiển thị trong ô (aria-labelledby → .file-dropzone-text, tự đổi theo tên file đã chọn); viền focus
 * vẽ trên ô bằng :focus-within.
 */
function enhanceDropzoneA11y(zone) {
  const input = zone.querySelector('input[type="file"]');
  if (!input) return;
  const oldLabel = zone.getAttribute("aria-label");
  ["role", "tabindex", "aria-label"].forEach((a) => zone.removeAttribute(a));
  const text = zone.querySelector(".file-dropzone-text[id]");
  if (text) input.setAttribute("aria-labelledby", text.id);
  else if (oldLabel && !input.getAttribute("aria-label")) input.setAttribute("aria-label", oldLabel);
}

function enhanceAllDropzonesA11y() {
  document.querySelectorAll(".file-dropzone").forEach(enhanceDropzoneA11y);
}
