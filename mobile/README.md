# Trợ Lý DGA — bản Mobile (web app di động THẬT)

Đây là ứng dụng di động **chạy thật** (không phải bản thiết kế demo trước đó) —
dùng chung 1 database với bản web (`dga-webapp/`) theo đúng yêu cầu.

## Vì sao "dùng chung database" mà lại là 2 thư mục riêng?

`dga-logic.js`, `storage.js`, `bbtn-export.js`, `config.js`, `vendor/`, `template/`
trong thư mục này là **bản sao y hệt** của bản web — bản thân các file đó không
chứa giao diện, chỉ chứa logic tính toán DGA + logic gọi backend (Google Sheets/
Supabase/localStorage). `index.html`/`style.css`/`app.js` là giao diện RIÊNG,
tối ưu cho màn hình điện thoại (1 cột, thanh điều hướng dưới, v.v.), nhưng gọi
đúng cùng các hàm `Storage.*`/`Auth.*`/`DGA.*` đó.

**Điều kiện DUY NHẤT để 2 bản dùng chung dữ liệu**: `config.js` của bản mobile
này phải có **cùng giá trị hệt** `config.js` của bản web (cùng
`GSHEET_WEBAPP_URL`, hoặc cùng `SUPABASE_URL`+`SUPABASE_ANON_KEY`, và cùng
`GOOGLE_CLIENT_ID` nếu dùng đăng nhập Google). Đăng nhập ở app nào cũng vào
cùng 1 tài khoản (Apps Script quản lý user tập trung), và 1 lần đo nhập ở điện
thoại sẽ hiện ngay trong Lịch sử đo/Xu hướng của bản web, và ngược lại.

Bạn đã chọn backend **Google Sheets (Apps Script)**. Việc cần làm:

1. Deploy Apps Script Web App theo đúng hướng dẫn trong `dga-webapp/README.md`
   (mục "Dùng Google Sheets thay Supabase") và `dga-webapp/gsheet/Code.gs` —
   nếu bạn CHƯA deploy lần nào, làm bước này trước, sẽ ra 1 URL dạng
   `https://script.google.com/macros/s/xxxx/exec`.
2. Dán URL đó vào **CẢ HAI** file: `dga-webapp/config.js` VÀ
   `dga-mobile-app/config.js` (biến `GSHEET_WEBAPP_URL`).
3. (Tùy chọn) Nếu dùng đăng nhập Google, dán cùng 1 `GOOGLE_CLIENT_ID` vào cả
   hai `config.js`, và vào biến `GOOGLE_CLIENT_ID` trong `gsheet/Code.gs`
   (3 nơi phải khớp nhau).
4. Deploy thư mục `dga-mobile-app/` lên hosting bạn đang dùng cho bản web
   (GitHub Pages/Netlify/...) — có thể để ở 1 subfolder riêng (VD `/m/`) hoặc
   1 domain phụ (VD `m.tenmien.com`) tùy bạn, miễn 2 config.js khớp nhau.

## Đã làm được — ĐẦY ĐỦ tính năng như bản web (đồng bộ 100%)

Bản mobile giờ có **5 tab chính** (thanh điều hướng dưới cùng), dùng lại đúng
`dga-logic.js` + `storage.js` của bản web nên luôn ra kết luận giống hệt nhau
với cùng số liệu:

- **Tab "DGA"** — luồng chính: Đăng nhập/Đăng ký email+mật khẩu, Đăng nhập
  Google, Đăng xuất; nhập lần đo (Trạm/Thiết bị gõ-tìm-hoặc-nhập-mới, Pha,
  Loại thiết bị, Nhà sản xuất); phân tích TCG, đánh giá từng khí, tỷ số khí
  Bảng 66, Tam giác Duval 1, tốc độ sinh khí Bảng 65, khuyến nghị, trạng thái
  tổng thể; Lịch sử đo (bấm để sửa); xuất BBTN (.docx); **đính kèm Biên bản
  thí nghiệm (PDF)** khi nhập lần đo, có **tự động đọc số liệu từ PDF** (Trạm,
  Thiết bị, Loại, Pha, Ngày, các giá trị khí) để điền sẵn vào form — vẫn nên
  kiểm tra lại trước khi lưu.
- **Tab "Dầu"** — thí nghiệm dầu cách điện MBA/Kháng dầu chính (Bảng 58/55/54)
  và dầu khoang điều áp dưới tải OLTC (Điều 37/Bảng 49): nhập, đánh giá, lưu,
  sửa, xóa, xem lịch sử — y hệt logic `DGA.evaluateOilTest`/`evaluateOltcOilTest`
  của bản web.
- **Tab "Xu hướng"** — chọn 1 thiết bị, vẽ biểu đồ theo thời gian (Chart.js)
  cho khí hòa tan/dầu MBA/dầu OLTC, lọc theo pha khi thiết bị có nhiều pha,
  kèm bảng lịch sử thô dạng danh sách thẻ.
- **Tab "Tiêu chuẩn"** — xem/thêm/sửa/xóa tiêu chuẩn riêng theo nhà sản xuất
  (khí hòa tan hoặc dầu cách điện), chỉ Admin ghi được (người dùng thường chỉ
  xem).
- **Tab "Quản trị"** (chỉ hiện với Admin, chỉ khi dùng backend Google Sheets)
  — danh sách người dùng, đổi vai trò User/Admin, xóa tài khoản.

Danh sách/lịch sử ở các tab mới hiển thị dạng **thẻ (card)** thay vì bảng
ngang như bản web, để hợp màn hình dọc điện thoại hơn — nội dung/thao tác
(Sửa/Xóa) giữ nguyên đầy đủ.

## Khác biệt nhỏ so với bản web (có chủ đích, không phải thiếu sót)

- Giao diện gọn hơn cho màn hình dọc: danh sách dạng thẻ thay vì bảng, các
  tab gộp gọn trong 1 thanh điều hướng dưới cùng thay vì thanh tab ngang.
- Đọc PDF tự động (đính kèm BBTN) hoạt động ngay trên điện thoại/trình duyệt
  di động, dùng đúng `bbtn-import.js` + `vendor/pdfjs/` của bản web.
