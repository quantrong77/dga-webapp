-- mirror-setup.sql — chuẩn bị Supabase làm BẢN SAO SONG SONG của Google Sheets.
--
-- Mô hình: Google Sheets vẫn là database CHÍNH (đăng nhập, phân quyền, đọc/ghi của app).
-- gsheet/Code.gs tự ghi/xóa theo sang Supabase mỗi lần có thay đổi, bằng service_role key cất
-- trong Script Properties của Apps Script (KHÔNG nằm trong config.js / trình duyệt). Vì vậy
-- Supabase KHÔNG cần mở quyền cho anon key — file này khóa hẳn quyền đó.
--
-- Thứ tự chạy (Supabase Dashboard > SQL Editor):
--   1. supabase-schema.sql   (nếu chưa từng chạy — tạo các bảng)
--   2. file này              (chạy lại nhiều lần vẫn an toàn, KHÔNG xóa dữ liệu)
-- Sau đó làm tiếp các bước ở README, mục 2c.

-- 1) Đủ mọi cột như schema hiện tại (bảng tạo từ phiên bản schema cũ có thể thiếu cột mới).
alter table manufacturer_standards
  add column if not exists manufacturer text,
  add column if not exists equipment_type text,
  add column if not exists source text,
  add column if not exists standard_type text,
  add column if not exists h2 numeric,
  add column if not exists ch4 numeric,
  add column if not exists c2h6 numeric,
  add column if not exists c2h4 numeric,
  add column if not exists c2h2 numeric,
  add column if not exists co numeric,
  add column if not exists co2 numeric,
  add column if not exists loaibo_h2 numeric,
  add column if not exists loaibo_ch4 numeric,
  add column if not exists loaibo_c2h6 numeric,
  add column if not exists loaibo_c2h4 numeric,
  add column if not exists loaibo_c2h2 numeric,
  add column if not exists loaibo_co numeric,
  add column if not exists loaibo_co2 numeric,
  add column if not exists rate_h2_lo numeric,
  add column if not exists rate_h2_hi numeric,
  add column if not exists rate_ch4_lo numeric,
  add column if not exists rate_ch4_hi numeric,
  add column if not exists rate_c2h6_lo numeric,
  add column if not exists rate_c2h6_hi numeric,
  add column if not exists rate_c2h4_lo numeric,
  add column if not exists rate_c2h4_hi numeric,
  add column if not exists rate_c2h2_lo numeric,
  add column if not exists rate_c2h2_hi numeric,
  add column if not exists rate_co_lo numeric,
  add column if not exists rate_co_hi numeric,
  add column if not exists rate_co2_lo numeric,
  add column if not exists rate_co2_hi numeric,
  add column if not exists oil_voltage_class text,
  add column if not exists oil_state text,
  add column if not exists oil_moisture_ppm numeric,
  add column if not exists oil_tgd_90c_percent numeric,
  add column if not exists oil_bdv_kv numeric,
  add column if not exists oil_moisture_loaibo_ppm numeric,
  add column if not exists oil_tgd_90c_loaibo_percent numeric,
  add column if not exists oil_bdv_loaibo_kv numeric,
  add column if not exists oil_tgd_20c_percent numeric,
  add column if not exists oil_tgd_20c_loaibo_percent numeric,
  add column if not exists oil_tgd_20c_loaibo_uhv_percent numeric,
  add column if not exists oil_tgd_20c_uhv_um_kv numeric,
  add column if not exists created_at timestamptz;
alter table measurements
  add column if not exists tram text,
  add column if not exists thiet_bi text,
  add column if not exists equipment_type text,
  add column if not exists mba_subtype text,
  add column if not exists manufacturer text,
  add column if not exists pha text,
  add column if not exists lan_do integer,
  add column if not exists sample_date date,
  add column if not exists h2 numeric,
  add column if not exists ch4 numeric,
  add column if not exists c2h6 numeric,
  add column if not exists c2h4 numeric,
  add column if not exists c2h2 numeric,
  add column if not exists co numeric,
  add column if not exists co2 numeric,
  add column if not exists ghi_chu text,
  add column if not exists bbtn_url text,
  add column if not exists bbtn_name text,
  add column if not exists kieu_may text,
  add column if not exists nam_sx integer,
  add column if not exists nam_van_hanh integer,
  add column if not exists dien_ap_dm text,
  add column if not exists so_che_tao text,
  add column if not exists loai_dau text,
  add column if not exists ket_cau_cach_dien text,
  add column if not exists hien_trang_van_hanh text,
  add column if not exists ngay_thi_nghiem date,
  add column if not exists ly_do_thi_nghiem text,
  add column if not exists nhiet_do numeric,
  add column if not exists do_am numeric,
  add column if not exists n2 numeric,
  add column if not exists o2 numeric,
  add column if not exists bang63_voltage_class text,
  add column if not exists bang63_applicable boolean,
  add column if not exists edited_fields text,
  add column if not exists edited_at timestamptz,
  add column if not exists edit_log text,
  add column if not exists created_at timestamptz;
alter table stations
  add column if not exists ma_tram text,
  add column if not exists ten_tram text,
  add column if not exists created_at timestamptz;
alter table oil_tests
  add column if not exists tram text,
  add column if not exists thiet_bi text,
  add column if not exists oil_sample_point text,
  add column if not exists phase text,
  add column if not exists voltage_class text,
  add column if not exists oil_state text,
  add column if not exists has_membrane_n2 boolean,
  add column if not exists manufacturer text,
  add column if not exists sample_date date,
  add column if not exists moisture_ppm numeric,
  add column if not exists tgd_90c_percent numeric,
  add column if not exists bdv_kv numeric,
  add column if not exists ghi_chu text,
  add column if not exists created_at timestamptz;
alter table oltc_oil_tests
  add column if not exists tram text,
  add column if not exists thiet_bi text,
  add column if not exists oltc_sample_point text,
  add column if not exists phase text,
  add column if not exists voltage_class text,
  add column if not exists oil_state text,
  add column if not exists has_membrane_n2 boolean,
  add column if not exists manufacturer text,
  add column if not exists sample_date date,
  add column if not exists moisture_ppm numeric,
  add column if not exists tgd_90c_percent numeric,
  add column if not exists bdv_kv numeric,
  add column if not exists ghi_chu text,
  add column if not exists created_at timestamptz;
alter table instrument_oil_tests
  add column if not exists tram text,
  add column if not exists thiet_bi text,
  add column if not exists equipment_type text,
  add column if not exists phase text,
  add column if not exists manufacturer text,
  add column if not exists sample_date date,
  add column if not exists moisture_ppm numeric,
  add column if not exists tgd_90c_percent numeric,
  add column if not exists bdv_kv numeric,
  add column if not exists tgd_20c_percent numeric,
  add column if not exists um_kv numeric,
  add column if not exists ghi_chu text,
  add column if not exists created_at timestamptz;
alter table feedback
  add column if not exists content text,
  add column if not exists image_url text,
  add column if not exists image_name text,
  add column if not exists created_at timestamptz;
alter table regulation_config
  add column if not exists citation text,
  add column if not exists values_json text,
  add column if not exists updated_at timestamptz;

-- 2) Cột "lưu vết" + id file Drive vốn chỉ có ở Google Sheets — cần có để bản sao đầy đủ.
alter table measurements
  add column if not exists created_by text, add column if not exists updated_by text,
  add column if not exists updated_at timestamptz, add column if not exists bbtn_file_id text;
alter table oil_tests
  add column if not exists created_by text, add column if not exists updated_by text,
  add column if not exists updated_at timestamptz;
alter table oltc_oil_tests
  add column if not exists created_by text, add column if not exists updated_by text,
  add column if not exists updated_at timestamptz;
alter table instrument_oil_tests
  add column if not exists created_by text, add column if not exists updated_by text,
  add column if not exists updated_at timestamptz;
alter table feedback
  add column if not exists image_file_id text, add column if not exists created_by text,
  add column if not exists updated_by text, add column if not exists updated_at timestamptz;

-- 3) Bản sao phải nhận đúng những gì Google Sheets đang có — Sheets không ràng buộc "bắt buộc
--    nhập"/"không trùng tên trạm", nên bỏ các ràng buộc này để dòng hợp lệ ở Sheets không bị từ chối.
alter table stations alter column ten_tram drop not null;
alter table stations drop constraint if exists stations_ten_tram_key;
alter table feedback alter column content drop not null;

-- 4) Khóa quyền anon key (service_role của Code.gs bỏ qua RLS nên vẫn ghi được).
drop policy if exists "measurements_all" on measurements;
drop policy if exists "standards_all" on manufacturer_standards;
drop policy if exists "stations_all" on stations;
drop policy if exists "oiltests_all" on oil_tests;
drop policy if exists "oltc_oiltests_all" on oltc_oil_tests;
drop policy if exists "instrument_oiltests_all" on instrument_oil_tests;
drop policy if exists "feedback_all" on feedback;
drop policy if exists "regulation_config_all" on regulation_config;
alter table measurements enable row level security;
alter table manufacturer_standards enable row level security;
alter table stations enable row level security;
alter table oil_tests enable row level security;
alter table oltc_oil_tests enable row level security;
alter table instrument_oil_tests enable row level security;
alter table feedback enable row level security;
alter table regulation_config enable row level security;
drop policy if exists "bbtn_insert" on storage.objects;
drop policy if exists "bbtn_select" on storage.objects;
drop policy if exists "bbtn_update" on storage.objects;
drop policy if exists "feedback_insert" on storage.objects;
drop policy if exists "feedback_select" on storage.objects;
drop policy if exists "feedback_update" on storage.objects;
update storage.buckets set public = false where id in ('bbtn', 'feedback');
