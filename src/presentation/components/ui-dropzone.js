/* src/presentation/components/ui-dropzone.js — Điều khiển vùng kéo-thả (Drag & Drop) và tải file PDF/Ảnh. */

/** Gắn sự kiện kéo-thả (drag & drop) cho ô chọn BBTN (PDF) ở tab "DGA" — #bbtnDropzone */
function setupBbtnDropzone() {
  const zone = $("bbtnDropzone");
  const input = $("f_bbtn");
  if (!zone || !input) return;

  zone.setAttribute("tabindex", "0");
  zone.setAttribute("role", "button");
  zone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });
  zone.addEventListener("focus", () => zone.classList.add("is-focused"));
  zone.addEventListener("blur", () => zone.classList.remove("is-focused"));

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
  const input = $("batchFiles");
  if (!zone) return;

  zone.setAttribute("tabindex", "0");
  zone.setAttribute("role", "button");
  if (input) {
    zone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        input.click();
      }
    });
  }
  zone.addEventListener("focus", () => zone.classList.add("is-focused"));
  zone.addEventListener("blur", () => zone.classList.remove("is-focused"));

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
