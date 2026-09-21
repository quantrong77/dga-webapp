# Use Case: Implement Jest Unit Tests

**Description:** Đảm bảo độ chính xác của logic DGA (ngưỡng QĐ1901/IEC 60599:2022, tỷ số khí, Tam giác Duval, đánh giá dầu, dự báo) bằng bộ kiểm thử tự động, để mọi lần chỉnh sửa ngưỡng hoặc thuật toán đều có lưới an toàn.

Type: test | Priority: **1 (làm đầu tiên)** | Effort: ~1–2 tuần cho bộ test lõi (ước tính lại; bản gốc ghi ~1 tháng)

## Trạng thái: ✅ ĐÃ THỰC HIỆN (2026-09-20)
- Thêm `package.json` (chỉ `devDependencies: jest`, script `npm test`) và thư mục `tests/` gồm 8 file, **159 test** — chạy ~2 giây. Cách chạy ghi ở `README.md` mục 6.
- Bao phủ: đánh giá tuyệt đối/chọn tiêu chuẩn (kể cả NSX, ngưỡng loại bỏ), Bảng 66, Table A.10, Duval 1, tốc độ sinh khí, Bảng 63 + tỷ lệ bổ sung, trạng thái tổng thể, dầu MBA/OLTC/TI-TU, dự báo, cấu hình quy định, xử lý lỗi (`ui/ui-errors.js`), và bất biến trên 300 tổ hợp khí ngẫu nhiên (seed cố định).
- Đã kiểm tra độ nhạy: cố ý đổi ngưỡng T3 và điều kiện biên `<=` → test báo đỏ đúng chỗ; khôi phục xong (file logic khớp hệt HEAD).
- **Chưa làm:** CI (GitHub Actions); test phần `storage.js`/`ui/*`/`app-core.js`; đo độ bao phủ (xem "Điều chỉnh" bên dưới).
- **Phát hiện khi viết test** (ghi bằng `test.failing` trong `tests/invariants.test.js`, chưa sửa code — chờ người có thẩm quyền quyết định):
  1. `diagnoseRatios`: điểm C2H2/C2H4 = 1,5; CH4/H2 = 0,3; C2H4/C2H6 = 1,5 chỉ khớp **D1** theo IEC 60599:2022 Table 1 (D2 cần C2H4/C2H6 > 2), nhưng code trả "D1/D2 (vùng chồng lấn)".
  2. `computeRatios` trả 999 cho mọi mẫu số bằng 0, kể cả 0/0 → bộ khí toàn 0 bị chẩn đoán "T3 - Tăng nhiệt > 700°C".
  3. Ô "Ngăn OLTC (thông dầu/khí với thùng chính)": vì lấy giá trị chặt hơn `min(Bảng 64; Table A.2)` nên C2H2 luôn = 20 ppm ở cả hai nhóm → ô này hiện **không đổi kết quả** với số liệu mặc định; `README.md` mục 5 vẫn mô tả khác (20 so với ~270 ppm). Cần quyết định sửa code hay sửa tài liệu (test hiện ghi lại hành vi thực tế của code).
- **Điều chỉnh so với kế hoạch:** tiêu chí "độ bao phủ ≥ 80%" **không đo được bằng Jest** vì `dga-logic.js` nạp logic qua `vm.runInContext` (Jest không đo mã chạy trong `vm`). Thay bằng: mọi hàm công khai trong nhóm rủi ro cao ở mục "Hiện trạng" đều có test. Nếu cần số phần trăm, phải dùng `c8`/`node --experimental-test-coverage` hoặc đổi cách nạp (gắn với [Implement_Module_System](./Implement_Module_System.md)).

## Hiện trạng (đối chiếu mã nguồn)
- **Chưa có** `package.json`, Jest, hay bất kỳ file test nào trong dự án.
- Logic nghiệp vụ **đã tách khỏi DOM** và **đã nạp được trong Node**: `dga-logic.js` có nhánh `module.exports` dùng `vm` để nạp 8 file `logic/dga-logic-*.js` vào một sandbox chung rồi trả về object `DGA`. Nghĩa là **không cần refactor** trước khi viết test — chỉ cần `const DGA = require("./dga-logic.js")`.
- Các hàm rủi ro cao nhất, sai một ngưỡng là kết luận sai thiết bị:
  - `logic/dga-logic-gas.js` (785 dòng): `computeTCG`, `evaluateAbsolute`, `computeRatios`, `diagnoseRatios` (Bảng 66), `diagnoseBushingRatios` (Table A.10), `classifyDuval1`, `computeRateOfChange`, `computeOverallStatus`.
  - `logic/dga-logic-oil.js`, `dga-logic-instrument-oil.js`: `evaluateOilTest`, `evaluateOltcOilTest`, `evaluateInstrumentOilTest`.
  - `logic/dga-logic-forecast.js`: `linearRegression`, `theilSenSlope`, `consecutiveAverageSlope`, `forecastGasTrend`.
  - `logic/dga-logic-regulation-config.js`: `applyRegulationConfigOverride`, `resetRegulationConfigItem` (cấu hình ngưỡng có thể bị ghi đè lúc chạy → cần test để bảo đảm reset về đúng mặc định).
- Lớp `storage.js`, `ui/*`, `app-core.js` phụ thuộc DOM/`fetch`/`localStorage`: **không** thuộc phạm vi đợt này.

## Actors
- Developer / người bảo trì

## Precondition
- Node.js đã cài; có quyền thêm `package.json` vào thư mục gốc dự án.
- Logic DGA vẫn nạp được bằng `require("./dga-logic.js")` (không đổi cơ chế `vm`).

## Postcondition
- `npm test` chạy được, độ bao phủ các hàm tính toán lõi đạt mục tiêu bên dưới.
- Đổi một ngưỡng trong bảng QĐ1901/IEC mà không cập nhật test thì test đỏ.

## Flows
### MAIN
1. Tạo `package.json` (chỉ `devDependencies: jest`), thêm script `"test": "jest"`; đặt `testEnvironment: "node"`. **Không** thêm bước build cho app (app vẫn chạy trực tiếp từ `index.html`).
2. Tạo thư mục `tests/`, viết test theo miền, dùng chính các ví dụ trong văn bản gốc làm **golden case**:
   - **Đánh giá tuyệt đối:** mỗi loại thiết bị (TI, TU, MBA có/không ngăn OLTC thông thùng chính, Sứ xuyên) × trường hợp dưới ngưỡng / đúng bằng ngưỡng / vượt ngưỡng — chú ý điều kiện biên `>` so với `>=`.
   - **Bảng 66:** đủ 6 mã PD, D1, D2, T1, T2, T3; các điều kiện chia cho 0 (H2 = 0, C2H6 = 0, C2H4 = 0); ngưỡng PD theo loại thiết bị (Sứ xuyên 0,07; MBA/Khác 0,1; TI/TU 0,2).
   - **Table A.10 (Sứ xuyên):** trường hợp khớp 0, 1, nhiều mã; trường hợp không khớp thì lùi về Bảng 66.
   - **Duval 1:** điểm nằm giữa các vùng, điểm sát ranh giới, vùng "D+T", tổng CH4+C2H4+C2H2 rất nhỏ.
   - **Tốc độ sinh khí (Bảng 65):** khoảng cách ngày = 0, ngày đảo ngược, lần đo đầu tiên (không có bản trước).
   - **Dầu:** đủ các cấp điện áp và trạng thái dầu (mới/vận hành) của Bảng 54/55/58, Bảng 49 (OLTC); TI/TU không có tiêu chuẩn nhà sản xuất phải trả về trạng thái "chưa có tiêu chuẩn", không được đánh giá Đạt.
   - **Dự báo:** dữ liệu tuyến tính chính xác (R² = 1), dữ liệu có ngoại lai (Theil-Sen ổn định hơn OLS), chỉ 1–2 điểm dữ liệu.
   - **Cấu hình quy định:** ghi đè → đọc lại → `resetRegulationConfigItem` khôi phục đúng số liệu gốc.
3. Thêm test **bất biến** (property-style) rẻ mà bắt lỗi tốt: tăng hàm lượng một khí không bao giờ làm trạng thái tổng thể "tốt hơn"; TCG luôn bằng tổng 5 khí cháy đã định nghĩa; không hàm nào trả `NaN`/`Infinity` khi khí bằng 0.
4. Ghi vào `README.md` mục "Chạy kiểm thử" (`npm install`, `npm test`).
5. (Tùy chọn, sau) Chạy `npm test` trên GitHub Actions cho mỗi lần push, vì repo đã dùng GitHub Pages.

### EXCEPTION: Test phát hiện sai lệch so với văn bản gốc
1. Nếu test dựng theo QĐ1901/IEC cho kết quả khác code hiện tại → **không sửa test cho khớp code**.
2. Đối chiếu lại điều khoản gốc, ghi lại nguồn (Điều/Bảng/Table), rồi mới quyết định sửa code hay sửa test.

## Tiêu chí hoàn thành
- 100% các hàm được liệt kê ở mục "Hiện trạng" có test (độ bao phủ dòng không đo được bằng Jest — xem "Điều chỉnh").
- Mỗi test golden case ghi chú nguồn (Bảng/Điều/Table) ngay trong tên test.
- `npm test` chạy dưới 10 giây trên máy phát triển.

## Rủi ro và lưu ý
- Số liệu golden phải lấy từ **văn bản gốc**, không sao chép kết quả từ chính code (nếu không, test chỉ xác nhận lỗi hiện có).
- `mobile/dga-logic.js` là bản cũ, **không** được test này bao phủ — xem [Unify_Shared_Logic](./Unify_Shared_Logic.md); test này chính là công cụ để phát hiện độ lệch giữa hai bản.

## Liên quan
- Là điều kiện tiên quyết nên có trước [Unify_Shared_Logic](./Unify_Shared_Logic.md), [Implement_Module_System](./Implement_Module_System.md) và [Migrate_to_TypeScript](./Migrate_to_TypeScript.md): có test rồi mới an toàn để đổi cấu trúc mã.

[Rationale]
Ứng dụng đưa ra kết luận Bình thường / Cảnh báo / Báo động cho thiết bị điện, nên sai một ngưỡng hoặc một điều kiện biên là sai kết luận vận hành. Logic đã tách khỏi DOM và nạp được trong Node, nên đây là cải tiến có chi phí thấp nhất, giá trị cao nhất; và là lưới an toàn cho mọi cải tiến khác trong thư mục này.

[Estimated effort]: ~1–2 tuần (bộ test lõi); CI: thêm ~0,5 ngày
