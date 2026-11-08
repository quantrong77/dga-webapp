# Hướng dẫn triển khai database riêng cho đơn vị (Google Sheets + Google Drive)

> **Dành cho:** cán bộ được đơn vị giao quản trị ứng dụng DGA-Webapp (không cần biết lập trình; cần thao tác được trên Google Sheets, Google Drive và GitHub).
> **Kết quả sau khi làm xong:** đơn vị có **database riêng** (Google Sheet + thư mục BBTN trên Google Drive), **trang web riêng** trỏ vào database đó và **tài khoản Admin** của đơn vị. Dữ liệu của đơn vị không lẫn với dữ liệu của đơn vị khác.
> **Thời gian:** khoảng 30–45 phút cho lần đầu.

---

## Mục lục

1. [Hiểu nhanh cách ứng dụng lưu dữ liệu](#1-hiểu-nhanh-cách-ứng-dụng-lưu-dữ-liệu)
2. [Chọn tài khoản Google sở hữu database](#2-chọn-tài-khoản-google-sở-hữu-database)
3. [Bước 1 — Tạo Google Sheet và gắn mã máy chủ (Apps Script)](#3-bước-1--tạo-google-sheet-và-gắn-mã-máy-chủ-apps-script)
4. [Bước 2 — Triển khai (Deploy) thành Web app](#4-bước-2--triển-khai-deploy-thành-web-app)
5. [Bước 3 — Tạo trang web riêng của đơn vị trỏ vào database](#5-bước-3--tạo-trang-web-riêng-của-đơn-vị-trỏ-vào-database)
6. [Bước 4 — Tạo tài khoản Admin và mời người dùng](#6-bước-4--tạo-tài-khoản-admin-và-mời-người-dùng)
7. [Dùng chung database cho nhiều tổ/đội trong cùng đơn vị](#7-dùng-chung-database-cho-nhiều-tổđội-trong-cùng-đơn-vị)
8. [Cập nhật phiên bản mới, sao lưu, bàn giao](#8-cập-nhật-phiên-bản-mới-sao-lưu-bàn-giao)
9. [Bảo mật — những điều bắt buộc nhớ](#9-bảo-mật--những-điều-bắt-buộc-nhớ)
10. [Xử lý sự cố thường gặp](#10-xử-lý-sự-cố-thường-gặp)
11. [Phương án không dùng Google: máy chủ nội bộ](#11-phương-án-không-dùng-google-máy-chủ-nội-bộ)

---

## 1. Hiểu nhanh cách ứng dụng lưu dữ liệu

Ứng dụng có hai phần tách rời:

| Phần | Nằm ở đâu | Vai trò |
| --- | --- | --- |
| **Trang web** (giao diện + toàn bộ thuật toán đánh giá) | GitHub Pages (hoặc máy chủ web bất kỳ) | Người dùng mở bằng trình duyệt |
| **Database** | Một **Google Sheet** + thư mục **`DGA_BBTN_DinhKem`** trên Google Drive của tài khoản triển khai | Lưu lần đo, kết quả dầu, người dùng, cấu hình, file BBTN đính kèm |

Trang web biết database ở đâu nhờ **một đường link Web app** (dạng `https://script.google.com/macros/s/AKfycb…/exec`) ghi trong file **`config.js`**. Vì link này được ghi cố định trong trang web, **mỗi database cần một trang web riêng**. Do đó, để có database riêng, đơn vị phải làm đủ cả hai phần: tạo database (Bước 1, 2) **và** tạo trang web riêng trỏ vào nó (Bước 3).

Toàn bộ các bảng (sheet con) và cột được **mã máy chủ tự tạo** ở lần dùng đầu tiên — không cần tạo tay.

---

## 2. Chọn tài khoản Google sở hữu database

Tài khoản Google dùng ở Bước 1–2 sẽ **sở hữu** Google Sheet, thư mục BBTN, và là tài khoản mà mã máy chủ "chạy dưới quyền". Nếu tài khoản này bị xóa/khóa/mất quyền, ứng dụng của đơn vị ngừng hoạt động.

| Phương án | Ưu điểm | Nhược điểm | Khuyến nghị |
| --- | --- | --- | --- |
| **A. Tài khoản Google dùng chung của đơn vị** (ví dụ `dga.tentruyentai@gmail.com`, tạo mới, chỉ dùng cho ứng dụng) | Không phụ thuộc cá nhân; bàn giao dễ (chỉ cần bàn giao mật khẩu + xác minh 2 bước); dung lượng 15 GB miễn phí riêng cho BBTN | Cần quy định người giữ mật khẩu | **Nên dùng** |
| **B. Tài khoản Google cá nhân của cán bộ quản trị** | Làm nhanh | Cán bộ chuyển công tác/nghỉ → phải triển khai lại, **đổi link**, cập nhật trang web; BBTN chiếm dung lượng Drive cá nhân | Chỉ dùng thử nghiệm |
| **C. Tài khoản Google Workspace của tổ chức** (nếu đơn vị có) | Quản lý tập trung theo chính sách tổ chức | Quản trị Workspace có thể chặn chia sẻ file "Bất kỳ ai có đường liên kết" hoặc chặn Apps Script → cần nhờ quản trị Workspace cho phép (xem mục 10) | Dùng được nếu Workspace cho phép |

Với phương án A:

1. Tạo tài khoản Gmail mới cho đơn vị.
2. **Bật xác minh 2 bước** (Google Account → Bảo mật), thêm số điện thoại/email khôi phục của đơn vị.
3. Lập biên bản/ghi nhận người giữ mật khẩu; khi người đó chuyển công tác thì bàn giao lại.

> Mọi bước dưới đây làm khi **đang đăng nhập đúng tài khoản đã chọn**. Nếu trình duyệt đăng nhập nhiều tài khoản Google, nên dùng một cửa sổ trình duyệt/hồ sơ riêng chỉ đăng nhập tài khoản này — Apps Script dễ nhầm tài khoản khi có nhiều tài khoản cùng đăng nhập.

---

## 3. Bước 1 — Tạo Google Sheet và gắn mã máy chủ (Apps Script)

Chuẩn bị: file mã nguồn ứng dụng (file zip `DGA-Webapp_ma_nguon_….zip`), giải nén ra một thư mục.

1. Mở <https://sheets.google.com> → tạo **Bảng tính trống** → đặt tên, ví dụ `DGA Database – Truyền tải điện X`.
2. Trong Sheet vừa tạo: menu **Tiện ích mở rộng (Extensions) → Apps Script**. Một tab mới mở ra (dự án Apps Script **gắn với chính Sheet này** — bắt buộc phải mở từ trong Sheet, không tạo dự án rời ở script.google.com).
3. Đặt tên dự án (góc trên bên trái), ví dụ `DGA Server`.
4. Ở file `Code.gs` trong trình soạn thảo: **xóa hết** đoạn mẫu `function myFunction() {…}`.
5. Mở file `backend/gsheet/Code.gs` trong thư mục mã nguồn đã giải nén (bằng Notepad/VS Code), **chọn tất cả → sao chép → dán** vào trình soạn thảo.
6. **Sửa 3 dòng cấu hình** ở đầu file (dùng Ctrl+F để tìm):

   ```js
   const ADMIN_EMAIL = "email-admin-cua-don-vi@gmail.com";   // ← email sẽ tự thành Admin khi đăng ký
   const REGISTRATION_MODE = "open";                          // ← để "open" lúc mới cài; xem mục 6
   const GOOGLE_CLIENT_ID = "";                               // ← để TRỐNG (không dùng nút "Đăng nhập bằng Google")
   ```

   - `ADMIN_EMAIL`: **bắt buộc đổi** sang email của người quản trị đơn vị (không để email của tác giả). Email này không cần là tài khoản sở hữu Sheet; đó là email sẽ dùng để đăng ký tài khoản Admin trong ứng dụng.
   - `GOOGLE_CLIENT_ID`: để `""`. Người dùng đăng nhập bằng email + mật khẩu của ứng dụng. (Muốn bật đăng nhập bằng Google cần tạo OAuth Client ID riêng trên Google Cloud Console — không cần thiết, không hướng dẫn ở đây.)
7. Bấm biểu tượng **Lưu** (đĩa mềm) hoặc Ctrl+S.

---

## 4. Bước 2 — Triển khai (Deploy) thành Web app

1. Trong trình soạn thảo Apps Script: **Triển khai (Deploy) → Tùy chọn triển khai mới (New deployment)**.
2. Bấm biểu tượng bánh răng cạnh "Chọn loại" → chọn **Ứng dụng web (Web app)**.
3. Điền:
   - **Mô tả:** ví dụ `v1`.
   - **Thực thi dưới dạng (Execute as):** **Tôi (Me)** — tài khoản đã chọn ở mục 2.
   - **Người có quyền truy cập (Who has access):** **Bất kỳ ai (Anyone)**.
     Bắt buộc chọn "Anyone" để trang web gọi được. Dữ liệu **vẫn được bảo vệ**: mọi thao tác đọc/ghi đều phải có phiên đăng nhập hợp lệ của ứng dụng và đúng quyền (xem mục 9).
4. Bấm **Triển khai (Deploy)** → **Cấp quyền truy cập (Authorize access)** → chọn đúng tài khoản.
   - Google sẽ cảnh báo *"Google chưa xác minh ứng dụng này"* vì đây là script tự viết. Bấm **Nâng cao (Advanced)** → **Đi tới DGA Server (không an toàn)** → **Cho phép (Allow)**. Quyền được xin gồm Google Sheets (đọc/ghi Sheet này) và Google Drive (tạo thư mục, lưu file BBTN).
5. Sao chép **URL ứng dụng web (Web app URL)** dạng `https://script.google.com/macros/s/AKfycb…/exec` — **ghi lại**, dùng ở Bước 3.
6. Kiểm tra nhanh: dán link sau vào thanh địa chỉ trình duyệt (thay link của đơn vị):

   ```text
   https://script.google.com/macros/s/AKfycb…/exec?action=registrationInfo
   ```

   Thấy `{"mode":"open","domain":""}` là máy chủ đã chạy đúng. Nếu hiện trang yêu cầu đăng nhập Google → bước 3 chưa chọn "Anyone", làm lại (mục 10).
7. Ghi lại thêm **link Google Sheet** (thanh địa chỉ của tab Sheet, dạng `https://docs.google.com/spreadsheets/d/…/edit`) — dùng ở Bước 3 để Admin bấm mở nhanh database từ ứng dụng.

> Thư mục **`DGA_BBTN_DinhKem`** (BBTN đính kèm) và **`DGA_Feedback_DinhKem`** (ảnh góp ý) được **tự tạo** trong "Drive của tôi" của tài khoản triển khai khi có người tải file lên lần đầu. Không đổi tên hai thư mục này — ứng dụng tìm chúng theo tên.

---

## 5. Bước 3 — Tạo trang web riêng của đơn vị trỏ vào database

### 5.1. Sửa `config.js`

Mở file `config.js` (thư mục gốc của mã nguồn), tìm khối `: {  DEPLOY_MODE: "online", …}` và sửa **3 dòng**:

```js
    : {
        DEPLOY_MODE: "online",
        LOCAL_SERVER_URL: "",
        GSHEET_WEBAPP_URL: "https://script.google.com/macros/s/AKfycb…/exec",          // ← Web app URL ở Bước 2
        GSHEET_SHEET_URL: "https://docs.google.com/spreadsheets/d/…/edit",            // ← link Google Sheet ở Bước 2
        SUPABASE_URL: "",
        SUPABASE_ANON_KEY: "",
        GOOGLE_CLIENT_ID: "",                                                         // ← để TRỐNG, khớp với Code.gs
      };
```

> **Lưu ý:** `GOOGLE_CLIENT_ID` trong `config.js` phải **giống** trong `Code.gs`. Bản mã nguồn gốc có sẵn Client ID của trang tác giả — **phải xóa thành `""`**, nếu không nút "Đăng nhập bằng Google" vẫn hiện nhưng bấm sẽ báo lỗi.
>
> Không sửa khối phía trên (`DEPLOY_MODE: "on-premise"`) — khối đó dành cho chế độ máy chủ nội bộ.

### 5.2. Đưa trang web lên GitHub Pages (miễn phí)

1. Tạo tài khoản <https://github.com> (nên dùng chính email Google của đơn vị ở mục 2).
2. Tạo repository mới (**New repository**), ví dụ tên `dga-webapp`, chọn **Public** (GitHub Pages miễn phí yêu cầu repo Public; trong mã nguồn **không có** dữ liệu, mật khẩu hay khóa bí mật nào — dữ liệu nằm trong Google Sheet).
3. Đưa toàn bộ mã nguồn đã giải nén (kể cả thư mục ẩn **`.github`**) lên repository. Cách dễ nhất là dùng **GitHub Desktop**: *File → Add local repository* (hoặc *New repository* trỏ vào thư mục mã nguồn) → *Commit to main* → *Publish repository*. Có thể dùng lệnh git:

   ```bash
   cd DGA-Webapp
   git init -b main
   git add .
   git commit -m "Trien khai DGA-Webapp cho don vi"
   git remote add origin https://github.com/<tai-khoan>/dga-webapp.git
   git push -u origin main
   ```

   > Tải lên bằng nút "Upload files" trên trang GitHub **không** nên dùng: dễ bỏ sót thư mục ẩn `.github` (chứa quy trình tự đưa trang lên Pages).
4. Trong repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
5. Vào tab **Actions**: quy trình *Deploy static app to GitHub Pages* tự chạy (2–3 phút). Khi có dấu ✓ xanh, trang web có tại:

   ```text
   https://<tai-khoan>.github.io/dga-webapp/
   ```

6. Mở trang này → màn hình đăng nhập hiện ra là đã kết nối được database.

Mỗi lần sửa `config.js` (hoặc cập nhật mã nguồn mới) và đẩy lên nhánh `main`, trang tự cập nhật sau vài phút. Người dùng bấm **Ctrl+F5** để tải bản mới.

> Có thể đặt trang web ở máy chủ web khác (máy chủ nội bộ có tên miền công khai, hosting tĩnh…) thay GitHub Pages: chỉ cần chép các file web lên — lệnh `node scripts/build-pages-site.js _site` tạo sẵn thư mục `_site` chỉ gồm các file cần đưa lên.

---

## 6. Bước 4 — Tạo tài khoản Admin và mời người dùng

1. Mở trang web của đơn vị → **Đăng ký** → dùng **đúng email đã ghi ở `ADMIN_EMAIL`** + mật khẩu mạnh (≥ 6 ký tự, nên ≥ 12). Tài khoản này tự động có quyền **Admin**.
2. Mở Google Sheet: các sheet con (`users`, `sessions`, `measurements`, `oil_tests`, …) đã được tạo tự động kèm tiêu đề cột.
3. Chọn cách cấp tài khoản cho người dùng, sửa `REGISTRATION_MODE` trong `Code.gs`:

   | Giá trị | Ý nghĩa | Khi nào dùng |
   |---|---|---|
   | `"open"` | Ai có link trang web cũng tự đăng ký được (quyền mặc định: User) | Chỉ trong thời gian đầu, khi mời mọi người đăng ký |
   | `"domain"` + `ALLOWED_EMAIL_DOMAIN = "tenmien.vn"` | Chỉ email đúng tên miền tự đăng ký được | Đơn vị dùng email theo tên miền riêng |
   | `"closed"` | Không ai tự đăng ký; Admin tạo tài khoản ở **Quản trị → Người dùng** và gửi mật khẩu tạm (người dùng bị bắt đổi ở lần đăng nhập đầu) | **Khuyến nghị** khi đã vận hành ổn định |

   Sau khi sửa `Code.gs` phải **triển khai phiên bản mới** (mục 8.1) mới có hiệu lực.
4. Phân quyền trong **Quản trị → Người dùng**:
   - **Admin:** cấu hình ngưỡng/tiêu chuẩn, quản lý người dùng, xóa dữ liệu.
   - **User:** nhập lần đo mới, chỉ sửa được bản ghi do mình nhập.
   - **Viewer:** chỉ xem, gửi góp ý.
5. Gửi cho người dùng: link trang web + tài khoản (hoặc hướng dẫn tự đăng ký) + tài liệu *Hướng dẫn sử dụng* (có sẵn trong tab **Hướng dẫn** của ứng dụng).

---

## 7. Dùng chung database cho nhiều tổ/đội trong cùng đơn vị

Một database phục vụ được nhiều tổ/đội, nhiều trạm cùng lúc — đây là cách làm **khuyến nghị** để đơn vị có một "kho dữ liệu chung":

- **Chỉ triển khai một lần** (Bước 1–3) bằng tài khoản Google dùng chung của đơn vị (mục 2, phương án A).
- Mọi người dùng chung **một link trang web**, mỗi người **một tài khoản ứng dụng riêng** (mục 6). Mọi lần nhập/sửa đều được ghi người nhập, người sửa và thời điểm.
- File BBTN của tất cả mọi người được lưu tập trung trong thư mục `DGA_BBTN_DinhKem` của tài khoản đơn vị.
- **Không cần** chia sẻ Google Sheet cho người dùng. Người dùng làm việc hoàn toàn qua trang web; quyền được kiểm soát bởi vai trò Admin/User/Viewer.
- Nếu muốn có thêm người cùng quản lý database (dự phòng khi người giữ tài khoản vắng mặt), chia sẻ Google Sheet ở quyền **Người chỉnh sửa** cho **tối đa 1–2 Admin tin cậy** — xem cảnh báo ở mục 9.

**Tách riêng theo đơn vị:** mỗi đơn vị (ví dụ mỗi Truyền tải điện khu vực) làm lại toàn bộ hướng dẫn này bằng tài khoản Google của mình → có Sheet, thư mục BBTN, link Web app và trang web riêng. Hai đơn vị không xem được dữ liệu của nhau.

**Google Shared Drive (Drive dùng chung của Google Workspace):** có thể đặt Google Sheet trong Shared Drive, nhưng thư mục BBTN vẫn được tạo trong "Drive của tôi" của tài khoản triển khai (Execute as: Me). Phương án này chưa được kiểm thử đầy đủ; nếu không có yêu cầu bắt buộc, dùng phương án tài khoản dùng chung (A).

---

## 8. Cập nhật phiên bản mới, sao lưu, bàn giao

### 8.1. Khi có phiên bản ứng dụng mới

Cần cập nhật **cả hai phần** nếu bản mới có thay đổi `Code.gs`:

1. **Mã máy chủ:** mở Sheet → *Tiện ích mở rộng → Apps Script* → dán đè toàn bộ `backend/gsheet/Code.gs` mới → **sửa lại 3 dòng cấu hình** ở Bước 1 mục 6 (`ADMIN_EMAIL`, `REGISTRATION_MODE`, `GOOGLE_CLIENT_ID`) → Lưu →
   **Triển khai → Quản lý các bản triển khai (Manage deployments)** → bấm biểu tượng **bút chì** ở bản đang dùng → **Phiên bản: Phiên bản mới (New version)** → **Triển khai**.
   - Làm đúng cách này thì **link Web app giữ nguyên**, không phải sửa `config.js`.
   - Chỉ bấm Lưu trong trình soạn thảo **không** làm bản đang chạy thay đổi.
   - **Không** tạo "Tùy chọn triển khai mới" (New deployment) — sẽ sinh link khác.
2. **Trang web:** chép đè mã nguồn mới vào repository, **giữ lại `config.js` của đơn vị** (hoặc sửa lại 3 dòng ở mục 5.1), commit và push lên `main`.

Cột mới (nếu có) được mã máy chủ tự thêm vào cuối sheet tương ứng, dữ liệu cũ giữ nguyên.

### 8.2. Sao lưu

- Định kỳ (ví dụ hàng tháng): mở Google Sheet → *Tệp → Tải xuống → Microsoft Excel (.xlsx)*, lưu vào nơi lưu trữ của đơn vị.
- Google Sheet có **Lịch sử phiên bản** (*Tệp → Lịch sử phiên bản*) để khôi phục khi lỡ xóa/sửa nhầm.
- Thư mục `DGA_BBTN_DinhKem`: có thể tải xuống cả thư mục (Google Drive → chuột phải → Tải xuống).
- Không sửa/xóa tay dữ liệu trong Sheet khi không thật cần thiết; nếu phải sửa, **không đổi tên sheet, không đổi tiêu đề cột, không chèn cột giữa**.

### 8.3. Bàn giao / đổi tài khoản sở hữu

- **Phương án A** (tài khoản dùng chung): chỉ cần bàn giao mật khẩu và phương thức xác minh 2 bước; không phải làm lại gì.
- **Đổi sang tài khoản Google khác:** chuyển quyền sở hữu Google Sheet và thư mục BBTN cho tài khoản mới → đăng nhập tài khoản mới → mở Apps Script → **Triển khai mới** (Execute as: Me = tài khoản mới) → link Web app **thay đổi** → sửa `GSHEET_WEBAPP_URL` trong `config.js` và đẩy lại trang web. Người dùng phải đăng nhập lại.

---

## 9. Bảo mật — những điều bắt buộc nhớ

1. **Không chia sẻ Google Sheet rộng rãi.** Sheet chứa sheet `users` (mật khẩu đã băm) và `sessions` (mã phiên đăng nhập đang hiệu lực). Ai mở được Sheet có thể dùng mã phiên để đăng nhập thay người khác. Chỉ tài khoản sở hữu và tối đa 1–2 Admin tin cậy được truy cập Sheet.
2. **Không đổi "Who has access" thành "Only myself"** — ứng dụng sẽ ngừng hoạt động. Mức "Anyone" là bắt buộc; bảo vệ dữ liệu do mã máy chủ đảm nhiệm (đăng nhập, phân quyền, khóa 15 phút khi nhập sai mật khẩu 5 lần, mật khẩu tạm bắt đổi ở lần đầu).
3. **File BBTN đính kèm** được đặt chế độ *"Bất kỳ ai có đường liên kết đều xem được"* để người dùng mở được bằng nút "Mở BBTN". Link file chỉ hiển thị cho người đã đăng nhập ứng dụng; không gửi các link này ra ngoài.
4. Chuyển `REGISTRATION_MODE` sang `"closed"` (hoặc `"domain"`) ngay khi đã cấp đủ tài khoản ban đầu.
5. Bật **xác minh 2 bước** cho tài khoản Google sở hữu database và tài khoản GitHub.
6. Khi người dùng nghỉ việc/chuyển công tác: Admin vào **Quản trị → Người dùng** xóa tài khoản hoặc hạ xuống Viewer.

---

## 10. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
| --- | --- | --- |
| Mở link `…/exec?action=registrationInfo` thấy trang đăng nhập Google | Deploy chưa chọn **Who has access: Anyone** | *Triển khai → Quản lý các bản triển khai → bút chì* → chọn Anyone → Triển khai |
| Trang web báo không kết nối được database / lỗi mạng | `GSHEET_WEBAPP_URL` trong `config.js` sai (thiếu `/exec`, dư dấu cách) | Sao chép lại đúng Web app URL ở *Quản lý các bản triển khai*, sửa `config.js`, đẩy lại trang |
| Đăng ký bằng email Admin nhưng chỉ có quyền User | `ADMIN_EMAIL` trong `Code.gs` gõ sai, hoặc sửa xong chưa triển khai phiên bản mới | Sửa đúng email → triển khai *Phiên bản mới* (mục 8.1); Admin cũ (nếu có) nâng quyền ở *Quản trị*; hoặc sửa cột `role` thành `admin` trong sheet `users` |
| Bấm "Đăng nhập bằng Google" báo lỗi *chưa cấu hình GOOGLE_CLIENT_ID* | `config.js` còn Client ID của bản gốc | Sửa `GOOGLE_CLIENT_ID: ""` trong `config.js` (mục 5.1) |
| Tải BBTN lên báo lỗi quyền Google Drive | Script chưa được cấp quyền Drive | Mở Apps Script → chọn hàm `getOrCreateBbtnFolder` ở thanh công cụ → **Chạy (Run)** → cấp quyền → triển khai *Phiên bản mới* |
| Tải BBTN báo lỗi khi đặt chế độ chia sẻ (tài khoản Workspace) | Quản trị Workspace chặn chia sẻ "Bất kỳ ai có đường liên kết" | Nhờ quản trị Workspace cho phép, hoặc dùng tài khoản Gmail riêng của đơn vị (phương án A) |
| Sửa `Code.gs` nhưng ứng dụng không thay đổi | Mới chỉ Lưu, chưa triển khai phiên bản mới | Làm theo mục 8.1 |
| Trang web vẫn hiện bản cũ sau khi cập nhật | Trình duyệt dùng bản lưu đệm | Bấm **Ctrl+F5**; kiểm tra tab *Actions* trên GitHub đã chạy xong (✓) |
| Báo "máy chủ đang bận" khi nhiều người cùng lưu | Các thao tác ghi được xếp hàng lần lượt (tối đa chờ 20 giây) | Thử lưu lại sau vài giây |

Giới hạn cần biết: một Google Sheet chứa tối đa 10 triệu ô — đủ cho hàng chục nghìn lần đo. Mỗi file BBTN tải lên tối đa khoảng 15 MB.

---

## 11. Phương án không dùng Google: máy chủ nội bộ

Nếu đơn vị không muốn lưu dữ liệu trên Google, có thể chạy ứng dụng **hoàn toàn trong mạng nội bộ (LAN)**:

1. Cài **Node.js** (bản LTS) trên một máy tính luôn bật trong mạng LAN của đơn vị.
2. Giải nén mã nguồn, chạy file **`chay_dga_offline.bat`**.
3. Người dùng trong mạng LAN mở `http://<địa-chỉ-IP-máy-đó>:8080/`.
4. Đăng nhập bằng tài khoản Admin mặc định hiện trên cửa sổ dòng lệnh và **đổi mật khẩu ngay** (mật khẩu mặc định ai có mã nguồn cũng biết).

Dữ liệu và file BBTN lưu trong thư mục `data/` của máy đó; ứng dụng không gửi yêu cầu nào ra Internet. Cần sao lưu định kỳ thư mục `data/`. Chi tiết xem `README.md`, mục 1a.
