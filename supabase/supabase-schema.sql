-- supabase-schema.sql
-- Chạy toàn bộ file này trong Supabase Dashboard > SQL Editor (dự án của bạn) > Run.
-- Idempotent (mọi "create table"/"create policy" đều có "if not exists"/"drop...if
-- exists" trước) — nếu bạn đã chạy file này từ trước, chạy lại TOÀN BỘ file vẫn AN
-- TOÀN, sẽ chỉ tạo thêm bảng/policy MỚI (ví dụ regulation_config bên dưới) mà không
-- đụng đến dữ liệu các bảng đã có.
-- Tạo các bảng: measurements (nhật ký các lần đo DGA), manufacturer_standards (tiêu
-- chuẩn riêng theo từng nhà sản xuất), stations (danh mục Trạm), oil_tests/
-- oltc_oil_tests/instrument_oil_tests (thí nghiệm dầu), feedback (góp ý người dùng), và
-- regulation_config (Cấu hình quy định — ghi đè số liệu/tham chiếu nguồn QĐ1901/IEC
-- 60599 gốc, xem ghi chú ngay tại "create table if not exists regulation_config" bên dưới).

create table if not exists manufacturer_standards (
  id text primary key,
  manufacturer text not null,
  equipment_type text not null,
  source text,
  -- Loại tiêu chuẩn: 'khi' (khí hòa tan, mặc định) hoặc 'dau' (dầu cách điện — Độ
  -- ẩm/tgδ/Điện áp chọc thủng). Bản ghi cũ (NULL) coi như 'khi' để tương thích ngược.
  standard_type text default 'khi',
  -- Ngưỡng tuyệt đối từng khí (ppm) do nhà sản xuất quy định — chỉ dùng khi standard_type = 'khi'
  h2 numeric, ch4 numeric, c2h6 numeric, c2h4 numeric, c2h2 numeric, co numeric, co2 numeric,
  -- Ngưỡng LOẠI BỎ (condemning limit, ppm) — nghiêm trọng hơn ngưỡng tuyệt đối ở trên,
  -- không bắt buộc điền đủ 7 khí; QĐ1901/IEC60599 không quy định mức này, chỉ áp dụng
  -- khi nhà sản xuất/đơn vị tự đặt ra để cảnh báo mức nguy hiểm cao hơn "không đạt".
  loaibo_h2 numeric, loaibo_ch4 numeric, loaibo_c2h6 numeric, loaibo_c2h4 numeric,
  loaibo_c2h2 numeric, loaibo_co numeric, loaibo_co2 numeric,
  -- Khoảng tốc độ tăng điển hình (ppm/năm), tùy chọn — để trống sẽ dùng Bảng 65 QĐ1901
  rate_h2_lo numeric, rate_h2_hi numeric,
  rate_ch4_lo numeric, rate_ch4_hi numeric,
  rate_c2h6_lo numeric, rate_c2h6_hi numeric,
  rate_c2h4_lo numeric, rate_c2h4_hi numeric,
  rate_c2h2_lo numeric, rate_c2h2_hi numeric,
  rate_co_lo numeric, rate_co_hi numeric,
  rate_co2_lo numeric, rate_co2_hi numeric,
  -- Tiêu chuẩn DẦU (chỉ dùng khi standard_type = 'dau') — 1 bản ghi ứng với 1 tổ hợp
  -- cấp điện áp + trạng thái dầu cụ thể, giống cấu trúc Bảng 54/55/58 QĐ1901. Có thể
  -- thêm nhiều bản ghi cho cùng 1 nhà sản xuất (khác cấp điện áp/trạng thái dầu).
  oil_voltage_class text,
  oil_state text,
  oil_moisture_ppm numeric,
  oil_tgd_90c_percent numeric,
  oil_bdv_kv numeric,
  -- Ngưỡng LOẠI BỎ (mức 2, tùy chọn) — CHỈ dùng khi equipment_type = TI/TU (dầu TI/TU
  -- không có oil_voltage_class/oil_state, xem evaluateInstrumentOilTest() ở
  -- dga-logic.js). QĐ1901 Điều 10/11 không quy định bảng số cho dầu TI/TU (chỉ dẫn
  -- chiếu "theo quy định nhà sản xuất") — ví dụ tài liệu Haefely Trench cho TI có cả
  -- 2 mức "normal conditions" và "limits — units to be taken out of service".
  oil_moisture_loaibo_ppm numeric,
  oil_tgd_90c_loaibo_percent numeric,
  oil_bdv_loaibo_kv numeric,
  created_at timestamptz default now()
);

create table if not exists measurements (
  id text primary key,
  tram text,
  thiet_bi text not null,
  equipment_type text not null,
  -- Phân loại CPC/OLTC (chỉ có ý nghĩa khi equipment_type = MBA/Kháng dầu) — quyết định
  -- bảng IEC 60599:1999 Annex A.1 Table A.2 nào được dùng để tính "tiêu chuẩn chặt hơn".
  mba_subtype text,
  manufacturer text,
  pha text,
  lan_do integer,
  sample_date date not null,
  h2 numeric, ch4 numeric, c2h6 numeric, c2h4 numeric, c2h2 numeric, co numeric, co2 numeric,
  ghi_chu text,
  -- Biên bản thí nghiệm (BBTN, file PDF) đính kèm — tùy chọn, xem uploadAttachment() ở
  -- storage.js. bbtn_url là link công khai trong bucket Storage "bbtn" (xem cấu hình
  -- bucket ở cuối file này); bbtn_name là tên file gốc lúc tải lên, hiển thị lại ở web app.
  bbtn_url text,
  bbtn_name text,
  -- Thông số kỹ thuật thiết bị (nameplate, tùy chọn) — chỉ dùng để điền vào "Báo cáo
  -- phân tích kỹ thuật (docx)" (xem tech-report-export.js), KHÔNG dùng để tính toán/
  -- đánh giá DGA.
  kieu_may text,
  nam_sx integer,
  nam_van_hanh integer,
  dien_ap_dm text,
  so_che_tao text,
  loai_dau text,
  ket_cau_cach_dien text,
  hien_trang_van_hanh text,
  -- Thông tin thí nghiệm bổ sung (tùy chọn) — tự đọc được từ BBTN (bbtn-import.js) hoặc
  -- nhập tay, dùng để điền vào "Xuất BBTN (docx)" (xem bbtn-export.js), KHÔNG dùng để
  -- tính toán/đánh giá DGA. Khác nhóm "nameplate" ở trên vì đây là thông tin của TỪNG
  -- LẦN đo (có thể khác nhau giữa các lần đo cùng thiết bị).
  ngay_thi_nghiem date,
  ly_do_thi_nghiem text,
  nhiet_do numeric,
  do_am numeric,
  -- N2, O2 (ppm, tùy chọn) + điều kiện áp dụng Bảng 63 — dùng cho "Đánh giá các tỷ lệ bổ
  -- sung" (tỷ lệ O2/N2) và Tổng hàm lượng khí hòa tan (Bảng 63, Điều 54 QĐ1901 — cộng CẢ
  -- 9 khí kể cả N2/O2, KHÁC 7 khí h2..co2 ở trên vốn dùng để tính TCG/đánh giá tuyệt đối/
  -- Bảng 66), xem dga-logic.js. Để trống (NULL) thì 2 mục này tự ẩn/bỏ qua ở webapp.
  n2 numeric,
  o2 numeric,
  -- Cấp điện áp áp dụng Bảng 63: '110-220' hoặc '500'.
  bang63_voltage_class text,
  bang63_applicable boolean,
  -- Lưu vết CHỈNH SỬA SỐ LIỆU (khác created_by/updated_by/updated_at do Apps Script quản lý
  -- riêng cho GSheet — đó là AI sửa/lúc nào chung chung; đây là KHÍ NÀO đã đổi giá trị).
  -- edited_fields: "H2:12|CO2:2000" (field:GIÁ TRỊ CŨ, chỉ field vừa đổi ở lần sửa gần
  -- nhất) — web app dùng tô nền đỏ đúng ô đã sửa ở tab "Lịch sử đo". edited_at: thời điểm
  -- ISO của lần sửa SỐ LIỆU gần nhất (không đổi nếu lần sửa sau chỉ sửa Ghi chú). edit_log:
  -- TOÀN BỘ lịch sử các lần sửa số liệu, mỗi dòng 1 lần sửa (mới nhất ở đầu), xem
  -- diffTrackedGasFields() ở app-core.js phía web app. Cả 3 để trống nếu bản ghi chưa từng
  -- bị sửa số liệu kể từ lúc nhập lần đầu.
  edited_fields text,
  edited_at timestamptz,
  edit_log text,
  created_at timestamptz default now()
);

create index if not exists idx_measurements_key on measurements (tram, thiet_bi, pha);

-- Danh mục Trạm (MaTram/TenTram) — dùng để gợi ý/tìm kiếm ở ô "Trạm" khi nhập số liệu,
-- không bắt buộc phải có trong danh mục mới nhập được (ô Trạm vẫn cho gõ tự do).
create table if not exists stations (
  id text primary key,
  ma_tram text,
  ten_tram text not null,
  created_at timestamptz default now(),
  unique (ten_tram)
);

-- Thí nghiệm dầu MBA — Độ ẩm (ppm), tgδ ở 90°C (%), điện áp chọc thủng (kV),
-- theo QĐ1901 Điều 46/47/50 (Bảng 54/55/58). Chỉ áp dụng MBA/Kháng dầu — QĐ1901
-- không có bảng số liệu riêng cho dầu TI/TU (theo quy định nhà sản xuất).
create table if not exists oil_tests (
  id text primary key,
  tram text,
  thiet_bi text not null,
  -- Điểm lấy mẫu: "chung" (mặc định, đa số MBA/Kháng ≤220kV dùng 1 thùng dầu chung 3
  -- pha) hoặc "pharieng" (MBA/Kháng 3 pha RỜI, mỗi pha 1 thùng dầu/1 mẫu riêng — thường
  -- gặp ở 500kV, xem OIL_SAMPLE_POINTS trong dga-logic.js).
  oil_sample_point text default 'chung',
  -- Pha: "A"/"B"/"C" khi oil_sample_point='pharieng', null khi 'chung'.
  phase text,
  -- Cấp điện áp MBA: duoi15 | 15den35 | tren35duoi110 | 110 | 220 | 500 (xem OIL_VOLTAGE_CLASSES trong dga-logic.js)
  voltage_class text not null,
  -- Trạng thái dầu: "new" (dầu mới, sau lắp đặt/sau sửa chữa) hoặc "inservice" (dầu vận hành)
  oil_state text not null,
  -- Có bảo vệ bằng màng chất dẻo/nitơ — chỉ có ý nghĩa khi voltage_class ≤110kV (Bảng 58)
  has_membrane_n2 boolean,
  -- Nhà sản xuất (tùy chọn) — nếu khớp với 1 tiêu chuẩn dầu đã cấu hình (cùng cấp điện
  -- áp + trạng thái dầu) trong manufacturer_standards, dùng ngưỡng NSX thay QĐ1901.
  manufacturer text,
  sample_date date not null,
  moisture_ppm numeric,
  tgd_90c_percent numeric,
  bdv_kv numeric,
  ghi_chu text,
  created_at timestamptz default now()
);

create index if not exists idx_oiltests_key on oil_tests (tram, thiet_bi);

-- Thí nghiệm dầu khoang điều áp dưới tải (OLTC) — QĐ1901 Điều 37/Bảng 49. Bảng
-- RIÊNG khỏi oil_tests (dầu thùng dầu chính) vì có thêm điểm lấy mẫu + pha.
create table if not exists oltc_oil_tests (
  id text primary key,
  tram text,
  thiet_bi text not null,
  -- Điểm lấy mẫu OLTC: "trungtinh" (điểm cuối trung tính, 3 pha chung 1 mẫu) hoặc
  -- "pharieng" (một pha / điểm không trung tính, mỗi pha A/B/C 1 mẫu riêng).
  oltc_sample_point text not null,
  -- Pha: "A"/"B"/"C" khi oltc_sample_point='pharieng', null khi 'trungtinh'.
  phase text,
  voltage_class text not null,
  oil_state text not null,
  has_membrane_n2 boolean,
  manufacturer text,
  sample_date date not null,
  moisture_ppm numeric,
  tgd_90c_percent numeric,
  bdv_kv numeric,
  ghi_chu text,
  created_at timestamptz default now()
);

create index if not exists idx_oltc_oiltests_key on oltc_oil_tests (tram, thiet_bi);

-- Thí nghiệm dầu cách điện TI/TU (biến dòng điện/biến điện áp kiểu kín, cách điện
-- dầu) — QĐ1901 Điều 10 (Bảng 9 mục 12) / Điều 11 (Bảng 14 mục 11) đều chỉ dẫn chiếu
-- "theo quy định nhà sản xuất", KHÔNG có bảng số mặc định như dầu MBA (Bảng 54/55/58)
-- — bắt buộc phải có tiêu chuẩn nhà sản xuất (manufacturer_standards, standard_type =
-- 'dau', equipment_type = TI/TU) mới đánh giá được, xem evaluateInstrumentOilTest() ở
-- dga-logic.js. Bảng RIÊNG khỏi oil_tests (MBA) — không có voltage_class/oil_state/
-- oil_sample_point/has_membrane_n2 (không áp dụng, xem ghi chú ở manufacturer_standards).
create table if not exists instrument_oil_tests (
  id text primary key,
  tram text,
  thiet_bi text not null,
  -- equipment_type: 'TI (biến dòng điện)' hoặc 'TU (biến điện áp)' (xem EQUIPMENT_TYPES
  -- trong dga-logic.js).
  equipment_type text not null,
  -- Pha: 'A'/'B'/'C' hoặc 'chung3pha' (đa số TI/TU là 1 pha/1 thiết bị vật lý riêng,
  -- nhưng vẫn cho chọn 'chung3pha' nếu đơn vị gộp chung, giống PHA_OPTIONS ở đo khí DGA).
  phase text,
  -- Nhà sản xuất — BẮT BUỘC phải khớp 1 tiêu chuẩn dầu TI/TU đã cấu hình mới đánh giá
  -- được (khác dầu MBA vốn có QĐ1901 làm mặc định khi không chọn NSX).
  manufacturer text,
  sample_date date not null,
  moisture_ppm numeric,
  tgd_90c_percent numeric,
  bdv_kv numeric,
  ghi_chu text,
  created_at timestamptz default now()
);

create index if not exists idx_instrument_oiltests_key on instrument_oil_tests (tram, thiet_bi);

-- Góp ý người dùng (tab "Người dùng phản hồi") — nội dung tự do + 1 ảnh minh họa tùy
-- chọn (image_url/image_name, xem bucket Storage "feedback" ở cuối file này — tách
-- riêng bucket "bbtn" để không lẫn 2 loại file khác mục đích).
create table if not exists feedback (
  id text primary key,
  content text not null,
  image_url text,
  image_name text,
  created_at timestamptz default now()
);

-- "Cấu hình quy định" (tab riêng trên web app, tách khỏi manufacturer_standards ở trên —
-- xem ui/ui-regulation-config.js + dga-logic.js mục 9, REGULATION_CONFIG_REGISTRY). Mỗi
-- dòng ứng với ĐÚNG 1 bảng ngưỡng gốc QĐ1901/IEC 60599 (id = key trong registry, VD
-- 'BANG64_MBA') — cho phép Admin sửa số + tham chiếu nguồn khi 2 quy định này có bản
-- cập nhật trong tương lai, KHÔNG cần sửa code. "values_json" lưu dạng TEXT (không phải
-- jsonb) — cố ý để khớp với cách Google Sheets/Code.gs lưu (chuỗi JSON đơn giản), tránh
-- phải viết logic (de)serialize khác nhau giữa 2 backend; client (storage.js) tự
-- JSON.parse/JSON.stringify. Không có bản ghi nào cho 1 key = dùng đúng số liệu mặc định
-- gốc đã tích hợp sẵn trong dga-logic.js (nút "Khôi phục mặc định" ở giao diện chính là
-- xóa dòng tương ứng ở đây).
create table if not exists regulation_config (
  id text primary key,
  citation text,
  values_json text,
  updated_at timestamptz default now()
);

-- Nếu bạn đã tạo bảng measurements từ trước (chưa có cột mba_subtype), chạy thêm dòng
-- sau (an toàn, không ảnh hưởng dữ liệu cũ) để nâng cấp:
-- alter table measurements add column if not exists mba_subtype text;

-- Nếu bạn đã tạo bảng manufacturer_standards từ trước (chưa có các cột loaibo_*), chạy
-- các dòng sau (an toàn, không ảnh hưởng dữ liệu cũ) để nâng cấp:
-- alter table manufacturer_standards add column if not exists loaibo_h2 numeric;
-- alter table manufacturer_standards add column if not exists loaibo_ch4 numeric;
-- alter table manufacturer_standards add column if not exists loaibo_c2h6 numeric;
-- alter table manufacturer_standards add column if not exists loaibo_c2h4 numeric;
-- alter table manufacturer_standards add column if not exists loaibo_c2h2 numeric;
-- alter table manufacturer_standards add column if not exists loaibo_co numeric;
-- alter table manufacturer_standards add column if not exists loaibo_co2 numeric;

-- Nếu bạn đã tạo bảng manufacturer_standards TRƯỚC KHI có tính năng "Loại tiêu chuẩn"
-- (khí/dầu), chạy các dòng sau để nâng cấp (an toàn, không ảnh hưởng dữ liệu cũ — các
-- dòng đã có sẽ tự hiểu là standard_type = 'khi'). Ràng buộc unique(manufacturer,
-- equipment_type) cũ (nếu còn) cũng cần gỡ vì 1 nhà sản xuất giờ có thể có NHIỀU tiêu
-- chuẩn dầu (khác cấp điện áp/trạng thái dầu) cho cùng equipment_type = MBA/Kháng dầu:
-- alter table manufacturer_standards drop constraint if exists manufacturer_standards_manufacturer_equipment_type_key;
-- alter table manufacturer_standards add column if not exists standard_type text default 'khi';
-- alter table manufacturer_standards add column if not exists oil_voltage_class text;
-- alter table manufacturer_standards add column if not exists oil_state text;
-- alter table manufacturer_standards add column if not exists oil_moisture_ppm numeric;
-- alter table manufacturer_standards add column if not exists oil_tgd_90c_percent numeric;
-- alter table manufacturer_standards add column if not exists oil_bdv_kv numeric;

-- Nếu bạn đã tạo bảng oil_tests từ trước (chưa có cột manufacturer), chạy thêm dòng
-- sau (an toàn, không ảnh hưởng dữ liệu cũ) để nâng cấp:
-- alter table oil_tests add column if not exists manufacturer text;

-- Nếu bạn đã tạo bảng measurements từ trước (chưa có cột bbtn_url/bbtn_name — tính
-- năng đính kèm Biên bản thí nghiệm PDF), chạy 2 dòng sau để nâng cấp:
-- alter table measurements add column if not exists bbtn_url text;
-- alter table measurements add column if not exists bbtn_name text;

-- Nếu bạn đã tạo bảng measurements từ trước (chưa có 8 cột "thông số kỹ thuật thiết
-- bị" — dùng cho tính năng "Xuất báo cáo phân tích kỹ thuật"), chạy các dòng sau để
-- nâng cấp (an toàn, không ảnh hưởng dữ liệu cũ):
-- alter table measurements add column if not exists kieu_may text;
-- alter table measurements add column if not exists nam_sx integer;
-- alter table measurements add column if not exists nam_van_hanh integer;
-- alter table measurements add column if not exists dien_ap_dm text;
-- alter table measurements add column if not exists so_che_tao text;
-- alter table measurements add column if not exists loai_dau text;
-- alter table measurements add column if not exists ket_cau_cach_dien text;
-- alter table measurements add column if not exists hien_trang_van_hanh text;

-- Nếu bạn đã tạo bảng measurements từ trước (chưa có 4 cột "thông tin thí nghiệm bổ
-- sung" — Ngày thí nghiệm/Lý do thí nghiệm/Điều kiện môi trường, dùng cho tính năng
-- "Xuất BBTN"), chạy các dòng sau để nâng cấp (an toàn, không ảnh hưởng dữ liệu cũ):
-- alter table measurements add column if not exists ngay_thi_nghiem date;
-- alter table measurements add column if not exists ly_do_thi_nghiem text;
-- alter table measurements add column if not exists nhiet_do numeric;
-- alter table measurements add column if not exists do_am numeric;

-- Nếu bạn đã tạo bảng measurements từ trước (chưa có N2/O2 + điều kiện áp dụng Bảng 63
-- — dùng cho "Đánh giá các tỷ lệ bổ sung" và Tổng hàm lượng khí hòa tan, Điều 54 QĐ1901),
-- chạy các dòng sau để nâng cấp (an toàn, không ảnh hưởng dữ liệu cũ):
-- alter table measurements add column if not exists n2 numeric;
-- alter table measurements add column if not exists o2 numeric;
-- alter table measurements add column if not exists bang63_voltage_class text;
-- alter table measurements add column if not exists bang63_applicable boolean;

-- Nếu bạn đã tạo bảng measurements từ trước (chưa có 3 cột lưu vết CHỈNH SỬA SỐ LIỆU —
-- tô nền đỏ + log thời điểm sửa ở tab "Lịch sử đo"), chạy các dòng sau để nâng cấp (an
-- toàn, không ảnh hưởng dữ liệu cũ):
-- alter table measurements add column if not exists edited_fields text;
-- alter table measurements add column if not exists edited_at timestamptz;
-- alter table measurements add column if not exists edit_log text;

-- Nếu bạn đã tạo bảng oil_tests từ trước (chưa có cột oil_sample_point/phase — tính
-- năng phân biệt MBA/Kháng dùng 1 thùng dầu CHUNG 3 pha hay 3 pha RỜI, mỗi pha 1 thùng
-- dầu/1 mẫu riêng, thường gặp ở 500kV), chạy 2 dòng sau để nâng cấp (an toàn, không ảnh
-- hưởng dữ liệu cũ — các dòng đã có sẽ tự hiểu là oil_sample_point = "chung"):
-- alter table oil_tests add column if not exists oil_sample_point text;
-- alter table oil_tests add column if not exists phase text;

-- Nếu bạn đã tạo bảng manufacturer_standards từ trước (chưa có 3 cột "Ngưỡng loại bỏ"
-- của dầu TI/TU — tính năng đánh giá dầu cách điện TI/TU theo tiêu chuẩn nhà sản xuất),
-- chạy các dòng sau để nâng cấp (an toàn, không ảnh hưởng dữ liệu cũ):
-- alter table manufacturer_standards add column if not exists oil_moisture_loaibo_ppm numeric;
-- alter table manufacturer_standards add column if not exists oil_tgd_90c_loaibo_percent numeric;
-- alter table manufacturer_standards add column if not exists oil_bdv_loaibo_kv numeric;

-- Bật Row Level Security + cho phép đọc/ghi công khai bằng anon key.
-- Đây là cấu hình đơn giản cho công cụ nội bộ 1 nhóm nhỏ dùng chung 1 link.
-- Nếu cần giới hạn theo tài khoản đăng nhập, thay các policy "using (true)"
-- bằng điều kiện auth.uid() phù hợp (xem tài liệu Supabase Auth).

alter table measurements enable row level security;
alter table manufacturer_standards enable row level security;
alter table stations enable row level security;
alter table oil_tests enable row level security;
alter table oltc_oil_tests enable row level security;
alter table instrument_oil_tests enable row level security;
alter table feedback enable row level security;
alter table regulation_config enable row level security;

drop policy if exists "measurements_all" on measurements;
create policy "measurements_all" on measurements for all using (true) with check (true);

drop policy if exists "standards_all" on manufacturer_standards;
create policy "standards_all" on manufacturer_standards for all using (true) with check (true);

drop policy if exists "stations_all" on stations;
create policy "stations_all" on stations for all using (true) with check (true);

drop policy if exists "oiltests_all" on oil_tests;
create policy "oiltests_all" on oil_tests for all using (true) with check (true);

drop policy if exists "oltc_oiltests_all" on oltc_oil_tests;
create policy "oltc_oiltests_all" on oltc_oil_tests for all using (true) with check (true);

drop policy if exists "instrument_oiltests_all" on instrument_oil_tests;
create policy "instrument_oiltests_all" on instrument_oil_tests for all using (true) with check (true);

drop policy if exists "feedback_all" on feedback;
create policy "feedback_all" on feedback for all using (true) with check (true);

drop policy if exists "regulation_config_all" on regulation_config;
create policy "regulation_config_all" on regulation_config for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Storage bucket "bbtn" — nơi lưu file Biên bản thí nghiệm (PDF) đính kèm 1 lần đo
-- (tính năng "Xem BBTN đã lưu" ở tab "DGA"/"Lịch sử đo"). Bucket công khai (public)
-- để bbtn_url mở trực tiếp được không cần token — chấp nhận được cho công cụ nội bộ 1
-- nhóm nhỏ dùng chung 1 link, giống cách "measurements_all" ở trên đang mở cho anon key.
-- Nếu cần hạn chế hơn, đổi public thành false và dùng createSignedUrl() ở storage.js
-- thay cho getPublicUrl() (xem uploadAttachment() trong storage.js).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('bbtn', 'bbtn', true)
on conflict (id) do update set public = true;

drop policy if exists "bbtn_insert" on storage.objects;
create policy "bbtn_insert" on storage.objects for insert
  with check (bucket_id = 'bbtn');

drop policy if exists "bbtn_select" on storage.objects;
create policy "bbtn_select" on storage.objects for select
  using (bucket_id = 'bbtn');

drop policy if exists "bbtn_update" on storage.objects;
create policy "bbtn_update" on storage.objects for update
  using (bucket_id = 'bbtn') with check (bucket_id = 'bbtn');

-- ---------------------------------------------------------------------------
-- Storage bucket "feedback" — ảnh minh họa đính kèm góp ý (tab "Người dùng phản hồi").
-- Tách riêng khỏi bucket "bbtn" ở trên vì khác mục đích (BBTN vs. ảnh chụp màn hình góp
-- ý), cùng cấu hình công khai (public) — xem lý do đầy đủ ở ghi chú "Storage bucket
-- "bbtn"" phía trên, áp dụng y hệt ở đây.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('feedback', 'feedback', true)
on conflict (id) do update set public = true;

drop policy if exists "feedback_insert" on storage.objects;
create policy "feedback_insert" on storage.objects for insert
  with check (bucket_id = 'feedback');

drop policy if exists "feedback_select" on storage.objects;
create policy "feedback_select" on storage.objects for select
  using (bucket_id = 'feedback');

drop policy if exists "feedback_update" on storage.objects;
create policy "feedback_update" on storage.objects for update
  using (bucket_id = 'feedback') with check (bucket_id = 'feedback');
