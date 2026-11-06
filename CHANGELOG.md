# Nhật ký thay đổi

Ghi các thay đổi đáng chú ý của DGOil (dga-webapp). Mới nhất ở trên.

## [Chưa phát hành] — Tái cấu trúc 3 lớp (nhánh `refactor/cau-truc-3-lop`, 2026-11-06)

Tái cấu trúc **không đổi kết quả đánh giá**: với cùng dữ liệu cũ, 57/57 kết quả chẩn đoán chi tiết, bảng lịch sử,
cảnh báo, xu hướng trùng khớp từng ký tự với bản trước tái cấu trúc (`a14f59a`). Định dạng dữ liệu lưu (cột Google
Sheets, khóa `localStorage`, cấu trúc `data/database.json`) giữ nguyên — dữ liệu cũ đọc được bình thường.
Chi tiết: [`docs/refactor/TEST_REPORT.md`](./docs/refactor/TEST_REPORT.md).

### Bảo mật

- Ngừng theo dõi `data/database.json` trong git (chứa tài khoản, `password_hash`, token phiên); thêm
  `data/database.example.json`, máy chủ tự tạo database rỗng nếu chưa có.
- GitHub Pages chỉ đưa lên **file web theo danh sách cho phép** (`scripts/build-pages-site.js` → `_site/`), không còn
  upload cả repo (`data/`, `backend/`, `tests/`, `docs/`…).
- **Máy chủ nội bộ chỉ phục vụ file web theo danh sách cho phép** (`backend/onpremise/static-allowlist.js`, dùng chung
  với bản Pages). Trước đây ai cùng mạng LAN cũng tải được `data/database.json`, `data/uploads/` (bỏ qua kiểm tra
  đăng nhập), `.git/`, mã máy chủ (lỗi #4).
- Lịch sử git trên GitHub **vẫn còn** các bản `database.json` cũ — xem [`docs/refactor/SECURITY_NOTE.md`](./docs/refactor/SECURITY_NOTE.md).

### Sửa lỗi

- **Mất dữ liệu ở chế độ máy chủ nội bộ:** thao tác lưu lúc mất mạng bị xóa khỏi hàng đợi mà không gửi lên máy chủ.
  Nay hàng đợi gửi thật; thao tác không nhận ra được giữ lại và báo lỗi thay vì âm thầm bỏ (lỗi #5).
- Giao diện tối: hàng chẵn của bảng có nền xám sáng, chữ trắng gần như không đọc được (lỗi #6).
- Biến CSS `--gray-700` được dùng nhưng chưa khai báo (lỗi #7).
- **Mở app khi mất mạng:** Service Worker trước đây không bao giờ được đăng ký (chỉ chờ sự kiện `load` đã qua từ
  trước khi đăng nhập) → tải lại trang lúc mất mạng không mở được. Nay đăng ký ngay sau đăng nhập; precache thêm 2
  thư viện mà module đọc BBTN PDF / tấm nhãn cần (lỗi #2).
- Tab Quản trị ở chế độ máy chủ nội bộ không còn gọi trạng thái bản sao Supabase (trước đây HTTP 400 trong console);
  báo "Không áp dụng" (lỗi #1).
- Đọc BBTN: ô "Điện áp định mức" không còn lấy nhầm dòng "Hãng sản xuất…" (nhãn khớp nhầm "máy biến áp"); "Hãng sản
  xuất" dừng trước "Số chế tạo / Kiểu loại" cùng dòng (lỗi #3).
- Mở bằng `file://`: thay thông báo "thư viện chưa tải xong, thử lại sau vài giây" bằng hướng dẫn mở qua máy chủ (lỗi #8).

### Cấu trúc thư mục

- Code chia 3 lớp trong `src/`: `domain/` (công thức đánh giá, thuần JS) → `data/` (lưu trữ, đọc/xuất BBTN) →
  `presentation/` (giao diện: `tabs/`, `components/`, `styles/`). Quy tắc phụ thuộc giữa các lớp được kiểm tra bằng
  `tests/architecture.test.js` và ESLint. Xem [`docs/refactor/ARCHITECTURE.md`](./docs/refactor/ARCHITECTURE.md).
- Máy chủ và script backend chuyển vào `backend/` (`onpremise/`, `gsheet/Code.gs`, `supabase/*.sql`); ảnh và mẫu BBTN
  vào `assets/`; tài liệu vào `docs/` (`quy-dinh/`, `huong-dan/`, `spec/`, `refactor/`).
- Mọi file được chuyển bằng `git mv` (giữ lịch sử). `npm start` = `node backend/onpremise/serve.js`.

### Mã nguồn

- `storage.js`: gom khuôn CRUD lặp lại của các thực thể vào `src/data/drivers/storage-repo.js`; API `window.Storage`
  / `window.Auth` giữ nguyên.
- `app-core.js` tách thành khởi động (`app-core.js`) / chế độ xem (`app-views.js`) / trạng thái kết nối (`app-status.js`).
- Lớp dữ liệu không còn chạm DOM hay gọi giao diện (7 vi phạm ranh giới đã gỡ).
- ESLint 61 → **0** cảnh báo; Stylelint 50 → **0** cảnh báo; khai báo kiểu cho API lớp dữ liệu (`types.d.ts`).
- Tệp đính kèm on-premise lưu theo mã băm SHA-256, cùng nội dung không lưu trùng; script
  `scripts/dedupe-uploads.js` (có `--dry-run`) gom tệp trùng cũ.
- Dọn file rác (`style.css` cũ, file khóa Word `~$*.docx`); đổi tên mẫu BBTN không dấu cách.

### Giao diện & khả năng truy cập

- Design tokens trong `src/presentation/styles/tokens.css` (màu theo vai trò, khoảng cách, cỡ chữ, bo góc, đổ bóng,
  z-index, giao diện tối); nút nhỏ `.btn.sm` / `.btn.xs`; xóa CSS không còn dùng.
- Quét axe-core WCAG 2.1 AA: 6 quy tắc / 242 phần tử vi phạm → **0** (độ tương phản chữ phụ, nhãn ô kéo-thả file,
  ô chọn vai trò, vùng cuộn dùng được bằng bàn phím, ARIA cho tab và hộp thoại, phím Esc đóng hộp thoại nhỏ).
- Ô nhập sai được đánh dấu (viền đỏ, `aria-invalid`, đưa con trỏ vào ô) và thông báo nói rõ ô nào.
- Hỏi xác nhận trước khi xóa tiêu chuẩn nhà sản xuất.
- Trạng thái rỗng hướng dẫn bước tiếp theo; Lịch sử đo phân biệt "chưa có dữ liệu" và "bộ lọc không khớp".
- Ghim cột Ngày ở 8 bảng lịch sử khi cuộn ngang; không tràn ngang ở 375 / 768 / 1440 px.
- Chi tiết từng thay đổi (trước → sau → lý do): [`docs/refactor/UX_CHANGES.md`](./docs/refactor/UX_CHANGES.md).

### Kiểm thử

- Jest 558 → **741** test (thêm: ranh giới 3 lớp, đặc tả `window.Storage`, hàng đợi đồng bộ 2 chế độ, danh sách cho
  phép của máy chủ nội bộ có gọi HTTP thật, artifact Pages, tệp đính kèm không trùng).

### Còn tồn tại

- Mở bằng `file://`: 2 chức năng đọc BBTN PDF / ảnh nhãn không chạy được (trình duyệt chặn ES module / Worker / WASM);
  app nay báo rõ cách mở qua máy chủ (lỗi #8, [`docs/refactor/BUGS_FOUND.md`](./docs/refactor/BUGS_FOUND.md)).
