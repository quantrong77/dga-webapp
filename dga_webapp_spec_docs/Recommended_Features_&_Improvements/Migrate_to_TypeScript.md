# Use Case: Migrate to TypeScript

**Description:** Bổ sung kiểm tra kiểu tĩnh cho các phép tính chẩn đoán DGA để phát hiện lỗi (sai tên khí, thiếu trường, `undefined` so sánh với số) ngay lúc viết, thay vì lúc chạy.

Type: upgrade | Priority: **5 (thấp nhất — làm theo hướng "kiểm tra kiểu dần dần")** | Effort: ~1–2 tuần cho JSDoc + `checkJs` ở lớp logic; chuyển hẳn sang `.ts` ~2–3 tháng (ước tính lại; bản gốc chỉ ghi "3+ tháng")

## Trạng thái: ⏸ CHƯA THỰC HIỆN — ưu tiên thấp nhất
- Nấc 1 (JSDoc + `checkJs`) có thể làm bất cứ lúc nào vì đã có `package.json`; nên chờ quyết định về [Implement_Module_System](./Implement_Module_System.md) trước khi định nghĩa kiểu cho toàn bộ lớp logic.

## Hiện trạng (đối chiếu mã nguồn)
- Toàn bộ mã là **JavaScript thuần**, không có `tsconfig.json` hay bước build nào; app chạy trực tiếp từ `index.html`. (`package.json` đã có từ đợt thêm Jest nhưng chỉ phục vụ kiểm thử.)
- Dữ liệu chạy qua nhiều dạng object không có định nghĩa kiểu: bản ghi lần đo (7 khí + N2/O2 + trường tùy chọn), kết quả `computeOverallStatus`, cấu hình tiêu chuẩn nhà sản xuất, bản ghi từ Google Sheets/Supabase/localStorage.
- Tên trường lưu ở cột Google Sheet / bảng Supabase là chuỗi; dễ lệch giữa `storage.js`, `gsheet/Code.gs` và `supabase-schema.sql`.
- Chuyển hẳn sang TypeScript đồng nghĩa **thêm bước build** — thay đổi lớn với dự án hiện chạy tĩnh trên GitHub Pages và mở trực tiếp bằng trình duyệt.

## Actors
- Developer / người bảo trì

## Precondition
- Đã có [Implement_Jest_Unit_Tests](./Implement_Jest_Unit_Tests.md) (để phát hiện hồi quy khi thêm kiểu).
- Đã cân nhắc [Implement_Module_System](./Implement_Module_System.md) (TypeScript hoạt động tốt nhất khi phụ thuộc file rõ ràng).

## Postcondition
- Lớp logic DGA và các cấu trúc dữ liệu chính có định nghĩa kiểu được trình biên dịch kiểm tra.
- Sai tên trường hoặc sai kiểu khí bị phát hiện trước khi triển khai.

## Flows
### MAIN (đề xuất: tiến từng nấc, dừng ở nấc nào đủ dùng)
1. **Nấc 1 — JSDoc + `// @ts-check` (không đổi ngôn ngữ, không thêm build):**
   - Thêm `jsconfig.json`/`tsconfig.json` với `checkJs: true`, `noEmit: true`; dùng `tsc --noEmit` chỉ như một bước kiểm tra, **không** biên dịch ra file.
   - Viết `@typedef` cho các cấu trúc trung tâm: `GasReading` (7 khí + N2/O2), `Measurement` (bản ghi lần đo), `OverallStatus`, `ManufacturerStandard`, `OilTestResult`.
   - Gắn `@param`/`@returns` cho các hàm lõi trong `logic/dga-logic-gas.js`, `dga-logic-oil.js`, `dga-logic-forecast.js`.
   - Bật dần `@ts-check` từng file, sửa cảnh báo thật, chỉ dùng `@ts-ignore` kèm lý do.
2. **Nấc 2 — Đồng bộ định nghĩa kiểu với nơi lưu trữ:** một file kiểu duy nhất (`types.d.ts`) mô tả bản ghi; đối chiếu với `supabase-schema.sql` và tiêu đề cột trong `gsheet/Code.gs` để bắt lệch tên trường sớm.
3. **Nấc 3 — Chuyển `logic/` sang `.ts` (chỉ khi nấc 1–2 chứng minh có lợi):**
   - Yêu cầu đã có ES modules cho `logic/` (Giai đoạn B của Module System).
   - Chọn công cụ build nhẹ (ví dụ `esbuild`/`tsc`) xuất ra `logic/*.js` để `index.html` vẫn nạp file JS thường; thêm bước build vào README và CI.
4. **Nấc 4 — Chuyển `storage.js` và `ui/*`** — chỉ nếu thực sự cần; UI thao tác DOM nhiều nên lợi ích thấp hơn logic.

### EXCEPTION: Bước build làm hỏng luồng "mở `index.html` là chạy"
1. Nếu người dùng nội bộ vẫn cần chạy trực tiếp không server → chỉ dừng ở Nấc 1–2 (không phát sinh build).
2. Nếu chuyển sang Nấc 3: commit cả file `.js` đã biên dịch để triển khai GitHub Pages không đổi, hoặc thêm bước build vào CI.

## Tiêu chí hoàn thành
- Nấc 1: `tsc --noEmit` chạy sạch trên `logic/*` với `checkJs`; không thêm phụ thuộc runtime.
- Nấc 2: một nguồn định nghĩa kiểu bản ghi, khớp với schema Supabase và Google Sheet.
- Nấc 3 (nếu làm): test Jest và tất cả tab chạy như trước; số lỗi kiểu = 0.

## Rủi ro và lưu ý
- **Tỷ suất lợi ích/chi phí thấp nhất** trong nhóm cải tiến: bộ test (Jest) đã chặn phần lớn lỗi tính toán với chi phí thấp hơn nhiều.
- Sai lệch lớn nhất (ngưỡng sai so với văn bản gốc) **TypeScript không bắt được** — chỉ test dựa trên văn bản gốc mới bắt được.
- Nhóm bảo trì cần quen TypeScript; nếu nhân sự thay đổi thường xuyên, JSDoc + `checkJs` dễ duy trì hơn.

## Liên quan
- Sau [Implement_Jest_Unit_Tests](./Implement_Jest_Unit_Tests.md) và [Implement_Module_System](./Implement_Module_System.md).

[Rationale]
Kiểm tra kiểu giúp bắt lỗi cấu trúc dữ liệu (sai tên trường, thiếu khí, `undefined`) trong phép tính chẩn đoán, nhưng chuyển hẳn sang TypeScript kéo theo bước build và thay đổi cách vận hành của một app hiện chạy tĩnh. Đi từng nấc (JSDoc → kiểu dùng chung → `.ts` cho logic) lấy được phần lớn lợi ích với chi phí nhỏ và dừng lại được bất kỳ lúc nào.

[Estimated effort]: Nấc 1 ~1–2 tuần; Nấc 2 ~2–3 ngày; Nấc 3 ~1–2 tháng; Nấc 4 ~2–3 tháng
