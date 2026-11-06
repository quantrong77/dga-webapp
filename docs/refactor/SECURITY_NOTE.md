# Ghi chú bảo mật: `data/database.json` đã bị công khai

> Bước 0 của `REFACTOR_PLAN.md`. **Chưa xóa lịch sử git** — việc đó cần chủ dự án quyết định (mục 4).

## 1. Đã lộ những gì

Repo `quantrong77/dga-webapp` là **repo công khai**, và workflow Pages cũ upload **cả repo** (`path: .`).
Kiểm tra ngày 2026-11-06:

- `https://quantrong77.github.io/dga-webapp/data/database.json` → **HTTP 200** (49 KB), ai cũng tải được.
- `data/database.json` nằm trong **7 commit** (commit đầu: `6331382`, 2026-11-02). Các commit này có trên các nhánh
  `origin/main`, `feat/ly-hoa-dau-mo-rong`, `feat/tach-tab-nhap-lap-bbtn`, `fix/khoi-phuc-dang-nhap-google`,
  `hieu/cap-nhat-tab-canh-bao`.

Bản đã đẩy lên (`a14f59a`) chứa:

| Bảng | Nội dung lộ |
|---|---|
| `users` | 43 tài khoản: `email`, `salt`, `password_hash`, `role`. Phần lớn là tài khoản do bộ test sinh ra (`throttle*`, `role*`, `kythuat_<số>_<chuỗi>`), nhưng có **`admin@ptc3.evnnpt.vn`** và **`kythuat_dilinh@ptc3.evnnpt.vn`**. |
| `sessions` | 78 token phiên (`token`, `email`, `role`), hạn tới **01–03/12/2026**. |
| `measurements`, `oil_tests`, `stations` | số liệu đo, tên trạm, thiết bị. |

Tài khoản và phiên trong file này là của **máy chủ on-premise** (`server/`), không phải của Google Sheets. Token chỉ
dùng được nếu máy chủ on-premise truy cập được từ ngoài.

**Mức rủi ro của `password_hash`:** băm bằng SHA-256 một vòng, có salt (`server/auth.js:17`). Kiểu băm này rất nhanh,
nên ai có hash + salt thì dò được mật khẩu yếu chỉ trong vài phút.

**Rủi ro liên quan:** mật khẩu Admin mặc định `admin123456` được **in ra ngay trên màn hình đăng nhập**
(`index.html:159`, cả trên Pages) và trong `chay_dga_offline.bat`. Tài khoản `admin@ptc3.evnnpt.vn` trong file lộ vẫn
dùng mật khẩu này (đăng nhập được trên máy phát triển).

## 2. Đã làm ở Bước 0 (nhánh `refactor/cau-truc-3-lop`, chưa đẩy)

1. `git rm --cached data/database.json`. File thật vẫn còn trên máy. `data/.gitignore` bỏ qua `database.json` và
   `database.json.bak*`. `.gitignore` mà `server/db.js` tự tạo cho thư mục dữ liệu mới cũng bỏ qua file này.
2. Thêm `data/database.example.json`: đủ 10 bảng, toàn bộ rỗng. `server/db.js` vốn đã tự tạo `database.json`
   từ `INITIAL_TABLES` khi chưa có file; nay có test bảo vệ (`tests/database-bootstrap.test.js`).
3. Workflow Pages chỉ upload `_site/`, do `scripts/build-pages-site.js` gom theo danh sách cho phép:
   - **Đưa lên:** `index.html`, `manifest.webmanifest`, `sw.js`, `config.js`, `early-layout.js`, `app-core.js`,
     `dga-logic.js`, `storage.js`, `style.css`; các thư mục `css/`, `logic/`, `storage/`, `ui/`, `bbtn/`,
     `vendor/`, `image/`, `mobile/` (bỏ `*.md`, file khóa `~$*`, `*.tmp`, `*.bak`); và `template/template-*.docx`.
   - **Không đưa:** `data/`, `server/`, `tests/`, `scripts/`, `docs/`, `gsheet/`, `supabase/`, `pdf/`,
     `node_modules/`, `.github/`, các file `.md`, và các BBTN thật trong `template/`.
   - Script tự kiểm tra đủ file app cần (src/href của `index.html` và `mobile/index.html`, icon trong manifest,
     `PRECACHE_ASSETS` của `sw.js`, các `*_TEMPLATE_URL`). Thiếu file nào là workflow dừng, không deploy.
     Có test bảo vệ: `tests/pages-site.test.js`.
   - Đã chạy thử `_site` bằng máy chủ tĩnh: app và `mobile/` mở được, không có lỗi 404, đủ 4 mẫu BBTN.
     `data/database.json` và `server/api.js` trả 404.

## 3. ⚠ Việc gấp, cần anh/chị quyết

**File vẫn đang công khai trên Pages** cho tới lần deploy kế tiếp có dùng workflow mới. Theo quy tắc B.1, nhánh refactor
chưa được đẩy và không deploy. Hai cách:

- **(a) Khuyến nghị:** cherry-pick 3 commit bảo mật của Bước 0 (`2b9b136`, `2cdd306` và commit tài liệu này) sang
  `feat/tach-tab-nhap-lap-bbtn` rồi push. Workflow chạy, Pages được thay bằng `_site/` và URL trên sẽ trả 404.
- **(b)** Chờ tới Bước 8. Trong thời gian đó file tiếp tục công khai.

## 4. Lịch sử git (chưa làm, cần anh/chị quyết)

Gỡ file khỏi các commit mới **không** xóa được file khỏi lịch sử: ai cũng xem được qua
`https://github.com/quantrong77/dga-webapp/blob/6331382/data/database.json`. Muốn xóa hẳn khỏi lịch sử:

```bash
# Làm trên 1 bản clone MỚI, dạng mirror (đừng làm trên thư mục đang code):
git clone --mirror https://github.com/quantrong77/dga-webapp.git dga-webapp-mirror
cd dga-webapp-mirror
pip install git-filter-repo
git filter-repo --invert-paths --path data/database.json
git push --force --mirror          # VIẾT LẠI MỌI NHÁNH trên GitHub
```

Hệ quả cần biết trước khi chạy:

- Mọi hash commit đổi. Mọi máy đã clone (kể cả máy này) phải clone lại hoặc `git reset --hard origin/<nhánh>`.
  Các thay đổi chưa đẩy phải cất riêng trước.
- GitHub còn giữ commit cũ qua các ref của Pull Request và bộ nhớ đệm. Muốn xóa hẳn phải liên hệ GitHub Support
  ("remove cached views / sensitive data").
- Bản fork hoặc clone người khác đã tải về thì không thu hồi được. Vì vậy **mục 5 bắt buộc làm, dù có viết lại lịch sử
  hay không.**

## 5. Bắt buộc làm (dù chọn cách nào ở mục 3, 4)

1. **Đổi mật khẩu** `admin@ptc3.evnnpt.vn`, `kythuat_dilinh@ptc3.evnnpt.vn` và mọi tài khoản thật khác trên máy chủ
   on-premise. Nếu ai dùng chung mật khẩu này cho Google Sheets, email hay tài khoản EVN thì đổi luôn ở những nơi đó.
2. **Thu hồi toàn bộ phiên on-premise:** dừng server, xóa nội dung bảng `sessions` trong `data/database.json` (để
   `"sessions": []`), rồi khởi động lại. Mọi người sẽ phải đăng nhập lại.
3. **Xóa tài khoản do bộ test sinh ra** trong database thật (`throttle*`, `role*`, `kythuat_<số>_*`). Chúng sinh ra
   từ trước khi bộ test dùng database riêng; máy phát triển hiện có 190 tài khoản và 367 phiên.
4. Nên làm (thay đổi hành vi, làm thành bước riêng, không lẫn vào refactor):
   - bỏ dòng hiện mật khẩu mặc định trên màn hình đăng nhập;
   - bắt đổi mật khẩu Admin mặc định ở lần đăng nhập đầu (cờ `must_change_password` đã có sẵn);
   - chuyển băm mật khẩu sang PBKDF2 hoặc scrypt (`crypto.scryptSync`), có cơ chế nâng cấp hash cũ khi người dùng
     đăng nhập.
