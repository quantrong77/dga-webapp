# Công cụ đánh giá DGA dầu cách điện (web app)

Web app đánh giá phân tích khí hòa tan trong dầu (DGA) cho thiết bị dầu cách điện:
**TI (biến dòng điện), TU (biến điện áp), MBA/Kháng dầu, Sứ xuyên (Bushing)**.

Tiêu chuẩn mặc định (khi thiết bị chưa gán nhà sản xuất, hoặc nhà sản xuất chưa
cấu hình đầy đủ ngưỡng) lấy **CHẶT HƠN** giữa **Quyết định 1901/QĐ-EVNNPT** và
**IEC 60599:1999 Annex A** (bảng nồng độ khí theo từng loại thiết bị):

| Loại thiết bị | Nguồn ngưỡng tuyệt đối | Ngưỡng PD (CH4/H2) |
|---|---|---|
| TI / TU | QĐ1901 Bảng 12 (Điều 10) = IEC Annex A.3.4 "giá trị tối đa cho phép" (2 nguồn trùng khớp) | < 0,2 (Annex A.3.3) |
| MBA/Kháng dầu | min(QĐ1901 Bảng 64, IEC Annex A.1 Table A.2) theo từng khí, phân theo CPC không thông dầu/khí hoặc có thông dầu/khí | < 0,1 (mặc định, Table 2) |
| Sứ xuyên (Bushing) | IEC Annex A.4.4 Table A.9 (QĐ1901 chưa có bảng riêng) | < 0,07 (Annex A.4.3) |

Ngoài ra, công cụ vẫn cho phép **cấu hình tiêu chuẩn riêng theo từng nhà sản
xuất** — khi thiết bị có gán nhà sản xuất đã cấu hình đầy đủ ngưỡng, công cụ
dùng tiêu chuẩn đó thay cho bảng mặc định ở trên.

Tính năng:
- Nhập từng thành phần khí (H2, CH4, C2H6, C2H4, C2H2, CO, CO2), tự tính tổng
  khí cháy (TCG).
- Đánh giá giá trị tuyệt đối từng khí so với tiêu chuẩn áp dụng (NSX, hoặc
  QĐ1901/IEC — xem bảng trên).
- **Chẩn đoán dạng sự cố bằng 2 phương pháp:**
  - *Ba tỷ số khí cơ bản* (Bảng 66 QĐ1901 = Table 2, IEC 60599:1999) → mã
    PD/D1/D2/T1/T2/T3, ngưỡng PD (CH4/H2) tự điều chỉnh theo loại thiết bị.
  - *Tam giác Duval 1* (Annex B, Figure B.3, IEC 60599:1999) — dùng %CH4,
    %C2H4, %C2H2 (quy về tổng 100%), có hình vẽ tam giác trực quan kèm điểm
    chẩn đoán. Vùng "D+T" là vùng chồng lấn phóng điện/tăng nhiệt mà chính
    hình vẽ gốc IEC cũng không phân định rạch ròi.
  - Khi 2 phương pháp cho kết quả khác nhau, công cụ tự ghi chú để người dùng
    đối chiếu thêm trước khi kết luận.
- Nhập lần đo sau cho cùng Trạm + Thiết bị + Pha → tự động tính tốc độ tăng
  hàm lượng khí (ppm/năm) và đối chiếu Bảng 65 QĐ1901.
- Khuyến cáo tổng hợp dựa trên kết quả đánh giá tuyệt đối, 2 mã chẩn đoán và
  tốc độ sinh khí.
- Lưu trữ toàn bộ lịch sử đo, xem lại/lọc theo trạm hoặc thiết bị.

> **Lưu ý về nguồn dữ liệu IEC**: các bảng Annex A (A.2, A.6, A.9) và bảng ranh
> giới vùng của Tam giác Duval (Annex B, Figure B.3) được trích trực tiếp và
> chính xác theo số liệu trong bản IEC 60599:1999 do bạn cung cấp. Vùng "D+T"
> nêu trên phản ánh đúng việc chính tài liệu gốc cũng để ngỏ ranh giới này
> (nhãn "D+T" xuất hiện ngay trên hình vẽ gốc) — không phải do công cụ suy
> diễn thêm.

## 1. Chạy thử ngay (không cần cấu hình gì)

Không cần server, không cần tài khoản: mở trực tiếp `index.html` bằng trình
duyệt (double-click, hoặc `python3 -m http.server` rồi mở `http://localhost:8000`).
Ở chế độ này, dữ liệu được lưu bằng `localStorage` — **chỉ máy/trình duyệt hiện
tại nhìn thấy**, mất dữ liệu nếu xóa lịch sử duyệt web. Phù hợp để dùng thử hoặc
dùng cá nhân trên 1 máy.

## 2. Có database dùng chung (nhiều máy / nhiều người cùng nhập, cùng xem)

Chọn 1 trong 2 cách bên dưới — điền đúng 1 mục trong `config.js`, để trống các
mục còn lại. Nếu điền cả 2, Google Sheets được ưu tiên dùng trước.

### 2a. Google Sheets (đơn giản nhất — chỉ cần tài khoản Google, không cần đăng ký gì thêm)

Dùng **Google Apps Script** để biến 1 Google Sheet thành API đọc/ghi cho web app:

1. Vào https://sheets.google.com → tạo 1 Sheet mới, trống (đặt tên gì cũng được,
   ví dụ "DGA Database").
2. Trong Sheet đó: **Tiện ích mở rộng (Extensions) → Apps Script**.
3. Xóa hết nội dung mẫu trong `Code.gs`, dán toàn bộ nội dung file
   [`gsheet/Code.gs`](./gsheet/Code.gs) (trong repo này) vào, rồi **Lưu** (biểu
   tượng đĩa mềm).
4. Bấm **Deploy (Triển khai) → New deployment (Triển khai mới)**:
   - Select type: **Web app**
   - Execute as: **Me** (tài khoản của bạn)
   - Who has access: **Anyone** (bắt buộc, để web app gọi được mà không cần
     đăng nhập Google mỗi lần)
   - Bấm **Deploy**, cấp quyền khi Google hỏi (Authorize access — chọn tài
     khoản của bạn, bấm "Advanced/Đi tới trang không an toàn" nếu Google cảnh
     báo vì đây là script tự viết chưa được Google xác minh, việc này bình
     thường với Apps Script cá nhân).
5. Copy **Web app URL** (dạng `https://script.google.com/macros/s/AKfycb.../exec`).
6. Mở file `config.js` trong repo, dán vào:
   ```js
   window.DGA_CONFIG = {
     GSHEET_WEBAPP_URL: "https://script.google.com/macros/s/AKfycb.../exec",
   };
   ```
7. Lưu lại, mở lại trang — góc trên bên phải sẽ hiện "Đã kết nối database
   (Google Sheets)". Script sẽ tự tạo 2 sheet con (`measurements`,
   `manufacturer_standards`) kèm tiêu đề cột trong chính Google Sheet của bạn —
   không cần tạo tay, và bạn có thể mở Sheet đó bất kỳ lúc nào để xem/lọc/xuất
   dữ liệu thô bằng chính Google Sheets.

> **Lưu ý bảo mật**: vì "Who has access" phải để "Anyone" thì web app mới gọi
> được từ trình duyệt, bất kỳ ai có URL Web App này đều đọc/ghi được vào Sheet
> của bạn (không có xác thực đăng nhập ở bước gọi API) — tương tự cơ chế "anon
> key" của Supabase bên dưới, không phải lỗ hổng nhưng cần hiểu rõ. Phù hợp
> dùng nội bộ 1 tổ/đội (không đăng URL này công khai). Nếu cần kiểm soát chặt
> hơn (ai được đọc/ghi cụ thể), dùng Supabase (mục 2b) với Row Level Security.
>
> **Nếu gặp lỗi khi Phân tích & Lưu**: công cụ sẽ hiện thông báo lỗi cụ thể —
> thường do URL trong `config.js` gõ sai, hoặc bước Deploy chưa chọn đúng "Who
> has access: Anyone". Thử mở thẳng Web app URL bằng trình duyệt (dán vào
> thanh địa chỉ) — nếu thấy `[]` hoặc dữ liệu JSON nghĩa là script hoạt động
> đúng; nếu thấy trang yêu cầu đăng nhập Google, quay lại bước 4 deploy lại.

### 2b. Supabase (Postgres, có Row Level Security thực sự — chặt hơn Google Sheets)

1. Tạo tài khoản tại https://supabase.com → **New project** (chọn khu vực gần
   Việt Nam, ví dụ Singapore).
2. Vào **SQL Editor** → dán toàn bộ nội dung file [`supabase-schema.sql`](./supabase-schema.sql)
   → **Run**. Lệnh này tạo 2 bảng (`measurements`, `manufacturer_standards`) và
   bật Row Level Security cho phép đọc/ghi bằng anon key (phù hợp 1 nhóm nhỏ
   dùng chung 1 link nội bộ).
3. Vào **Settings → API** → copy **Project URL** và **anon public key**.
4. Mở file `config.js` trong repo, dán vào:
   ```js
   window.DGA_CONFIG = {
     SUPABASE_URL: "https://xxxxxxxx.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGciOi...",
   };
   ```
5. Lưu lại, mở lại trang — góc trên bên phải sẽ hiện "Đã kết nối database
   (Supabase)" thay vì "Chế độ thử nghiệm".

> "anon key" của Supabase được thiết kế để đặt công khai phía trình duyệt/GitHub
> (không phải khóa bí mật) — bảo mật thực sự nằm ở chính sách Row Level Security
> đã bật ở bước 2. **Không dán "service_role key"** (khóa có toàn quyền, phải
> giữ bí mật) vào `config.js`.

## 3. Đưa lên GitHub + GitHub Pages (miễn phí)

```bash
cd dga-webapp
git init
git add .
git commit -m "Khởi tạo công cụ đánh giá DGA"
git branch -M main
git remote add origin https://github.com/<tai-khoan-cua-ban>/<ten-repo>.git
git push -u origin main
```

Sau đó vào repo trên GitHub → **Settings → Pages** → Source chọn nhánh `main`,
thư mục `/ (root)` → Save. Sau ít phút, trang sẽ có tại
`https://<tai-khoan-cua-ban>.github.io/<ten-repo>/`.

Vì đây là trang tĩnh (HTML/CSS/JS thuần, không có phần "server"), GitHub Pages
hoàn toàn phù hợp để host — mọi tính toán chạy trong trình duyệt, chỉ có phần
lưu trữ dữ liệu là gọi ra Google Sheets hoặc Supabase (nếu đã cấu hình).

**Riêng tư/nội bộ:** nếu chỉ muốn nội bộ tổ/đội dùng, có thể để repo ở chế độ
Private trên GitHub (GitHub Pages vẫn chạy được với repo private nếu tài khoản
là GitHub Pro/Team/Enterprise; với tài khoản Free, Pages công khai theo repo
Public — nếu cần giữ kín, cân nhắc thêm xác thực ở tầng Supabase Auth thay vì
policy "cho phép tất cả" trong `supabase-schema.sql`).

## 4. Cấu trúc file

| File | Vai trò |
|---|---|
| `index.html` | Giao diện (form nhập liệu, lịch sử, cấu hình tiêu chuẩn NSX) |
| `style.css` | Giao diện/màu sắc |
| `dga-logic.js` | Toàn bộ công thức đánh giá DGA (TCG, tỷ lệ khí Bảng 66, Tam giác Duval Annex B, tiêu chuẩn IEC Annex A theo loại thiết bị, tốc độ sinh khí Bảng 65, khuyến cáo) — tách riêng, không phụ thuộc DOM, có thể unit test độc lập |
| `storage.js` | Lớp lưu trữ — tự chuyển giữa Google Sheets, Supabase, và localStorage |
| `config.js` | Nơi dán URL Apps Script (Google Sheets) hoặc URL/anon key Supabase (để trống hết = chạy chế độ thử nghiệm) |
| `app.js` | Nối giao diện với `dga-logic.js` + `storage.js` |
| `supabase-schema.sql` | Script tạo bảng + bật Row Level Security trên Supabase |
| `gsheet/Code.gs` | Script Google Apps Script — dán vào Apps Script Editor của Google Sheet để biến Sheet thành database |

## 5. Giới hạn / lưu ý

- Đây là công cụ **hỗ trợ tham khảo**, không thay thế nguyên tắc đánh giá tổng
  thể tại Điều 3, QĐ1901 (cần đối chiếu thêm các pha khác, lần đo trước, xu
  hướng vận hành, hướng dẫn nhà sản xuất trước khi kết luận chính thức).
- Bảng 65 (tốc độ sinh khí) chỉ được QĐ1901 quy định chính thức cho MBA/Kháng
  dầu; với TI/thiết bị khác, công cụ vẫn tính nhưng chỉ nên dùng tham khảo,
  trừ khi bạn cấu hình khoảng tốc độ riêng theo nhà sản xuất.
- Tỷ lệ khí (Bảng 66) chỉ có ý nghĩa chẩn đoán khi có ít nhất 1 khí vượt giá
  trị điển hình (Điều 54 QĐ1901/mục 6.1(c) IEC 60599:1999) — công cụ tự ghi
  chú "Điều kiện áp dụng" nhưng vẫn hiển thị mã chẩn đoán để tham khảo.
- Với MBA/Kháng dầu, nhớ chọn đúng **Phân loại CPC** (không thông dầu/khí hay
  có thông dầu/khí với thùng chính) — lựa chọn này quyết định bảng IEC Annex
  A.1 Table A.2 nào được dùng để tính "tiêu chuẩn chặt hơn". Nếu không chắc,
  để mặc định "Không có CPC" (ngưỡng C2H2 chặt hơn nhiều so với lựa chọn còn
  lại: 20 ppm so với ~270 ppm).
- Bảng A.3 (IEC, vận tốc sinh khí theo mL/ngày cho MBA lực) **không được** dùng
  trong công cụ vì cần biết khối lượng/thể tích dầu để quy đổi — công cụ chỉ
  dùng Bảng 65 QĐ1901 (ppm/năm) cho tốc độ sinh khí.
- Tam giác Duval 1 chỉ nên dùng khi CH4+C2H4+C2H2 đủ lớn để có ý nghĩa (vài
  ppm trở lên) — với khí quá thấp, tỷ lệ % có thể dao động mạnh và làm sai
  lệch điểm chẩn đoán. Vùng "D+T" (giữa D2 và T3, khi %C2H2 nằm trong khoảng
  4–13% và %C2H4 &gt; 38%) là vùng ranh giới mà bản thân hình vẽ gốc IEC 60599
  Annex B cũng không phân định rõ — công cụ trả về mã riêng thay vì gán ép
  vào D2 hoặc T3.
