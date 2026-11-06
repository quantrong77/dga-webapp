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
- **Khung hiển thị Biên bản đối chiếu song song (Split View)**: Kéo-thả hoặc chọn file PDF BBTN tự động mở khung xem tài liệu gốc bên cạnh form nhập liệu để so sánh, xác nhận số liệu trước khi lưu.
- **BBTN dầu 3 pha TI/TU (PTC3/BM.14)**: Nhập PDF hoặc nhập tay chung 1 biên bản cho 3 pha A, B, C; tự tách 3 bản ghi độc lập; đánh giá theo 2 tầng ngưỡng NSX; đối chiếu cột "Trên BBTN" và xuất lại Word.
- **Kiến trúc 3 lớp** (giao diện → dữ liệu → nghiệp vụ, xem mục 4) và **hàng đợi offline**: thao tác lưu lúc mất
  kết nối được giữ trong trình duyệt và tự gửi lên máy chủ khi có mạng lại (cả chế độ máy chủ nội bộ lẫn Google
  Sheets). Service Worker (`sw.js`) lưu sẵn file giao diện sau lần đăng nhập đầu, nên tải lại trang lúc mất mạng
  vẫn mở được app (chạy qua `http://`, không áp dụng khi mở `file://`). Đọc BBTN PDF lúc mất mạng cần đã dùng ít
  nhất 1 lần lúc có mạng.
- *Xem tài liệu chi tiết toàn bộ tính năng và tiện ích tại [docs/huong-dan/Features-web-app.md](./docs/huong-dan/Features-web-app.md).*

> **Lưu ý về nguồn dữ liệu IEC**: các bảng Annex A (A.2, A.6, A.9) và bảng ranh
> giới vùng của Tam giác Duval (Annex B, Figure B.3) được trích trực tiếp và
> chính xác theo số liệu trong bản IEC 60599:2022 do bạn cung cấp. Vùng "D+T"
> nêu trên phản ánh đúng việc chính tài liệu gốc cũng để ngỏ ranh giới này
> (nhãn "D+T" xuất hiện ngay trên hình vẽ gốc) — không phải do công cụ suy
> diễn thêm.

## 1. Ba chế độ lưu trữ

`config.js` **tự chọn** chế độ theo nơi mở app, không cần sửa tay khi đổi môi trường:

| Chế độ | Khi nào | Dữ liệu nằm ở |
|---|---|---|
| **Máy chủ nội bộ (on-premise)** | mở qua `http://localhost`, `127.0.0.1`, IP mạng LAN, hoặc `file:///…/index.html` (gọi `http://localhost:8080/api`) | `data/database.json` + `data/uploads/` trên máy chạy máy chủ. Không gửi request nào ra Internet (Google Sheets / Google Sign-In tắt hẳn) |
| **Google Sheets (online)** | mở qua GitHub Pages hoặc domain công khai | Google Sheet + Google Drive, qua Apps Script `backend/gsheet/Code.gs` (mục 2a) |
| **localStorage + hàng đợi offline** | luôn chạy kèm 2 chế độ trên | bản sao cục bộ trong trình duyệt; thao tác lưu lúc mất kết nối nằm trong hàng đợi và tự gửi lại khi có mạng |

Supabase giữ nguyên code nhưng **không dùng** (chưa có đăng nhập/phân quyền — mục 2b, 2c).

### 1a. Chạy máy chủ nội bộ (on-premise)

Cần [Node.js](https://nodejs.org) (không cần `npm install` để chạy app):

```bash
npm start                  # = node backend/onpremise/serve.js, mặc định cổng 8080 (PORT=xxxx để đổi)
```

Trên Windows: double-click `chay_dga_offline.bat` (tự mở trình duyệt tới `http://localhost:8080`).

- Lần đầu chạy, `backend/onpremise/db.js` tự tạo `data/database.json` rỗng (cấu trúc bảng xem
  `data/database.example.json`). File này chứa tài khoản/`password_hash`/phiên đăng nhập — **không commit, không
  đưa lên Pages** (đã có trong `data/.gitignore`).
- Đặt biến môi trường `DGA_DATA_DIR` để dùng thư mục dữ liệu khác (bộ test dùng cách này).
- Máy chủ **chỉ phục vụ file web theo danh sách cho phép** (`backend/onpremise/static-allowlist.js`, dùng chung
  với bản GitHub Pages); `data/`, `.git/`, `backend/`, `docs/`, `*.md`… trả 404. File đính kèm chỉ tải qua
  `/api/files/…` (có kiểm tra phiên đăng nhập).
- Tệp đính kèm lưu theo mã băm SHA-256 (`data/uploads/<yyyy>/<mm>/<sha8>_<tên>`), cùng nội dung không lưu trùng.
  Gom tệp trùng cũ: `node scripts/dedupe-uploads.js --dry-run` (xem trước) rồi bỏ `--dry-run`.
- Thêm/đổi file web ở gốc dự án → bổ sung `ROOT_FILES` / `ROOT_DIRS` trong `static-allowlist.js`.
- Mở `index.html` bằng `file://` thì 2 chức năng đọc BBTN PDF / tấm nhãn chưa chạy (lỗi #8) — nên mở qua
  `http://localhost:8080`.

## 2. Database dùng chung trên Internet (nhiều máy / nhiều người cùng nhập, cùng xem)

Chế độ online dùng Google Sheets (mục 2a). Mục 2b, 2c về Supabase giữ lại để tham khảo.

### 2a. Google Sheets (đơn giản nhất — chỉ cần tài khoản Google, không cần đăng ký gì thêm)

Dùng **Google Apps Script** để biến 1 Google Sheet thành API đọc/ghi cho web app:

1. Vào https://sheets.google.com → tạo 1 Sheet mới, trống (đặt tên gì cũng được,
   ví dụ "DGA Database").
2. Trong Sheet đó: **Tiện ích mở rộng (Extensions) → Apps Script**.
3. Xóa hết nội dung mẫu trong `Code.gs`, dán toàn bộ nội dung file
   [`backend/gsheet/Code.gs`](./backend/gsheet/Code.gs) (trong repo này) vào, rồi **Lưu** (biểu
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
> Script, dán ĐÈ toàn bộ nội dung `backend/gsheet/Code.gs` mới nhất vào `Code.gs`, Lưu,
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
> Không dùng Supabase thì chạy [`backend/supabase/lockdown-anon.sql`](./backend/supabase/lockdown-anon.sql)
> và vô hiệu hóa anon key cũ (Project Settings > API Keys > tab Legacy API Keys > Disable JWT-based API keys). Muốn có Supabase chạy song song an toàn, dùng cách
> ở **mục 2c** (Code.gs ghi theo phía máy chủ, không cần anon key).

1. Tạo tài khoản tại https://supabase.com → **New project** (chọn khu vực gần
   Việt Nam, ví dụ Singapore).
2. Vào **SQL Editor** → dán toàn bộ nội dung file [`supabase-schema.sql`](./backend/supabase/supabase-schema.sql)
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
lưu/xóa thành công, `backend/gsheet/Code.gs` **tự ghi/xóa theo** bản ghi đó sang bảng cùng tên trên
Supabase: `measurements`, `oil_tests`, `oltc_oil_tests`, `instrument_oil_tests`,
`manufacturer_standards`, `stations`, `regulation_config`, `feedback`. Tài khoản/mật khẩu/phiên
đăng nhập (`users`, `sessions`) **không** được sao chép.

Việc ghi sang Supabase chạy ở **máy chủ Apps Script** bằng *service_role key* cất trong Script
properties. Key này không bao giờ xuống trình duyệt, nên `config.js` **không cần** điền gì về
Supabase và Supabase khóa được hoàn toàn quyền của anon key.

1. Tạo project Supabase (bước 1 mục 2b). Vào **SQL Editor**, chạy lần lượt:
   - [`supabase-schema.sql`](./backend/supabase/supabase-schema.sql) (nếu chưa từng chạy, để tạo bảng);
   - [`backend/supabase/mirror-setup.sql`](./backend/supabase/mirror-setup.sql) (bổ sung cột còn thiếu và cột lưu
     vết người nhập/người sửa, bỏ ràng buộc mà Sheets không có, **khóa quyền anon key**).
     Chạy lại nhiều lần vẫn an toàn, không xóa dữ liệu.
2. Supabase Dashboard > **Project Settings > API Keys** > tab **API Keys** > mục **Secret keys** > tạo
   khóa mới (dạng `sb_secret_...`, bí mật, toàn quyền — không dán vào `config.js`, không gửi qua chat).
   Project URL nằm ở **Project Settings > Data API** (dạng `https://<mã>.supabase.co`).
   Sau khi đồng bộ chạy tốt: tab **Legacy API Keys** > **Disable JWT-based API keys** để vô hiệu hóa
   anon key cũ đã lộ trên GitHub (app không còn dùng anon key).
3. Mở dự án Apps Script > **Project Settings** (bánh răng) > **Script properties** > thêm 2 thuộc tính:
   `SUPABASE_URL` = Project URL, `SUPABASE_SERVICE_ROLE_KEY` = khóa `sb_secret_...` (khóa service_role cũ dạng `eyJ...` cũng dùng được).
4. Dán `backend/gsheet/Code.gs` mới vào Apps Script > **Deploy > Manage deployments > New version**.
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

Trang được deploy bằng GitHub Actions (`.github/workflows/deploy-pages.yml`) mỗi khi push lên `main`:

1. Repo trên GitHub → **Settings → Pages** → Source chọn **GitHub Actions** (không chọn "Deploy from a branch" —
   cách đó đưa cả repo lên Pages).
2. Workflow chạy `node scripts/build-pages-site.js _site`: **chỉ chép file web theo danh sách cho phép**
   (`index.html`, `manifest.webmanifest`, `sw.js`, `config.js`, `src/`, `vendor/`, `assets/image/`, `mobile/`,
   `assets/template/template-*.docx`; trừ `*.md`). **Không** đưa `data/`, `backend/`, `tests/`, `scripts/`,
   `docs/`, `node_modules/` lên. Thiếu file app cần thì script dừng, không deploy.
3. Sau ít phút, trang có tại `https://<tai-khoan-cua-ban>.github.io/<ten-repo>/`.

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

```text
dga-webapp/
├─ index.html, manifest.webmanifest, sw.js, config.js   # bắt buộc ở gốc (GitHub Pages + phạm vi Service Worker)
├─ src/
│  ├─ domain/          # LỚP NGHIỆP VỤ — thuần JS: không DOM, không lưu trữ, không fetch
│  ├─ data/            # LỚP DỮ LIỆU — storage.js (facade window.Storage/Auth), drivers/, io/ (đọc/xuất BBTN)
│  └─ presentation/    # LỚP GIAO DIỆN — app-*.js, tabs/ (1 file/1 tab), components/, styles/ (tokens.css trước)
├─ backend/
│  ├─ onpremise/       # máy chủ nội bộ: serve.js, api.js, auth.js, db.js, uploads.js, static-allowlist.js
│  ├─ gsheet/          # Code.gs (Google Apps Script)
│  └─ supabase/        # *.sql (giữ lại, không dùng)
├─ assets/             # image/, template/ (mẫu BBTN template-*.docx)
├─ vendor/             # thư viện bên thứ ba
├─ mobile/             # bản điện thoại — mobile/dga-logic.js SINH TỰ ĐỘNG (npm run sync-mobile)
├─ data/               # dữ liệu on-premise (KHÔNG commit, KHÔNG deploy)
├─ scripts/  tests/  docs/
```

**Quy tắc phụ thuộc giữa các lớp:** `presentation → data → domain` (giao diện được gọi thẳng `DGA` để tính toán).
`domain` không gọi 2 lớp kia; `data` không chạm DOM, không gọi `showToast` (báo lỗi bằng `throw`/sự kiện).
`tests/architecture.test.js` và ESLint (`no-restricted-globals` theo thư mục) chặn vi phạm. Chi tiết:
[`docs/refactor/ARCHITECTURE.md`](./docs/refactor/ARCHITECTURE.md).

**Không có bước build và không dùng ES module cho script thường** (trừ 2 module đọc BBTN/tấm nhãn): ~60 file dùng
chung phạm vi toàn cục, **thứ tự `<script>` trong `index.html` là thứ tự phụ thuộc** (`tests/load-order.test.js`
kiểm tra). Đổi đường dẫn file nào thì cập nhật đồng thời `index.html`, danh sách precache và **tên cache** trong
`sw.js` (tên cache còn xuất hiện trong 1 script inline của `index.html`), `scripts/sync-mobile.js`,
`static-allowlist.js` nếu là thư mục gốc mới.

| File / thư mục | Vai trò |
|---|---|
| `index.html` | Giao diện (form nhập liệu, lịch sử, cấu hình tiêu chuẩn NSX, tab Hướng dẫn) |
| `config.js` | Tự chọn chế độ lưu trữ theo nơi mở app (mục 1) |
| `src/domain/dga-logic-*.js` | Toàn bộ công thức đánh giá DGA, tách theo miền: `core` (hằng số/bảng ngưỡng dùng chung), `gas` (TCG, Bảng 66, Table A.10, Duval, Bảng 65/63, khuyến cáo, trạng thái tổng thể), `oil`/`oil-extended`/`iec60422-2024`/`instrument-oil` (dầu MBA/OLTC/TI-TU), `forecast` (dự báo xu hướng), `regulation-config` (cơ chế "Cấu hình quy định"), `peer` (so sánh nhóm thiết bị tương tự), `case` (ca tương tự). Không phụ thuộc DOM — nạp và test được trong Node |
| `src/domain/dga-logic.js` | File **lắp ráp**: gom các file `src/domain/*.js` thành object `DGA` (trình duyệt: `window.DGA`; Node: `module.exports`, dùng để test) |
| `src/data/storage.js` | Facade `window.Storage` / `window.Auth` — API giữ nguyên cho giao diện |
| `src/data/drivers/` | `storage-core` (chọn chế độ), `storage-repo` (khuôn CRUD chung theo thực thể), `storage-remote` (máy chủ nội bộ / Google Sheets), `storage-local` (localStorage), `storage-offline` (hàng đợi đồng bộ), `storage-auth` (đăng nhập/phiên) |
| `src/data/io/*.js` | Đọc số liệu từ BBTN (PDF/DOCX)/nhãn thiết bị (ảnh), xuất BBTN và Báo cáo phân tích kỹ thuật (.docx). `oil-bbtn.js`: BBTN dầu 3 pha chung 1 biên bản (điền `assets/template/template-bbtn-dau-3pha.docx`, giao diện ở `src/presentation/tabs/ui-ti-oil-3pha.js`) |
| `src/presentation/app-core.js`, `app-views.js`, `app-status.js`, `early-layout.js` | Khởi động app / chuyển chế độ xem / badge trạng thái kết nối / bố cục sớm (tránh nháy giao diện) |
| `src/presentation/tabs/ui-*.js` | Nối giao diện từng tab với `DGA`/`Storage`/`Auth` (đăng nhập, DGA, dầu, lịch sử, xu hướng, cảnh báo, tiêu chuẩn, cấu hình quy định, quản trị, phản hồi, hướng dẫn) |
| `src/presentation/components/` | Thành phần dùng chung: `ui-errors.js` (xử lý lỗi tập trung, nạp sớm ngay sau `config.js`), combobox, ô kéo-thả file, chỉ báo đang xử lý, giao diện sáng/tối, ARIA tab/hộp thoại… |
| `src/presentation/styles/` | CSS: `tokens.css` (design tokens: màu theo vai trò, khoảng cách, cỡ chữ, bo góc, đổ bóng, z-index; giao diện tối) nạp đầu tiên, rồi base → components → từng tab |
| `backend/onpremise/` | Máy chủ nội bộ không phụ thuộc thư viện ngoài (mục 1a) |
| `backend/gsheet/Code.gs` | Script Google Apps Script — dán vào Apps Script Editor của Google Sheet để biến Sheet thành database |
| `backend/supabase/*.sql` | Script Supabase (giữ lại, đang không dùng) |
| `scripts/build-pages-site.js` | Dựng thư mục `_site/` cho GitHub Pages theo danh sách cho phép (mục 3) |
| `mobile/` | Bản giao diện tối ưu cho điện thoại — dùng chung logic với bản web (xem mục 6 và `mobile/README.md`) |
| `docs/refactor/` | Hồ sơ tái cấu trúc: kiến trúc, mốc chuẩn, lỗi phát hiện, thay đổi UX, báo cáo kiểm thử, ảnh trước/sau |
| `docs/huong-dan/user_manual.md` | Hướng dẫn sử dụng cho người dùng cuối — cũng là nguồn của tab "Hướng dẫn" trong app (xem mục 6) |
| `docs/huong-dan/Features-web-app.md` | Danh sách đầy đủ tính năng theo từng tab |
| `docs/huong-dan/KNOWLEDGE.md` | Kiến thức nền & kiến trúc chi tiết cho người phát triển |
| `docs/quy-dinh/` | Văn bản QĐ1901 (`QD1901.md`), Điều 54 (`Dieu54_QD1901.md`) |
| `docs/spec/` | Đặc tả thiết kế theo module |
| `docs/assets/` | Ảnh gốc dung lượng lớn (app dùng bản `.webp` trong `assets/image/`) |

## 5. Giới hạn / lưu ý

- **Bảo mật (cập nhật 10/2026):** `index.html` có thẻ Content Security Policy (chặn script
  inline, chỉ nạp script từ site + cdn.jsdelivr.net/cdnjs/Google) và các thư viện CDN được ghim
  phiên bản + `integrity` (SRI). Khi nâng phiên bản thư viện CDN phải tính lại hash
  (`openssl dgst -sha512 -binary file.js | openssl base64 -A`), khi thêm CDN/backend mới phải bổ
  sung vào CSP. `backend/gsheet/Code.gs` có khóa ghi (LockService), token/mật khẩu tạm sinh ngẫu nhiên an
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
`mobile/index.html`) chạy thẳng (chế độ máy chủ nội bộ chỉ cần Node.js, mục 1a) — các công cụ dưới
đây không đổi cách app chạy, chỉ giúp phát hiện lỗi sớm và giữ 2 nguồn (web/di động, code/tài liệu)
khớp nhau khi sửa mã.

```bash
npm install               # lần đầu (Jest, TypeScript, ESLint, Stylelint, Prettier, axe-core vào node_modules/)
npm start                 # chạy máy chủ nội bộ (mục 1a)
npm test                  # chạy toàn bộ kiểm thử tự động (Jest)
npm run typecheck         # kiểm tra kiểu (TypeScript checkJs) cho src/domain/ và một phần src/data/
npm run lint              # ESLint (kể cả quy tắc ranh giới 3 lớp); npm run lint:fix để tự sửa
npm run lint:css          # Stylelint cho src/presentation/styles/; npm run lint:css:fix để tự sửa
npm run format -- <file>  # Prettier cho file vừa sửa
npm run sync-mobile       # đồng bộ mobile/dga-logic.js từ src/domain/ của bản web
npm run build-guide       # dựng lại tab "Hướng dẫn" trong index.html từ docs/huong-dan/user_manual.md
```

**Cổng kiểm thử trước mỗi commit** — tất cả phải đạt (ESLint/Stylelint hiện 0 lỗi, 0 cảnh báo; không được tăng):

```bash
npm test && npm run typecheck && npm run lint && npm run lint:css \
  && npm run sync-mobile:check && npm run build-guide:check
```

### 6.1. Kiểm thử tự động (Jest)

Logic DGA (`src/domain/*.js`) không phụ thuộc DOM và nạp được trong Node, nên có bộ
kiểm thử tự động ở thư mục `tests/` (~740 test). Bao phủ:

- Đánh giá tuyệt đối từng khí và chọn tiêu chuẩn theo loại thiết bị/nhà sản xuất/ngưỡng loại bỏ.
- Bảng 66 (IEC Table 1), Table A.10 (sứ xuyên), Tam giác Duval 1.
- Tốc độ sinh khí (Bảng 65), Bảng 63 và tỷ lệ bổ sung (Điều 54), trạng thái tổng thể.
- Dầu MBA/OLTC/TI-TU, dự báo xu hướng, cơ chế "Cấu hình quy định".
- So sánh với nhóm thiết bị tương tự (z-score + Isolation Forest) và ca tương tự (cosine similarity).
- Xử lý lỗi tập trung (`src/presentation/components/ui-errors.js`).
- Các bất biến trên nhiều tổ hợp khí ngẫu nhiên (seed cố định, tái lập được).
- **Thứ tự nạp `<script>` và namespace toàn cục** của cả `index.html` lẫn `mobile/index.html`
  (`tests/load-order.test.js`) — bắt sớm việc 2 file khai báo trùng 1 tên hoặc thiếu file tham chiếu.
- **Bản di động khớp bản web** (mục 6.3) và **tên cột khớp giữa Supabase/Google Sheets**
  (`tests/schema-consistency.test.js`) — 2 backend lệch tên cột thì dữ liệu mất/rỗng khi đổi backend.
- **Tab "Hướng dẫn" khớp `docs/huong-dan/user_manual.md`** (mục 6.4).
- **Ranh giới 3 lớp** (`tests/architecture.test.js`), **lớp lưu trữ** `window.Storage` ở các chế độ, **hàng đợi
  đồng bộ** gửi đúng lên Google Sheets / máy chủ nội bộ (`tests/sync-queue-modes.test.js`), **máy chủ nội bộ chỉ
  phục vụ file trong danh sách cho phép** (`tests/onpremise-static.test.js`, gọi HTTP thật), artifact GitHub Pages
  (`tests/pages-site.test.js`), lưu tệp đính kèm không trùng (`tests/uploads-dedupe.test.js`).

Số liệu chuẩn (golden) lấy từ văn bản gốc QĐ1901/IEC 60599:2022, không sao chép kết quả từ chính
code. Các trường hợp đã biết là lệch văn bản gốc được ghi bằng `test.failing` trong
`tests/invariants.test.js` (chờ quyết định sửa — xem mục 5).

### 6.2. Kiểm tra kiểu (TypeScript `checkJs`, không đổi ngôn ngữ)

`tsconfig.json` + `types.d.ts` bật `tsc --noEmit --checkJs` cho `src/domain/*.js` —
bắt lỗi kiểu (sai tên trường, thiếu khí, `undefined` so sánh với số) ngay lúc viết, **không** thêm
bước build và **không** đổi file `.js` nào (JSDoc trong `src/domain/*.js` được bổ sung/chỉnh cho khớp
kiểu, code chạy không đổi). `npm run typecheck` chạy sạch (0 lỗi) tính đến lần cập nhật gần nhất.

### 6.3. Đồng bộ logic với bản di động (`scripts/sync-mobile.js`)

Bản di động (`mobile/`) được deploy như 1 thư mục độc lập nên không tham chiếu được
`../logic/...`. `mobile/dga-logic.js` vì vậy **được sinh tự động** bằng cách ghép các file
`src/domain/*.js` của bản web theo đúng thứ tự nạp trong `index.html` — **không sửa tay file này**.
Sau khi sửa bất kỳ file nào trong `src/domain/`, chạy `npm run sync-mobile` rồi commit cả 2 thay đổi.
`npm test` tự kiểm tra file đã đồng bộ chưa (`tests/mobile-sync.test.js`) và so kết quả đánh giá
giữa 2 bản trên nhiều bộ số liệu để bảo đảm **cùng số liệu luôn ra cùng kết luận**.

### 6.4. Dựng tab "Hướng dẫn" trong app (`scripts/build-user-guide.js`)

`docs/huong-dan/user_manual.md` là **nguồn duy nhất** của hướng dẫn người dùng. Nội dung tab "Hướng dẫn" trong
`index.html` (giữa 2 dấu `<!-- USER-GUIDE:BEGIN -->` / `<!-- USER-GUIDE:END -->`) được **sinh tự
động** từ file đó — không sửa tay khối HTML này. Sau khi sửa `docs/huong-dan/user_manual.md`, chạy
`npm run build-guide` rồi commit cả 2 thay đổi. Dùng bộ chuyển Markdown → HTML viết sẵn bằng JavaScript
(`scripts/md-to-html.js`), **không cần pandoc**, nên kết quả giống hệt nhau trên mọi máy.
