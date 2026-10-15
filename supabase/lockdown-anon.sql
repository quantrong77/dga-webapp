-- lockdown-anon.sql — KHÓA quyền truy cập bằng "anon key" vào dự án Supabase.
--
-- Vì sao: supabase-schema.sql tạo các policy "using (true) with check (true)" — ai có anon key
-- (key này từng nằm công khai trong config.js trên GitHub Pages và VẪN còn trong lịch sử git)
-- đều đọc/sửa/XÓA được toàn bộ dữ liệu + tải file lên 2 bucket "bbtn"/"feedback". App hiện dùng
-- Google Sheets nên không cần các quyền này.
--
-- Cách chạy: Supabase Dashboard > SQL Editor > dán toàn bộ file > Run. Chạy lại nhiều lần vẫn an toàn.
-- Sau khi chạy: RLS vẫn BẬT nhưng không còn policy nào cho anon/authenticated → mọi truy cập bằng
-- anon key bị từ chối (service_role key/Dashboard vẫn thao tác bình thường). Dữ liệu KHÔNG bị xóa.
--
-- Nên làm thêm (trên Dashboard, không làm được bằng SQL): Settings > API > "Roll" (đổi) JWT
-- secret/anon key để key cũ đã lộ hết hiệu lực hoàn toàn.
--
-- Muốn dùng lại chế độ Supabase về sau: cần thêm đăng nhập Supabase Auth + policy theo auth.uid()
-- và vai trò (VD: user chỉ UPDATE bản ghi created_by = chính mình, chỉ admin được DELETE) — chế độ
-- Supabase của app hiện CHƯA có màn hình đăng nhập, nên đừng chạy lại các policy "using (true)".

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

-- Storage: bỏ quyền ghi/đọc qua API của anon, và tắt "public" để link file không còn mở công khai.
drop policy if exists "bbtn_insert" on storage.objects;
drop policy if exists "bbtn_select" on storage.objects;
drop policy if exists "bbtn_update" on storage.objects;
drop policy if exists "feedback_insert" on storage.objects;
drop policy if exists "feedback_select" on storage.objects;
drop policy if exists "feedback_update" on storage.objects;
update storage.buckets set public = false where id in ('bbtn', 'feedback');
