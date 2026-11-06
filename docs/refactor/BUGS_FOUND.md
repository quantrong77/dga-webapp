# Lỗi phát hiện trong quá trình tái cấu trúc

Theo quy tắc B.2 của `REFACTOR_PLAN.md`: lỗi thật **không sửa lẫn** trong commit refactor. Mỗi lỗi ghi ở đây, chờ chủ
dự án quyết định sửa riêng (commit `fix(...)` tách biệt) hay để sau.

| # | Phát hiện ở | Mức độ | Trạng thái |
|---|---|---|---|
| 1 | Bước 0 | Thấp | Chờ quyết định |
| 2 | Bước 0 | **Cao** — chế độ offline không hoạt động | Chờ quyết định |
| 3 | Bước 3 | Thấp — đọc sai 2 ô thông số khi đọc BBTN TI | Chờ quyết định |
| 4 | Bước 3 | **Cao (bảo mật)** — máy chủ on-premise phục vụ `data/database.json`, `.git/`, mã nguồn không cần đăng nhập | Chờ quyết định — nên sửa sớm |
| 5 | Bước 4 | **Cao (mất dữ liệu)** — chế độ on-premise: thao tác lưu lúc mất mạng bị bỏ khỏi hàng đợi mà không gửi lên máy chủ | Chờ quyết định — nên sửa sớm |

---

## #1. Tab Quản trị (on-premise) gọi `supabaseSyncStatus` → HTTP 400

- **Hiện tượng:** mở tab Quản trị khi chạy `npm start` → console có lỗi
  `Failed to load resource: the server responded with a status of 400` cho
  `/api?action=supabaseSyncStatus&token=...`.
- **Nguyên nhân:** `src/presentation/tabs/ui-admin.js:136` gọi `Auth.supabaseSyncStatus()` → `src/data/drivers/storage-auth.js:162` gửi
  `gsheetGet("supabaseSyncStatus")`. Action này chỉ có ở `backend/gsheet/Code.gs:365`; `backend/onpremise/api.js` không có nên trả 400.
- **Ảnh hưởng:** chỉ là 1 lỗi console + khối "Bản sao Supabase" không có trạng thái; không mất dữ liệu.
- **Hướng sửa đề xuất:** ở chế độ on-premise thì không gọi (hoặc `backend/onpremise/api.js` trả `{ enabled: false }`).
- **ĐÃ SỬA** (nhánh `fix/bugs-1-3-8`): `refreshSupabaseSyncUI()` (`src/presentation/tabs/ui-admin.js`) chỉ gọi
  `supabaseSyncStatus` khi `Storage.mode === "gsheet"`; chế độ khác báo "Không áp dụng…", khóa nút đồng bộ. Test
  `tests/admin-supabase-status.test.js` (5 test). Kiểm trên trình duyệt (on-premise): mở tab Quản trị → 0 response lỗi.

## #2. Service Worker không bao giờ được đăng ký → không có bộ nhớ đệm offline

- **Hiện tượng:** sau khi mở app (on-premise `http://localhost:8091` hoặc bản tĩnh như GitHub Pages) và chờ 5 giây,
  `navigator.serviceWorker.getRegistration()` trả `undefined`. Không có cache `dga-offline-*` → tắt mạng rồi tải lại
  trang thì app không mở được. Hàng đợi đồng bộ (`src/data/drivers/storage-offline.js`, localStorage) vẫn chạy bình thường;
  chỉ phần "mở app khi mất mạng" là hỏng.
- **Nguyên nhân:** `registerServiceWorker()` (`src/presentation/app-core.js:906`) chỉ gắn trình nghe
  `window.addEventListener("load", ...)`. Hàm này được gọi trong `initApp()` (`src/presentation/app-core.js:102`), mà `initApp()` chỉ
  chạy **sau khi đăng nhập xong** (`src/presentation/tabs/ui-auth.js:137`, `:160`, có `await`). Lúc đó sự kiện `load` đã xảy ra từ lâu
  → trình nghe không bao giờ chạy.
- **Hướng sửa đề xuất:** nếu `document.readyState === "complete"` thì đăng ký ngay, ngược lại mới chờ `load`
  (hoặc gọi `registerServiceWorker()` từ đầu trang, trước màn hình đăng nhập). Sau khi sửa phải tăng tên cache trong
  `sw.js` và kiểm tra kịch bản D.9 (tắt mạng → tải lại trang).
- **Ghi chú:** Bước 7 của kế hoạch (kiểm thử offline bằng Service Worker) sẽ không đạt nếu chưa sửa lỗi này.
- **ĐÃ SỬA** (nhánh `fix/service-worker`): `registerServiceWorker()` (`src/presentation/app-status.js`) đăng ký ngay
  nếu `document.readyState === "complete"`, ngược lại chờ `load` (một lần). Kèm theo: `sw.js` precache thêm
  `vendor/pdfjs/pdf.min.js`, `vendor/tesseract/tesseract.esm.min.js` (2 module đọc BBTN PDF / tấm nhãn import tĩnh — thiếu
  thì không nạp được khi mất mạng) và `assets/image/app-icon-192.webp`; sửa nhánh dự phòng điều hướng offline
  (`caches.match(a) || caches.match(b)` — Promise luôn truthy nên không bao giờ thử `./`). Cache `v47-sw-register`.
  Test `tests/service-worker-register.test.js` (8 test). Kiểm trên trình duyệt (on-premise): sau đăng nhập SW
  `activated`, 87 mục trong cache; tắt mạng → tải lại trang → app mở, vẫn đăng nhập, badge "Chạy offline…", 0 lỗi JS,
  0 file tĩnh tải hỏng. **Giới hạn:** đọc BBTN PDF / OCR lúc mất mạng chỉ chạy nếu đã dùng ít nhất 1 lần lúc có mạng
  (worker pdf.js ~1,3 MB, lõi OCR ~3,9 MB + dữ liệu ngôn ngữ không precache, được lưu khi dùng lần đầu).

## #3. Đọc BBTN khí hòa tan của TI: ô "Điện áp định mức" và "Hãng sản xuất" lẫn nội dung dòng khác

- **Hiện tượng:** đọc `2634_AT2HamTan18092023.pdf` (BBTN DGA của TI M4100, Trạm 220kV Hàm Tân) bằng
  `BbtnImport.extract()`:
  - `dienApDm` = `"Hãng sản xuất (Manufacturer): EEMC Số chế tạo (Serial No): 194839-124"`;
  - `hangSanXuat` = `"EEMC Số chế tạo (Serial No): 194839-124"`.

  `soCheTao`, `namSx`, nhiệt độ, độ ẩm và khí vẫn đọc đúng. BBTN MBA (`BBTN_lyhoadau_MBA_OLTC_3_pha.pdf`) đọc đúng cả hai ô.
- **Nguyên nhân (dự đoán):** ở mẫu BBTN của TI, nhãn "Điện áp định mức" không có giá trị trên cùng dòng, nên bộ trích
  xuất lấy luôn dòng kế tiếp. Ô "Hãng sản xuất" thì không dừng ở nhãn "Số chế tạo" đứng cùng dòng. Code trích xuất
  (`src/data/io/bbtn-import.js`) không đổi ở Bước 3 (chỉ đổi đường dẫn `../vendor/`), nên đây là lỗi có từ trước.
- **Ảnh hưởng:** chỉ ở khối "Thông số kỹ thuật thiết bị" được tự điền; người dùng thấy và sửa tay được. Không ảnh hưởng
  kết quả đánh giá khí.
- **Hướng sửa đề xuất:** dừng giá trị ở nhãn kế tiếp ("Số chế tạo", "Năm sản xuất"…); bỏ qua giá trị bắt đầu bằng một
  nhãn khác. Thêm test với dòng chữ của mẫu TI.
- **ĐÃ SỬA** (nhánh `fix/bugs-1-3-8`). Nguyên nhân thật (file mẫu là BBTN MBA AT2 mẫu NPTS/BM.01): (1) nhãn điện áp
  `D?ien\s*ap` (chữ D tùy chọn cho OCR) khớp cả "Máy **biến áp** AT2" ở dòng Vị trí lắp đặt, ô coi như rỗng nên lấy
  dòng kế tiếp; (2) "Hãng sản xuất" chỉ dừng ở "Năm sản xuất". Sửa trong `src/data/io/bbtn-import.js`: nhãn điện áp
  không được đứng ngay sau 1 chữ cái; dòng kế tiếp có dấu `:` (hàng nhãn khác) không lấy làm giá trị; hàm mới
  `extractHangSanXuat()` dừng ở Năm sản xuất / Số chế tạo / Serial No / Kiểu loại. Test `tests/bbtn-device-info.test.js`
  (8 test). So bản cũ ↔ mới trên 39 PDF thật trên máy: 20 trường đổi — 15 từ sai thành đúng (Hãng sản xuất của MBA, CSV,
  TU, DCL, MC; Điện áp định mức MBA AT1 pha B → `550 kV`, AT2 → `225/115/23 (kV)`, kéo theo cấp Bảng 63 của AT2 `500` →
  `110-220`, đúng với 225 kV); 5 trường còn lại ở 4 file **không phải BBTN dầu** (BBTN mạch nhị thứ TU, biên bản
  nghiệm thu, tài liệu phần mềm) không có ô điện áp — trước và sau đều đoán sai, chỉ khác chuỗi.

## #4. Máy chủ on-premise phục vụ MỌI file trong thư mục dự án, kể cả database và `.git/`

- **Hiện tượng:** khi chạy `npm start` / `chay_dga_offline.bat`, bất kỳ ai truy cập được cổng máy chủ (máy khác trong
  mạng LAN) đều tải được, **không cần đăng nhập**:
  - `http://<máy>:<cổng>/data/database.json` → 200 (206 KB: tài khoản, `password_hash`, `salt`, token phiên);
  - `/data/uploads/2026/11/<tệp>.pdf` → 200 (bỏ qua bước kiểm tra phiên của `/api/files/…`);
  - `/.git/config` → 200 (đọc được toàn bộ lịch sử git, kể cả các bản `database.json` cũ);
  - `/backend/onpremise/auth.js`, `/node_modules/…`, `/docs/refactor/SECURITY_NOTE.md` → 200.
- **Nguyên nhân:** `backend/onpremise/serve.js` phục vụ tĩnh mọi đường dẫn nằm dưới gốc dự án (chỉ chặn `..` ra
  ngoài gốc), không có danh sách cho phép. Có từ trước Bước 3 (thời `scripts/serve.js`).
- **Ảnh hưởng:** lộ tài khoản và mật khẩu đã băm (SHA-256 một vòng, dò được nhanh), token phiên còn hạn, BBTN đính kèm
  và lịch sử git cho mọi máy trong cùng mạng.
- **Hướng sửa đề xuất:** dùng chung danh sách cho phép với `scripts/build-pages-site.js`, chỉ phục vụ: `index.html`,
  `manifest.webmanifest`, `sw.js`, `config.js`, `src/`, `vendor/`, `assets/image/`, `assets/template/template-*.docx`
  và `mobile/`. Mọi đường dẫn khác (`data/`, `.git/`, `backend/`, `node_modules/`, `docs/`, `tests/`, `scripts/`,
  `*.md`) trả về 404. Thêm test gọi thử các đường dẫn này.
- **ĐÃ SỬA** (`299aedf`, sau Bước 7): `backend/onpremise/static-allowlist.js` — danh sách cho phép dùng chung với
  `scripts/build-pages-site.js`; mọi đường dẫn khác trả 404. Test `tests/onpremise-static.test.js` (60 test, có gọi
  HTTP thật vào `serve.js`). Kiểm lại: `/data/database.json`, `/data/uploads/…`, `/.git/config`, `/backend/…`,
  `/node_modules/…`, `/docs/…`, `/README.md`, `/package.json`, `/src/%2e%2e/data/database.json`, BBTN thật trong
  `assets/template/` → 404; app 10 tab không lỗi / không 404. **Máy chủ đang chạy phải khởi động lại** mới có hiệu lực.
  Lịch sử git trên GitHub vẫn còn các bản `database.json` cũ (xem `SECURITY_NOTE.md`).

## #5. Chế độ on-premise: thao tác lưu lúc mất mạng bị "đồng bộ" mà không gửi lên máy chủ

- **Hiện tượng:** chạy máy chủ nội bộ (`Storage.mode === "local-server"`), mất mạng lúc bấm Lưu, nên bản ghi vào hàng
  đợi đồng bộ (đúng). Khi có mạng lại, `Storage.processSyncQueue()` báo `processed: 1`, hàng đợi rỗng, nhưng **không có
  lời gọi nào tới máy chủ**. Lần nạp danh sách sau, bộ nhớ đệm bị ghi đè bằng dữ liệu máy chủ, nên bản ghi đó **mất
  hẳn**. Với chế độ Google Sheets, mục trong hàng đợi được gửi đúng (`gsheetPost("addMeasurement")`).
- **Kiểm chứng (Node):** thêm 1 lần đo lúc `navigator.onLine = false`, sau đó `processSyncQueue()` lúc có mạng:
  `gsheet` → gửi `["addMeasurement"]`; `local-server` → gửi `[]`, `processed: 1`, `pending: 0`.
- **Nguyên nhân:** `executeRemoteSyncItem()` (`src/data/drivers/storage-offline.js`) chỉ có nhánh
  `currentMode === "gsheet"` và `"supabase"`, chưa có `"local-server"` (chế độ on-premise thêm sau, dùng cùng giao thức
  `gsheetPost`). Không vào nhánh nào thì hàm trả `undefined`, và `processSyncQueue()` coi đó là thành công, xóa mục khỏi
  hàng đợi. Có từ trước, không do refactor.
- **Hướng sửa đề xuất (1 dòng):** `if (currentMode === "gsheet" || currentMode === "local-server")`. Thêm test
  `processSyncQueue` cho cả 3 chế độ, và cho trường hợp action lạ (hiện cũng bị bỏ âm thầm; nên giữ lại trong hàng đợi
  hoặc báo lỗi).
- **Ghi chú:** chưa refactor `executeRemoteSyncItem` (độ phức tạp 72) ở Bước 4, vì refactor thuần sẽ phải giữ nguyên
  lỗi này. Nên sửa lỗi trước, rồi gom về `STORAGE_ENTITIES` (storage-repo.js) như các hàm CRUD.
- **ĐÃ SỬA** (`030d246`, sau Bước 7): nhánh `"local-server"` dùng chung với `"gsheet"`; chế độ/action không hỗ trợ
  thì ném lỗi (giữ lại trong hàng đợi, báo lỗi) thay vì âm thầm coi là đã đồng bộ. Test `tests/sync-queue-modes.test.js`
  (10 test, cả 2 chế độ, 16 action). Kiểm lại trên trình duyệt (bản sao database): lưu lúc mất mạng → có mạng lại →
  bản ghi CÓ trong `database.json`.

## #6. Giao diện tối: hàng chẵn của mọi bảng có nền xám sáng, chữ trắng gần như không đọc được

- **Hiện tượng:** ở giao diện tối, hàng chẵn các bảng (Lịch sử đo, Cảnh báo, Cấu hình…) có nền xám-tím sáng;
  chữ trắng trên nền đó tương phản rất thấp. Ô "Thao tác" ở cùng hàng lại tối, nên bảng trông loang lổ.
  Xem `docs/refactor/screenshots/before/desktop-dark-lichsu.png`.
- **Nguyên nhân:** `tbody tr:nth-child(even) { background: rgba(241, 245, 249, 0.45) }` (style-tab-tables.css) là
  màu sáng viết cứng, không theo giao diện tối. Có từ trước, không do refactor.
- **Đã sửa ở Bước 5** (commit riêng `style(css): soc bang giao dien toi…`): token `--table-stripe`, giao diện
  tối dùng `var(--surface-page)`, cùng màu với ô Thao tác của hàng chẵn. Giao diện sáng giữ nguyên.

## #7. Biến `--gray-700` được dùng nhưng chưa khai báo

- **Hiện tượng:** chữ ô kéo thả BBTN (6 ô), ghi chú quy trình `.sm-note` và chú thích ảnh `.sm-gallery figcaption`
  khai báo `color: var(--gray-700)`. Biến này không tồn tại, nên trình duyệt bỏ khai báo và các chữ này **kế thừa
  màu phần tử cha**, không phải màu chữ phụ như ý định.
- **Đã sửa ở Bước 5** (commit riêng `style(css): khai bao --gray-700…`): `--gray-700` = `#334155` (sáng) /
  `#cbd5e1` (tối), đậm hơn `--text-secondary` một bậc.

## #8. Mở bằng `file://`: không nạp được 2 module đọc BBTN PDF / tấm nhãn

- **Hiện tượng:** mở `index.html` trực tiếp từ ổ đĩa (`file:///…/index.html`, máy chủ API chạy ở `localhost:8080`):
  đăng nhập, xem lịch sử, phân tích, lưu đều chạy, nhưng console báo `Access to script at 'file:///…/bbtn-import.js'
  from origin 'null' has been blocked by CORS policy`. Tương tự với `nameplate-import.js`. Hệ quả: chức năng **nhập
  BBTN PDF** và **đọc ảnh tấm nhãn** không dùng được ở chế độ này.
- **Nguyên nhân:** 2 file này nạp bằng `<script type="module">`, mà trình duyệt chặn ES module từ `file://`.
- **Có từ trước refactor:** bản `a14f59a` (`bbtn/bbtn-import.js`) cho đúng lỗi này (đã kiểm ở Bước 7). Mở qua máy chủ
  (`npm start` / `chay_dga_offline.bat`, `http://localhost:…`) thì không bị.
- **Hướng sửa đề xuất:** README ghi rõ dùng `chay_dga_offline.bat` thay vì mở file trực tiếp; hoặc đổi 2 module này
  sang script cổ điển (IIFE, gắn `window.BbtnImport`) như các file khác — cần thận trọng vì `pdf.js` đang nạp bằng
  `import`.
- **ĐÃ XỬ LÝ** (nhánh `fix/bugs-1-3-8`) — không thể làm chạy được: đổi sang script cổ điển cũng không đủ vì pdf.js
  (Web Worker) và Tesseract (Worker + WASM) cũng bị chặn từ `file://`. Nay 6 chỗ báo "thư viện chưa tải xong, thử lại
  sau vài giây" (sai — không bao giờ tải xong) đi qua `importModuleUnavailableMessage()`
  (`src/presentation/components/ui-utils.js`): ở `file://` báo rõ chạy `chay_dga_offline.bat` / `npm start` rồi mở
  `http://localhost:8080`, hoặc nhập tay. Test `tests/file-protocol-import.test.js` (4 test, có kiểm không còn thông báo
  "chưa tải xong" nào của bộ đọc PDF/OCR đi riêng). README mục 1 ghi rõ. Lỗi CORS trong console vẫn còn (do thẻ
  `<script type="module">` tĩnh) — vô hại.
