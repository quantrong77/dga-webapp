# Hướng dẫn sử dụng — Ứng dụng "Đánh giá Dầu cách điện" (DGA)

> Tài liệu dành cho **người dùng cuối** (kỹ sư thí nghiệm, cán bộ theo dõi thiết bị). Nội dung đi theo từng công việc cụ thể: nhập số liệu, đọc kết quả, xem cảnh báo, xuất biên bản…
> Muốn cài đặt/triển khai app → xem `README.md`. Muốn tra danh sách đầy đủ tính năng → xem `docs/huong-dan/Features-web-app.md`.
> Nội dung này cũng có sẵn ngay trong app ở tab **Hướng dẫn** (chia theo từng mục, bấm để mở/thu gọn).

---

## Mục lục

1. [App dùng để làm gì?](#1-app-dùng-để-làm-gì)
2. [Bắt đầu: mở app và đăng nhập](#2-bắt-đầu-mở-app-và-đăng-nhập)
3. [Làm quen giao diện](#3-làm-quen-giao-diện)
4. [Nhập và đánh giá một lần đo khí hòa tan (tab Khí hòa tan)](#4-nhập-và-đánh-giá-một-lần-đo-khí-hòa-tan-tab-khí-hòa-tan)
5. [Đọc kết quả đánh giá](#5-đọc-kết-quả-đánh-giá)
6. [Nhập nhanh từ Biên bản thí nghiệm (PDF) và ảnh tấm nhãn](#6-nhập-nhanh-từ-biên-bản-thí-nghiệm-pdf-và-ảnh-tấm-nhãn)
7. [Nhập hàng loạt nhiều biên bản của cùng một thiết bị](#7-nhập-hàng-loạt-nhiều-biên-bản-của-cùng-một-thiết-bị)
8. [Xuất Biên bản thí nghiệm và Báo cáo phân tích kỹ thuật (.docx)](#8-xuất-biên-bản-thí-nghiệm-và-báo-cáo-phân-tích-kỹ-thuật-docx)
9. [Thí nghiệm dầu cách điện (tab Lý-Hóa dầu)](#9-thí-nghiệm-dầu-cách-điện-tab-lý-hóa-dầu)
10. [Xem lại, sửa, xóa và so sánh (tab Lịch sử đo)](#10-xem-lại-sửa-xóa-và-so-sánh-tab-lịch-sử-đo)
11. [Theo dõi thiết bị bất thường (tab Cảnh báo)](#11-theo-dõi-thiết-bị-bất-thường-tab-cảnh-báo)
12. [Xem xu hướng và dự báo (tab Xu hướng)](#12-xem-xu-hướng-và-dự-báo-tab-xu-hướng)
13. [Cấu hình tiêu chuẩn theo nhà sản xuất và bảng quy định (trong Quản trị → Cấu hình)](#13-cấu-hình-tiêu-chuẩn-theo-nhà-sản-xuất-và-bảng-quy-định-trong-quản-trị--cấu-hình)
14. [Tra cứu quy trình lấy mẫu và đánh giá (tab Quy trình)](#14-tra-cứu-quy-trình-lấy-mẫu-và-đánh-giá-tab-quy-trình)
15. [Góp ý cho ứng dụng (mục Phản hồi trên Menu bar)](#15-góp-ý-cho-ứng-dụng-mục-phản-hồi-trên-menu-bar)
16. [Phân quyền Admin / User và mục Quản trị](#16-phân-quyền-admin--user-và-mục-quản-trị)
17. [Bản di động](#17-bản-di-động)
18. [Câu hỏi thường gặp và xử lý sự cố](#18-câu-hỏi-thường-gặp-và-xử-lý-sự-cố)
19. [Lưu ý quan trọng khi dùng kết quả](#19-lưu-ý-quan-trọng-khi-dùng-kết-quả)

---

## 1. App dùng để làm gì?

Ứng dụng hỗ trợ đánh giá tình trạng cách điện của các thiết bị dầu cách điện qua **phân tích khí hòa tan (DGA)** và **thí nghiệm dầu**:

| Loại thiết bị | Có nhập DGA | Có nhập thí nghiệm dầu |
|---|:-:|:-:|
| MBA / Kháng dầu | ✔ | ✔ (dầu thùng chính + dầu OLTC, đủ chỉ tiêu lý-hóa) |
| TI (biến dòng điện) | ✔ | ✔ (cần chọn nhà sản xuất — xem mục 9.3) |
| TU (biến điện áp) | ✔ | ✔ (cần chọn nhà sản xuất — xem mục 9.3) |
| Sứ xuyên (Bushing) | ✔ | ✔ (theo tiêu chuẩn nhà sản xuất — xem mục 9.4) |
| Khác | ✔ | ✘ |

Căn cứ đánh giá: **QĐ 1901/QĐ-EVNNPT**, **IEC 60599:2022** (khí hòa tan) và **IEC 60422:2024** (dầu — tham khảo song song). Khi bạn chưa chọn nhà sản xuất, app tự lấy ngưỡng **chặt hơn** giữa QĐ1901 và IEC 60599 cho khí hòa tan.

App làm được những việc chính:

- Nhập 7 khí hòa tan → tự tính **TCG**, đánh giá từng khí, chẩn đoán dạng sự cố (**Bảng 66 / Tam giác Duval**), tính tốc độ sinh khí, đưa ra **trạng thái tổng thể** và **khuyến cáo**.
- Đánh giá **lý-hóa dầu**: chỉ tiêu cơ bản (điện áp chọc thủng, tgδ 90°C, hàm lượng nước) và bổ sung theo QĐ1901 (trị số axit, chớp cháy, tạp chất cơ học, đếm hạt, điện trở suất, 2-furfural, màu sắc, độ ổn định ôxi hóa…), kèm tham chiếu IEC 60422:2024.
- Lưu lịch sử, so sánh giữa các lần đo, vẽ xu hướng và dự báo.
- Tự động liệt kê các thiết bị đang ở mức **Cảnh báo / Báo động**.
- Tự đọc số liệu từ **Biên bản thí nghiệm (PDF, Word .docx)** — từng file hoặc **hàng loạt / cả thư mục** — và xuất lại thành **BBTN / Báo cáo kỹ thuật (.docx)**.
- Mỗi tab nhập liệu chia 2 tab con: **Nhập BBTN cũ** (đưa biên bản đã có vào lưu trữ) và **Lập BBTN** (nhập tay, đánh giá, xuất biên bản; thông số kỹ thuật thiết bị tự điền theo dữ liệu đã lưu).

---

## 2. Bắt đầu: mở app và đăng nhập

### 2.1. Mở app

Mở đường link do quản trị viên cung cấp bằng **Chrome, Edge hoặc Safari** (khuyến nghị Chrome/Edge). Nếu tự chạy trên máy, mở file `index.html` bằng trình duyệt (hoặc qua máy chủ cục bộ `npm start` — mặc định `http://localhost:8080`, đổi cổng bằng biến môi trường `PORT`).

Góc trên bên trái có **huy hiệu trạng thái lưu trữ**:

| Huy hiệu | Ý nghĩa |
|---|---|
| "Database" / "Supabase" | Dữ liệu lưu dùng chung trên database của đơn vị (bấm vào để mở nhanh Google Sheet hoặc Supabase Dashboard) |
| "Chế độ thử nghiệm" (kèm **banner đỏ** đầu trang) | Dữ liệu chỉ lưu trong trình duyệt của máy này |

> ⚠ Ở **chế độ thử nghiệm**, dữ liệu chỉ nằm trên trình duyệt hiện tại — **mất nếu xóa lịch sử duyệt web** và người khác không thấy được. Chỉ dùng để thử.

### 2.2. Đăng ký và đăng nhập (chế độ Google Sheets / Supabase)

1. Khi mở app sẽ hiện hộp thoại **"Đánh giá Dầu cách điện"**.
2. **Lần đầu:** bấm **Đăng ký** → nhập email + mật khẩu (tối thiểu 6 ký tự) → bấm **Đăng ký**.
3. **Các lần sau:** nhập email + mật khẩu → bấm **Đăng nhập**.
4. Nếu app có bật **Đăng nhập bằng Google**, nút này hiện ở đầu hộp thoại — bấm và chọn tài khoản Google.
5. Lần sau mở lại app, phiên đăng nhập được **tự khôi phục**.

**Đổi mật khẩu:** người dùng đã đăng nhập có thể đổi mật khẩu qua nút đổi mật khẩu ở góc trên.

**Đăng xuất:** bấm vào **tên/email của bạn** ở góc trên bên phải → xác nhận.

> Nếu Admin cấp tài khoản hoặc đặt lại mật khẩu cho bạn, bạn nhận được một **mật khẩu tạm**. Ở lần đăng nhập đầu, app **bắt buộc đổi sang mật khẩu riêng** (nhập mật khẩu tạm vào ô "Mật khẩu hiện tại") rồi mới dùng được.
>
> Nhập sai mật khẩu **5 lần liên tiếp**, đăng nhập bằng mật khẩu của tài khoản đó bị **tạm khóa 15 phút**.

---

## 3. Làm quen giao diện

### 3.1. Các tab

Giao diện được phân bố khoa học thành hai khu vực điều hướng: **Thanh bên (Sidebar)** chứa các tab tác nghiệp kỹ thuật thường xuyên và **Thanh Menu bar trên cùng (Header)** chứa các tiện ích toàn cục (dạng icon tinh gọn, khi trỏ chuột vào sẽ hiển thị tooltip tên chức năng).

#### Các tab ở Thanh bên (Sidebar):

| Tab | Dùng để |
|---|---|
| **Hướng dẫn** | Xem hướng dẫn sử dụng này ngay trong app (được đặt ở vị trí đầu tiên trong thanh bên để tiện tra cứu nhanh) |
| **Khí hòa tan** | Nhập và đánh giá một lần đo khí hòa tan (tab chính) |
| **Lý-Hóa dầu** | Nhập và đánh giá thí nghiệm dầu |
| **Cảnh báo** | Danh sách thiết bị đang ở mức Cảnh báo/Báo động |
| **Lịch sử đo** | Xem lại, sửa, xóa; so sánh 2 lần đo bất kỳ |
| **Xu hướng** | Đồ thị theo thời gian + dự báo |
| **Quy trình** | Hướng dẫn lấy mẫu dầu, sơ đồ quy trình đánh giá DGA |

#### Các chức năng trên thanh Menu bar (Header — dạng icon):

| Tab | Dùng để |
|---|---|
| **Giới thiệu** | Thông tin chung và căn cứ pháp lý |
| **Phản hồi** | Gửi góp ý cho ứng dụng |
| **Quản trị** | Quản lý người dùng, Cấu hình (Tiêu chuẩn & Quy định), Bản sao Supabase — **chỉ Admin** mới thấy |

> **Lưu ý cấu trúc mới:** Chức năng **Cấu hình** (Tiêu chuẩn nhà sản xuất và Quy định — các bảng ngưỡng) trước đây nằm ở thanh bên, nay đã được tích hợp tập trung vào trong mục **Quản trị** trên thanh Menu bar để thuận tiện quản lý phân quyền Admin.

### 3.2. Giao diện sáng hoặc tối

Bấm **biểu tượng mặt trăng/mặt trời** ở góc trên bên phải để đổi giao diện. Giao diện tối dễ nhìn hơn khi làm việc ban đêm. Lựa chọn được nhớ trên trình duyệt này; nếu chưa chọn, app theo cài đặt của hệ điều hành.

### 3.3. Thanh tab ngang hoặc dọc

Bấm nút biểu tượng thanh bên ở góc trên bên trái để chuyển giữa **thanh tab ngang** (mặc định) và **thanh tab dọc bên trái**. Ở chế độ dọc, bấm mũi tên để **thu gọn** (chỉ còn biểu tượng; rê chuột để xem tên tab). App nhớ lựa chọn của bạn.

### 3.4. Thanh tiêu đề cố định (Sticky Header)

Khi bạn cuộn màn hình xuống phía dưới để đọc kết quả phân tích DGA hoặc xem danh sách bảng biểu dài, **thanh tiêu đề và thanh tác vụ trên cùng luôn giữ cố định (Sticky Header)**. Điều này giúp bạn luôn quan sát được trạng thái lưu trữ database, trạng thái tài khoản đang đăng nhập và có thể chuyển đổi nhanh giữa các chức năng mà không cần phải cuộn chuột ngược lại lên đầu trang.

### 3.5. Các thao tác dùng chung

- **Ô Trạm / Thiết bị:** vừa **gõ để tìm**, vừa **bấm ▼ để chọn** trong danh sách đã có. Bạn cũng có thể **gõ tên mới** (không bắt buộc phải chọn từ danh sách).
- **Khung "Nhập BBTN" (tab con Nhập BBTN cũ):** nằm trên form nhập liệu, gồm **2 ô kéo thả ngang hàng, cùng kích thước** — ô trái nhận **1 biên bản** (đọc vào form để đối chiếu rồi lưu), ô phải nhận **nhiều biên bản hoặc cả thư mục** (nút **Chọn cả thư mục…**). Kéo file vào, hoặc bấm vào ô để chọn file; ô có viền sáng khi rê file qua. Trên màn hình hẹp, 2 ô tự xếp dọc.
- **Tab con "Nhập BBTN cũ" / "Lập BBTN":** có ở tab **Khí hòa tan** và **Lý-Hóa dầu**, dùng **chung một form** (đổi tab con không mất số liệu đang nhập); app nhớ tab con dùng lần cuối.
- **Biểu tượng "i":** bấm để xem giải thích chi tiết; đóng bằng **×** hoặc bấm ra ngoài. Chỉ một hộp giải thích mở tại một thời điểm.
- **Thông báo nhanh (toast)** hiện ở góc trên bên phải: màu xanh khi thao tác thành công (đăng nhập, lưu…), **màu đỏ khi có lỗi hoặc thiếu thông tin** (ví dụ chưa nhập Thiết bị, mất kết nối database). Toast lỗi hiện khoảng 6 giây; nội dung thường kèm gợi ý cách xử lý.
- Khi thấy **"Vui lòng chờ! Đang nạp dữ liệu…"**, hãy chờ danh sách Trạm/Thiết bị và lịch sử tải xong.

---

## 4. Nhập và đánh giá một lần đo khí hòa tan (tab Khí hòa tan)

Dưới ô **Loại thiết bị** có 2 tab con (cách tổ chức giống hệt tab **Lý-Hóa dầu**, app nhớ tab con dùng lần cuối):

- **Nhập BBTN cũ** — kéo thả BBTN (PDF) để tự điền form và đối chiếu ở khung bên cạnh, nhập hàng loạt nhiều BBTN của cùng 1 thiết bị, và bảng **Số liệu đã lưu** ở cuối trang: các lần đo đã lưu của đúng Trạm/Thiết bị đang nhập ở form (có nút Xem/Sửa/Xóa như tab Lịch sử đo).
- **Lập BBTN** — nhập tay số liệu mới, bấm **Phân tích & Lưu** rồi **Xuất BBTN (docx)** / báo cáo phân tích kỹ thuật ở khối kết quả.

Ở **Lập BBTN**, chọn **Trạm** và **Thiết bị**: nếu thiết bị đã có dữ liệu lưu trước đây (lần đo khí hòa tan, thí nghiệm dầu), app **tự điền thông số kỹ thuật** (kiểu máy, năm sản xuất, điện áp định mức, số chế tạo, loại dầu...) vào các ô **còn trống** và ghi rõ lấy từ lần lưu nào — ô bạn đã gõ không bị ghi đè; đổi sang thiết bị khác thì các ô app tự điền được thay theo thiết bị mới. Thiết bị mới thì nhập tay, hoặc kéo thả file PDF/Word cũ (BBTN, lý lịch thiết bị) vào ô **"Nhập thông số kỹ thuật từ file"** — app chỉ lấy thông số kỹ thuật, không đọc số liệu đo và không đính kèm file. Nếu còn file BBTN đã chọn ở tab Nhập BBTN cũ, Lập BBTN hiện dòng **"Biên bản đính kèm khi lưu"** kèm nút Bỏ file.

Hai tab con dùng **chung một form** — đổi tab con không mất số liệu đang nhập. Bấm Sửa/Xem một bản ghi từ tab Lịch sử đo, Cảnh báo hay bảng Số liệu đã lưu thì app tự mở tab con **Nhập BBTN cũ**.

### Bước 1 — Chọn loại thiết bị

Ở ô **Loại thiết bị** trên cùng, chọn: TI, TU, MBA/Kháng dầu, Sứ xuyên (Bushing) hoặc Khác. Lựa chọn này quyết định bảng ngưỡng và phương pháp chẩn đoán được dùng — **hãy chọn đúng**.

### Bước 2 — Điền khối "Thí nghiệm khí hòa tan trong dầu cách điện"

| Trường | Cách điền |
|---|---|
| **Trạm** | Gõ/chọn tên trạm |
| **Thiết bị (tên/mã)** | Gõ/chọn tên thiết bị, ví dụ `TI174`, `MBA T1` |
| **Ngăn OLTC (thông dầu/khí với thùng chính)** | *Chỉ hiện với MBA/Kháng dầu.* Tick nếu thiết bị có OLTC mà ngăn OLTC **thông dầu/khí** với thùng chính (thông tin này được lưu cùng lần đo). Với số liệu ngưỡng mặc định hiện tại, ô này chưa làm đổi ngưỡng đánh giá |
| **Nhà sản xuất (tùy chọn)** | Chọn hãng nếu đã có tiêu chuẩn riêng ở mục Cấu hình (trong Quản trị); để trống = dùng ngưỡng mặc định QĐ1901/IEC |
| **Pha** | A, B, C hoặc **Chung** (dùng chung cả 3 pha) |
| **Lần đo** | Tự gợi ý số thứ tự kế tiếp theo nhóm Trạm + Thiết bị + Pha; sửa được nếu cần |
| **Ngày lấy mẫu** | Ngày lấy mẫu dầu |
| **Ghi chú** | Không bắt buộc |
| **Xử lý dầu trước lần đo này** | Không bắt buộc: **Lọc dầu** / **Thay dầu** / **Không xử lý dầu** giữa lần đo trước và lần đo này. Nếu khí giảm đột ngột so với lần đo trước mà ô này để trống, sau khi lưu app sẽ hỏi xác nhận (xem mục 12.3) |
| **Biên bản thí nghiệm (PDF)** | Không bắt buộc — chọn ở ô trái khung **Nhập BBTN** (phía trên form, tab con Nhập BBTN cũ), xem [mục 6](#6-nhập-nhanh-từ-biên-bản-thí-nghiệm-pdf-và-ảnh-tấm-nhãn) |

> **Mẹo:** Để tránh app coi là hai thiết bị khác nhau, hãy **gõ tên Trạm và Thiết bị thống nhất** (nên chọn từ danh sách gợi ý thay vì gõ lại). Tốc độ sinh khí và xu hướng được tính theo nhóm **Trạm + Thiết bị + Pha**.

### Bước 3 — Nhập hàm lượng khí (ppm)

Nhập 7 khí: **H2, CH4, C2H6, C2H4, C2H2, CO, CO2**. Không nhập số âm.

### Bước 4 — Khí bổ sung N2, O2 (tùy chọn)

Chỉ cần nếu muốn xem thêm:

- Tỷ lệ **CO2/CO, O2/N2** (Điều 54 QĐ1901);
- **Tổng hàm lượng khí hòa tan** (Bảng 63).

Với Bảng 63, chọn thêm **Cấp điện áp** (110–220 kV hoặc 500 kV) và tick ô *"Dầu mới đưa vào vận hành lần đầu / sau sửa chữa có thay dầu hoặc lọc dầu"* nếu đúng trường hợp đó. **Cần nhập cả N2 lẫn O2** thì mục này mới tính được. Nếu để trống, các mục này tự ẩn và không ảnh hưởng đánh giá khác.

### Bước 5 — Thông tin bổ sung (tùy chọn)

Hai khối này **không ảnh hưởng đánh giá**, chỉ để điền sẵn vào file Word khi xuất:

- **Thông tin thí nghiệm bổ sung:** ngày thí nghiệm, lý do thí nghiệm, nhiệt độ và độ ẩm môi trường (dùng cho BBTN).
- **Thông số kỹ thuật thiết bị:** kiểu máy, năm sản xuất, năm đưa vào vận hành, điện áp định mức, số chế tạo, loại dầu, kết cấu cách điện, hiện trạng vận hành (dùng cho Báo cáo phân tích kỹ thuật).

> Thông số kỹ thuật lưu **theo từng lần đo**. Ở tab con **Lập BBTN**, chọn Trạm + Thiết bị đã có dữ liệu thì app **tự điền** các ô thông số còn trống từ lần lưu gần nhất (xem đầu mục 4); thiết bị mới thì nhập tay hoặc lấy từ file PDF/Word cũ qua ô **"Nhập thông số kỹ thuật từ file"**.

### Bước 6 — Bấm "Phân tích & Lưu"

- Kết quả hiện ngay bên dưới ở khối **"2. Kết quả đánh giá"**, đồng thời lần đo được **lưu** vào database.
- **Xóa form:** làm trống toàn bộ ô để nhập lần đo mới.

---

## 5. Đọc kết quả đánh giá

### 5.1. Trạng thái tổng thể (khung màu đầu kết quả)

| Mức | Ý nghĩa |
|---|---|
| **Bình thường** | Không có dấu hiệu bất thường theo các tiêu chí kiểm tra |
| **Cảnh báo (ALERT)** | Có dấu hiệu cần chú ý, tăng tần suất theo dõi |
| **Báo động (ALARM)** | Bất thường nghiêm trọng, cần xử lý/xác minh ngay |

Ngay dưới là **danh sách lý do** (khí nào vượt, mã sự cố gì, tốc độ tăng bao nhiêu…) và **khuyến cáo hành động** cụ thể. Trạng thái tổng hợp từ: đạt/không đạt từng khí, mã chẩn đoán, sự thay đổi loại sự cố so với lần đo trước, tốc độ tăng khí, và vượt ngưỡng loại bỏ.

### 5.2. Các thành phần kết quả

| Thành phần | Cách hiểu |
|---|---|
| **TCG** (Tổng khí cháy) | Tổng các khí cháy được; kèm ghi chú tốc độ tăng nếu đã có lần đo trước |
| **Đánh giá từng khí** | Mỗi khí so với ngưỡng áp dụng → Đạt / Không đạt; có **Kết luận chung** |
| **Bảng 66 (IEC Table 1)** | Mã sự cố theo tỷ số khí: **PD, D1, D2, T1, T2, T3** — dùng cho MBA/Kháng dầu, TI, TU |
| **Table A.10 (Sứ xuyên)** | Riêng Sứ xuyên: 4 mã **độc lập** PD, D, T, TP (có thể khớp 0, 1 hoặc nhiều mã); nếu không khớp mã nào, app lùi về Bảng 66 |
| **Tam giác Duval 1** | Hình tam giác trực quan có điểm chẩn đoán; dùng cho mọi loại thiết bị. Nếu khác kết quả tỷ số khí, app ghi chú để bạn đối chiếu |
| **Tỷ lệ bổ sung (Điều 54)** và **Tổng hàm lượng khí hòa tan (Bảng 63)** | Chỉ hiện khi đã nhập N2 và O2; là thông tin **tham khảo bổ sung**, không làm thay đổi trạng thái tổng thể |
| **Ngưỡng loại bỏ (condemning)** | Nếu nhà sản xuất có cấu hình: hiện cảnh báo riêng **"⚠ Vượt ngưỡng loại bỏ"** |
| **Tốc độ gia tăng khí** | So với lần đo liền trước của cùng Trạm + Thiết bị + Pha (Bảng 65 QĐ1901 hoặc khoảng riêng của hãng). Bảng 65 chỉ chính thức cho MBA/Kháng dầu; với loại khác chỉ để tham khảo |
| **So sánh với nhóm thiết bị tương tự** | Thống kê **tham khảo** (xem 5.3): lần đo này lệch bao nhiêu so với các lần đo khác của cùng nhóm thiết bị đã lưu |
| **Ca tương tự trong lịch sử đo** | Tối đa 3 lần đo cũ có "dạng" khí giống lần đo này nhất — để tham khảo diễn biến các trường hợp trước đây |

### 5.3. Hai khối thống kê tham khảo (chỉ có trên bản web)

Hai khối này **không phải ngưỡng của QĐ1901/IEC** và **không làm đổi** trạng thái Bình thường/Cảnh báo/Báo động ở đầu kết quả — chỉ để bạn có thêm góc nhìn.

- **So sánh với nhóm thiết bị tương tự.** App lấy các lần đo đã lưu của thiết bị **cùng loại** (ưu tiên cùng cấp điện áp và cùng nhà sản xuất; nếu không đủ dữ liệu sẽ tự nới dần tiêu chí, tên nhóm đang dùng được ghi ngay trong khối). Cần **tối thiểu 5 lần đo** trong nhóm, ít hơn thì app báo "chưa đủ dữ liệu". Kết quả gồm:
  - **Z-score từng khí** (tính trên thang log): |z| ≥ 2 là lệch nhẹ khỏi số đông — nên theo dõi thêm; |z| ≥ 3 là lệch rõ rệt.
  - **Điểm bất thường tổng hợp** (Isolation Forest, xét **đồng thời cả 7 khí**): từ 0,55 là hơi lệch, từ 0,62 là khả năng bất thường cao. Điểm này phát hiện được trường hợp nhiều khí cùng tăng nhẹ mà không khí nào riêng lẻ vượt ngưỡng.
- **Ca tương tự trong lịch sử đo.** App so "hình dạng" 7 khí của lần đo này với toàn bộ lịch sử và hiện tối đa 3 lần đo giống nhất (độ giống từ 0,5 trở lên). Dùng để xem các trường hợp tương tự trước đây diễn biến ra sao — **không phải kết luận** cho lần đo này. Chưa có lần đo nào đủ giống thì khối này báo không có ca tham khảo.

### 5.4. Hai điều cần nhớ

- **Tỷ số khí (Bảng 66) chỉ có ý nghĩa chẩn đoán khi có ít nhất 1 khí vượt giá trị điển hình.** Nếu chưa vượt, app vẫn hiển thị mã nhưng kèm ghi chú "Điều kiện áp dụng".
- **Tam giác Duval chỉ đáng tin khi CH4 + C2H4 + C2H2 đủ lớn** (vài ppm trở lên). Khí quá thấp thì tỷ lệ % dao động mạnh. Vùng **"D+T"** là vùng ranh giới mà chính hình gốc IEC cũng không phân định rõ.

---

## 6. Nhập nhanh từ Biên bản thí nghiệm (PDF) và ảnh tấm nhãn

### 6.1. Đọc số liệu từ Biên bản thí nghiệm (BBTN) và Khung đối chiếu song song

1. Ở tab **Khí hòa tan**, tab con **Nhập BBTN cũ**, khung **"Nhập BBTN"** trên cùng có 2 ô kéo thả ngang hàng, cùng kích thước: ô trái **"Một BBTN (PDF)"** — **kéo thả** file PDF vào hoặc bấm để chọn file, số liệu được đọc vào form bên dưới để đối chiếu rồi lưu; ô phải **"Nhiều BBTN hoặc cả thư mục"** — xem mục 7.
2. **Khung hiển thị Biên bản đối chiếu song song (Split View):** Ngay khi bạn chọn hoặc kéo-thả file PDF vào, giao diện tự động mở khung hiển thị tài liệu PDF ở cột bên cạnh vùng nhập liệu (ở màn hình máy tính, khung dính cố định khi cuộn; trên màn hình nhỏ/điện thoại, khung hiển thị ngay bên dưới):
   - Bạn có thể phóng to, thu nhỏ, cuộn và tìm kiếm nội dung trực tiếp trong file PDF gốc.
   - Nút **"Mở tab mới"** giúp mở toàn màn hình ở tab trình duyệt riêng nếu cần.
   - Nút **"✕ Ẩn"** hoặc **"Hiện BBTN đối chiếu"** để đóng hoặc mở lại khung xem bất kỳ lúc nào.
3. App tự đọc và **điền sẵn** vào form: Trạm, Thiết bị, Loại thiết bị, Pha, Ngày lấy mẫu, Nhà sản xuất, Số chế tạo, Điện áp định mức, Năm sản xuất, Năm vận hành, Loại dầu, Ngày thí nghiệm, Lý do thí nghiệm, nhiệt độ/độ ẩm môi trường và **7 khí hòa tan**.
4. **7 khí chính:** ô Kết quả trên biên bản để **trống**, ghi **0** hoặc ghi **KPH** đều được điền là **KPH** — app không lấy số ở cột Tiêu chuẩn thay cho ô trống. Khí nào app **không đọc được chắc chắn** (không thấy dòng khí đó, hoặc không phân biệt được số đọc ra là kết quả hay tiêu chuẩn) thì ô đó **để trống, tô vàng** và app báo tên khí: đối chiếu biên bản ở khung bên cạnh rồi nhập tay (ghi KPH nếu biên bản để trống). Còn ô tô vàng thì app chưa cho **Phân tích & Lưu**. Khi nhập hàng loạt, BBTN có khí đọc không chắc chắn được **bỏ chọn** kèm cảnh báo — kéo riêng BBTN đó vào ô **"Một BBTN (PDF)"** để nhập tay.
5. **Đối chiếu và xác nhận số liệu:** So sánh trực tiếp các giá trị số và thông tin trích xuất trên form với văn bản gốc hiển thị ngay bên cạnh để phát hiện bất kỳ sai sót nào trước khi lưu.
6. Bấm **Phân tích & Lưu**. File PDF được đính kèm cùng lần đo.
7. Sau này khi sửa hoặc xem lại lần đo, bạn có thể bấm **Xem BBTN đã lưu** hoặc **Hiện BBTN đối chiếu** để mở lại file PDF đối chiếu trực tiếp song song với form.

Việc đọc PDF chạy **hoàn toàn trên trình duyệt của bạn**, file không bị gửi đi đâu để "đọc".

> ⚠ App được thiết kế theo mẫu biên bản **PTC3/BM.15**. Nếu biên bản dùng mẫu khác, có thể chỉ đọc được một phần hoặc không đọc được. Luôn đối chiếu với biên bản gốc.

### 6.2. Đọc thông số từ ảnh tấm nhãn thiết bị (nameplate)

Trong khối **"Thông số kỹ thuật thiết bị"**, kéo thả **ảnh chụp tấm nhãn** (JPG/PNG) vào khung. App dùng OCR để gợi ý điền: Kiểu máy, Số chế tạo, Năm sản xuất, Điện áp định mức, Loại dầu và Nhà sản xuất.

> Mỗi hãng trình bày nhãn khác nhau nên **độ tin cậy thấp hơn** đọc BBTN — hãy chụp rõ, đủ sáng và **luôn kiểm tra lại từng ô**.

---

## 7. Nhập hàng loạt nhiều biên bản của cùng một thiết bị

Dùng khi cần **nhập bổ sung dữ liệu lịch sử** (nhiều năm đo) để phân tích xu hướng, không muốn lặp lại "chọn file → Phân tích & Lưu" từng lần.

1. **Điền trước** ở form "Thí nghiệm khí hòa tan trong dầu cách điện" (bên dưới khung Nhập BBTN): **Trạm, Thiết bị, Loại thiết bị, Ngăn OLTC, Nhà sản xuất** (các thông số kỹ thuật nếu muốn). Các thông tin này được dùng chung cho **tất cả** file trong đợt; riêng **Pha, Ngày lấy mẫu và 7 khí** được đọc riêng từ mỗi file.
2. Ở ô phải **"Nhiều BBTN (PDF) hoặc cả thư mục — cùng 1 thiết bị"** của khung **Nhập BBTN** (ngang hàng với ô 1 BBTN): kéo thả nhiều file PDF vào, hoặc bấm **Chọn cả thư mục…**.
3. Tick/bỏ tick **"Đính kèm PDF gốc vào từng lần đo"** (mặc định đang tick).
4. Xem **bảng xem trước**: mỗi file có một trạng thái:
   - **Sẵn sàng** — có thể nhập.
   - **Cảnh báo** — không đọc được Pha, hoặc **trùng Pha + Ngày** với bản ghi đã có/dòng khác trong đợt.
   - **Lỗi** — không đọc được file hoặc thiếu dữ liệu bắt buộc.
5. Sửa tay **Pha / Ngày** ở từng dòng nếu cần; tick chọn từng dòng, hoặc dùng **Chọn tất cả hợp lệ / Bỏ chọn tất cả**.
6. Bấm **Lưu các lần đo đã chọn**. App lưu lần lượt từng dòng (một dòng lỗi **không chặn** các dòng còn lại) và tự đánh số **Lần đo** tăng dần theo đúng nhóm Trạm + Thiết bị + Pha.

> Trình duyệt Firefox không lọc theo thư mục được (nút "Chọn cả thư mục" chỉ mở hộp chọn file thường). Nên dùng Chrome/Edge.

**Tab Lý-Hóa dầu** (MBA/Kháng dầu) có khung **Nhập BBTN** giống hệt: ô trái đọc 1 BBTN (PDF/Word) vào form, ô phải nhận **nhiều BBTN (PDF/Word) hoặc cả thư mục**. Mỗi file là 1 biên bản (thùng dầu chính + OLTC nếu có) và được lưu đúng như khi chọn từng file rồi bấm **"Đánh giá & Lưu cả biên bản"**. Trạm/Thiết bị lấy theo form nếu đã nhập (dùng chung cả đợt), để trống thì theo từng biên bản; Cấp điện áp, Trạng thái dầu, Ngày lấy mẫu và các chỉ tiêu đọc riêng từng file. Bảng xem trước báo **Hợp lệ** / **Đã có biên bản thiết bị này cùng ngày** (mặc định không chọn — tick để ghi đè) / **Lỗi**; sửa Ngày ở từng dòng nếu cần, rồi bấm **Lưu các biên bản đã chọn**.

---

## 8. Xuất Biên bản thí nghiệm và Báo cáo phân tích kỹ thuật (.docx)

Sau khi bấm **Phân tích & Lưu**, ở đầu khối **"2. Kết quả đánh giá"** có hai nút:

| Nút | Nội dung | Điều kiện |
|---|---|---|
| **Xuất BBTN (docx)** | Điền sẵn vào mẫu Biên bản thí nghiệm **PTC3/BM.15**: trạm, vị trí lắp đặt, hãng SX, ngày lấy/thí nghiệm mẫu, lý do, điều kiện môi trường, 7 khí, TCG, tốc độ sinh khí (%/tháng), N2/O2, Tổng hàm lượng khí hòa tan, kết luận | Luôn có |
| **Xuất báo cáo phân tích kỹ thuật (docx)** | Thông số thiết bị, kết quả thí nghiệm, 3 tỷ số khí, chẩn đoán bất thường, đề xuất hướng xử lý | Chỉ hiện khi trạng thái **khác "Bình thường"** |

Hai nút này nằm ở tab con **Lập BBTN** (riêng nút Báo cáo phân tích kỹ thuật hiện ở cả 2 tab con). Tab **Lý-Hóa dầu** có thêm **Xuất BBTN lý-hóa dầu** (thùng chính + OLTC) và **Xuất BBTN dầu 3 pha** TI/TU/Sứ xuyên — xem mục 9.

**Cách dùng:** bấm nút → file .docx được tải về → **mở bằng Word** để bổ sung các mục chưa có sẵn (hãng SX, số chế tạo, chữ ký…) rồi mới ban hành.

- Trường nào bạn để trống, file Word sẽ bỏ trống dòng đó (app không tự suy diễn).
- Việc tạo file chạy hoàn toàn trên trình duyệt, không gửi số liệu lên máy chủ.
- Số liệu điền sẵn chỉ mang tính **hỗ trợ**; người ký phải kiểm tra lại.

---

## 9. Thí nghiệm dầu cách điện (tab Lý-Hóa dầu)

Với dầu MBA/Kháng dầu và OLTC, bảng kết quả chia theo nhóm chỉ tiêu (chỉ nhập những chỉ tiêu có trong biên bản, ô để trống = không thí nghiệm):

| Nhóm | Chỉ tiêu | Căn cứ |
|---|---|---|
| **Cơ bản** | Điện áp chọc thủng, tgδ ở 90°C, hàm lượng nước (độ ẩm) | QĐ1901 Bảng 54 / 55 / 58 |
| **Bổ sung QĐ1901** | Trị số axit, chớp cháy cốc kín, tạp chất cơ học (quan sát bằng mắt / hàm lượng), số hạt > 6 μm và > 14 μm, điện trở suất 90°C, 2-furfural, màu sắc (ISO 2049) | QĐ1901 Điều 48–56 |
| **Độ ổn định ôxi hóa** (khi pha trộn dầu) | Cặn, trị số axit và tgδ sau ôxi hóa | QĐ1901 Bảng 60–62 |
| **Chỉ có ở IEC 60422** | Ngoại quan, sức căng bề mặt, lưu huỳnh ăn mòn, PCB, cặn, bùn, chất ức chế, chất thụ động | IEC 60422:2024 |
| **Khác** | Axit – kiềm hòa tan trong dầu | ghi trên BBTN PTC3 |

Kết quả có 2 khối: **đánh giá theo QĐ1901** (Đạt / Không đạt / Chưa đủ dữ liệu từng chỉ tiêu, kèm căn cứ) và **tham khảo IEC 60422:2024** (Bảng 3 dầu mới, Bảng 5 dầu vận hành — so với biên Tốt / Kém: Đạt / Cảnh báo (giữa 2 biên) / Không đạt), không ảnh hưởng kết luận theo QĐ1901.

Đầu tab, chọn **Loại thiết bị** — chỉ khối nhập liệu phù hợp được hiện ra (lựa chọn này chỉ để ẩn/hiện, không lưu vào bản ghi).

Giống tab Khí hòa tan, tab có 2 tab con dùng chung một form: **Nhập BBTN cũ** (đọc BBTN PDF/Word, khung đối chiếu, "Đánh giá & Lưu cả biên bản", bảng **Số liệu đã lưu** của đúng Trạm/Thiết bị đang nhập — dầu MBA chính, OLTC, TI/TU) và **Lập BBTN** (nhập tay, đánh giá, xuất BBTN lý-hóa / BBTN dầu 3 pha TI/TU dạng docx). Ở Lập BBTN, thông số kỹ thuật thiết bị (hãng sản xuất, năm sản xuất, điện áp định mức, công suất, số chế tạo, năm vận hành, loại dầu — khối **Thông số kỹ thuật thiết bị** của form dầu MBA, lưu kèm bản ghi) được tự điền khi chọn lại thiết bị đã lưu, hoặc lấy từ file PDF/Word cũ, giống tab Khí hòa tan. Toàn bộ dữ liệu của mọi thiết bị xem ở tab **Lịch sử đo**.

### 9.1. Dầu MBA/Kháng dầu (dầu chính)

Điền: **Trạm, Thiết bị, Điểm lấy mẫu, Cấp điện áp MBA, Trạng thái dầu, Nhà sản xuất (tùy chọn), Ngày lấy mẫu, Ghi chú**, (tùy chọn) **Loại dầu (chất ức chế)** và **Phương pháp thử ôxi hóa**, rồi nhập kết quả và bấm **Đánh giá & Lưu**.

- **Thông số kỹ thuật thiết bị** (hãng sản xuất, năm sản xuất, điện áp định mức, công suất, số chế tạo, năm vận hành, loại dầu): khối riêng trong form, **lưu kèm bản ghi** và dùng khi xuất BBTN. Ở **Lập BBTN**, chọn lại thiết bị đã lưu thì app tự điền các ô này.
- **Đọc từ BBTN (PDF hoặc Word .docx):** kéo thả vào ô trái khung **Nhập BBTN** (tab con Nhập BBTN cũ). App đọc thông tin chung, **thùng dầu chính và OLTC**, nhận MBA **1 pha** (vị trí lấy mẫu ghi 1 pha) hoặc **3 pha** (bảng có 3 cột Pha A/B/C, hoặc OLTC tách bảng con từng pha), chữ "Không thấy / Không có / Không ăn mòn". Biên bản Word được hiển thị bản xem nhanh ở **khung đối chiếu** bên cạnh form. Biên bản có cả phần OLTC thì bấm **Đánh giá & Lưu cả biên bản** để lưu cùng lúc thùng chính + OLTC (chung 1 file đính kèm).
- **Nhiều BBTN / cả thư mục:** ô phải khung Nhập BBTN — xem cuối mục 7.
- **Xuất BBTN lý-hóa dầu (docx):** ở **Lập BBTN**, sau khi **Đánh giá & Lưu**, khối **"Xuất Biên bản thí nghiệm dầu cách điện"** gom phần thùng chính và OLTC **cùng thiết bị, cùng ngày lấy mẫu** vào 1 biên bản theo mẫu PTC3. Điền vị trí lấy mẫu, lý do thí nghiệm, nhiệt độ / độ ẩm môi trường; **kết luận** do app tự viết (sửa được, bấm **Viết lại tự động** để viết lại) rồi bấm **Xuất BBTN (docx)**.

- **Điểm lấy mẫu:** *Thùng dầu chung 3 pha* (1 mẫu đại diện) hoặc *Thùng dầu riêng từng pha* (MBA/Kháng 3 pha rời, thường ở 500 kV) — khi đó chọn thêm **Pha A/B/C** và nhập riêng từng pha. Bấm **"i"** để xem giải thích.
- **Trạng thái dầu:** *Dầu mới (sau lắp đặt/sau sửa chữa)* hoặc *Dầu vận hành*.
- **"Có bảo vệ bằng màng chất dẻo/nitơ"**: chỉ hiện với cấp điện áp có phân biệt hai mức ngưỡng độ ẩm (≤ 110 kV).
- Ngưỡng theo **Bảng 58 / 55 / 54 QĐ1901** (Điều 50 / 47 / 46). Nếu chọn nhà sản xuất đã cấu hình tiêu chuẩn dầu, ngưỡng hãng được ưu tiên.

### 9.2. Dầu OLTC (bộ đổi nấc có tải)

Theo **Điều 37, Bảng 49 QĐ1901** (dầu vận hành); dầu OLTC mới đánh giá như dầu thùng chính. Điểm lấy mẫu: *Điểm cuối trung tính* (3 pha dùng chung) hoặc *Pha riêng*.

- Ô **"Kế thừa thông tin chung của dầu MBA chính"** (mặc định đang tick): OLTC dùng luôn Trạm, Thiết bị, Cấp điện áp, Trạng thái dầu, Nhà sản xuất, Ngày lấy mẫu, Ghi chú của form dầu MBA chính — các ô này được ẩn, chỉ hiện 1 dòng tóm tắt. Bỏ tick để nhập riêng cho OLTC.
- Phần OLTC được đưa vào cùng BBTN lý-hóa với thùng chính khi cùng thiết bị, cùng ngày lấy mẫu.

### 9.3. Dầu TI / TU / Sứ xuyên

Chọn **Loại thiết bị** là TI, TU hoặc **Sứ xuyên (Bushing)** — cả 3 dùng chung khối nhập dầu này.

**QĐ1901 không có bảng ngưỡng mặc định cho dầu TI/TU/Sứ xuyên** (chỉ dẫn chiếu "theo quy định nhà sản xuất"). Vì vậy:

- Bạn **bắt buộc phải chọn một Nhà sản xuất** đã được cấu hình đủ tiêu chuẩn **2 tầng (Bình thường / Loại bỏ)** ở mục **Quản trị → Cấu hình → Tiêu chuẩn**.
- Nếu chưa chọn hoặc hãng chưa có cấu hình, app **chặn lưu** và báo rõ lý do; hãy nhờ Admin cấu hình.
- Kết quả có 3 mức: **Đạt / Cảnh báo / Không đạt**.

#### BBTN dầu 3 pha (A, B, C chung một biên bản)

Khối này nằm đầu phần TI/TU/Sứ xuyên, dùng cho biên bản mẫu PTC3/BM.14 có 3 cột kết quả pha A, B, C.

Ở tab con **Nhập BBTN cũ**, khung **"Nhập BBTN dầu 3 pha"** trên cùng có 2 ô ngang hàng, cùng kích thước (giống dầu MBA và tab Khí hòa tan): ô trái đọc **một BBTN** vào form để đối chiếu; ô phải nhận **nhiều BBTN (PDF) hoặc cả thư mục** — mỗi file được lưu đúng như bấm **Đánh giá & Lưu 3 pha** (Trạm / Vị trí lắp đặt lấy theo form nếu đã nhập, Nhà sản xuất tự khớp theo hãng ghi trên biên bản), bảng xem trước báo Hợp lệ / Đã có biên bản cùng ngày (tick để ghi đè) / Lỗi.

1. **Có file PDF:** kéo thả vào ô trái của khung Nhập BBTN dầu 3 pha. Giao diện tự động mở **Khung hiển thị Biên bản đối chiếu song song** bên cạnh bảng số liệu 3 pha. App đọc thông tin chung và số liệu từng pha, rồi điền sẵn vào form. Bạn đối chiếu kết quả 3 pha (A, B, C) với văn bản gốc ngay bên cạnh trước khi bấm **Đánh giá & Lưu 3 pha**. Biên bản dạng ảnh scan được đọc bằng OCR nên cần so kỹ hơn.
2. **Nhập tay:** điền thông tin chung và bảng kết quả theo từng pha. Pha nào không thí nghiệm thì để trống.
3. Chọn **Nhà sản xuất áp tiêu chuẩn** (app tự chọn nếu tên trên biên bản khớp tiêu chuẩn đã cấu hình), rồi bấm **Đánh giá & Lưu 3 pha**.

Khi lưu, mỗi pha thành một bản ghi riêng trong lịch sử dầu TI/TU, nên tab **Cảnh báo** và **Xu hướng** theo dõi được từng pha. File PDF được đính kèm chung cho các pha. Bảng đánh giá có cột **Trên BBTN** để đối chiếu với đánh giá in trên biên bản, và app báo nếu hai bên khác nhau. Đánh giá của mỗi hạng mục lấy theo pha xấu nhất.

Nếu thiết bị đã có số liệu cùng ngày lấy mẫu, app hỏi trước khi ghi đè, không tạo dòng trùng.

**Xuất biên bản:** bấm **Xuất BBTN (docx)** để tải file Word theo mẫu, đã điền số liệu, tiêu chuẩn, đánh giá và kết luận. Kết luận do app viết sẵn và sửa được trước khi xuất. Trong Word, bổ sung Phụ lục (tiêu chuẩn nhà sản xuất, số liệu xuất xưởng), số biên bản và ngày ban hành rồi ký.

Muốn xem hoặc xuất lại biên bản cũ: ở bảng lịch sử, bấm **BBTN 3 pha** trên một dòng bất kỳ của biên bản đó. Các pha nhập lẻ trước đây cũng mở được, gom theo cùng trạm, thiết bị và ngày lấy mẫu.

### 9.4. Sứ xuyên (Bushing)

Thí nghiệm dầu sứ xuyên nhập ở khối **TI / TU / Sứ xuyên** (mục 9.3): đánh giá theo **tiêu chuẩn nhà sản xuất** (cấu hình tiêu chuẩn dầu với loại thiết bị "Sứ xuyên (Bushing)" ở **Quản trị → Cấu hình → Tiêu chuẩn**). Bảng tham chiếu IEC 60422:2024 Bảng 7 chỉ dành cho máy biến dòng/biến điện áp nên **không áp dụng** cho sứ xuyên. Khí hòa tan của sứ xuyên vẫn nhập ở tab **Khí hòa tan** (IEC 60599 Bảng A.10).

---

## 10. Xem lại, sửa, xóa và so sánh (tab Lịch sử đo)

### 10.1. Chọn nội dung xem

Ở đầu tab, chọn xem **Khí hòa tan (DGA)** hoặc **Dầu** (gồm 3 bảng: dầu MBA chính / dầu OLTC / dầu TI-TU-Sứ xuyên). Dùng ô lọc **Trạm/Thiết bị** (gõ tự do) và bộ lọc **Loại thiết bị** để thu hẹp danh sách.

### 10.2. Đọc bảng lịch sử DGA

Mỗi dòng gồm: ngày, trạm, thiết bị, loại, pha, lần đo, 7 khí + N2/O2, TCG, **Kết luận** (kèm "⚠ Vượt ngưỡng loại bỏ" nếu có), mã **Bảng 66**, vùng **Duval**, **Người nhập** và các nút thao tác.

- Ô khí **tô nền đỏ** = giá trị **đã bị sửa** so với lần lưu gốc. Rê chuột vào ô để xem **giá trị cũ và thời điểm sửa**.
- Huy hiệu **"✎ N lần sửa"** ở cột *Người nhập* cho xem log các lần chỉnh sửa.
- Nút **Xem** (biểu tượng con mắt) đưa số liệu lần đo lên form tab Khí hòa tan, kèm kết quả đánh giá; nếu lần đo có BBTN đính kèm, file PDF hiện ngay ở **khung đối chiếu** bên cạnh để soát số liệu đã nhập (nút **"Mở tab mới"** trong khung vẫn dùng được khi cần xem toàn màn hình). Ở chế độ Google Sheets, file trên Google Drive được tải qua máy chủ Apps Script nên lần mở đầu mất vài giây.

### 10.3. Sửa một lần đo đã lưu

1. Bấm nút sửa ở dòng cần sửa → app đưa số liệu lên form ở tab tương ứng, kèm dòng cảnh báo màu vàng **"Đang SỬA lần đo đã lưu…"**.
2. Chỉnh số liệu → bấm **Cập nhật & Lưu** để ghi đè, hoặc **Hủy sửa** để bỏ qua.
3. Hệ thống **tự ghi log** trường nào đã sửa (giá trị cũ, thời điểm) để mọi người cùng thấy.

> Người dùng thường chỉ sửa được bản ghi **do chính mình nhập**; xóa bản ghi chỉ dành cho **Admin** (xem mục 16).

### 10.4. So sánh tốc độ gia tăng khí giữa 2 lần đo bất kỳ

Ở khối **"So sánh tốc độ gia tăng khí giữa 2 lần đo"**:

1. Chọn **Thiết bị** (Trạm + Thiết bị + Pha) đã có từ **2 lần đo trở lên**.
2. Chọn **Lần đo thứ nhất** và **Lần đo thứ hai** (không cần là hai lần liền kề; app tự sắp theo thời gian).
3. Bấm **Tính tốc độ gia tăng**.

Bảng kết quả gồm: giá trị trước, sau, chênh lệch (Δ), **tốc độ (ppm/năm)**, khoảng điển hình và **đánh giá** theo Bảng 65 QĐ1901 (hoặc khoảng riêng của hãng nếu có).

---

## 11. Theo dõi thiết bị bất thường (tab Cảnh báo)

Tab này **tự rà soát lần đo/thí nghiệm gần nhất của từng thiết bị** (khí hòa tan, dầu MBA chính, dầu OLTC, dầu TI/TU/Sứ xuyên) và liệt kê các thiết bị đang ở mức **Cảnh báo** hoặc **Báo động**. App dùng đúng các hàm đánh giá đã dùng ở tab Khí hòa tan/Lý-Hóa dầu, không tự đặt ngưỡng riêng.

- **Thống kê nhanh:** tổng thiết bị đang theo dõi, số thiết bị đang có cảnh báo, số mức Cảnh báo, số mức Báo động.
- **Lọc theo Trạm biến áp:** gõ hoặc chọn trạm (chỉ gợi ý các trạm đang có cảnh báo); để trống = tất cả.
- Mỗi dòng cho biết: thiết bị, loại đo, mức cảnh báo, tình trạng, khí/chỉ tiêu vượt ngưỡng, lý do và khuyến cáo hành động.
- **Xem xu hướng:** nhảy thẳng sang tab **Xu hướng**, tự chọn đúng thiết bị/pha và tick sẵn (các) thông số gây cảnh báo.
- **Xuất Excel:** tải file `.xlsx` gồm thống kê tổng quan và toàn bộ danh sách đang hiển thị (theo bộ lọc Trạm hiện tại). Nút này chỉ bấm được khi có dữ liệu.

**Gợi ý thói quen:** mở tab này mỗi ngày/tuần để nắm các thiết bị cần theo dõi ngay, không phải mở từng thiết bị.

---

## 12. Xem xu hướng và dự báo (tab Xu hướng)

> **Thu gọn hướng dẫn:** cuối tiêu đề mỗi mục (Xu hướng theo thời gian, Chọn thông số cần vẽ, Dự báo xu hướng, Diễn biến loại khiếm khuyết) và cạnh tiêu đề bảng **Tiêu chuẩn so sánh** dưới đồ thị có nút **con mắt**. Bấm để ẩn các đoạn hướng dẫn, giải thích của mục đó (kể cả bảng Ý nghĩa mã khiếm khuyết) cho gọn màn hình; khi đó icon đổi thành con mắt gạch chéo, bấm lại để hiện. App nhớ lựa chọn của từng mục trên trình duyệt đang dùng.

### 12.1. Vẽ đồ thị

1. (Tùy chọn) Chọn **Trạm biến áp** để danh sách thiết bị chỉ gồm thiết bị của trạm đó. Nếu không chọn trạm mà tên thiết bị trùng ở nhiều trạm, app sẽ báo — hãy chọn trạm để phân biệt.
2. Chọn **Thiết bị**.
3. Nếu thiết bị có dữ liệu từ nhiều pha, tick các pha muốn so sánh ở **"Lọc theo pha"** — mỗi pha một đường riêng.
4. Ở **"Chọn thông số cần vẽ"**, tick các thông số muốn xem chung một đồ thị: 7 khí, N2, O2, TCG, Tổng hàm lượng khí hòa tan, và độ ẩm/tgδ/điện áp chọc thủng của dầu chính và dầu OLTC. Mỗi thông số dùng một trục tung phù hợp đơn vị.

**Nhận biết từng đường:**

- Ký hiệu thông số (H2, CH4, C2H2, TCG, Ẩm, BDV…) hiện ở cuối mỗi đường khi còn chỗ. Khi tách theo pha, ký hiệu kèm pha, ví dụ **H2·A**.
- Nhiều đường sát hoặc chồng nhau thì một số ký hiệu bị ẩn để không đè lên nhau. Chạm (điện thoại) hoặc click (máy tính) vào đường: đường đó đậm lên, các đường khác mờ đi, và ký hiệu hiện ngay tại chỗ chạm.
- Chạm lại đúng chỗ đó để chuyển sang đường đang bị chồng bên dưới. Chạm vào vùng trống để bỏ chọn.

**Hai chỉ tiêu tổng hợp** (app tự tính từ số liệu của từng lần đo):

| Chỉ tiêu | Cách tính | Đánh giá |
|---|---|---|
| **TCG — Tổng lượng khí cháy** (ppm) | H2 + CH4 + C2H6 + C2H4 + C2H2 + CO. Không cộng CO2 (không cháy), N2, O2 | QĐ1901 và IEC 60599 không quy định ngưỡng TCG — app chỉ vẽ để theo dõi xu hướng |
| **Tổng hàm lượng khí hòa tan** (%) — Bảng 63, Điều 54 | (H2 + CH4 + C2H6 + C2H4 + C2H2 + CO + CO2 + N2 + O2) ÷ 10.000 (1% = 10.000 ppm). Cần nhập **cả N2 lẫn O2**; lần đo thiếu thì đồ thị bỏ trống điểm đó | 110–220 kV: < 1%; 500 kV: < 0,5% |

**Khi nào đánh giá Bảng 63:** chỉ kết luận đạt/không đạt với **dầu mới đưa vào vận hành lần đầu hoặc sau sửa chữa có thay dầu/lọc dầu** (tick ô tương ứng và chọn cấp điện áp ở form Khí hòa tan, mục 4). Với dầu đang vận hành định kỳ, giá trị chỉ để tham khảo.

**Tiêu chuẩn so sánh của thông số khí đang vẽ:** ngay dưới đồ thị, khi đang tick ít nhất một thông số khí, app hiện bảng tiêu chuẩn của đúng các thông số đó. Bảng này có **nút con mắt riêng** để ẩn/hiện, không phụ thuộc nút của mục "Chọn thông số cần vẽ".

- **7 khí chính:** giá trị điển hình đang áp dụng cho thiết bị (theo loại thiết bị/nhà sản xuất của lần đo gần nhất — cùng nguồn với tab Khí hòa tan), ngưỡng loại bỏ nếu nhà sản xuất có cấu hình, và tốc độ tăng điển hình Bảng 65 (chỉ áp dụng chính thức cho MBA; loại khác ghi "tham khảo").
- **N2, O2:** không có ngưỡng riêng; dùng cho tỷ lệ O2/N2 (~0,5 là bình thường ở thiết bị tiếp xúc không khí, < 0,3 là tiêu thụ oxy quá mức) và Bảng 63.
- **TCG:** ghi rõ QĐ1901/IEC 60599 không quy định ngưỡng; kèm mốc **IEEE C57.104-2008** để tham khảo (≤ 720 ppm điều kiện 1; 721–1.920 điều kiện 2; 1.921–4.630 điều kiện 3; > 4.630 điều kiện 4 — bản 2019 đã bỏ cách phân loại này).
- **Tổng hàm lượng khí hòa tan:** ngưỡng 2 cấp điện áp (in đậm cấp của thiết bị nếu đã chọn khi nhập), và cho biết lần đo gần nhất có thuộc trường hợp dầu mới/sau thay, lọc dầu hay không.

Phía dưới có **bảng số liệu thô** của từng nguồn (khí / dầu chính / dầu OLTC).

> Nếu không có mạng hoặc thư viện vẽ đồ thị (Chart.js) tải lỗi, đồ thị sẽ ẩn kèm thông báo — kiểm tra kết nối và tải lại trang. Các bảng số liệu và bảng dự báo vẫn dùng được.

### 12.2. Dự báo xu hướng

- Tick **"Hiện dự báo xu hướng tương lai (ngoại suy tuyến tính, chỉ tham khảo)"** (app nhớ lựa chọn) và đặt **Số năm dự báo** (1–30).
- Với mỗi khí trong 7 khí chính, bảng hiển thị 4 phương pháp:
  - **Hồi quy tuyến tính OLS**: tốc độ thay đổi, giá trị dự báo kèm **khoảng dự báo 95%**, **R²** và **p-value** kiểm định độ dốc.
  - **Độ dốc Sen + kiểm định Mann–Kendall**: phương pháp phi tham số, ít bị ảnh hưởng bởi lần đo bất thường; kèm **khoảng tin cậy 95% của tốc độ**. Đường nét đứt trên đồ thị dùng phương pháp này.
  - **Độ dốc Sen + Mann–Kendall — giai đoạn gần đây**: cùng phương pháp nhưng chỉ dùng các lần đo trong **3 năm gần nhất**, tối thiểu **5 lần đo** gần nhất (nếu 3 năm có ít hơn 5 lần đo thì lấy thêm lần đo cũ hơn). Dòng này chỉ hiện khi chuỗi số liệu dài hơn cửa sổ, và giúp phát hiện tốc độ sinh khí đang thay đổi mà xu hướng toàn chuỗi phản ứng chậm.
- Cột **Khí** ghi kết luận xu hướng theo Mann–Kendall: **Tăng** / **Giảm** (khi p < 0,05), **Chưa phát hiện xu hướng có ý nghĩa thống kê**, hoặc **Chưa đủ lần đo** (cần ≥ 4). Khi có giai đoạn gần đây, cột này còn so sánh tốc độ gần đây với khoảng tin cậy 95% của tốc độ toàn chuỗi: **tăng nhanh hơn** / **chậm hơn** (nằm ngoài khoảng) hoặc **phù hợp**.
  - **Tốc độ 2 lần đo gần nhất**: đúng cách tính tốc độ tăng của Bảng 65, để tự động đối chiếu. Chỉ dùng 2 điểm, không có kiểm định thống kê, nên không dùng để kết luận xu hướng.
- Dự báo lấy từ **đường đã khớp**, không neo vào một lần đo đơn lẻ; nồng độ dự báo **không âm** (cắt tại 0).
- Cột **Khí** hiện cảnh báo **"⚠ Có thể vượt giá trị điển hình ~tháng/năm"** chỉ khi xu hướng tăng **có ý nghĩa thống kê** (Sen + Mann–Kendall, hoặc OLS) **và** mốc đó nằm trong **số năm dự báo** đã chọn; hoặc **"Lần đo gần nhất đã vượt giá trị điển hình"**. Ngưỡng ở đây là giá trị điển hình đang áp dụng — vượt ngưỡng là tín hiệu cần **tăng cường theo dõi**, chưa phải kết luận có khiếm khuyết. App không hiện mốc ngoại suy xa hơn số năm dự báo hoặc từ xu hướng chưa có ý nghĩa, vì tốc độ sinh khí còn phụ thuộc tải, nhiệt độ, lọc/thay dầu.
- Cần **tối thiểu 2 lần đo** mỗi khí để dự báo; khoảng dự báo cần ≥ 3 lần đo, kiểm định Mann–Kendall cần ≥ 4.
- Cảnh báo vượt giá trị điển hình chỉ áp dụng cho **7 khí chính**.

> ⚠ Dự báo giả định tốc độ sinh khí **không đổi** — chỉ mang tính tham khảo thống kê, không thay thế đánh giá tổng hợp.

### 12.3. Lọc dầu / thay dầu

Lọc hoặc thay dầu làm nồng độ khí hòa tan giảm đột ngột, nên số liệu trước đó không còn phản ánh tình trạng hiện tại của thiết bị.

- App coi một lần đo là **khí giảm đột ngột** khi so với lần đo liền trước (cùng thiết bị, cùng pha): tổng khí cháy **TDCG** (H2, CH4, C2H6, C2H4, C2H2, CO) giảm **≥ 50%**, TDCG lần trước **≥ 30 ppm**, và có **ít nhất 2 khí** (mỗi khí lần trước ≥ 5 ppm) cùng giảm ≥ 50%.
- Khi đó app hỏi **"Giữa 2 lần đo này có lọc dầu hoặc thay dầu không?"** với 3 lựa chọn: **Đã lọc dầu**, **Đã thay dầu**, **Không xử lý dầu**. Câu hỏi hiện ở khối kết quả tab DGA ngay sau khi lưu, và ở tab **Xu hướng** cho mọi lần đo chưa xác nhận (kể cả số liệu nhập hàng loạt hoặc đọc từ BBTN).
- Đã chọn **Lọc dầu** hoặc **Thay dầu**: dự báo xu hướng chỉ dùng các lần đo **từ lần đo này trở đi**. Bảng dự báo ghi rõ mốc bắt đầu và số lần đo cũ đã bỏ. Đồ thị vẫn hiện đầy đủ số liệu đã đo.
- Chọn **Không xử lý dầu**: chuỗi số liệu giữ nguyên, app không hỏi lại lần đo đó.
- Các lần xử lý dầu đã ghi nhận được liệt kê ở tab Xu hướng, kèm nút **Đổi** để bỏ xác nhận. Cũng có thể chọn trực tiếp ở ô **Xử lý dầu trước lần đo này** khi nhập hoặc sửa lần đo.
- Chỉ **Admin** hoặc **người đã nhập lần đo** mới xác nhận được.

### 12.4. Diễn biến loại khiếm khuyết (Bảng 66 và tam giác Duval)

Ba tỷ số C2H2/C2H4, CH4/H2, C2H4/C2H6 và tam giác Duval cho biết **loại** khiếm khuyết, không cho biết mức độ. Mức độ xem ở nồng độ và tốc độ tăng. Theo dõi chúng theo thời gian giúp thấy khiếm khuyết có **đổi bản chất** không, ví dụ quá nhiệt nóng dần lên hay xuất hiện phóng điện.

Bảng 66 Điều 54 QĐ1901 gồm 2 phần, app tra cả hai:

- **Phần 9 dòng** (mốc 0,1 – 1 – 3): bình thường, phóng điện cục bộ năng lượng thấp/cao, phóng điện năng lượng thấp/cao, khuyết tật nhiệt <150 °C, 150–300 °C, 300–700 °C, >700 °C. Văn bản không nói rõ biên, app quy ước **cận dưới tính vào, cận trên không tính** (ví dụ "0,1–1" là 0,1 ≤ tỷ số < 1). Tổ hợp không khớp dòng nào ghi **Ngoài bảng**.
- **Phần PD/D1/D2/T1/T2/T3** (= Table 1 IEC 60599), mốc chi tiết 0,1 · 0,2 · 0,5 · 0,6 · 1 · 2 · 2,5 · 4, kèm chú thích ᵃ NS (không có ý nghĩa, dù giá trị bao nhiêu) và ᵇ (C2H2 tăng có thể cho thấy điểm nóng vượt 1000 °C).
- **Bảng sơ bộ PD/D/T** ngay dưới: theo Điều 54, khi tỷ lệ không nằm trong giới hạn của phần PD/D1/D2/T1/T2/T3 thì dùng bảng này để xác định sơ bộ PD (CH4/H2 < 0,2), D (C2H2/C2H4 > 0,2) hay T (C2H2/C2H4 < 0,2). Trong bảng chi tiết và dải mã, lần đo như vậy ghi "Ngoài bảng → sơ bộ D" (hoặc PD, T).

Mục này nằm dưới phần dự báo ở tab Xu hướng, tự hiện khi thiết bị có số liệu khí hòa tan, gồm:

- **Đồ thị 3 tỷ số** theo thời gian, vẽ chung một trục tung. Ô **Thang trục tung** chọn **Logarit 0,01–10** (mặc định, cùng thang với Biểu đồ 1, 2 Điều 54) hoặc **Tuyến tính 0–10**; app nhớ lựa chọn. Ô **Vạch mốc** chọn bộ vạch đứt ngang (app nhớ lựa chọn):
  - **Phần 9 dòng Bảng 66**: các mốc **0,1 – 1 – 3**, bên cạnh ghi mốc đó dùng cho tỷ số nào (C2H2/C2H4 dùng 0,1 và 3; CH4/H2 dùng 0,1 và 1; C2H4/C2H6 dùng 1 và 3).
  - **Phần PD/D1/D2/T1/T2/T3 + bảng sơ bộ**: mốc chi tiết của từng tỷ số, vạch và nhãn **cùng màu với đường tỷ số** dùng mốc đó (C2H2/C2H4: 0,1 · 0,2 · 0,6 · 1 · 2,5; CH4/H2: 0,1 · 0,2 · 0,5 · 1 và ngưỡng PD theo loại thiết bị; C2H4/C2H6: 0,2 · 1 · 2 · 4). Bấm tên tỷ số ở chú giải trên đồ thị để ẩn bớt, chỉ còn vạch của tỷ số cần xem.

  Tỷ số lớn hơn 10 vẽ **▲** ở đỉnh.
- **Dải mã** ngay dưới trục thời gian: mỗi lần đo một ô màu, 3 làn **9 dòng** / **IEC** / **Duval**. Nhìn ngang thấy ngay lần đo nào đổi loại. Ô nhạt là lần đo chỉ để tham khảo.
- **Tam giác Duval 1** với các lần đo nối theo thứ tự thời gian. Số trên điểm là thứ tự trong bảng; điểm viền đậm là lần đo gần nhất trong số đang tick.
- **Bảng từng lần đo**: 3 tỷ số, mã Bảng 66 (9 dòng), mã Bảng 66 (IEC), vùng Duval và điều kiện áp dụng. Lần đo mà mã IEC khác lần đo đủ điều kiện trước đó được in đậm kèm chữ **(đổi)**.
- **Chọn lần đo hiển thị**: tick/bỏ tick ở cột đầu của bảng để chọn lần đo nào hiện trên đồ thị và quỹ đạo Duval (mặc định tick hết). Ô ở tiêu đề cột để chọn hoặc bỏ tất cả. Đổi thiết bị hoặc pha thì tick lại hết.
- **Ý nghĩa mã khiếm khuyết** ngay dưới tam giác:

  | Mã | Dạng khiếm khuyết |
  |---|---|
  | PD | Phóng điện cục bộ dạng corona (bọt khí, khoang rỗng trong cách điện ngâm dầu) |
  | D1 | Phóng điện năng lượng thấp: tia lửa, phóng điện bề mặt, lỗ châm/vết cháy nhỏ trên giấy |
  | D2 | Phóng điện năng lượng cao: hồ quang, phóng điện xuyên thủng, ngắn mạch vòng dây |
  | T1 | Quá nhiệt dưới 300 °C: quá tải, giấy cách điện bị nung nóng |
  | T2 | Quá nhiệt 300–700 °C: tiếp xúc xấu ở mối nối/bộ chuyển nấc, dòng xoáy |
  | T3 | Quá nhiệt trên 700 °C: dòng tuần hoàn trong lõi/vỏ thùng, chạm lõi nhiều điểm |
  | D+T | Hỗn hợp phóng điện và quá nhiệt (ranh giới không phân định rõ trên tam giác Duval) |
  | Ngoài bảng | Tổ hợp 3 tỷ số không khớp dòng/mã nào của Bảng 66 — xem vùng Duval |

**Phiếu đối chiếu từng lần đo:** bấm vào một điểm trên đồ thị, một ô ở dải mã, hoặc một dòng trong bảng để mở phiếu của lần đo đó. Phiếu gồm:

1. **3 thước** (log 0,01–10, chia theo mốc 0,1 – 1 – 3) có vạch chỉ vị trí từng tỷ số.
2. **Bảng 66 phần 9 dòng** dựng lại đúng như quy định: ô xanh ✓ là tỷ số nằm trong khoảng của ô, ô xám là không; dòng khớp đủ 3 ô được viền xanh, kèm cột ví dụ điển hình.
3. **Bảng 66 phần PD/D1/D2/T1/T2/T3** theo cùng cách, kèm chú thích ᵃ, ᵇ như quy định (ô NS = không xét).
4. **Bảng sơ bộ PD/D/T** cũng tô ô đạt/không đạt. Bảng này chỉ dùng để kết luận khi không khớp mã nào ở bảng trên; nếu đã khớp, phiếu hiện mờ và ghi "không áp dụng".
5. **Các bước khác của Điều 54** theo thứ tự: giá trị điển hình (Bảng 64), tốc độ tăng so với lần đo trước (Bảng 65), kiểm tra nhiễm khí từ OLTC (C2H2/H2 > 2–3), vùng Duval (Bảng 67), tỷ lệ bổ sung CO2/CO và O2/N2, lỗi điển hình (Bảng 68) theo mã tìm được, và dạng hư hỏng theo khí chính (Bảng 69). Ở Bảng 69 app tô dòng có khí chính vượt giá trị điển hình nhiều nhất — đây chỉ là **gợi ý**, Điều 54 không quy định cách chọn.

Cách đọc:

- **Điểm rỗng** (hoặc dòng chữ nhạt, ghi "Tham khảo"): lần đo chưa có khí nào vượt giá trị điển hình. Theo Điều 54 QĐ1901 và mục 6.1(c) IEC 60599, tỷ số lúc này chỉ để tham khảo. Ở nồng độ thấp, sai số đo cũng đủ làm tỷ số dao động mạnh.
- **Tam giác ▽ ở đáy** (thang log): tỷ số nhỏ hơn 0,01, kể cả khi tử số bằng 0 (KPH). Mẫu số bằng 0 thì không tính tỷ số đó.
- **Tính trên**: chọn tính tỷ số trên **Giá trị đo** hay **Phần tăng giữa 2 lần đo (Δ)** — xem mục ngay dưới.
- Thiết bị có nhiều pha: chọn từng pha ở ô **Pha**.

**Tính trên giá trị đo hay phần tăng giữa 2 lần đo (Δ):**

| Tùy chọn | Số liệu dùng để tính 3 tỷ số và điểm Duval |
|---|---|
| **Giá trị đo** (mặc định) | Nồng độ khí đo được ở chính lần đo đó |
| **Phần tăng (Δ)** | Lần đo này **trừ** lần đo ngay trước, tính riêng từng khí |

Vì sao cần Δ: khí trong dầu tích lũy dần. Máy từng có khiếm khuyết cũ (ví dụ phát nóng nhẹ nhiều năm trước) vẫn còn nhiều khí cũ trong dầu. Khi xuất hiện khiếm khuyết **mới**, khí mới sinh ra bị "pha loãng" vào khí cũ, tỷ số tính trên giá trị đo bị kéo về phía khiếm khuyết cũ. Δ chỉ giữ lượng khí **sinh ra giữa 2 lần đo**, nên phản ánh khiếm khuyết **đang hoạt động**. IEC 60599 khuyến nghị cách này khi khí tăng đáng kể.

Ví dụ (ppm):

| | H2 | CH4 | C2H6 | C2H4 | C2H2 |
|---|---|---|---|---|---|
| Lần 1 | 100 | 50 | 40 | 20 | 0 |
| Lần 2 | 300 | 70 | 50 | 100 | 2 |
| **Δ** | 200 | 20 | 10 | 80 | 2 |

| Tỷ số của lần 2 | Giá trị đo | Δ |
|---|---|---|
| C2H2/C2H4 | 0,02 | 0,025 |
| CH4/H2 | 0,23 | 0,10 |
| C2H4/C2H6 | **2,0** | **8,0** |

Tính trên giá trị đo, C2H4/C2H6 chỉ là 2. Tính trên Δ, tỷ số này lên tới 8: khí mới sinh ra chủ yếu là C2H4, dấu hiệu nhiệt cao hơn hẳn so với những gì giá trị đo thể hiện.

App xử lý như sau:

- **Lần đo đầu tiên** của thiết bị/pha không có lần trước để trừ, nên không có điểm Δ.
- **Lần đo ngay sau lọc/thay dầu** (đã xác nhận ở mục 12.3) bị bỏ qua: phép trừ ra số âm, không có ý nghĩa.
- **Cặp không có khí cháy nào tăng** (H2, CH4, C2H6, C2H4, C2H2 đều giảm hoặc giữ nguyên) bị bỏ qua.
- Tỷ số có **Δ tử số âm** hoặc **Δ mẫu số ≤ 0** thì không tính (ví dụ CH4 giảm thì bỏ trống CH4/H2). Thiếu 1 trong 3 tỷ số thì không tra được mã Bảng 66. Điểm Duval cần Δ của CH4, C2H4, C2H2 đều ≥ 0.
- Mỗi điểm ghi theo khoảng ngày, ví dụ **"Δ 12/03/2025 → 20/09/2025"**, trên đồ thị, bảng và phiếu đối chiếu.
- Trong phiếu đối chiếu chỉ **tỷ số** tính trên Δ. Các bước kiểm tra **nồng độ** theo Điều 54 (giá trị điển hình Bảng 64, tốc độ tăng Bảng 65…) vẫn dùng giá trị đo của lần đo sau, vì ngưỡng nồng độ áp dụng cho lượng khí thực có trong dầu.

Khi nào dùng: xem bình thường bằng **Giá trị đo** (đúng cách đọc Bảng 66 theo Điều 54). Bật **Δ** khi thấy khí tăng mạnh giữa 2 lần đo, để biết khí mới sinh ra thuộc dạng khiếm khuyết nào. Δ chỉ đáng tin khi lượng tăng đủ lớn so với sai số đo — khí chỉ nhích vài ppm thì tỷ số Δ dao động mạnh, không nên dùng để kết luận.

> Mã Bảng 66 ở đây tra thẳng Bảng 66 cho mọi loại thiết bị (ngưỡng PD theo loại thiết bị). Với sứ xuyên, kết luận chính thức ở tab Khí hòa tan dùng Table A.10 IEC 60599. Phiếu đối chiếu chỉ hỗ trợ — kết luận theo đánh giá tổng hợp (Điều 3 QĐ1901).

---

## 13. Cấu hình tiêu chuẩn theo nhà sản xuất và bảng quy định (trong Quản trị → Cấu hình)

Chức năng **Cấu hình** trước đây là tab riêng ở thanh bên, nay đã được chuyển vào mục **Quản trị** trên thanh Menu bar trên cùng (dành riêng cho Admin). Để truy cập: bấm biểu tượng **Quản trị** ở Header → chọn subtab **Cấu hình**.

Mục Cấu hình gồm hai phần con, chuyển bằng nút **Tiêu chuẩn / Quy định** ở đầu trang. Bấm biểu tượng **"i"** cạnh tiêu đề để xem hướng dẫn chi tiết.

> Phần này thường do **Admin** thực hiện. Người dùng thường chủ yếu chỉ xem trong các bảng tra cứu.

### 13.1. Mục "Tiêu chuẩn" — ngưỡng riêng theo nhà sản xuất

Cho phép đặt ngưỡng riêng cho từng hãng, áp dụng thay cho ngưỡng mặc định QĐ1901/IEC:

- **Khí hòa tan (DGA):** ngưỡng tuyệt đối từng khí, **ngưỡng loại bỏ**, khoảng tốc độ tăng riêng.
- **Dầu cách điện MBA/Kháng dầu:** thay cho Bảng 54/55/58 (theo cấp điện áp + trạng thái dầu).
- **Dầu cách điện TI/TU/Sứ xuyên:** **bắt buộc** cấu hình (2 tầng Bình thường/Loại bỏ) vì QĐ1901 không có bảng mặc định.

Màn hình chia 2 cột: **bên trái** là danh sách tiêu chuẩn đã cấu hình (tìm theo tên nhà sản xuất, lọc Khí / Dầu; bấm **Sửa** để nạp lên form, dòng đang sửa được tô nổi; **Xóa**), **bên phải** là form thêm/sửa. Các bước: bấm **+ Thêm tiêu chuẩn** (hoặc **Sửa** 1 dòng) → chọn loại tiêu chuẩn, hãng, loại thiết bị → điền ngưỡng ở bảng (mỗi dòng 1 khí / 1 hạng mục dầu, cột **Ngưỡng tuyệt đối/bình thường** và **Ngưỡng loại bỏ**) → bấm **Lưu tiêu chuẩn** (hoặc **Hủy**). Với dầu MBA/Kháng dầu, cột Loại bỏ và dòng tgδ 20°C tự ẩn (chỉ dùng cho TI/TU/Sứ xuyên).

**Quy tắc áp dụng:** nếu thiết bị/thí nghiệm không chọn nhà sản xuất, hoặc hãng chưa có cấu hình khớp, app dùng tiêu chuẩn mặc định QĐ1901/IEC. Riêng dầu TI/TU/Sứ xuyên sẽ báo *"Chưa có tiêu chuẩn nhà sản xuất"*.

### 13.2. Mục "Quy định" — các bảng ngưỡng số học

Cho phép chỉnh **các bảng ngưỡng đơn giản** trích từ QĐ1901/IEC 60599:2022/IEC 60422:2024 (ví dụ: MBA/Kháng dầu — Khí hòa tan; Dầu MBA — Điện áp chọc thủng; tgδ ở 90°C; Hàm lượng nước; Dầu OLTC — Độ ẩm & điện áp chọc thủng…) và tên văn bản/điều khoản hiển thị.

Màn hình chia 2 cột: **bên trái** là danh sách bảng theo nhóm (Khí hòa tan / Lý-hóa dầu / Tên văn bản) có ô **tìm kiếm** (gõ "Bảng 55", "Duval", "OLTC"…) và lọc **Chỉ bảng đã tùy chỉnh**; **bên phải** chỉ hiện bảng đang chọn, nút **Lưu bảng này / Khôi phục mặc định** luôn ở đầu bảng. Bảng có thay đổi chưa lưu được đánh dấu **●** ở danh sách và nhãn **Chưa lưu** — chuyển qua bảng khác không mất số đang sửa; lưu 1 bảng không ảnh hưởng các bảng đang sửa dở khác.

- Sửa số liệu + nguồn tham chiếu → bấm **Lưu bảng này** (dùng khi quy định được cập nhật, không cần sửa code).
- **Khôi phục mặc định:** trả bảng về đúng số liệu gốc tích hợp sẵn.
- **Không** gồm logic tra mã Bảng 66/Table A.10 và ranh giới Tam giác Duval — các phần này cố định theo văn bản gốc.
- Chỉ **Admin** sửa/lưu được (chế độ Google Sheets / Supabase); mọi người dùng đã đăng nhập đều xem được.

---

## 14. Tra cứu quy trình lấy mẫu và đánh giá (tab Quy trình)

Tab có hai mục con:

### 14.1. "Lấy mẫu dầu"

- **7 phương pháp lấy mẫu dầu** (Điều 8 QĐ1901) dạng thu gọn/mở rộng; dùng **Mở tất cả / Thu gọn tất cả**.
- 5 sơ đồ minh họa (Hình 2–5) và thư viện ảnh thực tế. **Bấm vào ảnh để phóng to**; đóng bằng nút **×**, bấm ra ngoài hoặc phím **Esc**.

### 14.2. "Đánh giá DGA"

- **Cẩm nang tham khảo nhanh:** các áp phích tổng hợp quy trình chẩn đoán (bấm để phóng to). Lưu ý đây chỉ là bản tóm tắt trực quan; số liệu ngưỡng chính thức mà app dùng là bảng theo đúng loại thiết bị.
- **Hai sơ đồ tư duy** (diễn giải quy trình DGA; cơ chế hình thành khí, 7 loại khí, khí chỉ thị theo lỗi…), mỗi sơ đồ có nút **Mở tất cả / Thu gọn tất cả**.
- Mục **"Căn cứ"** ghi rõ nguồn: IEC 60599:2022 và các điều/bảng của QĐ1901.

---

## 15. Góp ý cho ứng dụng (mục Phản hồi trên Menu bar)

Để gửi ý kiến đóng góp hoặc phản ánh sự cố, bấm vào biểu tượng **Phản hồi** (icon bóng thoại trên thanh Menu bar ở đầu trang — trước đây là tab *Người dùng phản hồi*).

1. Nhập nội dung góp ý.
2. (Tùy chọn) Đính kèm **1 ảnh minh họa** bằng một trong ba cách: chọn file, **kéo thả**, hoặc **dán trực tiếp (Ctrl+V)** ảnh vừa chụp màn hình vào khung. Bấm **Bỏ ảnh** nếu muốn gỡ.
3. Bấm **Gửi góp ý**.

Các góp ý đã gửi được hiển thị (mới nhất ở trên) để mọi người cùng xem, tránh đề xuất trùng nhau; bấm ảnh để phóng to. Góp ý **không sửa lại được** sau khi gửi; chỉ Admin xóa được.

---

## 16. Phân quyền Admin / User và mục Quản trị

### 16.1. Bảng phân quyền 3 vai trò (Viewer, User, Admin)

Ứng dụng hỗ trợ 3 vai trò người dùng với các mức quyền hạn phân định rõ ràng:

| Quyền hạn | Viewer | User | Admin |
|---|:-:|:-:|:-:|
| Xem toàn bộ dữ liệu (Khí DGA, Dầu, Lịch sử, Cảnh báo, Xu hướng) | ✔ | ✔ | ✔ |
| Nhập mới lần đo DGA, thí nghiệm dầu MBA, OLTC, TI/TU/Sứ xuyên | ✘ | ✔ | ✔ |
| Sửa bản ghi đo khí / thí nghiệm dầu đã lưu | ✘ | Chỉ bản ghi **do mình nhập** | Mọi bản ghi |
| Xóa bản ghi dữ liệu | ✘ | ✘ | ✔ |
| Gửi ý kiến phản hồi kèm ảnh minh họa | ✔ | ✔ | ✔ |
| Cấu hình Tiêu chuẩn theo nhà sản xuất | ✘ | ✘ (chỉ xem khi tra cứu) | ✔ (Thêm, Sửa, Xóa) |
| Chỉnh sửa các bảng Quy định số học QĐ1901/IEC | ✘ | ✘ (chỉ xem bảng) | ✔ (Lưu bảng, Khôi phục) |
| Quản lý người dùng (tạo tài khoản, đổi vai trò, đặt lại mật khẩu, xóa) | ✘ | ✘ | ✔ |
| Đồng bộ dữ liệu sang Bản sao Supabase | ✘ | ✘ | ✔ |

Mỗi bản ghi khi lưu đều tự động ghi nhận **người tạo, người sửa cuối cùng và thời điểm thực hiện** (cột "Người nhập" ở bảng Lịch sử đo). Mọi thao tác kiểm tra quyền đều được máy chủ (Apps Script / Supabase) xác thực độc lập.

### 16.2. Hướng dẫn chi tiết các tính năng trong mục Quản trị

Biểu tượng **Quản trị** trên thanh Menu bar ở đầu trang chỉ hiển thị khi tài khoản đang đăng nhập có vai trò **Admin**. Khi mở mục Quản trị, hệ thống cung cấp 3 subtab tác nghiệp chuyên biệt:

#### 1. Subtab "Người dùng" (Quản lý tài khoản & phân quyền)

- **Tạo tài khoản trực tiếp:**
  - Nhập **Email tài khoản mới** và chọn **Vai trò** (User, Viewer hoặc Admin) ở thanh công cụ trên cùng.
  - Bấm nút **+ Tạo tài khoản**.
  - Hệ thống tự động sinh một **mật khẩu tạm ngẫu nhiên** và hiển thị trong hộp thoại thông báo kèm nút **Copy**.
  - *Lưu ý quan trọng:* Mật khẩu tạm chỉ hiển thị **duy nhất 1 lần**, ứng dụng không lưu lại mật khẩu này. Admin nên gửi email tài khoản qua tin nhắn và đọc mật khẩu tạm qua cuộc gọi (không gửi chung cả hai trong cùng một tin nhắn). Khi người dùng đăng nhập lần đầu bằng mật khẩu tạm, hệ thống sẽ **bắt buộc đổi sang mật khẩu cá nhân** mới được phép vào sử dụng ứng dụng.
- **Danh sách tài khoản:** Bảng hiển thị thông tin toàn bộ tài khoản: Email, Vai trò hiện tại, Ngày đăng ký và Thời điểm đăng nhập gần nhất.
- **Đổi vai trò người dùng:** Admin có thể thay đổi trực tiếp vai trò của bất kỳ tài khoản nào (User ⇄ Viewer ⇄ Admin) thông qua menu chọn tại cột Vai trò.
- **Đặt lại mật khẩu (Reset password):** Khi người dùng quên mật khẩu hoặc cần cấp lại, bấm nút đặt lại mật khẩu ở dòng tương ứng → hệ thống tạo mật khẩu tạm mới để Admin gửi cho người dùng.
- **Xóa người dùng:** Bấm nút xóa (kèm hộp thoại xác nhận) để thu hồi quyền truy cập của tài khoản không còn hoạt động.
- **Cơ chế tự bảo vệ:** Dòng tài khoản của chính Admin đang đăng nhập sẽ tự động bị khóa ô chọn vai trò và ẩn nút xóa, ngăn ngừa tình huống Admin vô tình tự hạ quyền hoặc tự xóa tài khoản của chính mình.

#### 2. Subtab "Cấu hình" (Tiêu chuẩn & Quy định)

Subtab này tích hợp toàn bộ các công cụ quản lý thông số kỹ thuật dùng để đánh giá thiết bị:

- **Mục Tiêu chuẩn (theo Nhà sản xuất):**
  - Cấu hình ngưỡng riêng cho từng hãng chế tạo thay cho ngưỡng mặc định chung.
  - Hỗ trợ cả 2 nhóm: *Khí hòa tan (DGA)* và *Dầu cách điện (MBA, OLTC, TI/TU/Sứ xuyên)*.
  - Màn hình 2 cột: danh sách tiêu chuẩn bên trái (tìm, lọc Khí/Dầu, **+ Thêm tiêu chuẩn**), form thêm/sửa bên phải.
  - Cung cấp cấu hình **Ngưỡng loại bỏ (condemning limit)** cho các khí cháy nguy hiểm (H2, C2H2) và tiêu chuẩn 2 tầng (Bình thường / Loại bỏ) bắt buộc cho dầu TI/TU/Sứ xuyên.
  - Cho phép tra cứu, chỉnh sửa hoặc xóa các tiêu chuẩn hãng đã thiết lập (xem chi tiết tại [mục 13](#13-cấu-hình-tiêu-chuẩn-theo-nhà-sản-xuất-và-bảng-quy-định-trong-quản-trị--cấu-hình)).
- **Mục Quy định (các bảng ngưỡng số học):**
  - Chỉnh sửa trực tiếp các bảng ngưỡng số học trích từ QĐ1901/EVNNPT, IEC 60599:2022 và IEC 60422:2024 — chọn bảng ở danh sách bên trái (có tìm kiếm), sửa ở bên phải.
  - Khi ngành điện hoặc tiêu chuẩn quốc tế có đợt cập nhật ngưỡng số học mới, Admin chỉ cần sửa số trên giao diện và bấm **"Lưu bảng này"** — hệ thống sẽ lập tức áp dụng ngưỡng mới cho toàn bộ tính toán mà không cần lập trình viên phải sửa code hay cập nhật phiên bản web.
  - Có nút **"Khôi phục mặc định"** để hoàn tác về đúng số liệu gốc ban đầu nếu cần.

#### 3. Subtab "Bản sao Supabase" (Sao lưu & Đồng bộ dự phòng)

Dành cho hệ thống sử dụng Google Sheets làm cơ sở dữ liệu chính. Tính năng này **chỉ bật khi Admin đã khai báo khóa Supabase** trong Script properties của Apps Script; để trống thì app chỉ lưu vào Google Sheets và subtab này báo *chưa cấu hình* (hiện đơn vị tạm không dùng Supabase).

- **Tự động sao chép song song (Mirroring):** Mọi thao tác thêm mới, chỉnh sửa, xóa dữ liệu (kết quả đo DGA, thí nghiệm dầu, danh sách trạm, tiêu chuẩn hãng, bảng quy định, ý kiến phản hồi) khi lưu vào Google Sheets đều được hệ thống tự động ghi một bản sao sang cơ sở dữ liệu Supabase (PostgreSQL).
- **Kiểm tra trạng thái kết nối:** Hiển thị trực quan tình trạng sẵn sàng của đường truyền kết nối đến Supabase.
- **Đồng bộ toàn bộ thủ công (Full Sync):** Nút **"Đồng bộ toàn bộ sang Supabase"** cho phép Admin chủ động quét toàn bộ kho dữ liệu hiện có trên Google Sheets và đẩy sang Supabase, đảm bảo dữ liệu 2 bên luôn khớp nhau 100%.
- **Nhật ký lỗi đồng bộ (Sync Errors Log):** Bảng ghi nhận chi tiết các lần đồng bộ không thành công (thời điểm, tên bảng, loại thao tác, ID bản ghi và nguyên nhân lỗi) giúp Admin dễ dàng phát hiện và xử lý sự cố đường truyền.
- **Bảo mật thông tin:** Tài khoản người dùng và mật khẩu đăng nhập hoàn toàn **không bao giờ** bị sao chép sang Supabase, đảm bảo tính bảo mật tuyệt đối cho hệ thống xác thực.

---

## 17. Bản di động

Thư mục `mobile/` chứa bản giao diện tối ưu cho điện thoại (một cột, thanh điều hướng trên cùng), **dùng chung database và tài khoản** với bản web nếu được cấu hình cùng `config.js`. Số liệu nhập ở điện thoại xuất hiện ở bản web và ngược lại.

**Cùng số liệu, cùng kết luận:** bản di động dùng **chính bộ logic đánh giá của bản web** (file `mobile/dga-logic.js` được sinh tự động từ logic web, không sửa tay), nên ngưỡng QĐ1901/IEC 60599:2022, chẩn đoán Bảng 66/Table A.10 (sứ xuyên), Tam giác Duval, trạng thái tổng thể và đánh giá dầu đều giống hệt. **Cấu hình quy định** do Admin chỉnh ở bản web cũng được bản di động tự áp dụng khi mở app.

Bản di động gồm các tab: **DGA**, **Dầu**, **Xu hướng**, **Tiêu chuẩn** (Admin ghi được, người dùng thường chỉ xem) và **Quản trị** (chỉ Admin). Các phần **chỉ có trên bản web**: nhập N2/O2 và Tổng hàm lượng khí hòa tan (Bảng 63), dự báo xu hướng, diễn biến loại khiếm khuyết (Bảng 66 / tam giác Duval), so sánh với nhóm thiết bị tương tự, ca tương tự, tab Cảnh báo, Cấu hình quy định, nhập hàng loạt BBTN, tab con Nhập BBTN cũ / Lập BBTN (tự điền thông số kỹ thuật), đọc và xuất BBTN dầu cách điện (lý-hóa dầu MBA, dầu 3 pha TI/TU/Sứ xuyên). Chi tiết xem `mobile/README.md`.

---

## 18. Câu hỏi thường gặp và xử lý sự cố

**Bấm "Phân tích & Lưu" báo lỗi (thông báo màu đỏ góc trên bên phải).**
Nếu thông báo là "Vui lòng nhập…" thì bổ sung ô còn thiếu. Nếu là lỗi kết nối database, thông báo đã kèm gợi ý kiểm tra. Toast lỗi hiện khoảng 6 giây; chụp màn hình gửi cho Admin. Admin xem hướng dẫn xử lý ở `README.md`.

**Thấy thông báo "Đã xảy ra lỗi không lường trước" hoặc "Thao tác không hoàn tất".**
Đây là lỗi ngoài dự kiến của app (không phải lỗi nhập liệu). Tải lại trang và thử lại; nếu lặp lại, chụp màn hình thông báo, ghi lại bạn đang thao tác gì và gửi ở mục **Phản hồi** (icon trên Menu bar) hoặc cho Admin (chi tiết kỹ thuật nằm trong Console của trình duyệt, dòng bắt đầu bằng "[DGA]").

**Mở app thấy trắng/không có dữ liệu cũ.**
Kiểm tra huy hiệu trạng thái góc trên bên trái. Nếu đang ở *"Chế độ thử nghiệm"*, dữ liệu chỉ nằm trên trình duyệt máy đó — bạn có thể đang mở bằng trình duyệt/máy khác hoặc đã xóa lịch sử duyệt web.

**Không thấy Trạm/Thiết bị trong danh sách gợi ý.**
Chờ dòng *"Vui lòng chờ! Đang nạp dữ liệu…"* biến mất. Nếu thiết bị mới hoàn toàn, cứ **gõ tên mới**.

**Tốc độ sinh khí không hiện.**
Cần có **lần đo trước** của cùng **Trạm + Thiết bị + Pha**. Kiểm tra tên Trạm/Thiết bị và Pha đã trùng khớp với lần đo trước chưa.

**Không lưu được thí nghiệm dầu TI/TU/Sứ xuyên.**
Chưa chọn nhà sản xuất, hoặc hãng chưa có tiêu chuẩn dầu cho đúng loại thiết bị (TI, TU hoặc Sứ xuyên). Nhờ Admin cấu hình ở **Quản trị → Cấu hình → Tiêu chuẩn**.

**Không thấy ô kéo thả đọc BBTN.**
Ô đọc BBTN (1 file và nhiều file) nằm ở tab con **Nhập BBTN cũ**. Ở tab con **Lập BBTN** chỉ có ô **"Nhập thông số kỹ thuật từ file"** (chỉ lấy thông số thiết bị, không đọc số liệu đo).

**Thông số kỹ thuật không tự điền.**
Chỉ tự điền ở tab con **Lập BBTN**, khi đã có Trạm + Thiết bị **khớp đúng** với dữ liệu đã lưu, và chỉ điền vào ô còn trống. Nếu tên thiết bị có ở nhiều trạm, hãy chọn Trạm trước.

**Bảng "Số liệu đã lưu" trống.**
Bảng chỉ hiện dữ liệu của **đúng Trạm + Thiết bị đang nhập ở form**. Nhập/chọn thiết bị, hoặc xem toàn bộ ở tab **Lịch sử đo**.

**Nhập hàng loạt báo "Đã có biên bản thiết bị này cùng ngày".**
Thiết bị đã có biên bản cùng ngày lấy mẫu (cùng pha) — dòng đó mặc định không chọn để tránh ghi đè. Tick chọn nếu bạn muốn thay bằng số liệu mới.

**Không thấy nút "Xuất báo cáo phân tích kỹ thuật".**
Nút này chỉ hiện khi trạng thái tổng thể **khác "Bình thường"**.

**Không thấy nút Xuất BBTN/báo cáo sau khi mở lại một lần đo cũ.**
Các nút xuất nằm trong khối kết quả, chỉ hiện sau khi phân tích. Bấm **Phân tích & Lưu** (hoặc **Cập nhật & Lưu** khi sửa) để hiện.

**Đọc PDF / Word không ra số liệu / ra sai.**
Biên bản có thể dùng mẫu khác mẫu PTC3 (khí hòa tan PTC3/BM.15; dầu cách điện, dầu 3 pha PTC3/BM.14), hoặc là bản scan mờ. Nhập tay các ô còn thiếu; luôn đối chiếu với khung BBTN bên cạnh trước khi lưu.

**Tôi lỡ nhập sai số liệu đã lưu.**
Vào **Lịch sử đo** → sửa bản ghi đó (mục 10.3). Nếu bạn là User và bản ghi không phải của bạn, nhờ Admin sửa. Lịch sử chỉnh sửa luôn được ghi lại.

**Tôi không đăng nhập được.**
Kiểm tra email/mật khẩu (tối thiểu 6 ký tự). Nếu quên mật khẩu, liên hệ Admin để được cấp mật khẩu tạm. Nếu báo "tạm khóa", chờ 15 phút rồi thử lại. Nếu dùng Google mà không thấy nút Google, chức năng này chưa được bật ở app của bạn.

**Bản web và bản di động cho kết luận khác nhau với cùng số liệu.**
Hai bản dùng chung logic nên kết quả phải giống nhau. Nếu thấy khác, tải lại cứng trang (Ctrl+F5 trên máy tính; xóa dữ liệu trang trên di động) để bỏ bản cũ lưu trong bộ nhớ đệm, rồi kiểm tra Cấu hình quy định/tiêu chuẩn nhà sản xuất đang áp dụng có giống nhau ở hai bản không (cả hai đọc chung từ database). Nếu vẫn lệch, báo Admin.

**Nên dùng trình duyệt nào?**
Chrome hoặc Edge (đầy đủ nhất). Safari dùng được; Firefox không hỗ trợ chọn cả thư mục khi nhập hàng loạt.

---

## 19. Lưu ý quan trọng khi dùng kết quả

- App là **công cụ hỗ trợ tham khảo**, **không thay thế** nguyên tắc đánh giá tổng thể tại **Điều 3 QĐ1901**. Cần đối chiếu thêm với các pha khác, thiết bị cùng loại, lần đo trước, diễn biến vận hành và hướng dẫn của nhà sản xuất trước khi kết luận chính thức.
- **Trạng thái tổng thể** (Bình thường/Cảnh báo/Báo động) là thuật toán do ứng dụng tự xây dựng để số hóa lưu đồ đánh giá — không phải một bảng trích nguyên văn từ QĐ1901.
- **Bảng 65** (tốc độ sinh khí) chỉ chính thức cho MBA/Kháng dầu; với loại khác chỉ để tham khảo, trừ khi hãng có khoảng tốc độ riêng.
- **Nhập đúng loại thiết bị** — lựa chọn này quyết định bảng ngưỡng và phương pháp chẩn đoán được dùng. Hãy tick "Ngăn OLTC" đúng thực tế để dữ liệu lưu chính xác.
- **So sánh với nhóm thiết bị tương tự** và **ca tương tự** chỉ là thống kê tham khảo, không phải ngưỡng quy định và không thay đổi trạng thái tổng thể (xem mục 5.3).
- Số liệu tự động điền từ PDF/ảnh nhãn chỉ là **gợi ý**: luôn kiểm tra lại trước khi lưu hoặc ký biên bản.
- Không chia sẻ đường link database công khai ra ngoài nhóm nội bộ; không gửi mật khẩu qua tin nhắn nhóm.

---

*Nếu phát hiện lỗi hoặc muốn đề xuất tính năng, hãy dùng mục **Phản hồi** (icon trên Menu bar) trong ứng dụng.*
