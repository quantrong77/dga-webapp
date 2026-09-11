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
      sel.innerHTML = `<option value="user">User</option><option value="admin">Admin</option>`;
      sel.value = u.role === "admin" ? "admin" : "user";
      // Không cho tự hạ quyền chính mình để tránh tự khóa mình khỏi tab Quản trị.
      sel.disabled = isSelf;
      sel.addEventListener("change", async () => {
        try {
          await Auth.setUserRole(u.email, sel.value);
          await refreshUsersUI();
        } catch (err) {
          alert("Đổi quyền thất bại: " + ((err && err.message) || err));
          await refreshUsersUI();
        }
      });
      roleCell.appendChild(sel);

      const delCell = tr.children[4];
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
              alert("Xóa user thất bại: " + ((err && err.message) || err));
            }
          }
        });
        delCell.appendChild(delBtn);
      }
      tbody.appendChild(tr);
    });
}
