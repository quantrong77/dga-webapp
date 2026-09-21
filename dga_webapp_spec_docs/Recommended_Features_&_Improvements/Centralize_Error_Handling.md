# Use Case: Centralize Error Handling

**Description:** Tạo một điểm xử lý lỗi tập trung ở phía trình duyệt để mọi lỗi (đồng bộ, bất đồng bộ, lỗi gọi database) được ghi nhận và báo cho người dùng theo cùng một cách, thay vì `alert()` rải rác và `catch` bỏ trống.

Type: fix | Priority: **2** | Effort: ~3–5 ngày (ước tính lại; bản gốc ghi ~1 tuần)

## Trạng thái: ✅ ĐÃ THỰC HIỆN phần web (2026-09-20)
- Thêm `ui/ui-errors.js` (nạp ngay sau `config.js` trong `index.html`): `notifyError`, `reportError`, `errorMessageOf`, `installGlobalErrorHandlers`; chống lặp toast trong 2 giây; đăng ký `error` + `unhandledrejection` toàn cục; bỏ qua nhiễu `ResizeObserver`; lỗi "Script error." của CDN chỉ ghi log.
- **55/58** lệnh `alert()` đã đổi sang `notifyError()` (toast đỏ, không chặn giao diện); **2** cái là thông báo thành công được đổi sang `showToast()` (lưu cấu hình quy định, lưu tiêu chuẩn NSX); **1** cái được giữ lại có chủ ý: cảnh báo "khí đang để TRỐNG, sẽ tính là 0 ppm" ở `app-core.js` (cần người dùng đọc và xác nhận).
- `showToast`: toast lỗi hiện 6,5 giây (thay vì 2,4 giây) và hiển thị được nhiều dòng (`white-space: pre-line`) để đọc hết gợi ý xử lý (ví dụ nhắc kiểm tra URL Apps Script).
- 8 khối `catch` rỗng: **cả 8 đều là thao tác `localStorage`** (bị chặn ở chế độ riêng tư) nên bỏ qua là chủ ý — đã thêm chú thích nêu lý do, không đổi hành vi.
- Đã kiểm tra: `tests/errors.test.js` (16 test) + chạy thử trong trình duyệt (bản sao ở chế độ localStorage): form trống → toast đỏ "Vui lòng nhập ít nhất Thiết bị và Ngày lấy mẫu."; Promise bị từ chối và lỗi runtime trong `setTimeout` đều hiện toast; luồng nhập → đánh giá bình thường không đổi, không có lỗi console.
- **Chưa làm:** phân loại lỗi theo bản chất (bước 3 bên dưới — hiện mọi thông điệp dùng cùng một kiểu toast); hàm bọc `withErrorHandling` (bỏ vì handler toàn cục đã bắt Promise không được `await`, thêm nữa sẽ là mã chết); gửi lỗi về sheet `error_log` (bước 6, tùy chọn); áp dụng cho bản `mobile/`.

## Hiện trạng (đối chiếu mã nguồn)
Số liệu đếm trong `app-core.js`, `ui/`, `bbtn/`, `storage.js`:

| Hiện tượng | Số lượng | Hệ quả |
|---|---:|---|
| Gọi `alert()` để báo lỗi/xác nhận | 58 | Chặn giao diện, không thống nhất; trên di động rất khó chịu |
| Gọi `showToast()` (cơ chế thông báo đã có) | 10 | Đã có sẵn cơ chế tốt nhưng ít được dùng |
| `catch` rỗng (nuốt lỗi âm thầm) | 8 | Lỗi mất tích, người dùng và người bảo trì đều không biết |
| `console.error` / `console.warn` | 19 | Chỉ nhìn thấy khi mở DevTools |
| Handler toàn cục `window.onerror` / `unhandledrejection` | **0** | Lỗi ngoài `try/catch` (ví dụ trong callback sự kiện, Promise không được `await`) biến mất không dấu vết |

Ngoài ra `try/catch` nằm rải rác (~75 chỗ) với cách xử lý mỗi nơi một kiểu. Riêng `storage.js` đã có thông báo lỗi rõ ràng bằng tiếng Việt (ví dụ "Đọc file thất bại."), đây là mẫu tốt cần giữ lại.

## Actors
- Người dùng cuối (nhận thông báo lỗi dễ hiểu)
- Developer / người bảo trì (cần biết lỗi đã xảy ra ở đâu)

## Precondition
- App đã tải xong và `showToast()` (trong `ui/ui-auth.js`) sẵn sàng.

## Postcondition
- Mọi lỗi chưa được xử lý đều hiện thông báo thân thiện và được ghi lại (không mất dấu).
- Người dùng không còn thấy hộp thoại `alert()` cho lỗi thông thường.

## Flows
### MAIN
1. **Tạo module xử lý lỗi** (đề xuất `ui/ui-errors.js`, nạp **trước** các file `ui/*` trong `index.html`), cung cấp:
   - `reportError(err, context)` — chuẩn hóa lỗi, ghi `console.error`, hiện toast mức "lỗi" bằng tiếng Việt, kèm ngữ cảnh (đang lưu lần đo / đang đọc PDF / đang nạp dữ liệu…).
   - `withErrorHandling(fn, context)` — bọc hàm bất đồng bộ dùng cho các handler nút bấm.
2. **Đăng ký handler toàn cục** một lần lúc khởi động:
   - `window.addEventListener("error", …)`
   - `window.addEventListener("unhandledrejection", …)`
   Cả hai gọi `reportError`; chống lặp toast khi cùng một lỗi lặp liên tục (gộp trong ~2 giây).
3. **Phân loại lỗi** để thông báo đúng bản chất:
   - *Lỗi nhập liệu* (thiếu số, giá trị âm, TI/TU chưa chọn nhà sản xuất) → giữ hiển thị **ngay tại form**, không phải toast toàn cục.
   - *Lỗi mạng/database* (Apps Script/Supabase không phản hồi, sai URL, chưa "Anyone" access) → toast "Không kết nối được database", gợi ý thử lại.
   - *Lỗi quyền* (User sửa bản ghi của người khác) → thông báo rõ quyền.
   - *Lỗi không lường trước* → thông báo chung + ghi log.
4. **Thay dần `alert()` bằng `showToast()`/`reportError()`** theo thứ tự: luồng lưu dữ liệu (`ui-dga.js`, `ui-oil.js`, `ui-oltc.js`, `ui-ti-oil.js`) → nhập PDF (`bbtn/*`) → quản trị/tiêu chuẩn. Giữ `confirm()` cho thao tác **xóa** và **đăng xuất** (đó là hộp xác nhận, không phải báo lỗi).
5. **Xử lý 8 khối `catch` rỗng**: mỗi khối phải hoặc (a) ghi log + báo người dùng, hoặc (b) có comment nêu lý do chủ ý bỏ qua (ví dụ truy cập `localStorage` bị chặn ở chế độ riêng tư).
6. (Tùy chọn) Khi chạy ở chế độ Google Sheets: gửi lỗi nghiêm trọng về một sheet `error_log` để Admin xem — chỉ làm nếu thật sự cần; không thu thập dữ liệu nhạy cảm của thiết bị.

### EXCEPTION: Bản thân bộ xử lý lỗi gặp lỗi
1. Nếu `showToast` không tồn tại (script nạp lỗi) → dự phòng `console.error` và một `alert` duy nhất.
2. Không để bộ xử lý lỗi ném thêm lỗi (tránh vòng lặp vô hạn).

## Tiêu chí hoàn thành
- Không còn `catch` rỗng không có chú thích lý do.
- Gây lỗi giả (ví dụ tắt mạng rồi bấm "Phân tích & Lưu") → hiện đúng một toast rõ ràng, không `alert`, có dòng log.
- Ném lỗi trong một `setTimeout` bất kỳ → vẫn hiện toast (nhờ handler toàn cục).
- Số lần gọi `alert(` trong luồng nhập dữ liệu giảm về 0.

## Rủi ro và lưu ý
- Bản di động (`mobile/app.js`, 1729 dòng) có cách xử lý riêng; nên áp dụng cùng module sau khi web ổn định.
- Không nuốt lỗi của phép tính DGA: nếu một hàm đánh giá ném lỗi, phải báo — đừng để hiện kết luận "Bình thường" do lỗi bị bỏ qua.

## Liên quan
- Dễ kiểm chứng hơn khi đã có [Implement_Jest_Unit_Tests](./Implement_Jest_Unit_Tests.md) cho phần logic; phần UI kiểm tra thủ công hoặc bằng Playwright (dự án đã có `.playwright/`).

[Rationale]
Hiện lỗi được xử lý theo nhiều cách khác nhau và một phần bị nuốt. Với công cụ đánh giá tình trạng thiết bị điện, việc lưu thất bại mà người dùng không biết (nghĩ rằng đã lưu) là rủi ro thực tế. Cơ chế toast đã có sẵn nên chi phí thấp.

[Estimated effort]: ~3–5 ngày
