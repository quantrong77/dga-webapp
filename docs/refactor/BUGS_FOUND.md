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
