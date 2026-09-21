# Hướng dẫn sử dụng — Ứng dụng "Đánh giá Dầu cách điện" (DGA)

> Tài liệu dành cho **người dùng cuối** (kỹ sư thí nghiệm, cán bộ theo dõi thiết bị). Nội dung đi theo từng công việc cụ thể: nhập số liệu, đọc kết quả, xem cảnh báo, xuất biên bản…
> Muốn cài đặt/triển khai app → xem `README.md`. Muốn tra danh sách đầy đủ tính năng → xem `Features-web-app.md`.
> Nội dung này cũng có sẵn ngay trong app ở tab **Hướng dẫn** (chia theo từng mục, bấm để mở/thu gọn).

---

## Mục lục

1. [App dùng để làm gì?](#1-app-dùng-để-làm-gì)
2. [Bắt đầu: mở app và đăng nhập](#2-bắt-đầu-mở-app-và-đăng-nhập)
3. [Làm quen giao diện](#3-làm-quen-giao-diện)
4. [Nhập và đánh giá một lần đo khí hòa tan (tab DGA)](#4-nhập-và-đánh-giá-một-lần-đo-khí-hòa-tan-tab-dga)
5. [Đọc kết quả đánh giá](#5-đọc-kết-quả-đánh-giá)
6. [Nhập nhanh từ Biên bản thí nghiệm (PDF) và ảnh tấm nhãn](#6-nhập-nhanh-từ-biên-bản-thí-nghiệm-pdf-và-ảnh-tấm-nhãn)
7. [Nhập hàng loạt nhiều biên bản của cùng một thiết bị](#7-nhập-hàng-loạt-nhiều-biên-bản-của-cùng-một-thiết-bị)
8. [Xuất Biên bản thí nghiệm và Báo cáo phân tích kỹ thuật (.docx)](#8-xuất-biên-bản-thí-nghiệm-và-báo-cáo-phân-tích-kỹ-thuật-docx)
9. [Thí nghiệm dầu cách điện (tab Dầu cách điện)](#9-thí-nghiệm-dầu-cách-điện-tab-dầu-cách-điện)
10. [Xem lại, sửa, xóa và so sánh (tab Lịch sử đo)](#10-xem-lại-sửa-xóa-và-so-sánh-tab-lịch-sử-đo)
11. [Theo dõi thiết bị bất thường (tab Cảnh báo)](#11-theo-dõi-thiết-bị-bất-thường-tab-cảnh-báo)
12. [Xem xu hướng và dự báo (tab Xu hướng)](#12-xem-xu-hướng-và-dự-báo-tab-xu-hướng)
13. [Cấu hình tiêu chuẩn theo nhà sản xuất và bảng quy định (tab Cấu hình)](#13-cấu-hình-tiêu-chuẩn-theo-nhà-sản-xuất-và-bảng-quy-định-tab-cấu-hình)
14. [Tra cứu quy trình lấy mẫu và đánh giá (tab Quy trình)](#14-tra-cứu-quy-trình-lấy-mẫu-và-đánh-giá-tab-quy-trình)
15. [Góp ý cho ứng dụng (tab Người dùng phản hồi)](#15-góp-ý-cho-ứng-dụng-tab-người-dùng-phản-hồi)
16. [Phân quyền Admin / User và tab Quản trị](#16-phân-quyền-admin--user-và-tab-quản-trị)
17. [Bản di động](#17-bản-di-động)
18. [Câu hỏi thường gặp và xử lý sự cố](#18-câu-hỏi-thường-gặp-và-xử-lý-sự-cố)
19. [Lưu ý quan trọng khi dùng kết quả](#19-lưu-ý-quan-trọng-khi-dùng-kết-quả)

---

## 1. App dùng để làm gì?

Ứng dụng hỗ trợ đánh giá tình trạng cách điện của các thiết bị dầu cách điện qua **phân tích khí hòa tan (DGA)** và **thí nghiệm dầu**:

| Loại thiết bị | Có nhập DGA | Có nhập thí nghiệm dầu |
|---|:-:|:-:|
| MBA / Kháng dầu | ✔ | ✔ (dầu chính + dầu OLTC) |
| TI (biến dòng điện) | ✔ | ✔ (cần chọn nhà sản xuất — xem mục 9.3) |
| TU (biến điện áp) | ✔ | ✔ (cần chọn nhà sản xuất — xem mục 9.3) |
| Sứ xuyên (Bushing) | ✔ | ✘ (không có thí nghiệm dầu) |
| Khác | ✔ | ✘ |

Căn cứ đánh giá: **QĐ 1901/QĐ-EVNNPT** và **IEC 60599:2022**. Khi bạn chưa chọn nhà sản xuất, app tự lấy ngưỡng **chặt hơn** giữa hai nguồn này.

App làm được những việc chính:

- Nhập 7 khí hòa tan → tự tính **TCG**, đánh giá từng khí, chẩn đoán dạng sự cố (**Bảng 66 / Tam giác Duval**), tính tốc độ sinh khí, đưa ra **trạng thái tổng thể** và **khuyến cáo**.
- Đánh giá độ ẩm, tgδ, điện áp chọc thủng của dầu.
- Lưu lịch sử, so sánh giữa các lần đo, vẽ xu hướng và dự báo.
- Tự động liệt kê các thiết bị đang ở mức **Cảnh báo / Báo động**.
- Tự đọc số liệu từ **Biên bản thí nghiệm PDF**, và xuất lại thành **BBTN / Báo cáo kỹ thuật (.docx)**.

---

## 2. Bắt đầu: mở app và đăng nhập

### 2.1. Mở app

Mở đường link do quản trị viên cung cấp bằng **Chrome, Edge hoặc Safari** (khuyến nghị Chrome/Edge). Nếu tự chạy trên máy, mở file `index.html` bằng trình duyệt.

Góc trên bên trái có **huy hiệu trạng thái lưu trữ**:

| Huy hiệu | Ý nghĩa |
|---|---|
| "Đã kết nối database (Google Sheets)" | Dữ liệu lưu dùng chung, có đăng nhập và phân quyền |
| "Đã kết nối database (Supabase)" | Dữ liệu lưu dùng chung, **không** có đăng nhập/phân quyền |
| "Chế độ thử nghiệm" | Dữ liệu chỉ lưu trong trình duyệt của máy này |

> ⚠ Ở **chế độ thử nghiệm**, dữ liệu chỉ nằm trên trình duyệt hiện tại — **mất nếu xóa lịch sử duyệt web** và người khác không thấy được. Chỉ dùng để thử.

### 2.2. Đăng ký và đăng nhập (chế độ Google Sheets)

1. Khi mở app sẽ hiện hộp thoại **"Đánh giá Dầu cách điện"**.
2. **Lần đầu:** bấm **Đăng ký** → nhập email + mật khẩu (tối thiểu 6 ký tự) → bấm **Đăng ký**.
3. **Các lần sau:** nhập email + mật khẩu → bấm **Đăng nhập**.
4. Nếu app có bật **Đăng nhập bằng Google**, nút này hiện ở đầu hộp thoại — bấm và chọn tài khoản Google.
5. Lần sau mở lại app, phiên đăng nhập được **tự khôi phục**.

**Đăng xuất:** bấm vào **tên/email của bạn** ở góc trên bên phải → xác nhận.

> Ở chế độ Supabase hoặc thử nghiệm, không có màn hình đăng nhập và mọi người có toàn quyền như nhau.

---

## 3. Làm quen giao diện

### 3.1. Các tab

| Tab | Dùng để |
|---|---|
| **DGA** | Nhập và đánh giá một lần đo khí hòa tan (tab chính) |
| **Dầu cách điện** | Nhập và đánh giá thí nghiệm dầu |
| **Lịch sử đo** | Xem lại, sửa, xóa; so sánh 2 lần đo bất kỳ |
| **Cảnh báo** | Danh sách thiết bị đang ở mức Cảnh báo/Báo động |
| **Xu hướng** | Đồ thị theo thời gian + dự báo |
| **Quy trình** | Hướng dẫn lấy mẫu dầu, sơ đồ quy trình đánh giá DGA |
| **Cấu hình** | Tiêu chuẩn theo nhà sản xuất; chỉnh bảng quy định |
| **Giới thiệu** | Thông tin chung và căn cứ pháp lý |
| **Hướng dẫn** | Xem hướng dẫn sử dụng này ngay trong app |
| **Người dùng phản hồi** | Gửi góp ý |
| **Quản trị** | Quản lý người dùng — **chỉ Admin** mới thấy |

### 3.2. Thanh tab ngang hoặc dọc

Bấm nút biểu tượng thanh bên ở góc trên bên trái để chuyển giữa **thanh tab ngang** (mặc định) và **thanh tab dọc bên trái**. Ở chế độ dọc, bấm mũi tên để **thu gọn** (chỉ còn biểu tượng; rê chuột để xem tên tab). App nhớ lựa chọn của bạn.

### 3.3. Các thao tác dùng chung

- **Ô Trạm / Thiết bị:** vừa **gõ để tìm**, vừa **bấm ▼ để chọn** trong danh sách đã có. Bạn cũng có thể **gõ tên mới** (không bắt buộc phải chọn từ danh sách).
- **Biểu tượng "i":** bấm để xem giải thích chi tiết; đóng bằng **×** hoặc bấm ra ngoài. Chỉ một hộp giải thích mở tại một thời điểm.
- **Thông báo nhanh (toast)** hiện ở góc trên bên phải: màu xanh khi thao tác thành công (đăng nhập, lưu…), **màu đỏ khi có lỗi hoặc thiếu thông tin** (ví dụ chưa nhập Thiết bị, mất kết nối database). Toast lỗi hiện khoảng 6 giây; nội dung thường kèm gợi ý cách xử lý.
- Khi thấy **"Vui lòng chờ! Đang nạp dữ liệu…"**, hãy chờ danh sách Trạm/Thiết bị và lịch sử tải xong.

---

## 4. Nhập và đánh giá một lần đo khí hòa tan (tab DGA)

### Bước 1 — Chọn loại thiết bị

Ở ô **Loại thiết bị** trên cùng, chọn: TI, TU, MBA/Kháng dầu, Sứ xuyên (Bushing) hoặc Khác. Lựa chọn này quyết định bảng ngưỡng và phương pháp chẩn đoán được dùng — **hãy chọn đúng**.

### Bước 2 — Điền "Thông tin lần đo"

| Trường | Cách điền |
|---|---|
| **Trạm** | Gõ/chọn tên trạm |
| **Thiết bị (tên/mã)** | Gõ/chọn tên thiết bị, ví dụ `TI174`, `MBA T1` |
| **Ngăn OLTC (thông dầu/khí với thùng chính)** | *Chỉ hiện với MBA/Kháng dầu.* Tick nếu thiết bị có OLTC mà ngăn OLTC **thông dầu/khí** với thùng chính (thông tin này được lưu cùng lần đo). Với số liệu ngưỡng mặc định hiện tại, ô này chưa làm đổi ngưỡng đánh giá |
| **Nhà sản xuất (tùy chọn)** | Chọn hãng nếu đã có tiêu chuẩn riêng ở tab Cấu hình; để trống = dùng ngưỡng mặc định QĐ1901/IEC |
| **Pha** | A, B, C hoặc **Chung** (dùng chung cả 3 pha) |
| **Lần đo** | Tự gợi ý số thứ tự kế tiếp theo nhóm Trạm + Thiết bị + Pha; sửa được nếu cần |
| **Ngày lấy mẫu** | Ngày lấy mẫu dầu |
| **Ghi chú** | Không bắt buộc |
| **Biên bản thí nghiệm (PDF)** | Không bắt buộc — xem [mục 6](#6-nhập-nhanh-từ-biên-bản-thí-nghiệm-pdf-và-ảnh-tấm-nhãn) |

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

> Thông số kỹ thuật lưu **theo từng lần đo**. Nếu muốn báo cáo có đủ thông số, hãy điền (hoặc để nguyên nếu chưa xóa form) ở mỗi lần đo.

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

### 6.1. Đọc số liệu từ Biên bản thí nghiệm (BBTN)

1. Ở tab **DGA**, mục **"Biên bản thí nghiệm (PDF, tùy chọn)"**: **kéo thả** file PDF vào khung, hoặc bấm khung để chọn file.
2. App tự đọc và **điền sẵn** vào form: Trạm, Thiết bị, Loại thiết bị, Pha, Ngày lấy mẫu, Nhà sản xuất, Số chế tạo, Điện áp định mức, Năm sản xuất, Năm vận hành, Loại dầu, Ngày thí nghiệm, Lý do thí nghiệm, nhiệt độ/độ ẩm môi trường và **7 khí hòa tan**.
3. **Kiểm tra lại toàn bộ** các ô đã điền, sửa nếu cần, rồi bấm **Phân tích & Lưu**. File PDF được đính kèm cùng lần đo.
4. Sau này có thể bấm **Xem BBTN đã lưu** để mở lại file, hoặc **Bỏ file** để gỡ đính kèm.

Việc đọc PDF chạy **hoàn toàn trên trình duyệt của bạn**, file không bị gửi đi đâu để "đọc".

> ⚠ App được thiết kế theo mẫu biên bản **PTC3/BM.15**. Nếu biên bản dùng mẫu khác, có thể chỉ đọc được một phần hoặc không đọc được. Luôn đối chiếu với biên bản gốc.

### 6.2. Đọc thông số từ ảnh tấm nhãn thiết bị (nameplate)

Trong khối **"Thông số kỹ thuật thiết bị"**, kéo thả **ảnh chụp tấm nhãn** (JPG/PNG) vào khung. App dùng OCR để gợi ý điền: Kiểu máy, Số chế tạo, Năm sản xuất, Điện áp định mức, Loại dầu và Nhà sản xuất.

> Mỗi hãng trình bày nhãn khác nhau nên **độ tin cậy thấp hơn** đọc BBTN — hãy chụp rõ, đủ sáng và **luôn kiểm tra lại từng ô**.

---

## 7. Nhập hàng loạt nhiều biên bản của cùng một thiết bị

Dùng khi cần **nhập bổ sung dữ liệu lịch sử** (nhiều năm đo) để phân tích xu hướng, không muốn lặp lại "chọn file → Phân tích & Lưu" từng lần.

1. **Điền trước** ở form phía trên: **Trạm, Thiết bị, Loại thiết bị, Ngăn OLTC, Nhà sản xuất** (các thông số kỹ thuật nếu muốn). Các thông tin này được dùng chung cho **tất cả** file trong đợt; riêng **Pha, Ngày lấy mẫu và 7 khí** được đọc riêng từ mỗi file.
2. Ở khối **"Nhập hàng loạt nhiều BBTN (PDF) — cùng 1 thiết bị"**: kéo thả nhiều file PDF, hoặc bấm **Chọn cả thư mục…**.
3. Tick/bỏ tick **"Đính kèm PDF gốc vào từng lần đo"** (mặc định đang tick).
4. Xem **bảng xem trước**: mỗi file có một trạng thái:
   - **Sẵn sàng** — có thể nhập.
   - **Cảnh báo** — không đọc được Pha, hoặc **trùng Pha + Ngày** với bản ghi đã có/dòng khác trong đợt.
   - **Lỗi** — không đọc được file hoặc thiếu dữ liệu bắt buộc.
5. Sửa tay **Pha / Ngày** ở từng dòng nếu cần; tick chọn từng dòng, hoặc dùng **Chọn tất cả hợp lệ / Bỏ chọn tất cả**.
6. Bấm **Lưu các lần đo đã chọn**. App lưu lần lượt từng dòng (một dòng lỗi **không chặn** các dòng còn lại) và tự đánh số **Lần đo** tăng dần theo đúng nhóm Trạm + Thiết bị + Pha.

> Trình duyệt Firefox không lọc theo thư mục được (nút "Chọn cả thư mục" chỉ mở hộp chọn file thường). Nên dùng Chrome/Edge.

---

## 8. Xuất Biên bản thí nghiệm và Báo cáo phân tích kỹ thuật (.docx)

Sau khi bấm **Phân tích & Lưu**, ở đầu khối **"2. Kết quả đánh giá"** có hai nút:

| Nút | Nội dung | Điều kiện |
|---|---|---|
| **Xuất BBTN (docx)** | Điền sẵn vào mẫu Biên bản thí nghiệm **PTC3/BM.15**: trạm, vị trí lắp đặt, hãng SX, ngày lấy/thí nghiệm mẫu, lý do, điều kiện môi trường, 7 khí, TCG, tốc độ sinh khí (%/tháng), N2/O2, Tổng hàm lượng khí hòa tan, kết luận | Luôn có |
| **Xuất báo cáo phân tích kỹ thuật (docx)** | Thông số thiết bị, kết quả thí nghiệm, 3 tỷ số khí, chẩn đoán bất thường, đề xuất hướng xử lý | Chỉ hiện khi trạng thái **khác "Bình thường"** |

**Cách dùng:** bấm nút → file .docx được tải về → **mở bằng Word** để bổ sung các mục chưa có sẵn (hãng SX, số chế tạo, chữ ký…) rồi mới ban hành.

- Trường nào bạn để trống, file Word sẽ bỏ trống dòng đó (app không tự suy diễn).
- Việc tạo file chạy hoàn toàn trên trình duyệt, không gửi số liệu lên máy chủ.
- Số liệu điền sẵn chỉ mang tính **hỗ trợ**; người ký phải kiểm tra lại.

---

## 9. Thí nghiệm dầu cách điện (tab Dầu cách điện)

Ba chỉ tiêu được đánh giá: **Độ ẩm dầu (ppm)**, **Tổn hao điện môi tgδ ở 90°C (%)**, **Điện áp chọc thủng (kV)**.

Đầu tab, chọn **Loại thiết bị** — chỉ khối nhập liệu phù hợp được hiện ra (lựa chọn này chỉ để ẩn/hiện, không lưu vào bản ghi).

### 9.1. Dầu MBA/Kháng dầu (dầu chính)

Điền: **Trạm, Thiết bị, Điểm lấy mẫu, Cấp điện áp MBA, Trạng thái dầu, Nhà sản xuất (tùy chọn), Ngày lấy mẫu, Ghi chú**, rồi nhập 3 kết quả và bấm **Đánh giá & Lưu**.

- **Điểm lấy mẫu:** *Thùng dầu chung 3 pha* (1 mẫu đại diện) hoặc *Thùng dầu riêng từng pha* (MBA/Kháng 3 pha rời, thường ở 500 kV) — khi đó chọn thêm **Pha A/B/C** và nhập riêng từng pha. Bấm **"i"** để xem giải thích.
- **Trạng thái dầu:** *Dầu mới (sau lắp đặt/sau sửa chữa)* hoặc *Dầu vận hành*.
- **"Có bảo vệ bằng màng chất dẻo/nitơ"**: chỉ hiện với cấp điện áp có phân biệt hai mức ngưỡng độ ẩm (≤ 110 kV).
- Ngưỡng theo **Bảng 58 / 55 / 54 QĐ1901** (Điều 50 / 47 / 46). Nếu chọn nhà sản xuất đã cấu hình tiêu chuẩn dầu, ngưỡng hãng được ưu tiên.

### 9.2. Dầu OLTC (bộ đổi nấc có tải)

Cùng 3 chỉ tiêu, theo **Điều 37, Bảng 49 QĐ1901** (dầu vận hành) hoặc Bảng 58 (dầu mới lắp). Điểm lấy mẫu: *Điểm cuối trung tính* (3 pha dùng chung) hoặc *Pha riêng*.

### 9.3. Dầu TI / TU

**QĐ1901 không có bảng ngưỡng mặc định cho dầu TI/TU** (chỉ dẫn chiếu "theo quy định nhà sản xuất"). Vì vậy:

- Bạn **bắt buộc phải chọn một Nhà sản xuất** đã được cấu hình đủ tiêu chuẩn **2 tầng (Bình thường / Loại bỏ)** ở tab **Cấu hình → Tiêu chuẩn**.
- Nếu chưa chọn hoặc hãng chưa có cấu hình, app **chặn lưu** và báo rõ lý do; hãy nhờ Admin cấu hình.
- Kết quả có 3 mức: **Đạt / Cảnh báo / Không đạt**.

### 9.4. Sứ xuyên (Bushing)

Không có thí nghiệm dầu. Tab hiển thị ghi chú và hướng bạn dùng tab **DGA** (khí hòa tan là phương pháp đánh giá chính cho sứ xuyên kín dầu).

---

## 10. Xem lại, sửa, xóa và so sánh (tab Lịch sử đo)

### 10.1. Chọn nội dung xem

Ở đầu tab, chọn xem **Khí hòa tan (DGA)** hoặc **Dầu** (gồm 3 bảng: dầu MBA chính / dầu OLTC / dầu TI-TU-Sứ xuyên). Dùng ô lọc **Trạm/Thiết bị** (gõ tự do) và bộ lọc **Loại thiết bị** để thu hẹp danh sách.

### 10.2. Đọc bảng lịch sử DGA

Mỗi dòng gồm: ngày, trạm, thiết bị, loại, pha, lần đo, 7 khí + N2/O2, TCG, **Kết luận** (kèm "⚠ Vượt ngưỡng loại bỏ" nếu có), mã **Bảng 66**, vùng **Duval**, **Người nhập** và các nút thao tác.

- Ô khí **tô nền đỏ** = giá trị **đã bị sửa** so với lần lưu gốc. Rê chuột vào ô để xem **giá trị cũ và thời điểm sửa**.
- Huy hiệu **"✎ N lần sửa"** ở cột *Người nhập* cho xem log các lần chỉnh sửa.
- **Xem BBTN** để mở lại file PDF đã đính kèm (nếu có).

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

Tab này **tự rà soát lần đo/thí nghiệm gần nhất của từng thiết bị** (khí hòa tan, dầu MBA chính, dầu OLTC, dầu TI/TU) và liệt kê các thiết bị đang ở mức **Cảnh báo** hoặc **Báo động**. App dùng đúng các hàm đánh giá đã dùng ở tab DGA/Dầu cách điện, không tự đặt ngưỡng riêng.

- **Thống kê nhanh:** tổng thiết bị đang theo dõi, số thiết bị đang có cảnh báo, số mức Cảnh báo, số mức Báo động.
- **Lọc theo Trạm biến áp:** gõ hoặc chọn trạm (chỉ gợi ý các trạm đang có cảnh báo); để trống = tất cả.
- Mỗi dòng cho biết: thiết bị, loại đo, mức cảnh báo, tình trạng, khí/chỉ tiêu vượt ngưỡng, lý do và khuyến cáo hành động.
- **Xem xu hướng:** nhảy thẳng sang tab **Xu hướng**, tự chọn đúng thiết bị/pha và tick sẵn (các) thông số gây cảnh báo.
- **Xuất Excel:** tải file `.xlsx` gồm thống kê tổng quan và toàn bộ danh sách đang hiển thị (theo bộ lọc Trạm hiện tại). Nút này chỉ bấm được khi có dữ liệu.

**Gợi ý thói quen:** mở tab này mỗi ngày/tuần để nắm các thiết bị cần theo dõi ngay, không phải mở từng thiết bị.

---

## 12. Xem xu hướng và dự báo (tab Xu hướng)

### 12.1. Vẽ đồ thị

1. (Tùy chọn) Chọn **Trạm biến áp** để danh sách thiết bị chỉ gồm thiết bị của trạm đó. Nếu không chọn trạm mà tên thiết bị trùng ở nhiều trạm, app sẽ báo — hãy chọn trạm để phân biệt.
2. Chọn **Thiết bị**.
3. Nếu thiết bị có dữ liệu từ nhiều pha, tick các pha muốn so sánh ở **"Lọc theo pha"** — mỗi pha một đường riêng.
4. Ở **"Chọn thông số cần vẽ"**, tick các thông số muốn xem chung một đồ thị: 7 khí, N2, O2, TCG, Tổng hàm lượng khí hòa tan, và độ ẩm/tgδ/điện áp chọc thủng của dầu chính và dầu OLTC. Mỗi thông số dùng một trục tung phù hợp đơn vị.

Phía dưới có **bảng số liệu thô** của từng nguồn (khí / dầu chính / dầu OLTC).

> Nếu không có mạng hoặc thư viện vẽ đồ thị (Chart.js) tải lỗi, đồ thị sẽ ẩn kèm thông báo — kiểm tra kết nối và tải lại trang. Các bảng số liệu và bảng dự báo vẫn dùng được.

### 12.2. Dự báo xu hướng (ngoại suy tuyến tính)

- Tick **"Hiện dự báo xu hướng tương lai"** (app nhớ lựa chọn) và đặt **Số năm dự báo** (1–30).
- Với mỗi khí trong 7 khí chính, bảng hiển thị kết quả của **3 thuật toán độc lập** (hồi quy OLS, Theil-Sen, trung bình liền kề) và một dòng **Trung bình 3 thuật toán**: tốc độ thay đổi, giá trị dự báo, **R²** và **thời điểm dự kiến chạm ngưỡng** (nếu xu hướng đang tăng).
- Cần **tối thiểu 2 lần đo** mỗi khí; nên có **≥ 4 lần đo** để đáng tin (R² càng gần 1 càng tốt).
- Chỉ dự báo mốc chạm ngưỡng cho **7 khí chính**.

> ⚠ Dự báo giả định tốc độ sinh khí **không đổi** — chỉ mang tính tham khảo thống kê, không thay thế đánh giá tổng hợp.

---

## 13. Cấu hình tiêu chuẩn theo nhà sản xuất và bảng quy định (tab Cấu hình)

Tab có hai mục, chuyển bằng nút **Tiêu chuẩn / Quy định** ở đầu tab. Bấm biểu tượng **"i"** cạnh tiêu đề để xem hướng dẫn chi tiết.

> Phần này thường do **Admin** thực hiện. Người dùng thường chủ yếu chỉ cần xem.

### 13.1. Mục "Tiêu chuẩn" — ngưỡng riêng theo nhà sản xuất

Cho phép đặt ngưỡng riêng cho từng hãng, áp dụng thay cho ngưỡng mặc định QĐ1901/IEC:

- **Khí hòa tan (DGA):** ngưỡng tuyệt đối từng khí, **ngưỡng loại bỏ**, khoảng tốc độ tăng riêng.
- **Dầu cách điện MBA/Kháng dầu:** thay cho Bảng 54/55/58 (theo cấp điện áp + trạng thái dầu).
- **Dầu cách điện TI/TU:** **bắt buộc** cấu hình (2 tầng Bình thường/Loại bỏ) vì QĐ1901 không có bảng mặc định.

Các bước: chọn/nhập thông tin hãng và loại tiêu chuẩn → điền ngưỡng → bấm **Lưu tiêu chuẩn** (hoặc **Hủy**). Danh sách tiêu chuẩn đã cấu hình hiện bên dưới, có thể **xem lại / sửa / xóa**.

**Quy tắc áp dụng:** nếu thiết bị/thí nghiệm không chọn nhà sản xuất, hoặc hãng chưa có cấu hình khớp, app dùng tiêu chuẩn mặc định QĐ1901/IEC. Riêng dầu TI/TU sẽ báo *"Chưa có tiêu chuẩn nhà sản xuất"*.

### 13.2. Mục "Quy định" — 13 bảng ngưỡng số học

Cho phép chỉnh **13 bảng ngưỡng đơn giản** trích từ QĐ1901/IEC 60599:2022 (ví dụ: MBA/Kháng dầu — Khí hòa tan; Dầu MBA — Điện áp chọc thủng; tgδ ở 90°C; Hàm lượng nước; Dầu OLTC — Độ ẩm & điện áp chọc thủng…).

- Sửa số liệu + nguồn tham chiếu → bấm **Lưu bảng này** (dùng khi quy định được cập nhật, không cần sửa code).
- **Khôi phục mặc định:** trả bảng về đúng số liệu gốc tích hợp sẵn.
- **Không** gồm logic tra mã Bảng 66/Table A.10 và ranh giới Tam giác Duval — các phần này cố định theo văn bản gốc.
- Chỉ **Admin** sửa/lưu được (chế độ Google Sheets); mọi người dùng đã đăng nhập đều xem được.

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

## 15. Góp ý cho ứng dụng (tab Người dùng phản hồi)

1. Nhập nội dung góp ý.
2. (Tùy chọn) Đính kèm **1 ảnh minh họa** bằng một trong ba cách: chọn file, **kéo thả**, hoặc **dán trực tiếp (Ctrl+V)** ảnh vừa chụp màn hình. Bấm **Bỏ ảnh** nếu muốn gỡ.
3. Bấm **Gửi góp ý**.

Các góp ý đã gửi được hiển thị (mới nhất ở trên) để mọi người cùng xem, tránh đề xuất trùng nhau; bấm ảnh để phóng to. Góp ý **không sửa lại được** sau khi gửi; chỉ Admin xóa được.

---

## 16. Phân quyền Admin / User và tab Quản trị

*(Chỉ áp dụng ở chế độ Google Sheets. Ở chế độ khác, mọi người có toàn quyền.)*

| Quyền | User | Admin |
|---|:-:|:-:|
| Xem toàn bộ dữ liệu | ✔ | ✔ |
| Nhập bản ghi mới (khí, dầu MBA, dầu OLTC, dầu TI/TU) | ✔ | ✔ |
| Sửa bản ghi | Chỉ bản ghi **do mình nhập** | Mọi bản ghi |
| Xóa bản ghi | ✘ | ✔ |
| Cấu hình Tiêu chuẩn / Quy định | ✘ (chỉ xem) | ✔ |
| Quản lý người dùng | ✘ | ✔ |

Mỗi bản ghi lưu **người tạo, người sửa cuối và thời điểm** (cột "Người nhập"). Quyền thực sự được kiểm tra lại ở phía máy chủ.

### Tab Quản trị (chỉ Admin)

- Xem danh sách người dùng: email, vai trò, ngày tạo, lần đăng nhập cuối.
- **Đổi vai trò** User ⇄ Admin bằng ô chọn.
- **Xóa người dùng** (có xác nhận).
- Dòng của chính Admin đang đăng nhập bị khóa đổi vai trò và ẩn nút xóa để tránh tự khóa mình.

---

## 17. Bản di động

Thư mục `mobile/` chứa bản giao diện tối ưu cho điện thoại (một cột, thanh điều hướng trên cùng), **dùng chung database và tài khoản** với bản web nếu được cấu hình cùng `config.js`. Số liệu nhập ở điện thoại xuất hiện ở bản web và ngược lại.

**Cùng số liệu, cùng kết luận:** bản di động dùng **chính bộ logic đánh giá của bản web** (file `mobile/dga-logic.js` được sinh tự động từ logic web, không sửa tay), nên ngưỡng QĐ1901/IEC 60599:2022, chẩn đoán Bảng 66/Table A.10 (sứ xuyên), Tam giác Duval, trạng thái tổng thể và đánh giá dầu đều giống hệt. **Cấu hình quy định** do Admin chỉnh ở bản web cũng được bản di động tự áp dụng khi mở app.

Bản di động gồm các tab: **DGA**, **Dầu**, **Xu hướng**, **Tiêu chuẩn** (Admin ghi được, người dùng thường chỉ xem) và **Quản trị** (chỉ Admin). Các phần **chỉ có trên bản web**: nhập N2/O2 và Tổng hàm lượng khí hòa tan (Bảng 63), dự báo xu hướng, so sánh với nhóm thiết bị tương tự, ca tương tự, tab Cảnh báo, Cấu hình quy định, nhập hàng loạt BBTN. Chi tiết xem `mobile/README.md`.

---

## 18. Câu hỏi thường gặp và xử lý sự cố

**Bấm "Phân tích & Lưu" báo lỗi (thông báo màu đỏ góc trên bên phải).**
Nếu thông báo là "Vui lòng nhập…" thì bổ sung ô còn thiếu. Nếu là "Lỗi kết nối Google Sheets/Supabase…" thường do đường link kết nối database bị sai hoặc chưa cấp quyền truy cập đúng — thông báo đã kèm gợi ý kiểm tra. Toast lỗi hiện khoảng 6 giây; chụp màn hình gửi cho Admin. Admin xem hướng dẫn xử lý ở `README.md`.

**Thấy thông báo "Đã xảy ra lỗi không lường trước" hoặc "Thao tác không hoàn tất".**
Đây là lỗi ngoài dự kiến của app (không phải lỗi nhập liệu). Tải lại trang và thử lại; nếu lặp lại, chụp màn hình thông báo, ghi lại bạn đang thao tác gì và gửi ở tab **Người dùng phản hồi** hoặc cho Admin (chi tiết kỹ thuật nằm trong Console của trình duyệt, dòng bắt đầu bằng "[DGA]").

**Mở app thấy trắng/không có dữ liệu cũ.**
Kiểm tra huy hiệu trạng thái góc trên bên trái. Nếu đang ở *"Chế độ thử nghiệm"*, dữ liệu chỉ nằm trên trình duyệt máy đó — bạn có thể đang mở bằng trình duyệt/máy khác hoặc đã xóa lịch sử duyệt web.

**Không thấy Trạm/Thiết bị trong danh sách gợi ý.**
Chờ dòng *"Vui lòng chờ! Đang nạp dữ liệu…"* biến mất. Nếu thiết bị mới hoàn toàn, cứ **gõ tên mới**.

**Tốc độ sinh khí không hiện.**
Cần có **lần đo trước** của cùng **Trạm + Thiết bị + Pha**. Kiểm tra tên Trạm/Thiết bị và Pha đã trùng khớp với lần đo trước chưa.

**Không lưu được thí nghiệm dầu TI/TU.**
Chưa chọn nhà sản xuất, hoặc hãng chưa có tiêu chuẩn dầu TI/TU đủ 2 tầng. Nhờ Admin cấu hình ở **Cấu hình → Tiêu chuẩn**.

**Không thấy nút "Xuất báo cáo phân tích kỹ thuật".**
Nút này chỉ hiện khi trạng thái tổng thể **khác "Bình thường"**.

**Không thấy nút Xuất BBTN/báo cáo sau khi mở lại một lần đo cũ.**
Các nút xuất nằm trong khối kết quả, chỉ hiện sau khi phân tích. Bấm **Phân tích & Lưu** (hoặc **Cập nhật & Lưu** khi sửa) để hiện.

**Đọc PDF không ra số liệu / ra sai.**
Biên bản có thể dùng mẫu khác PTC3/BM.15, hoặc là bản scan mờ. Nhập tay các ô còn thiếu; luôn kiểm tra lại trước khi lưu.

**Tôi lỡ nhập sai số liệu đã lưu.**
Vào **Lịch sử đo** → sửa bản ghi đó (mục 10.3). Nếu bạn là User và bản ghi không phải của bạn, nhờ Admin sửa. Lịch sử chỉnh sửa luôn được ghi lại.

**Tôi không đăng nhập được.**
Kiểm tra email/mật khẩu (tối thiểu 6 ký tự). Nếu quên mật khẩu, liên hệ Admin. Nếu dùng Google mà không thấy nút Google, chức năng này chưa được bật ở app của bạn.

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
- Không chia sẻ đường link database (Google Apps Script/Supabase) công khai ra ngoài nhóm nội bộ.

---

*Nếu phát hiện lỗi hoặc muốn đề xuất tính năng, hãy dùng tab **Người dùng phản hồi** trong ứng dụng.*
