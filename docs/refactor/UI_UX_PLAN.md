# Kế hoạch refactor UI/UX — nhánh `refactor/ui-ux`

**Yêu cầu:**
- Theme phù hợp ngành điện, theo màu EVNNPT.
- Giao diện thân thiện với người dùng.
- Các tính năng dễ dùng.
- Chất lượng như bản production.

**Nguyên tắc:**
- Không đổi logic đánh giá.
- Không đổi dữ liệu và API.
- Làm từng bước nhỏ. Mỗi bước có ảnh trước/sau, chạy test, rồi dừng chờ duyệt.

---

## 1. Rà soát hiện trạng (ngày 12/11/2026, bản `main` v71)

Ảnh chụp ở 1440px và 375px, đăng nhập thật, dữ liệu sao lưu: 57 lần đo khí, 6 lần đo dầu.

| # | Vấn đề | Ở đâu | Mức |
|---|---|---|---|
| 1 | Header trên điện thoại cao khoảng **190px**. Gần ¼ màn hình chỉ chứa tên app, 2 badge, 5 icon và email | Mọi tab, 375px | Cao |
| 2 | Chữ hướng dẫn quá nhiều: **131 đoạn `.note`**, nhiều đoạn 3–5 dòng nằm ngay đầu tab. Việc chính bị đẩy xuống dưới | Mọi tab | Cao |
| 3 | Bảng Cảnh báo chật: 11 cột, cột Khuyến cáo chỉ rộng khoảng 80px nên mỗi dòng cao 250px. Dữ liệu thiếu hiện "-" hoặc "?" | Cảnh báo | Cao |
| 4 | "Loại thiết bị" chiếm nguyên 1 thẻ cho 1 ô chọn. Ba lớp thẻ lồng nhau tốn chiều ngang trên điện thoại | Khí hòa tan, Lý-Hóa dầu | TB |
| 5 | Hai ô kéo thả cạnh nhau, một ô viền liền, một ô viền đứt, không thống nhất | Khí hòa tan | TB |
| 6 | Tab Xu hướng khi chưa chọn thiết bị: trang trống, không gợi ý thiết bị nào (ví dụ thiết bị đang có cảnh báo, thiết bị vừa đo) | Xu hướng | TB |
| 7 | Font khai báo "Be Vietnam Pro" nhưng **không được nạp**, máy không cài thì rơi về Segoe UI | Toàn app | TB |
| 8 | **230 thuộc tính `style=""`** viết thẳng trong `index.html`, không theo token nên khó giữ nhất quán | index.html | TB |
| 9 | Thanh tab trên điện thoại cuộn ngang mà không báo hiệu còn tab ẩn | 375px | Thấp |
| 10 | Trạng thái (Đạt / Không đạt / Cảnh báo / Báo động) đang có nhiều kiểu pill, badge và màu khác nhau | Cảnh báo, kết quả DGA | TB |

Phần làm tốt, cần giữ:
- Đã có `tokens.css` (khoảng cách, cỡ chữ, bóng, màu ngữ nghĩa) và giao diện tối.
- Dải 3 màu pha A vàng, B xanh lá, C đỏ dưới header, đúng quy ước ngành điện.
- Màu navy EVN, sidebar thu gọn được, và nút con mắt ẩn/hiện hướng dẫn (vừa làm).

---

## 2. Định hướng thiết kế

### 2.1. Bảng màu — lấy từ logo EVNNPT (`backgroup PTC3.jpg`, đo trung bình điểm ảnh)

| Màu logo | Mã đo được | Dùng cho |
|---|---|---|
| Xanh EVN (chữ "EVN", vòng logo, tên công ty) | **`#00189E`** | Màu thương hiệu chính: header, tiêu đề, nút chính, tab đang chọn. Tương phản trên nền trắng 12,9:1 |
| Navy họa tiết ngôi sao | `#0E0C98` | Nền header/sidebar đậm, giao diện tối |
| Đỏ NPT (chữ "NPT", tia sét) | **`#ED1C24`** | Điểm nhấn thương hiệu: dải trang trí, logo, chữ lớn. Tương phản trên nền trắng chỉ 4,38:1 (**chưa đạt AA cho chữ thường**), nên chữ và nút đỏ dùng bản đậm hơn `#C8141B` (5,88:1) |
| Vàng tâm sao | `#FBEB07` | Chỉ để nhấn trên nền xanh, ví dụ gạch chân tab đang chọn trên header hay icon tia sét (10,5:1 trên `#00189E`). Không dùng làm chữ trên nền trắng |

Màu chức năng (không phải màu thương hiệu, giữ tách riêng để không nhầm với "đỏ thương hiệu"):

| Vai trò | Màu | Ghi chú |
|---|---|---|
| Trạng thái | Bình thường: xanh lá · Cảnh báo (ALERT): hổ phách · Báo động (ALARM): đỏ · Chưa đủ dữ liệu: xám | Theo quy ước màn hình SCADA. Luôn kèm icon và chữ, không chỉ dựa vào màu |
| Pha | A `#e9b800` · B `#1e9e4a` · C `#d9262c` | Giữ nguyên |
| Nền | Xám lạnh rất nhạt, thẻ trắng. Giao diện tối kiểu "phòng điều khiển": navy đậm theo `#0E0C98`, không đen tuyền | — |

Mọi cặp chữ/nền phải đạt WCAG AA (≥ 4,5:1), kiểm tra bằng `npm run check:contrast`.

### 2.2. Chữ
- Nạp **Be Vietnam Pro**, tự host file woff2 để chạy được trong mạng nội bộ, kèm dự phòng Segoe UI.
- Số liệu (ppm, %, kV) dùng chữ số đều cột (`font-variant-numeric: tabular-nums`) và canh phải trong bảng.

### 2.3. Bố cục
- **Header gọn:** cao 56px trên mọi cỡ màn hình. Trên điện thoại, các icon gom vào menu "⋯", email rút thành avatar.
- **Thanh ngữ cảnh thiết bị** (Trạm ▸ Thiết bị ▸ Pha) dính trên đầu các tab Khí hòa tan, Lý-Hóa dầu, Lịch sử, Xu hướng. Chọn một lần là dùng được cho cả các tab, nhờ bộ chọn bậc thang đã có.
- **Hướng dẫn thu gọn mặc định:** áp dụng mẫu nút con mắt (`setupGuideToggles`) cho mọi tab. Lần đầu dùng thì hiện; app nhớ lựa chọn.
- Desktop rộng (≥ 1280px): nội dung rộng tối đa 1280px. Tab Xu hướng và Cảnh báo được dùng toàn bộ chiều rộng.

---

## 3. Các bước thực hiện

| Bước | Nội dung | Kết quả kiểm chứng |
|---|---|---|
| **0** ✅ | `npm run ui:snap -- <thư mục>`: chụp 7 tab × 3 cỡ (375 / 768 / 1440) × sáng/tối = 42 ảnh, chạy trên máy chủ nội bộ, tài khoản lấy từ biến môi trường. `npm run check:contrast`: kiểm tra tương phản AA các cặp token sáng/tối | Đã có bộ ảnh mốc; tương phản hiện tại đạt AA ở mọi cặp |
| **1a** ✅ | **Token & theme:** màu EVNNPT cho cả giao diện sáng và tối; tự lưu font Be Vietnam Pro; `theme-color`/manifest | Tương phản AA mọi cặp; ảnh trước/sau |
| **1b** ✅ | Chuyển 190 `style=""` trong `index.html` sang class tiện ích `u-*` (`style-utilities.css`, sinh tự động, `!important` trừ `display`), kể cả 45 ô canh giữa trong tab Hướng dẫn (sửa `build-user-guide.js`). Giữ 4 `display:none` do JS bật/tắt. Dọn 4 cảnh báo stylelint | Style tính toán của 182 phần tử giống hệt ở 1440 và 375px; 12 ảnh giống từng điểm ảnh |
| **2a** ✅ | **Header:** máy tính cao 57px (trước 64px); điện thoại 1 dòng 52px (trước ~190px), các nút gom vào menu "⋯" có nhãn chữ, vùng bấm 44px, đóng bằng Esc/bấm ra ngoài; trạng thái đồng bộ luôn hiện cạnh tên app. Thanh tab đã có sẵn bóng mờ báo cuộn và tự cuộn tới tab đang chọn | Ảnh 375 / 768 / 1440, sáng/tối |
| **2b** ✅ | **Ngữ cảnh xem chung** (`ui-view-context.js`): chọn Trạm/Thiết bị ở Lịch sử đo, Xu hướng hoặc Cảnh báo → 2 tab kia lọc sẵn; xóa lựa chọn cũng bỏ lọc ở cả 3. Nhảy từ dòng cảnh báo sang Xu hướng cũng được nhớ. **Không** đụng form nhập (đã chốt). Chỉ nhớ trong phiên | Thử chuyển tab qua lại, form nhập giữ nguyên |
| **3a** ✅ | **Bảng:** ngày dd/mm/yyyy (chỉ hiển thị), cột số canh phải, pill không xuống dòng, nút thao tác xếp ngang từ 1024px, cột chẩn đoán đủ rộng → dòng Lịch sử cao ~63px (trước 115–165px) | Ảnh trước/sau |
| **3b** ✅ | **Ô kéo thả:** chỉ tô đậm khi focus bằng bàn phím (`:has(:focus-visible)`) | Thử chuột/Tab |
| **3c** ✅ | **Trạng thái rỗng** dùng chung (`.empty-state`); Xu hướng gợi ý bấm nhanh thiết bị đang cảnh báo / vừa đo | Thử bấm → vẽ ngay |
| **3d** ✅ | **Badge trạng thái:** giữ quy ước 2 tầng sẵn có (nền đặc = MỨC Báo động/Cảnh báo kèm icon; nền nhạt = kết luận/chi tiết), không gắn icon hàng loạt vào 48 chỗ dùng. **Màu viết cứng → token:** khung máy chủ ở màn hình đăng nhập, badge "Đã tải file" (×3), nền màn hình đăng nhập ở giao diện tối (trước tím nhạt chói). **Class có tên** thay 10 tổ hợp `u-*` hay lặp (43 chỗ), bỏ 25 class `u-*` không còn dùng (còn 81). **Khung chờ** (skeleton) ở bảng Lịch sử đo / Cảnh báo | Style tính toán 228 phần tử giống hệt ngoài các chỗ đổi màu chủ đích |
| **4a** | **Khí hòa tan / Lý-Hóa dầu:** đưa Loại thiết bị vào đầu form; gộp 2 ô kéo thả; dồn hướng dẫn vào nút con mắt; thẻ kết quả tóm tắt (kết luận, mã lỗi, việc cần làm) nằm trên cùng | Luồng Nhập → Phân tích → Lưu bấm ít hơn |
| **4b** ✅ | **Cảnh báo:** bảng 5 cột (Thiết bị kèm trạm + loại đo · Mức · Chỉ tiêu vượt · Lần đo kèm ngày · Thao tác); "Hạng mục cảnh báo" + "Khuyến cáo" mở bằng nút **Chi tiết**; dữ liệu thiếu ghi "(chưa ghi trạm)" / "(chưa ghi tên thiết bị)"; thẻ KPI Cảnh báo/Báo động bấm để lọc; điện thoại: mỗi cảnh báo 1 thẻ, KPI 2 cột, ô chọn không tràn | Dòng cao ~84px (trước ~250px), trang 1.107px (trước 1.964px) |
| **4c** | **Lịch sử đo:** cột đầu dính khi cuộn ngang, chọn cột hiển thị, ô sửa giữ nền đỏ | — |
| **4d** | **Xu hướng:** khi chưa chọn thiết bị thì gợi ý "thiết bị đang cảnh báo" và "vừa đo gần đây"; đồ thị rộng hơn; bảng tiêu chuẩn và dự báo xếp gọn | — |
| **4e** | **Hướng dẫn / Quy trình:** mục lục dính bên trái, tìm kiếm trong hướng dẫn | — |
| **5** | **UX và truy cập:** điều hướng bàn phím, viền focus rõ, `aria-*`, thông báo lỗi tiếng Việt chỉ rõ ô sai, xác nhận trước khi xóa, giữ dữ liệu form khi chuyển tab | axe: 0 lỗi nghiêm trọng |
| **6** | **Kiểm thử như bản production:** toàn bộ test, Lighthouse (Hiệu năng / Truy cập / Thực hành tốt ≥ 90), thử trên Chrome, Edge, Safari iOS, Zalo, bản di động, sáng/tối | Báo cáo + ảnh |

Sau mỗi bước: chạy `npm test` và `lint`, cập nhật tên cache trong `sw.js`, commit, báo cáo kèm ảnh, rồi **dừng chờ duyệt**.

**Thử trên GitHub Pages:** Pages giờ chỉ triển khai từ `main`. Muốn thử nhánh này thì thêm lại tạm trigger cho `refactor/ui-ux` (gỡ trước khi gộp), hoặc thử bằng máy chủ nội bộ.

---

## 4. Rủi ro

- **Xung đột với tính năng mới:** nhánh này sửa nhiều `index.html` và CSS. Tính năng mới nên làm sau khi refactor gộp xong, hoặc làm nhỏ và gộp thường xuyên.
- **Bản di động:** `mobile/` dùng CSS riêng. Cần kiểm tra đồng bộ màu ở bước 1.
- **Xuất BBTN docx / Excel:** không bị ảnh hưởng vì không dùng CSS giao diện. Vẫn kiểm tra lại ở bước 6.
