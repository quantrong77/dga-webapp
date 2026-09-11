-- supabase-schema.sql
-- Chạy toàn bộ file này trong Supabase Dashboard > SQL Editor (dự án của bạn) > Run.
-- Tạo 2 bảng: measurements (nhật ký các lần đo DGA) và manufacturer_standards
-- (tiêu chuẩn riêng theo từng nhà sản xuất, dùng thay thế QĐ1901 khi có cấu hình).

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

-- Bật Row Level Security + cho phép đọc/ghi công khai bằng anon key.
-- Đây là cấu hình đơn giản cho công cụ nội bộ 1 nhóm nhỏ dùng chung 1 link.
-- Nếu cần giới hạn theo tài khoản đăng nhập, thay các policy "using (true)"
-- bằng điều kiện auth.uid() phù hợp (xem tài liệu Supabase Auth).

alter table measurements enable row level security;
alter table manufacturer_standards enable row level security;
alter table stations enable row level security;
alter table oil_tests enable row level security;
alter table oltc_oil_tests enable row level security;

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
