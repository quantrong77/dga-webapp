# Công cụ đánh giá DGA dầu cách điện (web app)

Web app đánh giá phân tích khí hòa tan trong dầu (DGA) cho thiết bị dầu cách điện:
**TI (biến dòng điện), TU (biến điện áp), MBA/Kháng dầu, Sứ xuyên (Bushing)**.

Tiêu chuẩn mặc định (khi thiết bị chưa gán nhà sản xuất, hoặc nhà sản xuất chưa
cấu hình đầy đủ ngưỡng) lấy **CHẶT HƠN** giữa **Quyết định 1901/QĐ-EVNNPT** và
**IEC 60599:2022 Annex A** (bảng nồng độ khí theo từng loại thiết bị):

| Loại thiết bị | Nguồn ngưỡng tuyệt đối | Ngưỡng PD (CH4/H2) |
|---|---|---|
| TI / TU | QĐ1901 Bảng 12 (Điều 10) = IEC Annex A.4.4 Table A.8 "giá trị tối đa cho phép" (2 nguồn trùng khớp) | < 0,2 (Annex A.4.3) |
| MBA/Kháng dầu | min(QĐ1901 Bảng 64, IEC Annex A.2.4 Table A.2) theo từng khí, phân theo ngăn OLTC không/có thông dầu/khí với thùng chính | < 0,1 (mặc định, Table 1) |
| Sứ xuyên (Bushing) | IEC Annex A.5.4 Table A.11 (QĐ1901 chưa có bảng riêng) | < 0,07 (Annex A.5.3) |

Ngoài ra, công cụ vẫn cho phép **cấu hình tiêu chuẩn riêng theo từng nhà sản
xuất** — khi thiết bị có gán nhà sản xuất đã cấu hình đầy đủ ngưỡng, công cụ
dùng tiêu chuẩn đó thay cho bảng mặc định ở trên.

Tính năng:
- Nhập từng thành phần khí (H2, CH4, C2H6, C2H4, C2H2, CO, CO2), tự tính tổng
  khí cháy (TCG).
- Đánh giá giá trị tuyệt đối từng khí so với tiêu chuẩn áp dụng (NSX, hoặc
  QĐ1901/IEC — xem bảng trên).
- **Chẩn đoán dạng sự cố bằng 3 phương pháp:**
  - *Ba tỷ số khí cơ bản* (Bảng 66 QĐ1901 = Table 1, IEC 60599:2022, mục 5.4) → mã
    PD/D1/D2/T1/T2/T3, ngưỡng PD (CH4/H2) tự điều chỉnh theo loại thiết bị.
  - *Table A.10 (Annex A.5.3, IEC 60599:2022)* — bảng đơn giản hóa riêng cho **Sứ
    xuyên**: 4 mã **độc lập** PD/D/T/TP (có thể khớp 0, 1 hoặc nhiều mã cùng lúc);
    không mã nào khớp thì tự lùi về Table 1 như bảng gốc yêu cầu.
  - *Tam giác Duval 1* (Annex B, Figure B.3, IEC 60599:2022) — dùng %CH4,
    %C2H4, %C2H2 (quy về tổng 100%), có hình vẽ tam giác trực quan kèm điểm
    chẩn đoán. Vùng "D+T" là vùng chồng lấn phóng điện/tăng nhiệt mà chính
    hình vẽ gốc IEC cũng không phân định rạch ròi.
  - Khi các phương pháp cho kết quả khác nhau, công cụ tự ghi chú để người dùng
    đối chiếu thêm trước khi kết luận.
- **So sánh với nhóm thiết bị tương tự** (z-score thang log + Isolation Forest) và
  **ca tương tự trong lịch sử đo** (cosine similarity) — 2 khối thống kê **tham
  khảo bổ sung**, không đổi ngưỡng/kết luận chính thức.
- Nhập lần đo sau cho cùng Trạm + Thiết bị + Pha → tự động tính tốc độ tăng
  hàm lượng khí (ppm/năm) và đối chiếu Bảng 65 QĐ1901.
- Khuyến cáo tổng hợp dựa trên kết quả đánh giá tuyệt đối, 2 mã chẩn đoán và
  tốc độ sinh khí.
- Lưu trữ toàn bộ lịch sử đo, xem lại/lọc theo trạm hoặc thiết bị.
- Tab **"Người dùng phản hồi"**: góp ý tự do cho ứng dụng (ý kiến + 1 ảnh minh họa tùy
  chọn), lưu lại và hiển thị cho cả nhóm cùng xem, tránh đề xuất trùng nhau.

> **Lưu ý về nguồn dữ liệu IEC**: các bảng Annex A (A.2, A.6, A.9) và bảng ranh
> giới vùng của Tam giác Duval (Annex B, Figure B.3) được trích trực tiếp và
> chính xác theo số liệu trong bản IEC 60599:2022 do bạn cung cấp. Vùng "D+T"
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
   (Google Sheets)". Script sẽ tự tạo các sheet con (`measurements`,
   `manufacturer_standards`, `feedback`...) kèm tiêu đề cột trong chính Google
   Sheet của bạn — không cần tạo tay, và bạn có thể mở Sheet đó bất kỳ lúc nào
   để xem/lọc/xuất dữ liệu thô bằng chính Google Sheets.

> **Đã deploy từ trước, giờ thấy tab mới báo lỗi?** Mở lại đúng dự án Apps
> Script, dán ĐÈ toàn bộ nội dung `gsheet/Code.gs` mới nhất vào `Code.gs`, Lưu,
> rồi **Deploy → Manage deployments → sửa (biểu tượng bút chì) deployment đang
> dùng → Version chọn "New version" → Deploy** (chỉ Lưu trong editor KHÔNG tự
> cập nhật bản `/exec` đang chạy).

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

> ⚠ **Bảo mật:** chế độ Supabase của app hiện **chưa có đăng nhập/phân quyền**, và
> `supabase-schema.sql` mở policy `using (true)` — ai có anon key (công khai trong
> `config.js`) đều đọc/sửa/xóa được toàn bộ dữ liệu. Chỉ dùng cho thử nghiệm nội bộ.
> Không dùng Supabase thì chạy [`supabase/lockdown-anon.sql`](./supabase/lockdown-anon.sql)
> và vô hiệu hóa anon key cũ (Project Settings > API Keys > tab Legacy API Keys > Disable JWT-based API keys). Muốn có Supabase chạy song song an toàn, dùng cách
> ở **mục 2c** (Code.gs ghi theo phía máy chủ, không cần anon key).

1. Tạo tài khoản tại https://supabase.com → **New project** (chọn khu vực gần
   Việt Nam, ví dụ Singapore).
2. Vào **SQL Editor** → dán toàn bộ nội dung file [`supabase-schema.sql`](./supabase-schema.sql)
   → **Run**. Lệnh này tạo các bảng (`measurements`, `manufacturer_standards`,
   `feedback`...) và bật Row Level Security cho phép đọc/ghi bằng anon key (phù
   hợp 1 nhóm nhỏ dùng chung 1 link nội bộ). Đã chạy file này từ trước? Chạy lại
   toàn bộ vẫn an toàn — mọi lệnh đều dùng `if not exists`/`on conflict`, không
   ảnh hưởng dữ liệu đã có, chỉ thêm phần còn thiếu (ví dụ bảng `feedback` mới).
3. Lấy **Project URL** và **anon key** — dashboard Supabase hiện có 2 cách,
   dùng cách nào cũng ra đúng 2 giá trị cần:
   - **Nhanh nhất:** mở trang project → bấm nút **Connect** (thường ở góc trên
     thanh công cụ) → khung hiện ra có sẵn cả **Project URL** và khóa (chọn
     kiểu kết nối bất kỳ, ví dụ "App Frameworks", 2 giá trị đều hiện kèm nút
     copy).
   - **Đầy đủ hơn:** vào **Settings → API Keys** (dashboard mới gộp chung vào
     đây, không còn trang "Settings → API" riêng như trước) — **Project URL**
     hiện ở đầu trang, còn khóa nằm ở tab **Legacy API Keys**, dòng **anon**
     **public** (dự án Supabase mới có thể chỉ hiện "publishable key" thay vì
     "anon key" — 2 tên gọi khác nhau cho cùng 1 loại khóa công khai, dùng
     được như nhau ở đây).
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

### 2c. Dùng Supabase SONG SONG với Google Sheets (bản sao tự động)

Google Sheets vẫn là database **chính** (đăng nhập, phân quyền, mọi thao tác của app). Mỗi lần
lưu/xóa thành công, `gsheet/Code.gs` **tự ghi/xóa theo** bản ghi đó sang bảng cùng tên trên
Supabase: `measurements`, `oil_tests`, `oltc_oil_tests`, `instrument_oil_tests`,
`manufacturer_standards`, `stations`, `regulation_config`, `feedback`. Tài khoản/mật khẩu/phiên
đăng nhập (`users`, `sessions`) **không** được sao chép.

Việc ghi sang Supabase chạy ở **máy chủ Apps Script** bằng *service_role key* cất trong Script
properties. Key này không bao giờ xuống trình duyệt, nên `config.js` **không cần** điền gì về
Supabase và Supabase khóa được hoàn toàn quyền của anon key.

1. Tạo project Supabase (bước 1 mục 2b). Vào **SQL Editor**, chạy lần lượt:
   - [`supabase-schema.sql`](./supabase-schema.sql) (nếu chưa từng chạy, để tạo bảng);
   - [`supabase/mirror-setup.sql`](./supabase/mirror-setup.sql) (bổ sung cột còn thiếu và cột lưu
     vết người nhập/người sửa, bỏ ràng buộc mà Sheets không có, **khóa quyền anon key**).
     Chạy lại nhiều lần vẫn an toàn, không xóa dữ liệu.
2. Supabase Dashboard > **Project Settings > API Keys** > tab **API Keys** > mục **Secret keys** > tạo
   khóa mới (dạng `sb_secret_...`, bí mật, toàn quyền — không dán vào `config.js`, không gửi qua chat).
   Project URL nằm ở **Project Settings > Data API** (dạng `https://<mã>.supabase.co`).
   Sau khi đồng bộ chạy tốt: tab **Legacy API Keys** > **Disable JWT-based API keys** để vô hiệu hóa
   anon key cũ đã lộ trên GitHub (app không còn dùng anon key).
3. Mở dự án Apps Script > **Project Settings** (bánh răng) > **Script properties** > thêm 2 thuộc tính:
   `SUPABASE_URL` = Project URL, `SUPABASE_SERVICE_ROLE_KEY` = khóa `sb_secret_...` (khóa service_role cũ dạng `eyJ...` cũng dùng được).
4. Dán `gsheet/Code.gs` mới vào Apps Script > **Deploy > Manage deployments > New version**.
5. Vào app bằng tài khoản Admin > tab **Quản trị** > khối "Bản sao Supabase" phải báo "Đang bật" >
   bấm **Đồng bộ toàn bộ sang Supabase** để chép dữ liệu cũ. Từ đó trở đi mọi thay đổi tự ghi theo.

Lưu ý:

- Supabase lỗi (mất mạng, sai cột…) **không** làm hỏng thao tác chính trên Google Sheets — lỗi được
  ghi vào sheet `supabase_sync_log` và hiện ở tab Quản trị. Khắc phục xong, bấm lại **Đồng bộ toàn
  bộ** (chép lại mọi dòng và xóa các dòng chỉ còn bên Supabase → Supabase khớp đúng Sheets).
- Chỉ đồng bộ **một chiều** Sheets → Supabase. Sửa trực tiếp trên Supabase sẽ bị ghi đè ở lần đồng
  bộ sau.
- File đính kèm (BBTN, ảnh góp ý) vẫn nằm trên Google Drive; Supabase chỉ lưu đường link.
- Mỗi lần lưu chậm thêm khoảng 0,2–0,5 giây (một lượt gọi Supabase). Bỏ 2 Script properties ở
  bước 3 là tắt đồng bộ ngay.
- **Muốn chuyển hẳn sang Supabase** về sau: chế độ Supabase của app hiện **chưa có đăng nhập/phân
  quyền** (xem cảnh báo ở mục 2b), cần phát triển thêm (Supabase Auth + RLS theo vai trò) trước khi
  xóa `GSHEET_WEBAPP_URL`.

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

**App chạy trực tiếp từ các file dưới đây — không có bước build.** `package.json`, `tests/`,
`scripts/`, `tsconfig.json`, `types.d.ts` chỉ phục vụ phát triển/kiểm thử (xem mục 6), không được
trình duyệt nạp và không bắt buộc phải có để chạy app.

| File / thư mục | Vai trò |
|---|---|
| `index.html` | Giao diện (form nhập liệu, lịch sử, cấu hình tiêu chuẩn NSX, tab Hướng dẫn) |
| `style.css`, `css/*.css` | Giao diện/màu sắc |
| `config.js` | Nơi dán URL Apps Script (Google Sheets) hoặc URL/anon key Supabase (để trống hết = chạy chế độ thử nghiệm) |
| `logic/dga-logic-*.js` | Toàn bộ công thức đánh giá DGA, tách theo miền: `core` (hằng số/bảng ngưỡng dùng chung), `gas` (TCG, Bảng 66, Table A.10, Duval, Bảng 65/63, khuyến cáo, trạng thái tổng thể), `oil`/`instrument-oil` (dầu MBA/OLTC/TI-TU), `forecast` (dự báo xu hướng), `regulation-config` (cơ chế "Cấu hình quy định"), `peer` (so sánh nhóm thiết bị tương tự), `case` (ca tương tự). Không phụ thuộc DOM — nạp và test được trong Node |
| `dga-logic.js` | File **lắp ráp**: gom 8 file `logic/*.js` thành object `DGA` (trình duyệt: `window.DGA`; Node: `module.exports`, dùng để test) |
| `storage.js` | Lớp lưu trữ — tự chuyển giữa Google Sheets, Supabase, và localStorage |
| `ui/ui-errors.js` | Xử lý lỗi tập trung (toast lỗi + handler `error`/`unhandledrejection` toàn cục) — nạp sớm, ngay sau `config.js` |
| `ui/ui-*.js` | Nối giao diện từng tab với `DGA`/`Storage`/`Auth` (đăng nhập, DGA, dầu, lịch sử, xu hướng, cảnh báo, tiêu chuẩn, cấu hình quy định, quản trị, phản hồi, hướng dẫn) |
| `app-core.js` | Lõi khởi động app (nạp dữ liệu, gắn sự kiện dùng chung, bố cục tab) |
| `bbtn/*.js` | Đọc số liệu từ BBTN (PDF)/nhãn thiết bị (ảnh), xuất BBTN và Báo cáo phân tích kỹ thuật (.docx) |
| `supabase-schema.sql` | Script tạo bảng + bật Row Level Security trên Supabase |
| `gsheet/Code.gs` | Script Google Apps Script — dán vào Apps Script Editor của Google Sheet để biến Sheet thành database |
| `mobile/` | Bản giao diện tối ưu cho điện thoại — dùng chung logic với bản web (xem mục 6 và `mobile/README.md`) |
| `user_manual.md` | Hướng dẫn sử dụng cho người dùng cuối — cũng là nguồn của tab "Hướng dẫn" trong app (xem mục 6) |
| `Features-web-app.md` | Danh sách đầy đủ tính năng theo từng tab |

## 5. Giới hạn / lưu ý

- **Bảo mật (cập nhật 10/2026):** `index.html` có thẻ Content Security Policy (chặn script
  inline, chỉ nạp script từ site + cdn.jsdelivr.net/cdnjs/Google) và các thư viện CDN được ghim
  phiên bản + `integrity` (SRI). Khi nâng phiên bản thư viện CDN phải tính lại hash
  (`openssl dgst -sha512 -binary file.js | openssl base64 -A`), khi thêm CDN/backend mới phải bổ
  sung vào CSP. `gsheet/Code.gs` có khóa ghi (LockService), token/mật khẩu tạm sinh ngẫu nhiên an
  toàn, tạm khóa 15 phút sau 5 lần sai mật khẩu, và bắt đổi mật khẩu tạm ở lần đăng nhập đầu —
  sau khi sửa `Code.gs` phải **Deploy > Manage deployments > New version** mới có hiệu lực.

- Đây là công cụ **hỗ trợ tham khảo**, không thay thế nguyên tắc đánh giá tổng
  thể tại Điều 3, QĐ1901 (cần đối chiếu thêm các pha khác, lần đo trước, xu
  hướng vận hành, hướng dẫn nhà sản xuất trước khi kết luận chính thức).
- Bảng 65 (tốc độ sinh khí) chỉ được QĐ1901 quy định chính thức cho MBA/Kháng
  dầu; với TI/thiết bị khác, công cụ vẫn tính nhưng chỉ nên dùng tham khảo,
  trừ khi bạn cấu hình khoảng tốc độ riêng theo nhà sản xuất.
- Tỷ lệ khí (Bảng 66) chỉ có ý nghĩa chẩn đoán khi có ít nhất 1 khí vượt giá
  trị điển hình (Điều 54 QĐ1901/mục 6.1(c) IEC 60599:2022) — công cụ tự ghi
  chú "Điều kiện áp dụng" nhưng vẫn hiển thị mã chẩn đoán để tham khảo.
- Với MBA/Kháng dầu, nhớ tick đúng checkbox **"Ngăn OLTC (thông dầu/khí với
  thùng chính?)"** nếu thiết bị có OLTC và ngăn OLTC đó thông dầu/khí với thùng
  dầu chính — lựa chọn này quyết định bảng IEC Annex A.2.4 Table A.2 nào được
  dùng để tính "tiêu chuẩn chặt hơn". **Với số liệu mặc định hiện tại**, ngưỡng
  C2H2 áp dụng thực tế luôn là 20 ppm ở cả 2 lựa chọn — vì công cụ lấy giá trị
  **chặt hơn (min)** giữa Table A.2 (20 ppm nếu không có OLTC, 280 ppm nếu có
  OLTC thông thùng chính) và QĐ1901 Bảng 64 (20 ppm) — nên tick hay không tick ô
  này *chưa* làm đổi kết quả đánh giá; ô vẫn nên tick đúng thực tế vì được lưu
  cùng lần đo và dùng làm tiêu chí gom nhóm ở "So sánh với nhóm thiết bị tương
  tự" (xem `tests/gas-absolute.test.js`, mục "MBA: với số liệu mặc định...").
- Bảng A.3 (IEC, vận tốc sinh khí theo mL/ngày cho MBA lực) **không được** dùng
  trong công cụ vì cần biết khối lượng/thể tích dầu để quy đổi — công cụ chỉ
  dùng Bảng 65 QĐ1901 (ppm/năm) cho tốc độ sinh khí.
- Tam giác Duval 1 chỉ nên dùng khi CH4+C2H4+C2H2 đủ lớn để có ý nghĩa (vài
  ppm trở lên) — với khí quá thấp, tỷ lệ % có thể dao động mạnh và làm sai
  lệch điểm chẩn đoán. Vùng "D+T" (phần diện tích ngoài D1/D2 nhưng %C2H4 ≤ 50%,
  hoặc %C2H2 &gt; 15% với %C2H4 &gt; 50%) là vùng ranh giới mà bản thân hình vẽ
  gốc IEC 60599:2022 Annex B, Figure B.3 cũng không phân định rõ — công cụ trả
  về mã riêng thay vì gán ép vào D2 hoặc T3.
- Hai đề xuất đã biết **lệch với văn bản gốc IEC 60599:2022 Table 1** (phát hiện
  khi viết bộ kiểm thử — xem `tests/invariants.test.js`, các `test.failing`,
  và mục 6 bên dưới): (1) điểm tỷ số khí chỉ khớp D1 nhưng bị gán nhãn "D1/D2
  vùng chồng lấn"; (2) khi cả 7 khí đều bằng 0 (chưa đo), công cụ vẫn trả về
  mã "T3 - Tăng nhiệt >700°C" thay vì "Không xác định". Chưa sửa code — cần xác
  nhận trước khi đổi hành vi chẩn đoán.

## 6. Công cụ phát triển (kiểm thử, kiểm tra kiểu, đồng bộ bản di động, dựng tab Hướng dẫn)

**Chỉ người phát triển/bảo trì cần mục này.** Người dùng cuối mở `index.html` (hoặc
`mobile/index.html`) chạy thẳng, không cần Node/npm/pandoc gì cả — các công cụ dưới đây không
đổi cách app chạy, chỉ giúp phát hiện lỗi sớm và giữ 2 nguồn (web/di động, code/tài liệu) khớp
nhau khi sửa mã.

```bash
npm install          # lần đầu (cài Jest/TypeScript vào node_modules/, đã có trong .gitignore)
npm test              # chạy toàn bộ kiểm thử tự động
npm run typecheck     # kiểm tra kiểu (TypeScript checkJs) cho lớp logic/
npm run sync-mobile   # đồng bộ mobile/dga-logic.js từ logic/ của bản web
npm run build-guide   # dựng lại tab "Hướng dẫn" trong index.html từ user_manual.md (cần cài pandoc)
```

### 6.1. Kiểm thử tự động (Jest)

Logic DGA (`dga-logic.js` + `logic/*.js`) không phụ thuộc DOM và nạp được trong Node, nên có bộ
kiểm thử tự động ở thư mục `tests/` (~250 test, chạy dưới 3 giây). Bao phủ:

- Đánh giá tuyệt đối từng khí và chọn tiêu chuẩn theo loại thiết bị/nhà sản xuất/ngưỡng loại bỏ.
- Bảng 66 (IEC Table 1), Table A.10 (sứ xuyên), Tam giác Duval 1.
- Tốc độ sinh khí (Bảng 65), Bảng 63 và tỷ lệ bổ sung (Điều 54), trạng thái tổng thể.
- Dầu MBA/OLTC/TI-TU, dự báo xu hướng, cơ chế "Cấu hình quy định".
- So sánh với nhóm thiết bị tương tự (z-score + Isolation Forest) và ca tương tự (cosine similarity).
- Xử lý lỗi tập trung (`ui/ui-errors.js`).
- Các bất biến trên nhiều tổ hợp khí ngẫu nhiên (seed cố định, tái lập được).
- **Thứ tự nạp `<script>` và namespace toàn cục** của cả `index.html` lẫn `mobile/index.html`
  (`tests/load-order.test.js`) — bắt sớm việc 2 file khai báo trùng 1 tên hoặc thiếu file tham chiếu.
- **Bản di động khớp bản web** (mục 6.3) và **tên cột khớp giữa Supabase/Google Sheets**
  (`tests/schema-consistency.test.js`) — 2 backend lệch tên cột thì dữ liệu mất/rỗng khi đổi backend.
- **Tab "Hướng dẫn" khớp `user_manual.md`** (mục 6.4, cần pandoc — tự bỏ qua nếu máy chưa cài).

Số liệu chuẩn (golden) lấy từ văn bản gốc QĐ1901/IEC 60599:2022, không sao chép kết quả từ chính
code. Các trường hợp đã biết là lệch văn bản gốc được ghi bằng `test.failing` trong
`tests/invariants.test.js` (chờ quyết định sửa — xem mục 5).

### 6.2. Kiểm tra kiểu (TypeScript `checkJs`, không đổi ngôn ngữ)

`tsconfig.json` + `types.d.ts` bật `tsc --noEmit --checkJs` cho `logic/*.js` + `dga-logic.js` —
bắt lỗi kiểu (sai tên trường, thiếu khí, `undefined` so sánh với số) ngay lúc viết, **không** thêm
bước build và **không** đổi file `.js` nào (JSDoc trong `logic/*.js` được bổ sung/chỉnh cho khớp
kiểu, code chạy không đổi). `npm run typecheck` chạy sạch (0 lỗi) tính đến lần cập nhật gần nhất.

### 6.3. Đồng bộ logic với bản di động (`scripts/sync-mobile.js`)

Bản di động (`mobile/`) được deploy như 1 thư mục độc lập nên không tham chiếu được
`../logic/...`. `mobile/dga-logic.js` vì vậy **được sinh tự động** bằng cách ghép các file
`logic/*.js` của bản web theo đúng thứ tự nạp trong `index.html` — **không sửa tay file này**.
Sau khi sửa bất kỳ file nào trong `logic/`, chạy `npm run sync-mobile` rồi commit cả 2 thay đổi.
`npm test` tự kiểm tra file đã đồng bộ chưa (`tests/mobile-sync.test.js`) và so kết quả đánh giá
giữa 2 bản trên nhiều bộ số liệu để bảo đảm **cùng số liệu luôn ra cùng kết luận**.

### 6.4. Dựng tab "Hướng dẫn" trong app (`scripts/build-user-guide.js`)

`user_manual.md` là **nguồn duy nhất** của hướng dẫn người dùng. Nội dung tab "Hướng dẫn" trong
`index.html` (giữa 2 dấu `<!-- USER-GUIDE:BEGIN -->` / `<!-- USER-GUIDE:END -->`) được **sinh tự
động** từ file đó — không sửa tay khối HTML này. Sau khi sửa `user_manual.md`, chạy
`npm run build-guide` rồi commit cả 2 thay đổi. Cần cài [pandoc](https://pandoc.org) trên máy
đang cập nhật hướng dẫn (người dùng mở app không cần).
