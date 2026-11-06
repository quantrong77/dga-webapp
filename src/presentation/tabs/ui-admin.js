/* ui-admin.js — Tab "Quản trị": danh sách user (chỉ Admin xem/thao tác được, xem
   requireAdmin() ở gsheet/Code.gs — đây chỉ là hiển thị, quyền thật kiểm tra ở
   server). Tách từ app.js — xem ui-auth.js đầu file đó để biết quy ước chia sẻ
   scope giữa các file ui-*.js. */

async function refreshUsersUI() {
  const users = await Auth.listUsers();
  const tbody = $("usersTable");
  tbody.innerHTML = "";
  $("usersEmpty").classList.toggle("hidden", users.length > 0);

  users
    .slice()
    .sort((a, b) => (a.email || "").localeCompare(b.email || ""))
    .forEach((u) => {
      const isSelf = Auth.current && Auth.current.email === u.email;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(u.email)}${isSelf ? ' <span class="pill muted">bạn</span>' : ""}</td>
        <td></td>
        <td style="font-size:12px;">${escapeHtml(u.created_at || "—")}</td>
        <td style="font-size:12px;">${escapeHtml(u.last_login || "—")}</td>
        <td></td>
      `;
      const roleCell = tr.children[1];
      const sel = document.createElement("select");
      sel.className = "role-select";
      // 3 vai trò hợp lệ — xem VALID_ROLES ở gsheet/Code.gs. "viewer" từng bị thiếu ở đây
      // (chỉ có user/admin) dù server đã hỗ trợ đủ 3 vai trò từ trước.
      sel.innerHTML = `<option value="user">User</option><option value="viewer">Viewer</option><option value="admin">Admin</option>`;
      sel.value = u.role === "admin" ? "admin" : u.role === "viewer" ? "viewer" : "user";
      // Không cho tự hạ quyền chính mình để tránh tự khóa mình khỏi tab Quản trị.
      sel.disabled = isSelf;
      sel.addEventListener("change", async () => {
        try {
          await Auth.setUserRole(u.email, sel.value);
          await refreshUsersUI();
        } catch (err) {
          notifyError("Đổi quyền thất bại: " + ((err && err.message) || err));
          await refreshUsersUI();
        }
      });
      roleCell.appendChild(sel);

      const delCell = tr.children[4];
      delCell.style.display = "flex";
      delCell.style.gap = "6px";
      // Đặt lại mật khẩu — cho MỌI user kể cả chính mình (Admin quên mật khẩu chính tài
      // khoản của mình vẫn cần lối thoát) — dùng actionAdminResetPassword() (Code.gs),
      // KHÁC actionChangePassword() (không cần biết mật khẩu cũ, chỉ Admin gọi được).
      const resetBtn = document.createElement("button");
      resetBtn.className = "btn ghost";
      resetBtn.textContent = "Đặt lại mật khẩu";
      resetBtn.addEventListener("click", async () => {
        if (!confirm(`Đặt mật khẩu TẠM mới cho ${u.email}? Mọi thiết bị đang đăng nhập bằng tài khoản này sẽ bị đăng xuất.`)) return;
        try {
          const result = await Auth.adminResetPassword(u.email);
          showTempPasswordModal(u.email, result.tempPassword, "Mật khẩu tạm mới");
        } catch (err) {
          notifyError("Đặt lại mật khẩu thất bại: " + ((err && err.message) || err));
        }
      });
      delCell.appendChild(resetBtn);
      if (!isSelf) {
        const delBtn = document.createElement("button");
        delBtn.className = "btn danger";
        delBtn.textContent = "Xóa";
        delBtn.addEventListener("click", async () => {
          if (confirm(`Xóa tài khoản ${u.email}? Người này sẽ không đăng nhập được nữa.`)) {
            try {
              await Auth.deleteUser(u.email);
              await refreshUsersUI();
            } catch (err) {
              notifyError("Xóa user thất bại: " + ((err && err.message) || err));
            }
          }
        });
        delCell.appendChild(delBtn);
      }
      tbody.appendChild(tr);
    });
}

// ---------------------------------------------------------------------
// Tạo tài khoản trực tiếp (Admin) — xem toolbar #qt_newuser_email/#qt_newuser_role/
// #btnAdminCreateUser ở tab "Quản trị" (index.html). Cần thiết khi REGISTRATION_MODE
// (Code.gs) không phải "open" (tự đăng ký bị tắt), nhưng để mở cho MỌI chế độ vì Admin
// có thể muốn chủ động cấp tài khoản trước. Trả về mật khẩu TẠM giống "Đặt lại mật khẩu"
// (refreshUsersUI() ở trên) — cùng dùng chung showTempPasswordModal() bên dưới.
// ---------------------------------------------------------------------
async function onAdminCreateUser() {
  const emailInput = $("qt_newuser_email");
  const email = emailInput.value.trim();
  const role = $("qt_newuser_role").value;
  const errEl = $("qtNewUserError");
  errEl.classList.add("hidden");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    errEl.textContent = "Vui lòng nhập email hợp lệ.";
    errEl.classList.remove("hidden");
    return;
  }
  const btn = $("btnAdminCreateUser");
  btn.disabled = true;
  try {
    const result = await Auth.adminCreateUser(email, role);
    emailInput.value = "";
    $("qt_newuser_role").value = "user";
    await refreshUsersUI();
    showTempPasswordModal(result.email, result.tempPassword, "Đã tạo tài khoản");
  } catch (err) {
    errEl.textContent = (err && err.message) || String(err);
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
}

/** Modal dùng CHUNG cho "+ Tạo tài khoản" và "Đặt lại mật khẩu" (đều trả về 1 mật khẩu
 *  ngẫu nhiên CHỈ hiện ĐÚNG 1 LẦN — app không lưu lại, xem generateTempPassword() ở
 *  Code.gs) — xem #tempPasswordOverlay (index.html). titleSuffix tùy chọn để phân biệt
 *  2 tình huống gọi (mặc định "Mật khẩu tạm" khớp đúng tiêu đề có sẵn trong HTML). */
function showTempPasswordModal(email, tempPassword, title) {
  $("tempPasswordTitle").textContent = title || "Mật khẩu tạm";
  $("tempPasswordEmail").textContent = email;
  $("tempPasswordValue").textContent = tempPassword;
  $("tempPasswordOverlay").classList.remove("hidden");
}

// ---------------------------------------------------------------------
// Bản sao Supabase (khối dưới bảng người dùng ở tab "Quản trị") — trạng thái + nút đồng bộ toàn
// bộ. Việc ghi sang Supabase do Code.gs làm ở máy chủ; trình duyệt chỉ hỏi trạng thái/ra lệnh.
// ---------------------------------------------------------------------
async function refreshSupabaseSyncUI() {
  const statusEl = $("sbSyncStatus");
  try {
    const st = await Auth.supabaseSyncStatus();
    $("btnSyncSupabase").disabled = !st.enabled;
    statusEl.textContent = st.enabled
      ? `Đang bật — dữ liệu được ghi theo sang ${st.url}.`
      : "Chưa bật — đặt SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY trong Script properties của Apps Script (README mục 2c).";
    const errors = st.recentErrors || [];
    $("sbSyncErrorsWrap").classList.toggle("hidden", errors.length === 0);
    $("sbSyncErrors").innerHTML = errors.map((e) => `<tr>
      <td style="font-size:12px;">${escapeHtml(e.time ? new Date(e.time).toLocaleString("vi-VN") : "")}</td>
      <td>${escapeHtml(e.table)}</td><td>${escapeHtml(e.op)}</td><td>${escapeHtml(e.id)}</td>
      <td style="font-size:12px; max-width:360px;">${escapeHtml(e.error)}</td></tr>`).join("");
  } catch (err) {
    $("btnSyncSupabase").disabled = true;
    statusEl.textContent = "Không đọc được trạng thái (máy chủ chưa cập nhật Code.gs mới?): " + storageErrorMessage(err);
  }
}

async function onSyncSupabase() {
  if (!confirm("Chép toàn bộ dữ liệu Google Sheets sang Supabase và xóa các dòng chỉ còn bên Supabase? Trong lúc chạy, các thao tác lưu khác phải chờ.")) return;
  const btn = $("btnSyncSupabase");
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "Đang đồng bộ…";
  try {
    const res = await Auth.syncSupabase();
    const parts = Object.entries(res.summary || {}).map(([table, s]) =>
      s.error ? `${table}: LỖI` : `${table}: ${s.upserted} dòng${s.deleted ? `, xóa ${s.deleted}` : ""}`);
    const failed = Object.values(res.summary || {}).some((s) => s.error);
    showToast((failed ? "Đồng bộ xong nhưng có bảng lỗi — " : "Đã đồng bộ — ") + parts.join("; "), failed ? "error" : "success");
  } catch (err) {
    notifyError(storageErrorMessage(err));
  } finally {
    btn.textContent = original;
    await refreshSupabaseSyncUI();
  }
}

/** Nối các nút thao tác 1 LẦN lúc khởi động app (xem initApp(), app-core.js) — khác
 *  refreshUsersUI() (vẽ lại BẢNG mỗi lần mở tab "Quản trị", gọi riêng ở setupTabs()). */
function setupAdminUsers() {
  $("btnAdminCreateUser").addEventListener("click", onAdminCreateUser);
  $("btnSyncSupabase").addEventListener("click", onSyncSupabase);
  $("qt_newuser_email").addEventListener("keydown", (e) => {
    if (e.key === "Enter") onAdminCreateUser();
  });

  function closeTempPasswordModal() {
    $("tempPasswordOverlay").classList.add("hidden");
    // Xóa khỏi DOM ngay khi đóng — không giữ lại mật khẩu tạm trong bộ nhớ trình duyệt
    // lâu hơn cần thiết (đã cảnh báo trong index.html: "chỉ hiện đúng 1 lần").
    $("tempPasswordValue").textContent = "";
  }
  $("btnCloseTempPassword").addEventListener("click", closeTempPasswordModal);
  $("btnCloseTempPassword2").addEventListener("click", closeTempPasswordModal);

  $("btnCopyTempPassword").addEventListener("click", async () => {
    const value = $("tempPasswordValue").textContent;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showToast("Đã copy mật khẩu tạm.");
    } catch (err) {
      // Một số trình duyệt/ngữ cảnh (vd http không có TLS) chặn Clipboard API — vẫn để
      // người dùng tự bôi đen chọn thủ công trong <code id="tempPasswordValue">, không
      // chặn luồng chính vì đây chỉ là tiện ích phụ.
      notifyError("Không tự copy được (trình duyệt chặn) — vui lòng bôi đen mật khẩu tạm rồi copy thủ công.");
    }
  });
}
