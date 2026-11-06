# Đề xuất kiến trúc 3 lớp (Bước 2 — CHỈ ĐỀ XUẤT, chưa di chuyển file)

> Trạng thái: **chờ chủ dự án duyệt**. Sau khi duyệt (kèm chỉnh sửa nếu có), Bước 3 di chuyển file đúng theo
> bảng ánh xạ ở mục 6. Bản đồ phụ thuộc ở mục 2 sinh tự động bằng trình phân tích cú pháp (espree + eslint-scope —
> có sẵn trong `node_modules` của ESLint), không phải khớp chuỗi: một file "dùng" file khác khi nó tham chiếu một
> tên toàn cục (hàm/biến cấp cao nhất, hoặc `window.X =`) mà file kia khai báo.

## 0. Tóm tắt

- Cây thư mục theo hướng của `REFACTOR_PLAN.md`, **điều chỉnh 4 điểm** (lý do ở mục 3.1):
  1. `src/domain/` để **phẳng** (11 file), không chia `dga/ oil/ regulation/`;
  2. `src/presentation/tabs/` để **phẳng**, giữ nguyên tên file `ui-*.js`;
  3. `scripts/serve.js` (máy chủ chạy app on-premise, không phải công cụ phát triển) chuyển về `backend/onpremise/`;
  4. `supabase/supabase-schema.sql` (bản **cũ**, thiếu cột) bị bỏ, giữ bản ở gốc làm bản chuẩn trong `backend/supabase/`.
- Ranh giới lớp hiện tại **khá sạch**:
  - `domain` không gọi lớp nào phía trên (chỉ có `window.DGA = DGA` để xuất API — ngoại lệ hợp lệ);
  - `data → presentation` chỉ có **14 tham chiếu, tất cả trong `bbtn/`** (mục 5).
- Phần lớn khớp nối nằm **bên trong lớp giao diện** (2.228 tham chiếu). Điểm nóng: `ui/ui-auth.js` vừa là màn hình
  đăng nhập vừa chứa tiện ích dùng chung (`$`, `showToast`, `canWrite`, `canSaveEntry`) được **24 file** gọi. Việc này
  để Bước 4.
- Bước 3 gồm **6 commit** (domain → data → presentation → styles → backend → assets), tổng 117 file. Mỗi commit sửa
  kèm 3–8 nơi tham chiếu (mục 7).

## 1. Cơ chế nạp hiện tại (ràng buộc phải giữ)

- **Không có bước build.** `index.html` nạp 62 thẻ `<script>` theo thứ tự cố định (5 thư viện `vendor/` + 57 file của
  dự án). Các file cổ điển dùng **chung global scope**: hàm/biến cấp cao nhất của file trước là "API" cho file sau.
  `tests/load-order.test.js` chặn trùng tên cấp cao nhất.
- **Ngoại lệ 1 — 2 ES module:** `bbtn/bbtn-import.js` và `bbtn/nameplate-import.js` nạp bằng `type="module"` (vì
  `import` pdf.js / Tesseract), xuất API qua `window.BbtnImport` / `window.NameplateImport`. Hai file này dùng đường dẫn
  tương đối `../vendor/...` và `new URL("../vendor/...", import.meta.url)`, nên **phải sửa đường dẫn khi đổi chỗ**.
- **Ngoại lệ 2 — facade UMD `dga-logic.js`:**
  - Trong trình duyệt: gom 10 file `logic/*.js` thành `window.DGA`.
  - Trong Node: tự đọc lại 10 file đó bằng `vm` theo danh sách `LOGIC_FILES` và `LOGIC_DIR = path.join(__dirname, "logic")`.
  - 10 file test `require("../dga-logic")`.
- **`mobile/dga-logic.js`** do `scripts/sync-mobile.js` sinh ra. Script lấy thứ tự file logic từ `index.html` bằng
  regex `logic\/dga-logic-[\w-]+|dga-logic`, nên phải sửa regex khi đổi chỗ.
- **Phạm vi Service Worker** = thư mục chứa `sw.js` → `sw.js`, `index.html` phải ở gốc. `config.js` ở gốc vì README
  hướng dẫn người dùng sửa trực tiếp file này.
- **Thứ tự nạp theo lớp đã đúng chiều:**
  - `config.js` → `ui-errors.js` → `logic/*` → `dga-logic.js` → `storage/*` → `storage.js` → các `ui-*` và `bbtn/*` → `app-core.js`.
  - Riêng `bbtn/bbtn-import.js` và `bbtn/nameplate-import.js` nạp sớm (trước `config.js`). Là module nên chúng chạy
    *sau* khi tài liệu được phân tích xong; vẫn đúng.

## 2. Bản đồ phụ thuộc hiện tại

### 2.1. Ma trận theo lớp (số lần tham chiếu tên toàn cục của lớp khác)

Phân lớp hiện tại để đếm: **domain** = `logic/*`, `dga-logic.js` · **data** = `storage/*`, `storage.js`, `bbtn/*`,
`config.js` · **presentation** = `ui/*`, `app-core.js`, `early-layout.js`.

| Từ \ Tới | domain | data | presentation |
|---|---|---|---|
| **domain** | 377 | 0 | 0 |
| **data** | 19 | 486 | **14** ⚠ |
| **presentation** | 284 | 487 | 2.228 |

→ Chiều phụ thuộc đã gần đúng `presentation → data → domain`. Chỉ có 14 tham chiếu ngược `data → presentation`.

### 2.2. Tên toàn cục được dùng rộng nhất (số file dùng)

| Tên | Định nghĩa ở | Số file dùng | Ghi chú |
|---|---|---|---|
| `$` | `ui/ui-auth.js` | 24 | tiện ích DOM `getElementById` — nên ở `components/` |
| `DGA` | `dga-logic.js` | 20 | API domain — đúng thiết kế |
| `escapeHtml` | `ui/ui-utils.js` | 17 | |
| `notifyError` | `ui/ui-errors.js` | 16 | |
| `showToast` | `ui/ui-auth.js` | 15 | nên ở `components/` |
| `Storage` | `storage.js` | 15 | API data — đúng thiết kế |
| `storageErrorMessage` | `storage/storage-core.js` | 11 | |
| `_allStandards` | `ui/ui-standards.js` | 10 | **trạng thái** dùng chung qua biến toàn cục (kể cả `bbtn/bbtn-import.js`) |
| `_allMeasurements` | `ui/ui-history.js` | 8 | trạng thái dùng chung |
| `canWrite`, `canSaveEntry` | `ui/ui-auth.js` | 8, 7 | quyền — nên tách khỏi màn hình đăng nhập |

### 2.3. Từng file (theo thứ tự nạp trong `index.html`)

Cột "Dùng tên toàn cục của": tên file bỏ thư mục và `.js`; số trong ngoặc = số lần tham chiếu.

| File | Lớp hiện tại | Dòng | Dùng tên toàn cục của (số lần tham chiếu) | Số file dùng nó |
|---|---|---|---|---|
| `early-layout.js` | presentation | 29 | — | 0 |
| `bbtn/bbtn-import.js` | data | 776 | dga-logic(12), ui-standards(8) | 6 |
| `bbtn/nameplate-import.js` | data | 185 | — | 1 |
| `config.js` | data | 57 | — | 2 |
| `ui/ui-errors.js` | presentation | 129 | ui-auth(4) | 16 |
| `logic/dga-logic-core.js` | domain | 436 | — | 9 |
| `logic/dga-logic-gas.js` | domain | 958 | dga-logic-core(86) | 1 |
| `logic/dga-logic-oil.js` | domain | 156 | dga-logic-core(21), dga-logic-oil-extended(6) | 2 |
| `logic/dga-logic-instrument-oil.js` | domain | 140 | dga-logic-core(11) | 3 |
| `logic/dga-logic-iec60422-2024.js` | domain | 222 | dga-logic-core(13), dga-logic-instrument-oil(6), dga-logic-oil-extended(4) | 3 |
| `logic/dga-logic-oil-extended.js` | domain | 478 | dga-logic-core(34), dga-logic-iec60422-2024(3), dga-logic-oil(2), dga-logic-instrument-oil(1) | 4 |
| `logic/dga-logic-forecast.js` | domain | 213 | — | 1 |
| `logic/dga-logic-regulation-config.js` | domain | 690 | dga-logic-core(35), dga-logic-oil-extended(13), dga-logic-iec60422-2024(2) | 1 |
| `logic/dga-logic-peer.js` | domain | 308 | dga-logic-core(4) | 1 |
| `logic/dga-logic-case.js` | domain | 95 | dga-logic-core(2) | 1 |
| `dga-logic.js` | domain | 163 | dga-logic-core(38), dga-logic-gas(35), dga-logic-oil-extended(25), dga-logic-regulation-config(10), dga-logic-iec60422-2024(8), dga-logic-peer(6), dga-logic-forecast(5), dga-logic-oil(3), dga-logic-case(3), dga-logic-instrument-oil(1) | 20 |
| `storage/storage-core.js` | data | 211 | config(13), storage(12), storage-offline(2) | 16 |
| `storage/storage-remote.js` | data | 54 | storage-core(10) | 3 |
| `storage/storage-local.js` | data | 54 | — | 1 |
| `storage/storage-offline.js` | data | 168 | storage-core(21), storage-remote(18), storage(4) | 2 |
| `storage/storage-auth.js` | data | 183 | storage-remote(14), storage-core(9), storage(1) | 5 |
| `storage.js` | data | 1172 | storage-core(194), storage-offline(79), storage-local(77), storage-remote(26), storage-auth(6) | 18 |
| `ui/ui-auth.js` | presentation | 416 | storage-auth(74), storage(37), ui-utils(3), app-core(3), storage-core(2), config(2), ui-busy(1), ui-theme(1) | 25 |
| `ui/ui-utils.js` | presentation | 144 | ui-errors(3), ui-auth(2), dga-logic(1), ui-standards(1) | 17 |
| `ui/ui-terms.js` | presentation | 110 | dga-logic(9) | 3 |
| `ui/ui-combobox.js` | presentation | 109 | ui-utils(1) | 2 |
| `ui/ui-dropzone.js` | presentation | 139 | ui-auth(8), ui-batch-import(2) | 1 |
| `ui/ui-layout.js` | presentation | 156 | ui-auth(11), ui-alerts(2), ui-regulation-config(2) | 1 |
| `ui/ui-busy.js` | presentation | 83 | storage(7), ui-auth(2), storage-auth(2) | 1 |
| `ui/ui-theme.js` | presentation | 43 | ui-auth(3) | 1 |
| `ui/ui-guides.js` | presentation | 164 | ui-auth(20) | 1 |
| `ui/ui-dieu54-charts.js` | presentation | 576 | ui-dga(3), dga-logic(2) | 0 |
| `ui/ui-dga-workflow.js` | presentation | 171 | — | 0 |
| `ui/ui-dga.js` | presentation | 1527 | ui-auth(299), dga-logic(72), ui-utils(27), ui-errors(15), ui-standards(14), storage(12), ui-input-subtabs(8), bbtn-import(8), app-core(3), ui-device-specs(2), ui-history(2), storage-core(2), bbtn-export(2), nameplate-import(2), tech-report-export(1) | 9 |
| `bbtn/bbtn-export.js` | data | 177 | dga-logic(4), ui-terms(2) | 1 |
| `bbtn/mba-oil-bbtn.js` | data | 468 | — | 3 |
| `bbtn/mba-oil-bbtn-export.js` | data | 211 | ui-terms(2) | 1 |
| `bbtn/device-specs.js` | data | 110 | — | 1 |
| `bbtn/oil-bbtn.js` | data | 352 | — | 2 |
| `bbtn/tech-report-export.js` | data | 143 | dga-logic(3), ui-terms(2) | 1 |
| `ui/ui-batch-import.js` | presentation | 407 | ui-auth(35), storage(10), bbtn-import(5), ui-errors(4), ui-history(4), dga-logic(4), ui-utils(3), ui-standards(1), ui-dga(1) | 3 |
| `ui/ui-standards.js` | presentation | 526 | ui-auth(88), dga-logic(18), storage(14), ui-utils(6), ui-errors(6), storage-core(2), ui-ti-oil-3pha(1) | 14 |
| `ui/ui-regulation-config.js` | presentation | 371 | ui-utils(19), dga-logic(17), ui-auth(11), ui-errors(7), storage(6), storage-core(2) | 2 |
| `ui/ui-admin.js` | presentation | 205 | ui-auth(28), storage-auth(18), storage(9), ui-utils(8), ui-errors(5), storage-core(2) | 1 |
| `ui/ui-oil.js` | presentation | 797 | ui-auth(148), ui-utils(35), dga-logic(28), mba-oil-bbtn(14), storage(12), ui-input-subtabs(10), ui-oltc(9), ui-history(7), ui-standards(7), ui-errors(5), ui-oil-bbtn-export(4), storage-core(3), ui-dga(3), ui-ti-oil(3), bbtn-import(3), ui-oil-batch-import(2), ui-device-specs(2), app-core(1), ui-trend(1), ui-alerts(1) | 8 |
| `ui/ui-oltc.js` | presentation | 364 | ui-auth(77), ui-oil(21), dga-logic(20), ui-utils(19), ui-standards(8), ui-input-subtabs(8), storage(8), ui-history(7), ui-errors(5), storage-core(3), ui-dga(3), ui-oil-bbtn-export(2), ui-oil-batch-import(2), app-core(1), ui-trend(1), ui-alerts(1) | 8 |
| `ui/ui-oil-bbtn-export.js` | presentation | 199 | ui-auth(23), dga-logic(8), mba-oil-bbtn-export(8), ui-oil(4), ui-utils(4), ui-errors(3), ui-history(2) | 4 |
| `ui/ui-oil-batch-import.js` | presentation | 449 | ui-auth(57), ui-ti-oil-3pha(13), ui-utils(10), ui-oil(10), ui-oltc(9), oil-bbtn(9), mba-oil-bbtn(4), bbtn-import(3), ui-errors(2), ui-input-subtabs(2), storage(2), ui-oil-bbtn-export(2), ui-standards(2), ui-batch-import(1), dga-logic(1), ui-ti-oil(1) | 3 |
| `ui/ui-ti-oil.js` | presentation | 297 | ui-auth(60), ui-utils(19), dga-logic(12), ui-input-subtabs(8), ui-standards(7), storage(6), ui-errors(5), ui-ti-oil-3pha(2), storage-core(2), ui-dga(2), ui-history(2), app-core(1), ui-alerts(1) | 8 |
| `ui/ui-ti-oil-3pha.js` | presentation | 518 | ui-auth(84), oil-bbtn(26), ui-input-subtabs(8), ui-ti-oil(8), ui-errors(7), ui-standards(6), ui-utils(6), storage(6), dga-logic(3), bbtn-import(3), storage-core(2), app-core(1), ui-combobox(1) | 4 |
| `ui/ui-history.js` | presentation | 519 | ui-auth(45), dga-logic(27), ui-utils(15), ui-dga(9), ui-errors(9), storage(8), ui-standards(7), ui-ti-oil(4), ui-input-subtabs(2), storage-core(2), ui-trend(1), ui-alerts(1), app-core(1), ui-oil(1), ui-oltc(1) | 11 |
| `ui/ui-input-subtabs.js` | presentation | 164 | ui-auth(23), ui-history(5), ui-device-specs(4), ui-ti-oil(4), ui-oil(2), ui-oltc(2) | 9 |
| `ui/ui-device-specs.js` | presentation | 355 | ui-auth(44), device-specs(12), mba-oil-bbtn(8), ui-oil(6), ui-history(6), ui-input-subtabs(4), app-core(2), ui-oltc(2), ui-standards(2), ui-ti-oil(2), ui-dga(2) | 4 |
| `ui/ui-trend.js` | presentation | 688 | ui-auth(37), ui-utils(21), dga-logic(17), ui-history(9), ui-standards(4), ui-oltc(1) | 5 |
| `ui/ui-alerts.js` | presentation | 904 | dga-logic(31), ui-auth(28), ui-utils(21), ui-dga(12), ui-history(11), ui-standards(10), ui-ti-oil(9), ui-trend(9), ui-oil(4), ui-oltc(4), ui-errors(2) | 6 |
| `ui/ui-feedback.js` | presentation | 254 | ui-auth(31), storage(12), ui-utils(5), ui-errors(4), storage-core(2) | 1 |
| `app-core.js` | presentation | 1006 | ui-auth(184), storage(67), storage-auth(38), ui-history(33), ui-standards(19), ui-combobox(18), ui-dga(16), dga-logic(14), ui-alerts(13), ui-oltc(11), ui-oil(10), ui-layout(9), ui-ti-oil(9), ui-feedback(7), ui-trend(7), ui-guides(6), ui-batch-import(6), storage-core(3), ui-admin(3), ui-dropzone(3), ui-input-subtabs(2), ui-device-specs(2), ui-oil-batch-import(2), ui-oil-bbtn-export(2), bbtn-import(2), ui-regulation-config(1), ui-errors(1), ui-ti-oil-3pha(1) | 8 |

## 3. Cây thư mục đề xuất

```text
dga-webapp/
├─ index.html, manifest.webmanifest, sw.js      # bắt buộc ở gốc (Pages + phạm vi Service Worker)
├─ config.js                                    # ở gốc: người dùng sửa trực tiếp (README mục 2)
├─ types.d.ts, tsconfig.json, package.json, eslint.config.mjs, …   # cấu hình phát triển (giữ nguyên chỗ)
├─ src/
│  ├─ domain/                 # LỚP NGHIỆP VỤ — thuần JS: KHÔNG DOM, KHÔNG storage, KHÔNG fetch
│  │  ├─ dga-logic-core.js    #   hub: hằng số, bảng ngưỡng QĐ1901/IEC dùng chung (9 file phụ thuộc)
│  │  ├─ dga-logic-gas.js, -oil.js, -instrument-oil.js, -iec60422-2024.js, -oil-extended.js,
│  │  │  -forecast.js, -regulation-config.js, -peer.js, -case.js
│  │  └─ dga-logic.js         #   facade → window.DGA / module.exports (đặt CÙNG thư mục với các file logic)
│  ├─ data/                   # LỚP DỮ LIỆU — truy cập, đồng bộ, đọc/ghi định dạng file: KHÔNG chạm DOM trang
│  │  ├─ storage.js           #   facade window.Storage (giữ nguyên API)
│  │  ├─ drivers/             #   storage-core, -remote (GSheet/on-premise), -local, -offline (hàng đợi), -auth (window.Auth)
│  │  └─ io/                  #   bbtn/*: đọc BBTN PDF/DOCX (pdf.js, Tesseract), xuất DOCX (docxtemplater)
│  └─ presentation/           # LỚP GIAO DIỆN
│     ├─ early-layout.js, app-core.js
│     ├─ components/          #   dùng chung, không gắn 1 tab: ui-errors, ui-utils, ui-terms, ui-combobox,
│     │                       #   ui-dropzone, ui-busy, ui-theme, ui-layout, ui-input-subtabs
│     ├─ tabs/                #   theo tab/tính năng: ui-auth, ui-dga, ui-dga-workflow, ui-dieu54-charts,
│     │                       #   ui-batch-import, ui-device-specs, ui-oil, ui-oltc, ui-oil-bbtn-export,
│     │                       #   ui-oil-batch-import, ui-ti-oil, ui-ti-oil-3pha, ui-history, ui-trend, ui-alerts,
│     │                       #   ui-standards, ui-regulation-config, ui-admin, ui-feedback, ui-guides
│     └─ styles/              #   css/* (Bước 5 thêm tokens.css nạp đầu tiên)
├─ backend/
│  ├─ onpremise/              # server/api.js, auth.js, db.js, uploads.js + serve.js (từ scripts/)
│  ├─ gsheet/                 # Code.gs
│  └─ supabase/               # supabase-schema.sql (bản ở gốc), lockdown-anon.sql, mirror-setup.sql
├─ assets/
│  ├─ image/                  # ảnh .webp, favicon, icon
│  └─ template/               # template-*.docx (app tải bằng fetch), mau-goc-*.docx, BBTN thật (không commit)
├─ vendor/                    # thư viện bên thứ ba — giữ nguyên
├─ mobile/                    # bản di động — mobile/dga-logic.js SINH TỰ ĐỘNG
├─ data/                      # dữ liệu on-premise — KHÔNG commit, KHÔNG deploy
├─ scripts/                   # công cụ phát triển: build-guide, sync-mobile, build-pages-site, dedupe-uploads, …
├─ tests/
└─ docs/
```

### 3.1. Các điểm điều chỉnh so với hướng trong `REFACTOR_PLAN.md`

| # | Đề xuất của kế hoạch | Điều chỉnh | Lý do |
|---|---|---|---|
| 1 | `src/domain/{dga,oil,regulation}/` | `src/domain/` **phẳng** | Chỉ có 11 file, tên đã có tiền tố theo miền. Thứ tự nạp đang mã hóa ở **3 nơi** (`index.html`, `LOGIC_FILES` trong `dga-logic.js`, regex của `sync-mobile.js`); thêm thư mục con làm 3 nơi đó phức tạp hơn. Ranh giới giữa các nhóm cũng không sạch: `oil-extended` dùng `iec60422`, `regulation-config` dùng `oil-extended` (mục 2.3), và mọi file đều dùng `core`. Nếu sau này domain lớn hơn thì chia vẫn dễ. |
| 2 | `tabs/` "1 file/1 tab" | `tabs/` **phẳng**, giữ tên `ui-*.js` | Một tab đang gồm nhiều file (VD tab Lý-Hóa dầu: `ui-oil`, `ui-oltc`, `ui-ti-oil`, `ui-ti-oil-3pha`, `ui-oil-bbtn-export`, `ui-oil-batch-import`). Gộp file là sửa nội dung, để Bước 4. Không đổi tên file nên chỉ đổi đường dẫn, lịch sử git rõ ràng. |
| 3 | `scripts/` giữ `serve.js` | `serve.js` → `backend/onpremise/` | `serve.js` là **máy chủ chạy app** cho người dùng (`npm start`, `chay_dga_offline.bat`), cùng nhóm với `api.js`/`db.js`. `scripts/` chỉ còn công cụ phát triển. |
| 4 | `backend/supabase/*.sql` | bỏ `supabase/supabase-schema.sql` | Có **2 bản** `supabase-schema.sql`: bản ở gốc (499 dòng) là bản mới, được `tests/schema-consistency.test.js` kiểm tra và README dẫn tới. Bản trong `supabase/` (460 dòng) thiếu các cột tgδ 20°C, U.H.V, thông số thiết bị. Giữ 2 bản dễ chạy nhầm bản cũ. |

Các phần khác giữ đúng kế hoạch: `config.js` ở gốc; `bbtn/*` thuộc `src/data/io/` (adapter định dạng file);
`css/` thuộc `src/presentation/styles/`; `image/` và `template/` vào `assets/`.

## 4. Quy tắc phụ thuộc giữa các lớp

```text
presentation ──► data ──► domain
     └─────────────────────►┘      (presentation được gọi domain trực tiếp để tính toán)
```

| Lớp | Được dùng | KHÔNG được dùng |
|---|---|---|
| `src/domain/` | chỉ tên của `src/domain/` + JS chuẩn (`Math`, `Date`, …) | `document`, `window` (trừ `window.DGA = DGA` trong facade), `localStorage`, `sessionStorage`, `fetch`, `gsheetGet`/`gsheetPost`, `sb()`, `alert`/`confirm`, mọi tên của `data/`/`presentation/` |
| `src/data/` | `src/domain/`, `config.js`, `vendor/`, API trình duyệt **không phải DOM trang**: `fetch`, `localStorage`, `navigator.onLine`, `Blob`, `URL`, `FileReader`, `<canvas>` ngoài trang để OCR | `document.getElementById`/`querySelector`, gắn phần tử vào trang (`document.body.appendChild`), `showToast`, `notifyError`, `$`, `alert`/`confirm`, mọi tên của `presentation/`. Báo lỗi bằng `throw` hoặc sự kiện (`dispatchEvent`). |
| `src/presentation/` | tất cả | — |

Bước 3 sẽ thêm `tests/architecture.test.js` (quét AST như mục 2, không dùng grep để tránh báo nhầm trong chú thích),
cộng quy tắc `no-restricted-globals`/`no-restricted-properties` theo thư mục trong `eslint.config.mjs`. Các vi phạm ở
mục 5 vào **danh sách ngoại lệ có ghi chú**, gỡ ở Bước 4.

## 5. Vi phạm hiện có (10 chỗ, tất cả ở `bbtn/` và facade)

| # | File (lớp đề xuất) | Vi phạm | Chi tiết | Hướng xử lý ở Bước 4 |
|---|---|---|---|---|
| V1 | `bbtn/bbtn-import.js` (data/io) | gọi presentation | `_allStandards`, `toManufacturerStandardsForLogic` (`ui/ui-standards.js`) — dòng 306–307, đọc trạng thái tiêu chuẩn NSX qua biến toàn cục | Bên gọi (presentation) truyền danh sách tiêu chuẩn vào làm tham số; `toManufacturerStandardsForLogic` (hàm thuần) chuyển sang `src/data/` hoặc `DGA` |
| V2 | `bbtn/bbtn-export.js` (data/io) | gọi presentation | `applyRegulationTermsDeep` (`ui/ui-terms.js`) | `applyRegulationTermsDeep` là **hàm thuần** chỉ dựa trên `DGA.regulationTermsActive()`/`DGA.applyRegulationTerms()` → chuyển vào domain (`DGA.applyRegulationTermsDeep`). Mobile được tự cập nhật qua `sync-mobile`. |
| V3 | `bbtn/mba-oil-bbtn-export.js` (data/io) | gọi presentation | như V2 | như V2 |
| V4 | `bbtn/tech-report-export.js` (data/io) | gọi presentation | như V2 | như V2 |
| V5 | `bbtn/bbtn-export.js` (data/io) | chạm DOM trang | dòng 164–167: tạo `<a>`, `document.body.appendChild`, `click()` để tải file | Hàm xuất trả về `Blob` + tên file; việc "tải xuống" (DOM) chuyển sang 1 tiện ích ở `components/` |
| V6 | `bbtn/mba-oil-bbtn-export.js` (data/io) | chạm DOM trang | dòng 194–197, như V5 | như V5 |
| V7 | `bbtn/tech-report-export.js` (data/io) | chạm DOM trang | dòng 132–135, như V5 | như V5 |
| V8 | `bbtn/bbtn-import.js` (data/io) | `document.createElement("canvas")` | dòng 94: canvas **ngoài trang** để render trang PDF cho OCR | **Cho phép** (ngoại lệ đã ghi ở mục 4) — không chạm DOM trang. Có thể đổi sang `OffscreenCanvas` nếu muốn bỏ hẳn `document`. |
| V9 | `bbtn/nameplate-import.js` (data/io) | như V8 | dòng 50 | như V8 |
| V10 | `dga-logic.js` (domain) | `window` | dòng 119, 161: `typeof window` + `window.DGA = DGA` | **Cho phép** — chỉ để xuất API (UMD) |

**Khớp nối cần dọn trong lớp giao diện** (không vi phạm quy tắc 3 lớp, nhưng làm khó Bước 4):
- `ui/ui-auth.js` chứa tiện ích dùng chung `$`, `showToast`, `canWrite`, `canSaveEntry`, được 24 file gọi. Đề xuất
  tách sang `components/` (VD `ui-dom.js`, `ui-permissions.js`), nạp trước các tab.
- Trạng thái dùng chung qua biến toàn cục: `_allStandards` (10 file), `_allMeasurements` (8 file).
- `ui/ui-utils.js` (tiện ích chung) lại gọi ngược `ui/ui-standards.js` (1 chỗ) và `ui/ui-auth.js`.

## 6. Ánh xạ đường dẫn cũ → mới (117 file được git theo dõi)

Không đổi tên file, chỉ đổi thư mục. File chưa được git theo dõi trong `template/` (5 BBTN thật, không commit) chuyển bằng
`mv` thường cùng commit 6.

#### Commit 1 — domain (11 file)

| Cũ | Mới |
|---|---|
| `dga-logic.js` | `src/domain/dga-logic.js` |
| `logic/dga-logic-case.js` | `src/domain/dga-logic-case.js` |
| `logic/dga-logic-core.js` | `src/domain/dga-logic-core.js` |
| `logic/dga-logic-forecast.js` | `src/domain/dga-logic-forecast.js` |
| `logic/dga-logic-gas.js` | `src/domain/dga-logic-gas.js` |
| `logic/dga-logic-iec60422-2024.js` | `src/domain/dga-logic-iec60422-2024.js` |
| `logic/dga-logic-instrument-oil.js` | `src/domain/dga-logic-instrument-oil.js` |
| `logic/dga-logic-oil-extended.js` | `src/domain/dga-logic-oil-extended.js` |
| `logic/dga-logic-oil.js` | `src/domain/dga-logic-oil.js` |
| `logic/dga-logic-peer.js` | `src/domain/dga-logic-peer.js` |
| `logic/dga-logic-regulation-config.js` | `src/domain/dga-logic-regulation-config.js` |

#### Commit 2 — data (14 file)

| Cũ | Mới |
|---|---|
| `bbtn/bbtn-export.js` | `src/data/io/bbtn-export.js` |
| `bbtn/bbtn-import.js` | `src/data/io/bbtn-import.js` |
| `bbtn/device-specs.js` | `src/data/io/device-specs.js` |
| `bbtn/mba-oil-bbtn-export.js` | `src/data/io/mba-oil-bbtn-export.js` |
| `bbtn/mba-oil-bbtn.js` | `src/data/io/mba-oil-bbtn.js` |
| `bbtn/nameplate-import.js` | `src/data/io/nameplate-import.js` |
| `bbtn/oil-bbtn.js` | `src/data/io/oil-bbtn.js` |
| `bbtn/tech-report-export.js` | `src/data/io/tech-report-export.js` |
| `storage.js` | `src/data/storage.js` |
| `storage/storage-auth.js` | `src/data/drivers/storage-auth.js` |
| `storage/storage-core.js` | `src/data/drivers/storage-core.js` |
| `storage/storage-local.js` | `src/data/drivers/storage-local.js` |
| `storage/storage-offline.js` | `src/data/drivers/storage-offline.js` |
| `storage/storage-remote.js` | `src/data/drivers/storage-remote.js` |

#### Commit 3 — presentation (31 file)

| Cũ | Mới |
|---|---|
| `app-core.js` | `src/presentation/app-core.js` |
| `early-layout.js` | `src/presentation/early-layout.js` |
| `ui/ui-admin.js` | `src/presentation/tabs/ui-admin.js` |
| `ui/ui-alerts.js` | `src/presentation/tabs/ui-alerts.js` |
| `ui/ui-auth.js` | `src/presentation/tabs/ui-auth.js` |
| `ui/ui-batch-import.js` | `src/presentation/tabs/ui-batch-import.js` |
| `ui/ui-busy.js` | `src/presentation/components/ui-busy.js` |
| `ui/ui-combobox.js` | `src/presentation/components/ui-combobox.js` |
| `ui/ui-device-specs.js` | `src/presentation/tabs/ui-device-specs.js` |
| `ui/ui-dga-workflow.js` | `src/presentation/tabs/ui-dga-workflow.js` |
| `ui/ui-dga.js` | `src/presentation/tabs/ui-dga.js` |
| `ui/ui-dieu54-charts.js` | `src/presentation/tabs/ui-dieu54-charts.js` |
| `ui/ui-dropzone.js` | `src/presentation/components/ui-dropzone.js` |
| `ui/ui-errors.js` | `src/presentation/components/ui-errors.js` |
| `ui/ui-feedback.js` | `src/presentation/tabs/ui-feedback.js` |
| `ui/ui-guides.js` | `src/presentation/tabs/ui-guides.js` |
| `ui/ui-history.js` | `src/presentation/tabs/ui-history.js` |
| `ui/ui-input-subtabs.js` | `src/presentation/components/ui-input-subtabs.js` |
| `ui/ui-layout.js` | `src/presentation/components/ui-layout.js` |
| `ui/ui-oil-batch-import.js` | `src/presentation/tabs/ui-oil-batch-import.js` |
| `ui/ui-oil-bbtn-export.js` | `src/presentation/tabs/ui-oil-bbtn-export.js` |
| `ui/ui-oil.js` | `src/presentation/tabs/ui-oil.js` |
| `ui/ui-oltc.js` | `src/presentation/tabs/ui-oltc.js` |
| `ui/ui-regulation-config.js` | `src/presentation/tabs/ui-regulation-config.js` |
| `ui/ui-standards.js` | `src/presentation/tabs/ui-standards.js` |
| `ui/ui-terms.js` | `src/presentation/components/ui-terms.js` |
| `ui/ui-theme.js` | `src/presentation/components/ui-theme.js` |
| `ui/ui-ti-oil-3pha.js` | `src/presentation/tabs/ui-ti-oil-3pha.js` |
| `ui/ui-ti-oil.js` | `src/presentation/tabs/ui-ti-oil.js` |
| `ui/ui-trend.js` | `src/presentation/tabs/ui-trend.js` |
| `ui/ui-utils.js` | `src/presentation/components/ui-utils.js` |

#### Commit 4 — styles (10 file)

| Cũ | Mới |
|---|---|
| `css/style-auth.css` | `src/presentation/styles/style-auth.css` |
| `css/style-base.css` | `src/presentation/styles/style-base.css` |
| `css/style-components.css` | `src/presentation/styles/style-components.css` |
| `css/style-dga-workflow.css` | `src/presentation/styles/style-dga-workflow.css` |
| `css/style-dieu54-charts.css` | `src/presentation/styles/style-dieu54-charts.css` |
| `css/style-nav-layout.css` | `src/presentation/styles/style-nav-layout.css` |
| `css/style-tab-feedback.css` | `src/presentation/styles/style-tab-feedback.css` |
| `css/style-tab-regulation-config.css` | `src/presentation/styles/style-tab-regulation-config.css` |
| `css/style-tab-tables.css` | `src/presentation/styles/style-tab-tables.css` |
| `css/style-tabs-secondary.css` | `src/presentation/styles/style-tabs-secondary.css` |

#### Commit 5 — backend (10 file)

| Cũ | Mới |
|---|---|
| `gsheet/Code.gs` | `backend/gsheet/Code.gs` |
| `scripts/serve.js` | `backend/onpremise/serve.js` |
| `server/api.js` | `backend/onpremise/api.js` |
| `server/auth.js` | `backend/onpremise/auth.js` |
| `server/db.js` | `backend/onpremise/db.js` |
| `server/uploads.js` | `backend/onpremise/uploads.js` |
| `supabase-schema.sql` | `backend/supabase/supabase-schema.sql` |
| `supabase/lockdown-anon.sql` | `backend/supabase/lockdown-anon.sql` |
| `supabase/mirror-setup.sql` | `backend/supabase/mirror-setup.sql` |
| `supabase/supabase-schema.sql` | (xóa — bản cũ, thiếu cột so với supabase-schema.sql ở gốc) |

#### Commit 6 — assets (41 file)

| Cũ | Mới |
|---|---|
| `image/app-icon-192.webp` | `assets/image/app-icon-192.webp` |
| `image/app-icon-96.webp` | `assets/image/app-icon-96.webp` |
| `image/apple-touch-icon.png` | `assets/image/apple-touch-icon.png` |
| `image/cam-nang-dga-thumb.webp` | `assets/image/cam-nang-dga-thumb.webp` |
| `image/cam-nang-dga.webp` | `assets/image/cam-nang-dga.webp` |
| `image/co-che-hinh-thanh-khi-dga-thumb.webp` | `assets/image/co-che-hinh-thanh-khi-dga-thumb.webp` |
| `image/co-che-hinh-thanh-khi-dga.webp` | `assets/image/co-che-hinh-thanh-khi-dga.webp` |
| `image/favicon-16.png` | `assets/image/favicon-16.png` |
| `image/favicon-32.png` | `assets/image/favicon-32.png` |
| `image/phan-tich-khi-hoa-tan-thumb.webp` | `assets/image/phan-tich-khi-hoa-tan-thumb.webp` |
| `image/phan-tich-khi-hoa-tan.webp` | `assets/image/phan-tich-khi-hoa-tan.webp` |
| `image/qt-anh-dat-thung-vanchuyen-thumb.webp` | `assets/image/qt-anh-dat-thung-vanchuyen-thumb.webp` |
| `image/qt-anh-dat-thung-vanchuyen.webp` | `assets/image/qt-anh-dat-thung-vanchuyen.webp` |
| `image/qt-anh-dat-xilanh-ong-baoquan-thumb.webp` | `assets/image/qt-anh-dat-xilanh-ong-baoquan-thumb.webp` |
| `image/qt-anh-dat-xilanh-ong-baoquan.webp` | `assets/image/qt-anh-dat-xilanh-ong-baoquan.webp` |
| `image/qt-anh-dong-goi-thung-thumb.webp` | `assets/image/qt-anh-dong-goi-thung-thumb.webp` |
| `image/qt-anh-dong-goi-thung.webp` | `assets/image/qt-anh-dong-goi-thung.webp` |
| `image/qt-anh-gan-the-nhan-thumb.webp` | `assets/image/qt-anh-gan-the-nhan-thumb.webp` |
| `image/qt-anh-gan-the-nhan.webp` | `assets/image/qt-anh-gan-the-nhan.webp` |
| `image/qt-anh-lay-mau-mba-thumb.webp` | `assets/image/qt-anh-lay-mau-mba-thumb.webp` |
| `image/qt-anh-lay-mau-mba.webp` | `assets/image/qt-anh-lay-mau-mba.webp` |
| `image/qt-anh-tach-ong-noi-thumb.webp` | `assets/image/qt-anh-tach-ong-noi-thumb.webp` |
| `image/qt-anh-tach-ong-noi.webp` | `assets/image/qt-anh-tach-ong-noi.webp` |
| `image/qt-anh-treo-the-xilanh-thumb.webp` | `assets/image/qt-anh-treo-the-xilanh-thumb.webp` |
| `image/qt-anh-treo-the-xilanh.webp` | `assets/image/qt-anh-treo-the-xilanh.webp` |
| `image/qt-hinh1-chai-thumb.webp` | `assets/image/qt-hinh1-chai-thumb.webp` |
| `image/qt-hinh1-chai.webp` | `assets/image/qt-hinh1-chai.webp` |
| `image/qt-hinh2-xilanh-thumb.webp` | `assets/image/qt-hinh2-xilanh-thumb.webp` |
| `image/qt-hinh2-xilanh.webp` | `assets/image/qt-hinh2-xilanh.webp` |
| `image/qt-hinh3-ong-mau-thumb.webp` | `assets/image/qt-hinh3-ong-mau-thumb.webp` |
| `image/qt-hinh3-ong-mau.webp` | `assets/image/qt-hinh3-ong-mau.webp` |
| `image/qt-hinh4-khi-xilanh-thumb.webp` | `assets/image/qt-hinh4-khi-xilanh-thumb.webp` |
| `image/qt-hinh4-khi-xilanh.webp` | `assets/image/qt-hinh4-khi-xilanh.webp` |
| `image/qt-hinh5-khi-ong-mau-thumb.webp` | `assets/image/qt-hinh5-khi-ong-mau-thumb.webp` |
| `image/qt-hinh5-khi-ong-mau.webp` | `assets/image/qt-hinh5-khi-ong-mau.webp` |
| `template/mau-goc-bbtn-dga.docx` | `assets/template/mau-goc-bbtn-dga.docx` |
| `template/mau-goc-bbtn-doam-up-tan-3pha.docx` | `assets/template/mau-goc-bbtn-doam-up-tan-3pha.docx` |
| `template/template-baocao-phantich-dga.docx` | `assets/template/template-baocao-phantich-dga.docx` |
| `template/template-bbtn-dau-3pha.docx` | `assets/template/template-bbtn-dau-3pha.docx` |
| `template/template-bbtn-dga.docx` | `assets/template/template-bbtn-dga.docx` |
| `template/template-bbtn-ly-hoa-dau.docx` | `assets/template/template-bbtn-ly-hoa-dau.docx` |

## 7. Kế hoạch commit Bước 3 và nơi phải sửa

**Nguyên tắc:** mỗi commit = `git mv` + sửa **chỉ đường dẫn** ở mọi nơi tham chiếu (kể cả các dòng đường dẫn bên trong
file vừa di chuyển, nếu không app hỏng ngay) + tăng tên cache `sw.js` (và chuỗi kiểm tra trong `index.html`) +
`npm run sync-mobile` + cổng kiểm thử + mở app kiểm tra console không có lỗi 404.
- Sửa đường dẫn trong file vừa di chuyển chỉ chiếm vài dòng, nên git vẫn nhận là đổi tên (độ giống > 90%).
- Mọi sửa đổi khác (logic, chú thích dài) để commit riêng.
- **Lưới an toàn có sẵn:** `scripts/build-pages-site.js` tự kiểm tra mọi `src`/`href` của `index.html` và
  `mobile/index.html`, icon trong manifest, `PRECACHE_ASSETS` của `sw.js` và các `*_TEMPLATE_URL` đều tồn tại. Chạy
  script này sau mỗi commit sẽ bắt được đường dẫn sai mà Jest không thấy.

| Commit | Nơi phải sửa (ngoài `git mv`) |
|---|---|
| **1 domain** | `index.html` (11 thẻ script) · `sw.js` (11 dòng precache) · `dga-logic.js`: `LOGIC_DIR = __dirname` (cùng thư mục) · `scripts/sync-mobile.js`: regex `src\/domain\/dga-logic…` + kiểm tra "file cuối" · `tsconfig.json` `include` · `eslint.config.mjs` (`logic/**` → `src/domain/**`) · 10 test `require("../dga-logic")` → `require("../src/domain/dga-logic")` · 5 test đọc `logic/…` · README, KNOWLEDGE |
| **2 data** | `index.html` (14 thẻ script) · `sw.js` (14 dòng) · **`bbtn-import.js`, `nameplate-import.js`: `../vendor/` → `../../../vendor/`** (cả `import` lẫn `new URL(…, import.meta.url)`) · `eslint.config.mjs` (`storage/**`, `bbtn/**`, khối riêng cho 2 file module) · test `require("../storage…")`, `require("../bbtn/…")` (≈ 9 file test) · README, KNOWLEDGE |
| **3 presentation** | `index.html` (31 thẻ script) · `sw.js` (31 dòng) · `eslint.config.mjs` (`*.js`, `ui/**`) · test `require("../ui/…")`, đọc `app-core.js` (≈ 8 file test) · README, KNOWLEDGE |
| **4 styles** | `index.html` (10 thẻ `<link>`) · `sw.js` (10 dòng) · `package.json` `lint:css`, `lint:css:fix` · `.stylelintrc.json` · 2 test đọc `css/` · kiểm tra `url()` trong CSS (hiện **không có** — không phải sửa) |
| **5 backend** | **`db.js`: `DATA_DIR` = `../../data`** (giữ thư mục dữ liệu ở gốc) · `serve.js`: `ROOT = ../..`, `require("./api")` · `package.json` `start` · `chay_dga_offline.bat` · test `require("../server/…")`, đọc `gsheet/Code.gs`, `supabase-schema.sql` (≈ 7 file test) · `scripts/dedupe-uploads.js` (`require("../server/…")`) · `eslint.config.mjs` (`server/**`) · README (mục Apps Script/Supabase, link `supabase/lockdown-anon.sql`, `supabase/mirror-setup.sql`), KNOWLEDGE · chú thích nhắc `supabase/…` trong `storage.js`, `storage-offline.js`, `Code.gs` (chỉ chú thích — **không cần deploy lại `Code.gs`**) · `git rm supabase/supabase-schema.sql` |
| **6 assets** | `index.html` (≈ 20 ảnh `src`/`href`) · `manifest.webmanifest` (4 icon) · `sw.js` (5 dòng) · **4 hằng `*_TEMPLATE_URL`** (`bbtn-export`, `mba-oil-bbtn-export`, `tech-report-export`, `ui-ti-oil-3pha`) · `scripts/build-pages-site.js` (`ROOT_DIRS`, `TEMPLATE_PATTERN`) · test đọc `template/`, `image/` (≈ 6 file test) · README |

Cuối Bước 3, `scripts/build-pages-site.js` cũng cập nhật `ROOT_FILES`/`ROOT_DIRS` (từ commit 1–4) để Pages vẫn đủ
file.

## 8. Rủi ro và việc cần chủ dự án quyết

1. **Duyệt 4 điều chỉnh ở mục 3.1:** domain phẳng, tabs phẳng, `serve.js` vào `backend/onpremise/`, bỏ bản Supabase
   schema cũ.
2. **Đường dẫn công khai đổi (commit 6):** ảnh và mẫu BBTN trên GitHub Pages đổi URL (`…/image/x.webp` →
   `…/assets/image/x.webp`). App tự dùng đường dẫn mới; chỉ ảnh hưởng nếu ai đó lưu link trực tiếp tới ảnh. Có thể
   bỏ commit 6 (giữ `image/`, `template/` ở gốc) nếu muốn giảm thay đổi.
3. **Cache trình duyệt:** sau mỗi commit đổi đường dẫn, phải tăng tên cache. Do lỗi #2 (`BUGS_FOUND.md`: Service
   Worker không được đăng ký), hiện chưa người dùng nào có cache cũ để bị ảnh hưởng. Nhưng nếu sửa lỗi #2 trước Bước 3
   thì quy tắc tăng tên cache trở nên bắt buộc.
4. **`mobile/`** giữ nguyên vị trí và cách deploy độc lập; chỉ `scripts/sync-mobile.js` đổi đường dẫn nguồn. Nội dung
   `mobile/dga-logic.js` sẽ đổi phần chú thích `// ===== logic/… =====` thành `// ===== src/domain/… =====`.
5. **Mở bằng `file://`:** đường dẫn tương đối vẫn chạy. Riêng 2 ES module (`bbtn-import.js`, `nameplate-import.js`)
   vốn không chạy được dưới `file://` (trình duyệt chặn module cục bộ); không đổi so với hiện tại.
