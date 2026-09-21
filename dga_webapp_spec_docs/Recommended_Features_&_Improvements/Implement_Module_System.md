# Use Case: Implement Module System

**Description:** Chuyển dần từ các thẻ `<script>` thường dùng chung global scope sang ES modules để giảm ô nhiễm namespace và làm rõ phụ thuộc giữa các file.

Type: refactor | Priority: **4 (làm từng phần, sau Jest)** | Effort: ~2–3 tuần cho lớp logic; toàn bộ UI ~1–2 tháng (ước tính lại)

## Trạng thái: ⏸ CHƯA THỰC HIỆN — cần quyết định của bạn
- Cần chốt: app còn phải chạy được khi mở `index.html` trực tiếp (`file://`) không? ES modules không chạy được theo cách đó. Nếu vẫn cần, chỉ nên dừng ở giai đoạn A.
- Giai đoạn A (bọc IIFE) **không** làm được máy móc vì ~200 hàm global trong `ui/` và `app-core.js` gọi lẫn nhau qua tên (và có thể qua `onclick` trong HTML) — mỗi file cần rà soát tên nào phải xuất ra `window`.

## Hiện trạng (đối chiếu mã nguồn)
- `index.html` nạp ~30 file bằng `<script>` thường, **thứ tự nạp quyết định app chạy được hay không**: `config.js` → 8 file `logic/dga-logic-*.js` → `dga-logic.js` → `storage.js` → `ui/*` → `bbtn/*` → `app-core.js`.
- Chỉ **2 file** đã là ES module: `bbtn/bbtn-import.js`, `bbtn/nameplate-import.js` (`<script type="module">`).
- `logic/`: 8 file dùng chung global scope; `dga-logic-core.js` là "hub", các file còn lại phụ thuộc core (theo chú thích trong `dga-logic.js`). Nhánh Node nạp chúng bằng `vm` để mô phỏng đúng cách này.
- `ui/*` + `app-core.js`: khoảng **200 hàm khai báo ở top-level** (global) và gọi lẫn nhau qua tên; `Storage`, `Auth`, `DGA` gắn vào `window`.
- Đây **không phải lỗi đang xảy ra**: app chạy ổn; đây là nợ kỹ thuật ảnh hưởng khả năng bảo trì (xung đột tên, phụ thuộc ngầm, khó test UI).

## Actors
- Developer / người bảo trì

## Precondition
- Có bộ test lõi ([Implement_Jest_Unit_Tests](./Implement_Jest_Unit_Tests.md)) và bản chạy thủ công trên các tab chính để so sánh trước/sau.
- Xác nhận quy tắc **chạy không cần build**: hiện có thể mở `index.html` trực tiếp (README mục 1). ES modules **không chạy qua `file://`** trên nhiều trình duyệt (bị chặn CORS) — cần server tĩnh hoặc GitHub Pages.

## Postcondition
- Lớp logic là ES modules có `import`/`export` rõ ràng; thứ tự nạp không còn là "kiến thức ngầm".
- Không đổi hành vi nào nhìn thấy được với người dùng.

## Flows
### MAIN
1. **Quyết định ràng buộc trước:** app còn cần mở trực tiếp bằng `file://` (dùng thử ngoại tuyến) hay chấp nhận yêu cầu server tĩnh? Nếu vẫn cần `file://`, **hoãn** hạng mục này hoặc chỉ làm bước 2 (giữ tương thích).
2. **Bước rẻ nhất, an toàn nhất — giảm namespace mà không đổi cách nạp:** giữ `<script>` thường nhưng bọc mỗi file `logic/*` và `ui/*` trong IIFE, chỉ gắn ra ngoài đúng những tên cần dùng (ví dụ `window.DGA` như hiện tại). Giảm va chạm tên với rủi ro rất thấp.
3. **Chuyển lớp logic sang ES modules trước** (`logic/*`): `dga-logic-core.js` xuất hằng số/hàm; các file còn lại `import` từ core; `dga-logic.js` gom lại thành `DGA` và vẫn gán `window.DGA` để phần UI cũ dùng được (**lớp tương thích**). Nhánh Node của `dga-logic.js` (dùng `vm`) được thay bằng `import` thật — Jest hỗ trợ ES modules.
4. **Chuyển `storage.js`** (`Storage`, `Auth`) sang module; vẫn gán `window.Storage`/`window.Auth` trong giai đoạn chuyển tiếp.
5. **Chuyển UI theo từng tab**, mỗi lần một file (`ui-alerts.js`, `ui-trend.js`, …): thay lời gọi hàm global bằng `import`; xóa `window.*` tương ứng khi không còn ai dùng. Ưu tiên tab tách biệt (Cảnh báo, Xu hướng, Phản hồi) trước; `ui-dga.js` (1.148 dòng) và `app-core.js` (1.213 dòng) làm sau cùng.
6. **Dọn `index.html`:** thay dãy ~30 thẻ `<script>` bằng một điểm vào (`<script type="module" src="main.js">`) khi UI đã chuyển xong.
7. **Kiểm tra tương thích:** chạy trên Chrome, Edge, Safari, di động; xác nhận GitHub Pages phục vụ đúng MIME cho `.js` module.

### EXCEPTION: Vòng phụ thuộc (circular import)
1. Nếu hai file UI gọi lẫn nhau qua hàm global cũ, `import` sẽ tạo vòng phụ thuộc.
2. Tách phần dùng chung thành file thứ ba (ví dụ `ui/ui-common.js`) hoặc truyền hàm qua tham số/sự kiện.

### EXCEPTION: Bản di động
1. Bản `mobile/` dùng logic riêng (đang lệch, xem [Unify_Shared_Logic](./Unify_Shared_Logic.md)).
2. Không chuyển module cho mobile trước khi hợp nhất logic — tránh làm hai lần.

## Tiêu chí hoàn thành (theo từng giai đoạn)
- Giai đoạn A (bước 2): mọi file `logic/*`, `ui/*` bọc IIFE; toàn bộ tab chạy như cũ.
- Giai đoạn B (bước 3–4): `logic/` và `storage.js` là ES modules; test Jest import trực tiếp, không còn dùng `vm`.
- Giai đoạn C (bước 5–6): không còn hàm global nào ngoài điểm vào; `index.html` chỉ một thẻ script module.

## Rủi ro và lưu ý
- **Đây là cải tiến ít cấp bách nhất** về mặt người dùng cuối (không thêm tính năng, không sửa lỗi). Chỉ nên làm khi việc bảo trì thật sự bị cản trở bởi cấu trúc hiện tại.
- Cần server tĩnh khi phát triển (ví dụ `python -m http.server`), README đã hướng dẫn cách này.
- Dùng CDN (Chart.js, xlsx, Supabase, Google Identity Services) vẫn qua `<script>` thường; đừng cố chuyển các thư viện này.

## Liên quan
- Nền tảng cho [Migrate_to_TypeScript](./Migrate_to_TypeScript.md) (TypeScript cần biên giới module rõ ràng).

[Rationale]
Cấu trúc hiện tại chạy tốt nhưng phụ thuộc thứ tự nạp và tên toàn cục (~200 hàm). Chuyển dần theo từng lớp giúp giảm rủi ro xung đột tên và làm rõ phụ thuộc, nhưng không cần làm một lần; bước IIFE cho phần lớn lợi ích với rủi ro thấp.

[Estimated effort]: giai đoạn A ~2–3 ngày; B ~2–3 tuần; C ~1–2 tháng
