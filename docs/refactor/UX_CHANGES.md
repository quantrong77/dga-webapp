# Thay đổi UX & khả năng truy cập (Bước 6)

Mỗi mục ghi **trước → sau → lý do**. Đo bằng axe-core 4 (WCAG 2.1 A/AA) trên 10 tab + tab con Quy trình / Quản trị /
Cấu hình, desktop 1440px và mobile 375px, giao diện sáng và tối (`axe-core` là dev-dependency, chỉ dùng để kiểm thử).

| axe | Trước Bước 6 | Sau Bước 6 |
|---|---|---|
| Quy tắc bị vi phạm | 6 | **0** |
| Phần tử vi phạm (gộp theo selector) | 242 | **0** |

## 1. Truy cập (a11y)

| # | Trước | Sau | Lý do |
|---|---|---|---|
| A1 | 11 ô kéo-thả file: `<input type="file">` trong suốt phủ lên ô, **không có nhãn**; 4 ô còn được gắn `role="button" tabindex="0"` nên mỗi ô có **2 điểm dừng Tab** (ô + input) | Chỉ input là control: 1 điểm dừng Tab, Enter/Space mở hộp chọn file (hành vi gốc của trình duyệt), tên truy cập = đúng chữ hiển thị trong ô (`aria-labelledby`), viền focus vẽ trên ô bằng `:focus-within` | axe `label` (critical), `nested-interactive`, `label-content-name-mismatch`; người dùng bàn phím phải Tab 2 lần qua 1 ô, trình đọc màn hình đọc "nút" rồi "chọn tệp, không tên" |
| A2 | Ô chọn vai trò ở bảng người dùng (tab Quản trị) không có tên | `aria-label="Vai trò của <email>"` | axe `select-name` (critical, 190 ô) — trình đọc màn hình chỉ đọc "hộp kết hợp" |
| A3 | Chữ cấp ba `--text-tertiary` #94a3b8 (đơn vị đo "(kV)", "thứ N/M lần đo", chữ gợi ý trong ô nhập) | #5b6779 — ≥ 5,1:1 trên mọi nền sáng | axe `color-contrast`: chỉ 2,3–2,6:1 (cần 4,5:1) |
| A4 | Giao diện tối: `--text-tertiary` #64748b, `--gray-500` #6b7280 (danh mục bảng ở mục Quy định) | Cả hai = #94a3b8 (bằng chữ phụ) | 3,0–3,4:1 trên nền tối; màu tối hơn #94a3b8 không đạt 4,5:1 trên nền hàng đang rê chuột (#252e63) |
| A5 | 5 khung cuộn ngang không có phần tử nhận focus (Số liệu đã lưu – Khí hòa tan / Dầu MBA / Dầu OLTC, bảng số liệu biểu đồ Điều 54, sơ đồ quy trình DGA) | `tabindex="0" role="region" aria-label="… (cuộn ngang)"` | axe `scrollable-region-focusable`: người chỉ dùng bàn phím không cuộn ngang được để xem cột bị khuất |
| A6 | Thanh tab chính không có thuộc tính ARIA; tab con Quy trình / Quản trị / Cấu hình có `role="tab"` nhưng `aria-selected` luôn `"false"` | Tab chính: `aria-current="page"` cho tab đang mở; tab con: `aria-selected` đồng bộ theo tab đang chọn (1 bộ nghe chung, `syncTabAria()` ở ui-layout.js) | Trình đọc màn hình không biết đang ở tab nào |
| A7 | Hộp thoại Đổi mật khẩu / Mật khẩu tạm / khung Đăng nhập là `<div>` thường; phím Esc không đóng được | `role="dialog" aria-modal="true" aria-labelledby` (tiêu đề hộp); Esc đóng hộp thoại nhỏ bằng chính nút ×, nên không đóng được khi đang bắt buộc đổi mật khẩu tạm (nút × bị ẩn) | Trình đọc màn hình không thông báo đang mở hộp thoại; người dùng bàn phím quen dùng Esc |

## 2. Luồng chính & thông báo

| # | Trước | Sau | Lý do |
|---|---|---|---|
| U1 | Bấm "Phân tích & Lưu" thiếu Thiết bị hoặc Ngày lấy mẫu → 1 câu chung "Vui lòng nhập ít nhất Thiết bị và Ngày lấy mẫu." | Câu nêu đúng ô còn thiếu ("Vui lòng nhập Thiết bị (bắt buộc để lưu lần đo).") + ô đó viền đỏ, `aria-invalid="true"`, con trỏ nhảy vào ô; gõ vào ô thì bỏ đánh dấu | Kế hoạch 6.1: "thông báo lỗi nói rõ ô nào sai và cách sửa" |
| U2 | Ô khí nhập sai (chữ không phải số / KPH) → chỉ có thông báo | Thông báo (giữ nguyên câu) + ô khí đó viền đỏ, `aria-invalid`, con trỏ nhảy vào ô | Như U1 — form 9 ô khí, khó tìm ô sai |
| U3 | Nút **Xóa** tiêu chuẩn nhà sản xuất (Quản trị → Cấu hình → Tiêu chuẩn NSX) xóa ngay | Hỏi xác nhận "Xóa tiêu chuẩn của <hãng>? Không thể hoàn tác." như mọi nút Xóa khác | Kế hoạch 6.1: "xác nhận trước thao tác xóa" — đây là nút Xóa duy nhất chưa hỏi |

Đã có từ trước, kiểm lại và giữ nguyên:
- **Giữ dữ liệu form khi chuyển tab:** mọi tab nằm sẵn trong trang (chỉ ẩn/hiện), nên số đang nhập không mất khi
  chuyển tab rồi quay lại (đã thử bằng Playwright: nhập H2 và Thiết bị → qua Lịch sử đo, Lý-Hóa dầu, Cảnh báo →
  quay lại tab Khí hòa tan, 2 ô vẫn giữ giá trị).
- **Trạng thái kết nối / đồng bộ / mất mạng:** badge trên header (Đã đồng bộ / Đang đồng bộ / Ngoại tuyến + số thao
  tác chờ), hộp chờ có bánh răng khi đang nạp / lưu.
- **Xác nhận xóa:** lần đo, thí nghiệm dầu MBA / OLTC / TI-TU, góp ý, tài khoản, khôi phục bảng quy định mặc định.

## 3. Trạng thái rỗng

| # | Trước | Sau | Lý do |
|---|---|---|---|
| E1 | Tab Lịch sử đo báo "Chưa có lần đo nào được lưu." cả khi database CÓ dữ liệu nhưng bộ lọc không khớp | Chưa có dữ liệu: "Chưa có lần đo nào được lưu. Vào tab "Khí hòa tan" để nhập số liệu (hoặc kéo-thả BBTN PDF) rồi bấm "Phân tích & Lưu"." — lọc không khớp: "Không có lần đo nào khớp bộ lọc hiện tại (N lần đo đã lưu). Xóa bớt Trạm / Thiết bị / Loại thiết bị ở ô lọc phía trên để xem." | Câu cũ sai sự thật khi đang lọc; trạng thái rỗng phải chỉ bước tiếp theo |
| E2 | Khung "Số liệu đã lưu" (Khí hòa tan, Dầu MBA, Dầu OLTC) khi thiết bị chưa có dữ liệu: "Thiết bị này chưa có … nào được lưu." | Thêm bước tiếp theo: "… — nhập số liệu ở form phía trên rồi bấm "Phân tích & Lưu" / "Đánh giá & Lưu"." | Kế hoạch 6.2 |

Các trạng thái rỗng khác đã có hướng dẫn từ trước (giữ nguyên): Cảnh báo ("Chưa phát hiện thiết bị nào đang ở mức
Cảnh báo/Báo động…"), Xu hướng ("Chưa có dữ liệu nào được lưu … để vẽ xu hướng."), so sánh 2 lần đo, các khung "Số
liệu đã lưu" khi chưa chọn thiết bị ("Nhập hoặc chọn Trạm và Thiết bị ở form phía trên…").

## 4. Responsive

| # | Trước | Sau | Lý do |
|---|---|---|---|
| R1 | 8 bảng lịch sử nhiều cột (Lịch sử đo khí / dầu MBA / OLTC / TI-TU, Số liệu đã lưu ở tab nhập) cuộn ngang mất luôn cột Ngày — ở 375px không biết dòng đang xem là lần đo nào | Cột đầu (Ngày lấy mẫu) **ghim** ở mép trái khi cuộn ngang (class `sticky-first-col`), nền đặc khớp nền thường / hàng chẵn / hàng rê chuột, vạch ngăn bên phải; cột Thao tác vẫn ghim bên phải như trước | Kế hoạch 6.3: "bảng cuộn ngang có cột đầu cố định" |

Kiểm tra tràn ngang: **không tab nào tràn** ở 375 / 768 / 1440px, cả bố cục tab ngang lẫn sidebar dọc, sáng và tối.

## 5. Chưa làm (đề xuất, cần quyết định)

- **Đầu bảng dính khi cuộn dọc:** bảng nằm trong khung cuộn ngang (`overflow-x: auto`) nên `position: sticky; top`
  chỉ dính trong khung, không dính theo trang. Muốn dính phải cho khung bảng chiều cao tối đa (cuộn dọc riêng trong
  khung), làm đổi cách đọc bảng dài — nên thử với người dùng trước.
- **Số canh phải + cột đơn vị:** bảng đã dùng chữ số đều độ rộng (`tabular-nums`). Canh phải các cột khí / chỉ tiêu
  dầu cần sửa hàm vẽ từng bảng; đơn vị hiện ghi ở tiêu đề cột.
- **Đưa focus vào hộp thoại khi mở / giữ focus trong hộp thoại** (focus trap): chưa làm, hộp thoại hiện chỉ có Esc +
  ARIA.
- `mobile/` (bản di động riêng, CSS viết tay): chưa quét axe.
