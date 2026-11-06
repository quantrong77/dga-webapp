# Báo cáo kiểm thử tổng thể (Bước 7)

Ngày kiểm: 2026-11-06 · nhánh `refactor/cau-truc-3-lop` @ `b2d442d` (sau Bước 6) · so với bản trước refactor
`a14f59a`. Máy: Windows 11, Chromium (Playwright), Node 24.

**Kết luận:** refactor **không đổi kết quả** (dữ liệu cũ, chẩn đoán, cảnh báo trùng khớp từng ký tự với bản trước
refactor). Các mục **KHÔNG ĐẠT** đều do lỗi **có từ trước refactor** (`BUGS_FOUND.md`).

> **Cập nhật sau Bước 7** (theo quyết định "sửa #5, #4"): đã sửa **#5** (`030d246`, mất dữ liệu khi đồng bộ hàng đợi
> on-premise) và **#4** (`299aedf` + `b247778`, máy chủ nội bộ chỉ phục vụ file web theo danh sách cho phép). Chạy
> lại: cổng kiểm thử 741/741 test, ESLint/Stylelint 0/0; kịch bản khói D1–D9 **đạt hết** (D9 nay đạt); các đường dẫn
> nhạy cảm trả 404. Còn KHÔNG ĐẠT: Service Worker / offline (#2), `file://` một phần (#8) — chưa sửa.

## 1. Cổng kiểm thử (B.4) so với mốc

| Cổng | Mốc Bước 0 | Hiện tại | Đánh giá |
|---|---|---|---|
| `npm test` (Jest) | 35 bộ · 558 test | 39 bộ · **671** test, 0 skip (sau sửa #4, #5: 41 bộ · **741**) | ĐẠT (≥ mốc) |
| `npm run typecheck` | OK | OK | ĐẠT |
| `npm run lint` (ESLint) | 0 lỗi / 61 cảnh báo | **0 / 0** | ĐẠT (< mốc) |
| `npm run lint:css` (Stylelint) | 0 lỗi / 50 cảnh báo | **0 / 0** | ĐẠT (< mốc) |
| `npm run sync-mobile:check` | OK | OK | ĐẠT |
| `npm run build-guide:check` | OK | OK | ĐẠT |
| axe-core WCAG 2.1 A/AA (thêm ở Bước 6) | 6 quy tắc · 242 phần tử | **0** | ĐẠT |

## 2. Dữ liệu cũ — trùng khớp với bản trước refactor

Chạy **song song** bản `a14f59a` (`scripts/serve.js`) và bản hiện tại (`backend/onpremise/serve.js`), mỗi bản trên
1 **bản sao riêng** của `data/database.json` của máy phát triển (57 lần đo khí, 6 thí nghiệm dầu MBA, 31 trạm); so
nội dung HIỂN THỊ (không so code):

| Hạng mục | Kết quả |
|---|---|
| Bảng Lịch sử đo khí hòa tan (57 dòng × 21 cột, có Kết luận / Bảng 66 / Duval) | ĐẠT — trùng khớp |
| Bảng Lịch sử dầu MBA (6 dòng) / OLTC / TI-TU | ĐẠT — trùng khớp |
| Tab Cảnh báo: bảng (4 thiết bị) + thẻ tổng hợp | ĐẠT — trùng khớp |
| Khung kết quả chẩn đoán CHI TIẾT từng lần đo (`onViewMeasurement`, 57/57 lần đo, 141 224 ký tự: mức cảnh báo, TCG, mã Bảng 66, Duval, từng khí, tốc độ tăng, so sánh nhóm, ca tương tự, khuyến cáo) | ĐẠT — **57/57** trùng khớp |
| Danh sách thiết bị vẽ Xu hướng | ĐẠT — trùng khớp |
| Lần đo MỚI nhập cùng số liệu ở 2 bản (D3, 2 bản sao database mới) | ĐẠT — kết quả 5 181 ký tự trùng khớp |

## 3. Kịch bản khói (mục D) — chế độ on-premise (`backend/onpremise/serve.js`, bản sao database)

| # | Bước | Kết quả | Ghi chú |
|---|---|---|---|
| D1 | Mở app: không lỗi JS; badge chế độ lưu trữ | ĐẠT | "Máy chủ nội bộ" |
| D2 | Đăng nhập, vào 10 tab chính | ĐẠT | ảnh: `screenshots/after-step6/` (40 ảnh: 10 tab × desktop/mobile × sáng/tối) |
| D3 | Nhập 1 lần đo MBA đủ 7 khí + O2/N2 → Phân tích & Lưu | ĐẠT | thêm đúng 1 bản ghi; "BÁO ĐỘNG (ALARM)"; kết quả trùng bản cũ |
| D3 | Xuất BBTN DOCX khí hòa tan | ĐẠT | `BBTN_DGA_MBA-SMOKE-02_Pha-A_2026-11-06.docx` 231 KB |
| D3 | Thấy trong Lịch sử đo, Xu hướng; Cảnh báo cập nhật | ĐẠT | |
| D4 | Sửa bản ghi vừa lưu | ĐẠT | vẫn 1 bản ghi, H2 120 → 125 |
| D4 | Xóa có hộp xác nhận | ĐẠT | "Xóa lần đo này khỏi lịch sử?" → còn 0 |
| D5 | Lý-Hóa dầu: nhập tay → Đánh giá & Lưu | ĐẠT | Kết luận "Đạt", căn cứ Bảng 58 Điều 50 |
| D5 | Xuất BBTN DOCX dầu MBA | ĐẠT | `BBTN_LyHoaDau_MBA-SMOKE-02_2026-11-06.docx` 162 KB |
| D5 | Nhập BBTN PDF cũ (khí hòa tan) → đọc các trường | ĐẠT | đọc H2/CH4/C2H2/CO/CO2, Thiết bị "M4100" |
| D6 | Nhập hàng loạt 2 BBTN dầu (Word) **cùng nội dung**, tên khác | ĐẠT | xem trước 2 dòng, file 2 báo "Trùng biên bản… tick thì GHI ĐÈ"; lưu 4 bản ghi (thùng chính + OLTC, 3 pha); **1** file đính kèm (`764b16b4_…docx`, gom theo SHA-256) |
| D6 | Nhập hàng loạt BBTN **khí** | KHÔNG KIỂM ĐƯỢC | 3 BBTN khí mẫu có trên máy đều báo "Không đọc được Ngày lấy mẫu" (2 file trong `data/uploads/` chỉ là file giả 34–45 byte) — **bản `a14f59a` báo y hệt** với cùng file, không phải do refactor |
| D7 | Quản trị: danh sách người dùng, Cấu hình quy định | ĐẠT | 190 tài khoản, 34 bảng quy định |
| D8 | Sáng/tối, 375 / 768 / 1440px: không tràn ngang | ĐẠT | cả bố cục tab ngang và sidebar (Bước 6) |
| D9 | Mất mạng → thao tác lưu vào hàng đợi | ĐẠT | badge "Chạy offline, tự đồng bộ khi có mạng (1)" |
| D9 | Có mạng lại → hàng đợi tự gửi, bản ghi có trên máy chủ | **ĐẠT** (sau sửa #5) | trước khi sửa: hàng đợi về 0 nhưng máy chủ **không có** bản ghi → mất dữ liệu (lỗi #5). Sau `030d246`: bản ghi có trong `database.json` |

## 4. Ba chế độ chạy

| Chế độ | Kết quả | Ghi chú |
|---|---|---|
| On-premise `http://localhost:<cổng>` (`npm start` / `chay_dga_offline.bat`) | ĐẠT | mục 3 (D9 đạt sau sửa #5); chỉ phục vụ file web theo danh sách cho phép (sau sửa #4) |
| `file:///…/index.html` (API `http://localhost:8080`) | ĐẠT một phần | đăng nhập, 57 lần đo, 10 tab chạy; **2 module đọc BBTN PDF / tấm nhãn bị chặn** (CORS với `type="module"` từ `file://`) → lỗi #8, **có từ trước** (bản `a14f59a` y hệt) |
| Offline: Service Worker phục vụ cache | **KHÔNG ĐẠT** | Service Worker **không được đăng ký** (0 bản đăng ký) nên tải lại trang khi mất mạng thất bại → lỗi #2, có từ trước |
| Hàng đợi đồng bộ khi có mạng lại | **ĐẠT** (sau sửa #5) | on-premise kiểm trên trình duyệt; Google Sheets không kiểm được trên máy (cần Apps Script thật) — `tests/sync-queue-modes.test.js` kiểm cả 2 chế độ |
| `mobile/index.html` | ĐẠT (giới hạn có sẵn) | nạp không lỗi, không vi phạm CSP; bản mobile có `config.js` riêng **chỉ dùng Google Sheets** nên trên máy chủ nội bộ không có dữ liệu — bản `a14f59a` y hệt |

## 5. Console, 404, CSP

| Hạng mục | Kết quả |
|---|---|
| Lỗi JS (pageerror) — 10 tab, on-premise | ĐẠT — 0 |
| File 404 | ĐẠT — 0 |
| Vi phạm CSP ("Refused to …") — on-premise, `file://`, mobile | ĐẠT — 0 |
| Lỗi console còn lại | 1 × `400 /api?action=supabaseSyncStatus` khi mở tab Quản trị — lỗi #1, có từ trước (máy chủ nội bộ không có action này) |

## 6. Lỗi có từ trước (chi tiết ở `BUGS_FOUND.md`)

| # | Lỗi | Mức | Ảnh hưởng ở Bước 7 |
|---|---|---|---|
| 5 | On-premise: thao tác lưu lúc mất mạng bị bỏ khỏi hàng đợi mà không gửi | Cao — mất dữ liệu | **ĐÃ SỬA** `030d246` |
| 4 | Máy chủ nội bộ cho tải `data/database.json`, `.git/`, mã nguồn không cần đăng nhập | Cao — bảo mật | **ĐÃ SỬA** `299aedf` (khởi động lại máy chủ đang chạy) |
| 2 | Service Worker không bao giờ được đăng ký | Trung bình | offline không đạt |
| 8 | `file://`: không nạp được module đọc BBTN PDF / tấm nhãn | Trung bình | `file://` đạt một phần |
| 1 | `supabaseSyncStatus` trả 400 trên máy chủ nội bộ | Thấp | 1 lỗi console |
| 3 | 2 trường BBTN TI đọc sai | Thấp | — |

## 7. Cách chạy lại

Script kiểm thử (Playwright, Python) nằm ngoài repo (thư mục tạm của phiên làm việc). Muốn đưa vào repo thành bộ
kiểm thử e2e cố định (`tests/e2e/`), cần thêm `@playwright/test` vào devDependencies; để Bước 8 hoặc sau.
