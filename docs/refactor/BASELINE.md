# Mốc chuẩn trước tái cấu trúc (Bước 0)

Ngày lấy mốc: 2026-11-06 · nhánh `refactor/cau-truc-3-lop` tách từ `feat/tach-tab-nhap-lap-bbtn` @ `a14f59a`.
Mọi bước sau so với các con số dưới đây (quy tắc B.4 của `REFACTOR_PLAN.md`).

## 1. Cổng kiểm thử

| Cổng | Mốc trước Bước 0 (`a14f59a`) | Mốc sau Bước 0 (các bước sau so với cột này) |
|---|---|---|
| `npm test` (Jest) | 33 bộ · **550** test đạt | 35 bộ · **558** test đạt (+4 `database-bootstrap`, +4 `pages-site`) |
| `npm run typecheck` | OK | OK |
| `npm run lint` (ESLint) | **0 lỗi / 61 cảnh báo** | **0 lỗi / 61 cảnh báo** |
| `npm run lint:css` (Stylelint) | **1 lỗi** / 50 cảnh báo | **0 lỗi / 50 cảnh báo** (đã sửa `word-break: break-word`, `8a17d0c`) |
| `npm run sync-mobile:check` | OK | OK |
| `npm run build-guide:check` | OK | OK |

### ESLint: 61 cảnh báo, theo quy tắc

| Quy tắc | Số | Ghi chú |
|---|---|---|
| `no-useless-escape` | 38 | phần lớn ở `bbtn/bbtn-import.js` (regex đọc PDF) |
| `no-unused-vars` | 11 | |
| `no-var` | 5 | `config.js` |
| `no-useless-assignment` | 3 | `ui/ui-oil.js`, `ui/ui-ti-oil-3pha.js`, `bbtn/oil-bbtn.js` |
| `preserve-caught-error` | 3 | `storage/*` (thiếu `{ cause: err }`) |
| `prefer-const` | 1 | |

Theo file: `bbtn/bbtn-import.js` 29 · `bbtn/nameplate-import.js` 7 · `config.js` 5 · `scripts/md-to-html.js` 3 ·
`tests/offline-sync.test.js` 3 · `bbtn/mba-oil-bbtn.js` 2 · `storage/storage-remote.js` 2 · còn lại 1/file
(`bbtn/oil-bbtn.js`, `storage.js`, `storage/storage-local.js`, `storage/storage-offline.js`, `ui/ui-alerts.js`,
`ui/ui-history.js`, `ui/ui-oil.js`, `ui/ui-ti-oil-3pha.js`, `tests/gsheet-code.test.js`,
`tests/local-server-storage.test.js`).

### Stylelint: 50 cảnh báo

`no-descending-specificity` 29 · `shorthand-property-no-redundant-values` 7 · `color-hex-length` 7 ·
`declaration-block-no-redundant-longhand-properties` 4 · `no-duplicate-selectors` 3.

## 2. Độ phức tạp (thay cho báo cáo SonarQube)

SonarQube for IDE chỉ phân tích file đang mở trong VS Code, không xuất được báo cáo toàn dự án từ dòng lệnh.
Mốc dưới đây đo bằng quy tắc có sẵn của ESLint: `complexity` (độ phức tạp vòng, ngưỡng 25) và
`max-lines-per-function` (ngưỡng 150 dòng, không tính dòng trống/chú thích). Chỉ số "cognitive complexity" của
SonarQube khác về cách đếm, nhưng thứ hạng các hàm nặng nhất tương đương.

**26 hàm có độ phức tạp > 25** — 20 hàm nặng nhất:

| Độ phức tạp | Hàm | Vị trí |
|---|---|---|
| 79 | `onViewMeasurement` | `ui/ui-dga.js:676` |
| 72 | `executeRemoteSyncItem` | `storage/storage-offline.js:41` |
| 64 | `mbaOilDocxXmlToHtml` | `bbtn/mba-oil-bbtn.js:365` |
| 54 | `onAnalyze` | `ui/ui-dga.js:880` |
| 52 | `initApp` | `app-core.js:62` |
| 51 | `buildRecommendations` | `logic/dga-logic-gas.js:782` |
| 50 | `parseMbaOilBbtnLines` | `bbtn/mba-oil-bbtn.js:213` |
| 50 | `handleApiRequest` | `server/api.js:67` |
| 46 | `onBbtnFileSelected` | `ui/ui-dga.js:353` |
| 45 | (hàm mũi tên) | `ui/ui-alerts.js:261` |
| 44 | `renderResults` | `ui/ui-dga.js:1223` |
| 42 | `onBatchSave` | `ui/ui-batch-import.js:267` |
| 38 | `mdToHtml` | `scripts/md-to-html.js:4` |
| 35 | `extractGasValues` | `bbtn/bbtn-import.js:318` |
| 35 | `buildTechReportData` | `bbtn/tech-report-export.js:44` |
| 35 | `evaluateOilExtendedQd1901` | `logic/dga-logic-oil-extended.js:177` |
| 35 | `evaluateIec60422ExtendedMba` | `logic/dga-logic-oil-extended.js:305` |
| 34 | (hàm mũi tên) | `ui/ui-standards.js:287` |
| 33 | `onAnalyzeOil` | `ui/ui-oil.js:260` |
| 33 | `onSaveStandard` | `ui/ui-standards.js:420` |

**Hàm dài > 150 dòng (không tính test):** `initApp` 457 (`app-core.js`) · `buildRegulationConfigRegistry` 341
(`logic/dga-logic-regulation-config.js`, phần lớn là bảng dữ liệu) · `onAnalyze` 209 (`ui/ui-dga.js`) ·
`handleApiRequest` 208 (`server/api.js`) · `createOilBatch` 205 (`ui/ui-oil-batch-import.js`) ·
`renderTrendChart` 172 (`ui/ui-trend.js`).

**File JS lớn nhất (số dòng, không tính vendor/mobile):** `ui/ui-dga.js` 1526 · `storage.js` 1171 · `app-core.js` 1005 ·
`logic/dga-logic-gas.js` 957 · `ui/ui-alerts.js` 903 · `ui/ui-oil.js` 796 · `bbtn/bbtn-import.js` 775 ·
`logic/dga-logic-regulation-config.js` 689 · `ui/ui-trend.js` 687 · `ui/ui-dieu54-charts.js` 575.

Lệnh đo lại (tạo config tạm kế thừa `eslint.config.mjs`):

```bash
cat > eslint.complexity.tmp.mjs <<'EOF'
import base from "./eslint.config.mjs";
export default [...base, { files: ["**/*.js"], rules: { complexity: ["warn", 25],
  "max-lines-per-function": ["warn", { max: 150, skipBlankLines: true, skipComments: true }] } }];
EOF
npx eslint -c eslint.complexity.tmp.mjs . -f json -o complexity.json; rm eslint.complexity.tmp.mjs
```

## 3. Ảnh mốc giao diện

40 ảnh ở `docs/refactor/screenshots/before/`: 10 tab (`nhap`, `dau`, `canhbao`, `lichsu`, `xuhuong`, `quytrinh`,
`huongdan`, `about`, `phanhoi`, `quantri`) × desktop 1440×900 / mobile 375×812 × sáng / tối. Tên file:
`<desktop|mobile>-<light|dark>-<tab>.png`; chụp toàn trang, riêng `huongdan` chỉ chụp khung nhìn (trang rất dài).
Chạy trên `npm start` (on-premise, cổng 8091), đăng nhập Admin, với database của máy phát triển.

- **Không có tab nào tràn ngang ở 375px.**
- Thư mục ảnh **không commit** (`docs/refactor/.gitignore`): ảnh có tên trạm, thiết bị, email tài khoản thật.

## 4. Hiện trạng đã biết lúc lấy mốc (không phải do refactor)

- Tab Quản trị, chế độ on-premise: `GET /api?action=supabaseSyncStatus` trả **400** (máy chủ nội bộ không có action này)
  → 1 lỗi console. Xem `BUGS_FOUND.md` #1.
- Service Worker **không được đăng ký** (cả on-premise lẫn bản tĩnh như Pages). Xem `BUGS_FOUND.md` #2.

## 5. Sau Bước 4 (refactor bên trong từng lớp)

| Cổng | Mốc sau Bước 0 | Sau Bước 4 |
|---|---|---|
| Jest | 558 test | **671 test** (+113: đặc tả Storage 29, combo app-core 40, kiến trúc, hàm cung cấp tiêu chuẩn NSX…) |
| ESLint | 0 lỗi / 61 cảnh báo | **0 lỗi / 0 cảnh báo** |
| Stylelint | 0 lỗi / 50 cảnh báo | 0 lỗi / 50 cảnh báo (để Bước 5) |
| tsc | `src/domain/*.js` | `src/domain/*.js` + `src/data/drivers/storage-repo.js` |
| Kích thước | `storage.js` 1171 dòng, `app-core.js` 1006 dòng | `storage.js` 438 + `storage-repo.js` ~230; `app-core.js` 579 + `app-status.js` 186 + `app-views.js` 211 |

Độ phức tạp: `initApp` (52, 457 dòng) đã chia thành 7 hàm; 28 hàm CRUD của `storage.js` đã gom về khuôn chung.
Còn lại (để lần sau, cần test đặc tả riêng từng hàm trước khi sửa): `onViewMeasurement` (79), `executeRemoteSyncItem` (72,
chờ sửa lỗi #5), `mbaOilDocxXmlToHtml` (64), `onAnalyze` (54), `buildRecommendations` (51), `parseMbaOilBbtnLines` (50),
`handleApiRequest` (50).


## 6. Sau Bước 5 (design tokens, Stylelint, chuẩn hóa thành phần)

| Cổng | Sau Bước 4 | Sau Bước 5 |
|---|---|---|
| Jest | 671 test | 671 test |
| ESLint | 0 lỗi / 0 cảnh báo | 0 lỗi / 0 cảnh báo |
| Stylelint | 0 lỗi / 50 cảnh báo | **0 lỗi / 0 cảnh báo** |
| CSS | token ở đầu `style-base.css` | `tokens.css` nạp đầu tiên: 82 → 132 token (vai trò màu, bóng có hướng, `--gray-500/700`, `--blue-500`) |

- Màu viết cứng ngoài `tokens.css`: còn bảng màu sơ đồ tư duy (biến cục bộ `--mm-accent`), bóng sơ đồ quy trình
  (`style-dga-workflow.css`) và vệt sáng trong nút chính.
- Khoảng cách / cỡ chữ / bo góc: 188 giá trị khớp thang đã dùng token; khoảng 375 giá trị NGOÀI thang (6/10/14px,
  cỡ chữ 13/12,5/11,5px…) giữ nguyên, chờ quyết định.
- Style viết trực tiếp (`style=""`): 285 → 262 (26 nút dùng `.btn.sm` / `.btn.xs`; 2 nút còn giữ phần style riêng).
- Ảnh `screenshots/after-step5/` so với `before/`: 12/40 giống hệt; khác biệt còn lại đều thuộc các thay đổi có chủ
  đích (sọc bảng tối #6, `--gray-700` #7, cỡ nút nhỏ làm trang Nhập/Dầu ngắn 2–3px), hoặc là nhiễu khử răng cưa
  (0 px vượt ngưỡng) và dấu thời gian trong dữ liệu.

## 7. Sau Bước 6 (UX & khả năng truy cập)

| Cổng | Sau Bước 5 | Sau Bước 6 |
|---|---|---|
| Jest / ESLint / Stylelint | 671 · 0/0 · 0/0 | 671 · 0/0 · 0/0 |
| axe-core WCAG 2.1 A/AA (10 tab + tab con × desktop/mobile × sáng/tối) | 6 quy tắc · 242 phần tử vi phạm | **0** |
| Tràn ngang 375 / 768 / 1440px (tab ngang + sidebar) | 0 tab | 0 tab |

Chi tiết từng thay đổi: `UX_CHANGES.md`. Ảnh `screenshots/after-step6/` so với `after-step5/`: 12/40 giống hệt, phần
khác là màu chữ cấp ba mới (đơn vị đo, chữ gợi ý, ghi chú) và cột Ngày được ghim ở các bảng lịch sử.
