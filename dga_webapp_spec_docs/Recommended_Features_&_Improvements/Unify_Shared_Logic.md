# Use Case: Unify Shared Logic

**Description:** Loại bỏ bản sao logic giữa bản web và bản di động để hai bản luôn cho **cùng một kết luận** với cùng số liệu — hiện chúng đã lệch nhau.

Type: refactor | Priority: **3 (sau khi có Jest)** | Effort: ~1–2 tuần cho phần logic DGA; storage/BBTN thêm ~1–2 tuần (ước tính lại; bản gốc ghi 3+ tháng cho toàn bộ)

## Trạng thái: ⏸ CHƯA THỰC HIỆN — cần quyết định của bạn
- Việc hợp nhất sẽ **đổi kết luận trên bản di động** (bản mobile đang dùng IEC 1999, chưa có dự báo/cấu hình quy định). Cần xác nhận: bản di động có cần đủ tính năng như web không, và chấp nhận đổi kết luận cũ trên di động không.
- Bước đo độ lệch (mục MAIN bước 1) làm được ngay sau khi có bạn xác nhận hướng đi; bộ Jest hiện có đã sẵn sàng làm golden case.

## Hiện trạng (đối chiếu mã nguồn)
`mobile/README.md` nói các file trong `mobile/` là **"bản sao y hệt"** bản web. Thực tế **không còn đúng**:

| File | Web | Mobile | Nhận xét |
|---|---|---|---|
| Logic DGA | `dga-logic.js` (lắp ráp) + 8 file `logic/dga-logic-*.js` ≈ 2.400 dòng | `mobile/dga-logic.js` **909 dòng, một file** | Mobile là bản cũ trước đợt tách/cập nhật |
| `storage.js` | 788 dòng | 550 dòng | Khác ~244 dòng |
| `bbtn-export.js`, `bbtn-import.js`, `config.js` | có | có | Đều **khác** bản web |

Độ lệch logic đo bằng số lần xuất hiện từ khóa trong file:

| Nội dung | Web (`logic/*` + `dga-logic.js`) | Mobile |
|---|---:|---:|
| Dự báo xu hướng (`forecast`) | 23 | **0** |
| Cấu hình quy định (`regulation`) | 64 | **0** |
| Nhắc tới "2022" (IEC 60599:2022) | 38 | **0** |
| Nhắc tới "1999" (IEC 60599:1999) | 4 | 15 |
| Bushing / Table A.10 | 61 | 11 |

Nghĩa là bản di động vẫn dựa trên **IEC 60599:1999**, chưa có cấu hình quy định, có thể **cho kết luận khác** bản web với cùng số liệu — trái với cam kết trong `mobile/README.md` ("luôn ra kết luận giống hệt nhau").

## Actors
- Developer / người bảo trì
- Kỹ sư dùng bản di động ngoài hiện trường (bị ảnh hưởng nếu kết luận lệch)

## Precondition
- Đã có bộ test lõi ([Implement_Jest_Unit_Tests](./Implement_Jest_Unit_Tests.md)) để chứng minh "hai bản cho cùng kết quả".
- Xác nhận với người dùng: bản di động có cần đủ tính năng như web (dự báo, cấu hình quy định) hay chỉ một tập con.

## Postcondition
- Chỉ còn **một nguồn sự thật** cho logic DGA; bản di động dùng lại đúng logic đó.
- Có kiểm tra tự động phát hiện khi hai bản lệch nhau.

## Flows
### MAIN
1. **Đo độ lệch trước khi sửa:** viết một script so sánh kết quả `DGA` web và mobile trên cùng bộ số liệu mẫu (tái dùng golden case của Jest) → lập danh sách các trường hợp cho kết luận khác nhau. Đây là bằng chứng và cũng là danh sách việc phải kiểm tra.
2. **Chọn một nguồn duy nhất**: thư mục `logic/` của bản web là nguồn chuẩn. Đặt một thư mục dùng chung (ví dụ `shared/` hoặc giữ nguyên `logic/`) mà cả `index.html` và `mobile/index.html` cùng tham chiếu — **không** nhân bản file.
3. **Cách để mobile dùng chung** (chọn 1, theo cách triển khai/hosting đang dùng):
   - *(a) Tham chiếu đường dẫn tương đối* `../logic/...` từ `mobile/index.html` — đơn giản nhất nếu hai bản cùng host trong một repo; **cần kiểm tra** hosting hiện tại có phục vụ được thư mục cha hay không (mobile có thể được deploy riêng theo `mobile/README.md`).
   - *(b) Script đồng bộ* (ví dụ `npm run sync-mobile`) sao chép `logic/*` sang `mobile/` khi build/deploy, kèm test "hai bản giống hệt" chạy trong CI. Dễ triển khai, nhưng vẫn có bản sao — chỉ chấp nhận nếu có kiểm tra tự động.
4. **Xử lý riêng từng nhóm file**:
   - `dga-logic`: thay hoàn toàn bản mobile cũ bằng logic chuẩn. Đối chiếu giao diện mobile với các hàm mới (đổi tên/tham số) và kiểm tra các màn hình dùng chúng.
   - `storage.js`: gom phần **chung** (Google Sheets/Supabase/localStorage, `Auth`) thành một file; phần khác biệt thật sự của mobile (nếu có) tách thành lớp mỏng. Kiểm tra kỹ vì ảnh hưởng đăng nhập và dữ liệu thật.
   - `bbtn-export.js`, `bbtn-import.js`: xác định vì sao khác (mobile có thể đơn giản hơn có chủ ý) rồi mới hợp nhất.
   - `config.js`: **giữ riêng** hoặc dùng chung một nguồn — README yêu cầu hai bản phải có cùng URL/khóa, nên hợp nhất sẽ giảm rủi ro cấu hình lệch.
5. **Cập nhật `mobile/README.md`** cho đúng thực tế sau khi hợp nhất, và bỏ câu khẳng định "bản sao y hệt" nếu không còn đúng.
6. **Thêm kiểm tra chống lệch**: test tự động so sánh `DGA` của hai bản trên cùng đầu vào; chạy trong CI.

### EXCEPTION: Sau khi hợp nhất, kết luận đổi so với trước trên bản di động
1. Đây là **dự kiến** (bản di động đang dùng IEC 1999) — không phải lỗi.
2. Ghi vào lịch sử thay đổi để kỹ sư biết cùng một số liệu cũ có thể ra mức đánh giá khác trên di động.
3. Bản ghi cũ đã lưu **không tự tính lại** trong cơ sở dữ liệu; kết luận hiển thị được tính lúc xem, nên cần kiểm tra Lịch sử đo/Cảnh báo sau khi đổi.

## Tiêu chí hoàn thành
- Không còn `mobile/dga-logic.js` là bản cũ độc lập.
- Test so sánh web ↔ mobile pass cho toàn bộ golden case.
- `mobile/README.md` mô tả đúng cách dùng chung.

## Rủi ro và lưu ý
- **Đây là việc cần nhất trong nhóm cải tiến**, nhưng cũng có rủi ro thay đổi kết luận trên di động → làm sau Jest, phát hành từng bước (logic DGA trước, storage sau).
- Không nên "làm đẹp" đồng loạt thành thư mục `/core` lớn (kế hoạch ban đầu 3+ tháng); chỉ hợp nhất phần thực sự trùng lặp và đang lệch.

## Liên quan
- Phụ thuộc [Implement_Jest_Unit_Tests](./Implement_Jest_Unit_Tests.md).
- Nên thống nhất cách nạp file với [Implement_Module_System](./Implement_Module_System.md) trước khi chọn phương án 3(a) hay 3(b).

[Rationale]
Tính nhất quán kết luận giữa web và di động là cam kết đã ghi trong tài liệu, nhưng số liệu cho thấy logic mobile đã tụt lại một đợt cập nhật lớn (IEC 2022, dự báo, cấu hình quy định). Với công cụ hỗ trợ đánh giá thiết bị điện, hai giao diện cho hai kết luận khác nhau là rủi ro thật, không chỉ là nợ kỹ thuật.

[Estimated effort]: ~1–2 tuần (logic DGA) + ~1–2 tuần (storage/BBTN/config)
