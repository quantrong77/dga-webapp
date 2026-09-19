# Tính năng ứng dụng DGA (Phân tích khí hòa tan trong dầu cách điện)

> Tài liệu này mô tả **đầy đủ tính năng hiện có** của ứng dụng, theo đúng từng tab trên giao diện. Đây là tài liệu bổ sung cho `README.md` (vốn tập trung vào cài đặt/triển khai) — dùng để tra cứu "app hiện làm được những gì", không phải hướng dẫn cài đặt. Nội dung được đối chiếu trực tiếp với mã nguồn tại thời điểm viết; khi thêm/sửa tính năng, hãy cập nhật lại file này.

Phạm vi ứng dụng: hỗ trợ kỹ sư thí nghiệm điện (EVNNPT) đánh giá tình trạng cách điện của **MBA/Kháng dầu, TI (biến dòng điện), TU (biến điện áp), Sứ xuyên (Bushing)** thông qua phân tích khí hòa tan (DGA) và các thí nghiệm dầu cách điện, căn cứ theo **QĐ 1901/QĐ-EVNNPT** và **IEC 60599:2022**.

---

## 1. Tab "DGA" — Phân tích khí hòa tan

Tab chính của ứng dụng, nơi nhập và đánh giá 1 lần đo khí hòa tan.

**Nhập liệu:**
- Thông tin lần đo: Trạm, Thiết bị, Loại thiết bị (TI/TU/MBA-Kháng dầu/Sứ xuyên/Khác), Pha (A/B/C/Chung 3 pha), Lần đo (tự gợi ý số thứ tự kế tiếp theo nhóm Trạm+Thiết bị+Pha), Ngày lấy mẫu, Nhà sản xuất (ô combo tự gõ-tìm).
- Với MBA: tick chọn phân loại OLTC ("OLTC có/không thông dầu với thùng chính" — ảnh hưởng chuẩn ngưỡng CO/CO2 theo Bảng 66/Table A.2).
- 7 khí hòa tan chính (H2, CH4, C2H6, C2H4, C2H2, CO, CO2), cùng 2 khí bổ sung tùy chọn N2/O2 (dùng cho Tổng hàm lượng khí hòa tan — Bảng 63, Điều 54).
- Khối "Thông số kỹ thuật thiết bị" (kiểu máy, năm sản xuất, năm vận hành, điện áp định mức, số chế tạo, loại dầu, kết cấu cách điện, hiện trạng vận hành) — phục vụ xuất "Báo cáo phân tích kỹ thuật".
- Khối "Thông tin thí nghiệm bổ sung" (ngày thí nghiệm, lý do thí nghiệm, nhiệt độ/độ ẩm môi trường) — phục vụ xuất Biên bản thí nghiệm (BBTN).
- Đính kèm 1 file BBTN (PDF) gốc cho lần đo — có thể **tự động trích xuất** dữ liệu từ PDF (xem mục 12) để điền sẵn toàn bộ form phía trên, người dùng không phải gõ tay.
- Nhập liệu hàng loạt (Batch import) từ nhiều file BBTN cùng lúc — xem mục 12.

**Phân tích & đánh giá (khi bấm "Phân tích & Lưu"):**
- **Đánh giá giá trị tuyệt đối từng khí** so với ngưỡng đang áp dụng (QĐ1901/IEC hoặc tiêu chuẩn nhà sản xuất nếu đã cấu hình) — kết luận Đạt/Không đạt từng khí và tổng thể.
- **Tổng lượng khí cháy (TCG)**.
- **Chẩn đoán mã sự cố theo tỷ số khí**: dùng song song 2 phương pháp độc lập, không thay thế nhau:
  - *Bảng 66 QĐ1901 / Table 1 IEC 60599:2022* (6 mã sự cố loại trừ lẫn nhau: PD, D1, D2, T1, T2, T3) — áp dụng cho MBA/Kháng dầu, TI, TU.
  - *Table A.10 IEC 60599:2022 Annex A.5.3 (Bảng đơn giản hóa cho Sứ xuyên)* — 4 mã **độc lập** (PD, D, T, TP; có thể khớp 0, 1 hoặc nhiều mã cùng lúc), dùng riêng cho Sứ xuyên; nếu không khớp mã nào thì tự động lùi về dùng Bảng 66 (đúng khuyến cáo của IEC). Ngưỡng PD theo tỷ số CH4/H2 cũng khác nhau theo loại thiết bị: Sứ xuyên 0,07; MBA/Khác 0,1; TI/TU 0,2.
  - **Tam giác Duval 1** — áp dụng đồng thời cho mọi loại thiết bị (kể cả Sứ xuyên), có đối chiếu chéo với mã Bảng 66/Table A.10 trong phần khuyến cáo.
- **Tỷ lệ bổ sung Điều 54** (CO2/CO, O2/N2) và **Tổng hàm lượng khí hòa tan (Bảng 63)** — chỉ tính được khi đã nhập cả N2 lẫn O2; đưa ra khuyến cáo riêng (không ảnh hưởng trạng thái tổng thể Bình thường/Cảnh báo/Báo động, chỉ là tham khảo bổ sung).
- **Ngưỡng loại bỏ (condemning limits)** riêng của nhà sản xuất (nếu đã cấu hình) — cảnh báo "⚠ Vượt ngưỡng loại bỏ" tách biệt với đánh giá "Không đạt" thông thường.
- **Tốc độ gia tăng khí** so với lần đo liền trước (nếu có), đối chiếu Bảng 65 QĐ1901 (chỉ chính thức cho MBA/Kháng dầu; loại khác chỉ mang tính tham khảo) hoặc khoảng tốc độ riêng của nhà sản xuất nếu đã cấu hình.
- **Trạng thái tổng thể** (Bình thường / Cảnh báo (ALERT) / Báo động (ALARM)) tổng hợp từ: kết quả Đạt/Không đạt, số khí vượt ngưỡng, mã chẩn đoán, đổi loại sự cố giữa 2 lần đo liền kề, tốc độ tăng bất thường, và vượt ngưỡng loại bỏ.
- **Khuyến cáo hành động** cụ thể theo từng trường hợp.
- Cảnh báo giá trị âm khi nhập liệu nhầm.

**Xuất báo cáo (chỉ hiện khi có dữ liệu tương ứng):**
- **Xuất BBTN (.docx)** — điền sẵn số liệu vào mẫu Biên bản thí nghiệm chuẩn PTC3/BM.15 (Trạm, vị trí lắp đặt, hãng SX, ngày lấy/thí nghiệm mẫu, lý do thí nghiệm, điều kiện môi trường, 7 khí + TCG + tốc độ sinh khí %/tháng, N2/O2, Tổng hàm lượng khí hòa tan, kết luận tổng hợp) — chạy 100% phía trình duyệt (docxtemplater), không gửi số liệu lên server nào.
- **Xuất "Báo cáo phân tích kỹ thuật" (.docx)** — chỉ xuất được khi trạng thái khác "Bình thường": tổng hợp thông số kỹ thuật thiết bị, kết quả thí nghiệm, 3 tỷ số khí, chẩn đoán bất thường, đề xuất hướng xử lý và việc cần làm.

**Sửa lần đo đã lưu:** cho phép sửa số liệu khí của bản ghi cũ; hệ thống tự động ghi log các trường đã sửa (giá trị cũ, thời điểm sửa) để hiển thị cảnh báo ở tab "Lịch sử đo".

---

## 2. Tab "Dầu cách điện" — Thí nghiệm dầu

Gồm 3 khối con, chọn qua bộ lọc "Loại thiết bị":

### 2.1. Dầu MBA chính (MBA/Kháng dầu)
- Độ ẩm dầu (ppm), tgδ ở 90°C (%), Điện áp chọc thủng (kV) — theo **Bảng 58/55/54 QĐ1901** (Điều 50/47/46), phân theo cấp điện áp và trạng thái dầu (mới/đang vận hành).
- Tùy chọn "Có bảo vệ màng/nitơ" — chỉ hiện khi cấp điện áp đó có phân biệt 2 mức ngưỡng độ ẩm (theo Bảng 58).
- Hỗ trợ lấy mẫu theo điểm "Chung" (1 mẫu đại diện 3 pha) hoặc "Pha riêng" (A/B/C — dành cho MBA/Kháng 3 pha rời, phổ biến ở cấp 500kV).
- Có thể ưu tiên dùng tiêu chuẩn riêng của nhà sản xuất (nếu đã cấu hình ở tab "Cấu hình" — mục "Tiêu chuẩn") thay cho bảng mặc định.
- Sửa/xóa thí nghiệm đã lưu (quyền theo vai trò — xem mục 9).

### 2.2. Dầu OLTC (bộ đổi nấc có tải)
- Cùng 3 chỉ tiêu Độ ẩm/tgδ 90°C/Điện áp chọc thủng — theo **Điều 37, Bảng 49 QĐ1901** (dầu vận hành) hoặc theo Bảng 58 (nếu là dầu mới lắp).
- Lấy mẫu theo "Điểm cuối trung tính" (3 pha dùng chung) hoặc "Pha riêng" (A/B/C).

### 2.3. Dầu TI/TU/Sứ xuyên
- Cùng 3 chỉ tiêu Độ ẩm/tgδ 90°C/Điện áp chọc thủng, nhưng **QĐ1901 Điều 10/11 KHÔNG có bảng ngưỡng mặc định** cho TI/TU (chỉ dẫn chiếu "theo quy định nhà sản xuất") — bắt buộc phải chọn 1 Nhà sản xuất đã cấu hình đủ tiêu chuẩn 2 tầng (Bình thường/Loại bỏ) ở tab "Cấu hình" — mục "Tiêu chuẩn" thì mới đánh giá được; nếu chưa chọn, hệ thống chặn lưu và báo rõ lý do.
- Kết quả có 3 mức: Đạt / Cảnh báo / Không đạt (dựa theo 2 tầng ngưỡng của nhà sản xuất).
- **Sứ xuyên (Bushing) KHÔNG có thí nghiệm dầu cách điện** — ứng dụng hiển thị ghi chú rõ và hướng người dùng quay lại tab "DGA" (khí hòa tan là phương pháp đánh giá chính cho sứ xuyên kín dầu).

---

## 3. Tab "Lịch sử đo"

- Bảng nhật ký toàn bộ các lần đo khí hòa tan đã lưu — lọc theo Trạm/Thiết bị (gõ tự do) và theo Loại thiết bị.
- Có bộ chọn xem theo "Khí hòa tan (DGA)" hoặc "Dầu" (gộp 3 bảng con: Dầu MBA chính / Dầu OLTC / Dầu TI-TU-Sứ xuyên, dùng chung 1 ô lọc Trạm/Thiết bị).
- Mỗi dòng hiển thị đầy đủ: 7 khí + N2/O2 (nếu có), TCG, kết luận Đạt/Không đạt (kèm cờ "⚠ Vượt ngưỡng loại bỏ" nếu có), mã chẩn đoán tỷ số khí, vùng Tam giác Duval, người nhập/người sửa lần cuối, huy hiệu "✎ N lần sửa" (xem log chi tiết qua tooltip).
- Ô số liệu đã bị sửa so với bản gốc được tô nền cảnh báo, hiện tooltip giá trị cũ + thời điểm sửa.
- Xem lại file BBTN đã đính kèm (nếu có), sửa/xóa từng bản ghi (theo phân quyền).
- **So sánh tốc độ gia tăng khí giữa 2 lần đo bất kỳ** (không bắt buộc là 2 lần liền kề) của cùng 1 thiết bị — chọn thiết bị rồi chọn 2 mốc đo, hệ thống tự sắp theo thời gian và tính tốc độ theo Bảng 65 QĐ1901 hoặc khoảng riêng của nhà sản xuất.

---

## 4. Tab "Cảnh báo"

Tự động rà soát **lần đo/thí nghiệm gần nhất của từng thiết bị** (gộp theo Trạm+Thiết bị+Pha đã chuẩn hóa) trên cả 4 nguồn dữ liệu (khí hòa tan, dầu MBA chính, dầu OLTC, dầu TI/TU/Sứ xuyên) và liệt kê các thiết bị đang ở mức **Cảnh báo (ALERT)** hoặc **Báo động (ALARM)** — tái dùng nguyên các hàm đánh giá đã dùng ở tab DGA/Dầu cách điện, không tự đặt ngưỡng riêng.

- Thống kê nhanh: tổng số thiết bị đang theo dõi, số thiết bị đang có cảnh báo, số mức Cảnh báo, số mức Báo động.
- Lọc theo Trạm biến áp.
- Mỗi dòng liệt kê: thiết bị, loại đo, mức cảnh báo, tình trạng, các khí/chỉ tiêu vượt ngưỡng, lý do chi tiết, khuyến cáo hành động cụ thể.
- Nút "Xem xu hướng" — nhảy thẳng sang tab "Xu hướng", tự chọn đúng thiết bị/pha và tự tick sẵn đúng (các) thông số đã gây cảnh báo.
- **Xuất báo cáo cảnh báo ra Excel (.xlsx)** — gồm thống kê tổng quan + toàn bộ danh sách đang hiển thị (tôn trọng bộ lọc Trạm đang áp dụng).

---

## 5. Tab "Xu hướng"

Vẽ đồ thị theo thời gian (Chart.js) cho 1 thiết bị cụ thể, gộp cả 3 nguồn dữ liệu: khí hòa tan, dầu MBA chính, dầu OLTC.

- Chọn Trạm (tùy chọn) và Thiết bị qua ô combo tự gõ-tìm; cảnh báo nếu tên thiết bị bị trùng giữa nhiều trạm khi không lọc theo Trạm.
- Lọc theo Pha (A/B/C) khi thiết bị có từ 2 pha dữ liệu trở lên.
- Chọn tùy ý các thông số cần vẽ chung 1 đồ thị: 7 khí chính, N2, O2, TCG, Tổng hàm lượng khí hòa tan (Bảng 63), độ ẩm/tgδ 90°C/điện áp chọc thủng của dầu chính và dầu OLTC — mỗi thông số 1 trục tung riêng phù hợp đơn vị.
- **Dự báo xu hướng (ngoại suy tuyến tính)** cho từng khí trong 7 khí chính: 3 thuật toán độc lập (hồi quy OLS, Theil-Sen, trung bình liền kề) + 1 dòng "Trung bình 3 thuật toán"; hiển thị tốc độ ppm/năm, R², giá trị dự báo, và ước tính thời điểm chạm ngưỡng đang áp dụng (nếu xu hướng đang tăng) trong khoảng số năm dự báo tùy chỉnh (1–30 năm). Có thể bật/tắt hiển thị dự báo (trạng thái nhớ qua localStorage).
- Bảng lịch sử số liệu thô đi kèm cho từng nguồn (khí/dầu chính/dầu OLTC).
- Toàn bộ phần vẽ đồ thị tự ẩn nếu thư viện Chart.js không tải được (mất mạng/CDN lỗi), nhưng bảng dự báo xu hướng vẫn hoạt động độc lập.

---

## 6. Tab "Cấu hình"

Gộp 2 nhóm chức năng cấu hình vào 1 tab, chuyển đổi qua bộ chọn segmented control nội bộ "Tiêu chuẩn" / "Quy định" (không phụ thuộc hệ thống tab chính, hoạt động nhất quán ở cả bố cục ngang lẫn sidebar):

### 6.1. Mục "Tiêu chuẩn" — Tiêu chuẩn theo nhà sản xuất
Cho phép cấu hình ngưỡng riêng theo từng Nhà sản xuất, áp dụng thay cho ngưỡng mặc định QĐ1901/IEC:
- **Khí hòa tan (DGA)** — ngưỡng tuyệt đối từng khí, ngưỡng loại bỏ (condemning), khoảng tốc độ tăng riêng.
- **Dầu cách điện MBA/Kháng dầu** — thay cho Bảng 54/55/58 QĐ1901 (theo cấp điện áp + trạng thái dầu).
- **Dầu cách điện TI/TU** — **bắt buộc** phải cấu hình ở đây (2 tầng ngưỡng Bình thường/Loại bỏ) vì QĐ1901 không có bảng mặc định cho hạng mục này.
- Thiết bị/thí nghiệm không chọn nhà sản xuất, hoặc nhà sản xuất chưa có cấu hình khớp, tự động dùng tiêu chuẩn mặc định QĐ1901/IEC (riêng TI/TU sẽ báo "Chưa có tiêu chuẩn nhà sản xuất").
- Danh sách các tiêu chuẩn đã cấu hình, có thể xem lại/sửa/xóa.
- Nội dung hướng dẫn được gói gọn sau icon "i" cạnh tiêu đề, bấm để xem popover.

### 6.2. Mục "Quy định" — Cấu hình quy định (13 bảng ngưỡng)
Cho phép chỉnh sửa **13 bảng ngưỡng số học đơn giản** trích từ QĐ1901/IEC 60599:2022 (KHÔNG bao gồm logic tra mã Bảng 66/Table A.10 hay ranh giới Tam giác Duval — các phần đó vẫn cố định theo văn bản gốc), nhóm theo loại thiết bị/bối cảnh áp dụng — ví dụ các bảng "MBA/Kháng dầu — Khí hòa tan", "Dầu MBA — Điện áp chọc thủng", "Dầu MBA — Tổn hao điện môi tgδ ở 90°C", "Dầu MBA — Hàm lượng nước", "Dầu OLTC (đang vận hành) — Độ ẩm & điện áp chọc thủng", v.v.
- Sửa số liệu + tham chiếu nguồn rồi bấm "Lưu bảng này" khi QĐ1901/IEC 60599 có bản cập nhật trong tương lai — không cần sửa code.
- "Khôi phục mặc định" — quay lại đúng số liệu gốc đã tích hợp sẵn trong ứng dụng cho từng bảng.
- Chỉ Admin sửa/lưu được (chế độ Google Sheets); mọi người dùng đã đăng nhập đều xem được.
- Nội dung hướng dẫn cũng được gói gọn sau icon "i" cạnh tiêu đề.

---

## 7. Tab "Quy trình lấy mẫu"

- **7 phương pháp lấy mẫu dầu** (Điều 8 QĐ1901) trình bày dạng accordion, có nút "Mở tất cả"/"Thu gọn tất cả".
- 5 sơ đồ minh họa (Hình 2–5) + thư viện ảnh thực tế lấy mẫu — xem phóng to qua lightbox (bấm ảnh để mở, đóng bằng nút ×/bấm ra ngoài/phím Esc).

## 8. Tab "Quy trình đánh giá"

- **Cẩm nang tham khảo nhanh** — các áp phích tổng hợp quy trình chẩn đoán, xem phóng to qua lightbox riêng.
- **2 sơ đồ tư duy (mindmap)** dạng accordion lồng nhau (`<details>/<summary>`), có nút "Mở tất cả"/"Thu gọn tất cả" cho từng sơ đồ:
  - Sơ đồ diễn giải quy trình DGA.
  - Sơ đồ tổng quan thứ 2: cơ chế hình thành khí, 7 loại khí, khí chỉ thị theo lỗi, phương pháp chẩn đoán, quy trình.

---

## 9. Đăng nhập, phân quyền và Quản trị

**Đăng nhập** (chỉ hoạt động ở chế độ Google Sheets — `Auth.enabled`; ở chế độ Supabase/localStorage mọi người dùng đều có toàn quyền):
- Đăng ký/đăng nhập bằng email + mật khẩu.
- Đăng nhập bằng Google (Google Identity Services) — tùy chọn, chỉ hiện khi đã cấu hình `GOOGLE_CLIENT_ID`.
- Tự động khôi phục phiên đăng nhập đã lưu khi tải lại trang.
- Đăng xuất qua bấm vào huy hiệu tên người dùng (có xác nhận trước khi đăng xuất).

**Phân quyền 2 vai trò — Admin / User:**
- **Admin**: toàn quyền sửa/xóa mọi bản ghi, cấu hình Tiêu chuẩn/Quy định, quản lý người dùng.
- **User** (đã đăng nhập): tự nhập bản ghi mới (khí hòa tan/dầu MBA/dầu OLTC/dầu TI-TU); chỉ sửa được bản ghi do **chính mình** nhập; không xóa được, không cấu hình được Tiêu chuẩn/Quy định.
- Quyền hiển thị ở giao diện chỉ mang tính gợi ý — quyền thật luôn được kiểm tra lại phía server (Google Apps Script), không tin tưởng tuyệt đối phía trình duyệt.
- Mỗi bản ghi lưu vết người tạo/người sửa cuối + thời điểm — hiển thị ở cột "Người nhập" tại tab "Lịch sử đo"/"Dầu cách điện".

**Tab "Quản trị" (chỉ Admin, chỉ chế độ Google Sheets):**
- Danh sách toàn bộ người dùng: email, vai trò (đổi qua dropdown User/Admin), ngày tạo tài khoản, lần đăng nhập cuối.
- Xóa người dùng (có xác nhận).
- Tự bảo vệ tránh khóa nhầm chính mình: dòng của Admin đang đăng nhập bị vô hiệu hóa dropdown vai trò và ẩn nút xóa.

---

## 10. Tab "Giới thiệu" (About)

Thông tin giới thiệu chung về ứng dụng, phạm vi áp dụng và căn cứ pháp lý (QĐ1901/IEC 60599:2022).

## 11. Tab "Người dùng phản hồi"

- Gửi góp ý tự do (nội dung văn bản) kèm tối đa 1 ảnh minh họa tùy chọn.
- Hỗ trợ đính kèm ảnh qua 3 cách: chọn file, kéo-thả vào khung, hoặc **dán trực tiếp (Ctrl+V)** ảnh vừa chụp màn hình.
- Xem lại toàn bộ góp ý đã gửi (mới nhất lên đầu), xem ảnh minh họa phóng to qua lightbox.
- Chỉ Admin xóa được góp ý; không có tính năng sửa lại góp ý đã gửi.

---

## 12. Nhập liệu từ Biên bản thí nghiệm (BBTN) — tự động hóa nhập liệu

Chạy 100% phía trình duyệt bằng thư viện `pdf.js` (đóng gói sẵn, không phụ thuộc CDN ngoài) — không gửi file lên server nào để "đọc".

- **Nhập rời từng lần** (tab "DGA"): đính kèm 1 file BBTN PDF (mẫu PTC3/BM.15) cho lần đo đang nhập — hệ thống tự nhận diện và điền sẵn: Trạm, Thiết bị, Loại thiết bị, Pha, Ngày lấy mẫu, Nhà sản xuất, Số chế tạo, Điện áp định mức, Năm sản xuất, Năm vận hành, Loại dầu cách điện, Ngày thí nghiệm, Lý do thí nghiệm, Điều kiện môi trường (nhiệt độ/độ ẩm), và cả 7 giá trị khí hòa tan.
- **Nhập hàng loạt (Batch import)** (tab "DGA"): chọn nhiều file PDF hoặc cả 1 thư mục BBTN của cùng 1 thiết bị cùng lúc — dùng chung Trạm/Thiết bị/Loại thiết bị/Nhà sản xuất/Thông số kỹ thuật đang điền ở form phía trên cho cả đợt, chỉ đọc riêng Pha/Ngày/7 khí từ mỗi file. Có bảng xem trước (preview) cho từng file với trạng thái: sẵn sàng nhập / cảnh báo (không đọc được Pha, hoặc trùng Pha+Ngày với bản ghi đã có/dòng khác trong đợt) / lỗi (không đọc được file hoặc thiếu dữ liệu bắt buộc) — có thể sửa tay Pha/Ngày từng dòng, tick chọn/bỏ chọn từng dòng hoặc chọn tất cả/bỏ tất cả, tùy chọn đính kèm luôn PDF gốc vào bản ghi. Lưu tuần tự từng dòng (1 dòng lỗi không chặn các dòng còn lại), tự đánh số "Lần đo" tăng dần đúng theo nhóm Trạm+Thiết bị+Pha. Phù hợp để nhập nhanh dữ liệu lịch sử (backfill) phục vụ phân tích xu hướng.
- Đây là suy đoán "tốt nhất có thể" dựa trên cấu trúc mẫu BBTN hiện hành — nếu biên bản dùng mẫu khác, có thể chỉ nhận được một phần hoặc không nhận được trường nào; người dùng luôn xem lại và sửa tay được mọi trường trước khi lưu.

---

## 13. Các tiện ích giao diện dùng chung

- **Bố cục thanh tab**: chuyển đổi giữa bố cục **ngang** (mặc định, có hiệu ứng bóng mờ 2 bên báo hiệu còn tab ẩn ngoài tầm nhìn, tự cuộn mượt tới tab vừa bấm) và bố cục **sidebar dọc** (có thể thu gọn) — trạng thái được nhớ qua localStorage.
- **Icon "i" (info popover)**: cơ chế dùng chung cho mọi đoạn hướng dẫn dài — bấm để xem, đóng bằng nút "×" hoặc bấm ra ngoài; chỉ 1 popover mở tại 1 thời điểm.
- **Ô combo tự gõ-tìm** (Trạm, Thiết bị...) — vừa gõ tự do vừa gợi ý từ dữ liệu đã có, không ép buộc chọn đúng từ danh sách.
- **Toast thông báo** góc trên bên phải cho các thao tác rõ ràng (đăng nhập/đăng ký/lưu thành công...).
- Giao diện tiếng Việt, tối ưu cho cả máy tính và di động.

---

## 14. Lưu trữ dữ liệu (3 chế độ, tự động chọn theo cấu hình)

Thứ tự ưu tiên: **Google Sheets > Supabase > localStorage**.

1. **Google Sheets** (qua Google Apps Script) — duy nhất hỗ trợ đăng nhập/phân quyền Admin-User; cần redeploy thủ công Apps Script (`gsheet/Code.gs`) mỗi khi mã backend thay đổi.
2. **Supabase** (Postgres + Row Level Security) — chưa hỗ trợ phân quyền theo vai trò (giới hạn đã ghi trong README.md).
3. **localStorage** (ngoại tuyến/demo) — dữ liệu chỉ lưu trên trình duyệt hiện tại, mọi người dùng có toàn quyền, ảnh/PDF đính kèm lưu dạng base64 cục bộ.

Toàn bộ 3 chế độ dùng chung 1 giao diện (`storage.js` là lớp trừu tượng), không phân biệt khi thao tác trên các tab.

---

*Xem `README.md` để biết hướng dẫn cài đặt, triển khai và cấu trúc thư mục chi tiết của dự án.*
