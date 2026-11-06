#!/usr/bin/env node
/* scripts/dedupe-uploads.js — Gom tệp đính kèm TRÙNG NỘI DUNG trong data/uploads/ (máy chủ on-premise) về cấu trúc
 * mới data/uploads/<yyyy>/<mm>/<sha8>_<ten> (giống backend/onpremise/uploads.js) và cập nhật liên kết trong database.json.
 *
 *   node scripts/dedupe-uploads.js              # = --dry-run: CHỈ in kế hoạch, không đổi gì
 *   node scripts/dedupe-uploads.js --dry-run
 *   node scripts/dedupe-uploads.js --apply      # làm thật (phải DỪNG máy chủ trước)
 *   Thêm --data-dir <thư mục> để chạy trên thư mục dữ liệu khác (mặc định: như backend/onpremise/db.js, DGA_DATA_DIR hoặc ./data).
 *
 * Khi --apply:
 *   1. Sao lưu database.json → database.json.bak-<thời điểm> (đã nằm trong data/.gitignore);
 *   2. Mỗi nhóm cùng nội dung: giữ 1 file (bản tải lên SỚM NHẤT, chuyển vào <yyyy>/<mm>/ theo ngày của nó), xóa bản trùng;
 *   3. Mọi giá trị chuỗi trong database.json bằng id cũ (VD bbtn_file_id) hoặc chứa /api/files/<id cũ> (bbtn_url,
 *      image_url) được đổi sang id/URL mới. Tên gốc (bbtn_name, image_name) giữ nguyên.
 * Máy chủ giữ database trong bộ nhớ và ghi đè cả file khi lưu → chạy lúc máy chủ đang bật sẽ mất phần cập nhật liên
 * kết; script kiểm tra cổng máy chủ (PORT hoặc 8080, 8091) và dừng nếu đang có máy chủ trả lời.
 */
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const uploads = require("../backend/onpremise/uploads");

const LEGACY_PREFIX = /^\d{13}_/; // <Date.now()>_<ten> — cách đặt tên cũ của backend/onpremise/api.js

function listFiles(uploadsDir) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name !== ".gitkeep") out.push(p);
    }
  };
  if (fs.existsSync(uploadsDir)) walk(uploadsDir);
  return out;
}

/** Kế hoạch gom: không đổi gì trên đĩa. */
function planDedupe(dataDir) {
  const uploadsDir = path.join(dataDir, "uploads");
  const dbFile = path.join(dataDir, "database.json");
  const files = listFiles(uploadsDir).map((p) => {
    const st = fs.statSync(p);
    const id = uploads.toId(uploadsDir, p);
    return { path: p, id, size: st.size, mtime: st.mtime, nested: id.includes("/"), sha256: uploads.sha256(fs.readFileSync(p)) };
  });
  const byHash = new Map();
  for (const f of files) {
    if (!byHash.has(f.sha256)) byHash.set(f.sha256, []);
    byHash.get(f.sha256).push(f);
  }

  const reserved = new Set(files.filter((f) => f.nested).map((f) => f.path));
  const groups = [];
  for (const [hash, list] of byHash) {
    list.sort((a, b) => a.mtime - b.mtime || a.id.localeCompare(b.id));
    // Đã có bản kiểu mới cho nội dung này → giữ bản đó; chưa có → bản sớm nhất, đặt tên mới theo tháng của nó
    const keep = list.find((f) => f.nested) || list[0];
    let target = keep.path;
    if (!keep.nested) {
      const original = path.basename(keep.path).replace(LEGACY_PREFIX, "");
      target = uploads.newPathFor(uploadsDir, hash, original, keep.mtime);
      // newPathFor() chỉ tránh file ĐÃ có trên đĩa; tránh thêm các đích đã dành cho nhóm khác trong cùng kế hoạch
      // (chỉ xảy ra khi 2 nội dung khác nhau trùng 8 ký tự băm đầu VÀ trùng tên — gần như không bao giờ).
      const dir = path.dirname(target);
      const prefix = hash.slice(0, uploads.SHA_PREFIX_LEN);
      const clean = uploads.safeFileName(original);
      for (let i = 2; reserved.has(target); i++) target = path.join(dir, `${prefix}-${i}_${clean}`);
      reserved.add(target);
    }
    const targetId = uploads.toId(uploadsDir, target);
    const moves = list.map((f) => ({ fromId: f.id, toId: targetId, from: f.path, keep: f === keep, size: f.size }));
    if (moves.every((m) => m.fromId === m.toId)) continue; // đã đúng cấu trúc, không trùng
    groups.push({ sha256: hash, target, targetId, moves });
  }

  // Liên kết trong database.json
  const idMap = new Map();
  for (const g of groups) for (const m of g.moves) if (m.fromId !== m.toId) idMap.set(m.fromId, m.toId);
  const db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile, "utf8")) : {};
  const refUpdates = [];
  for (const [table, rows] of Object.entries(db)) {
    if (!Array.isArray(rows)) continue;
    rows.forEach((row, idx) => {
      if (!row || typeof row !== "object") return;
      for (const [field, value] of Object.entries(row)) {
        const next = remapValue(value, idMap);
        if (next !== value) refUpdates.push({ table, idx, rowId: row.id, field, from: value, to: next });
      }
    });
  }
  const duplicates = groups.flatMap((g) => g.moves.filter((m) => !m.keep));
  return {
    dataDir,
    uploadsDir,
    dbFile,
    totalFiles: files.length,
    totalBytes: files.reduce((s, f) => s + f.size, 0),
    distinctContents: byHash.size,
    groups,
    duplicates: duplicates.length,
    bytesFreed: duplicates.reduce((s, m) => s + m.size, 0),
    refUpdates,
  };
}

/** Đổi id cũ → mới trong 1 giá trị: bằng đúng id (…_file_id) hoặc chứa /api/files/<id đã mã hóa> (…_url). */
function remapValue(value, idMap) {
  if (typeof value !== "string" || !idMap.size) return value;
  if (idMap.has(value)) return idMap.get(value);
  const m = value.match(/\/api\/files\/([^?#]+)/);
  if (!m) return value;
  let oldId;
  try {
    oldId = decodeURIComponent(m[1]);
  } catch (_) {
    return value;
  }
  if (!idMap.has(oldId)) return value;
  return value.replace(`/api/files/${m[1]}`, uploads.fileUrl(idMap.get(oldId)));
}

/** Thực hiện kế hoạch: sao lưu DB → chuyển/xóa file → ghi DB (ghi nguyên tử qua file tạm). */
function applyPlan(plan, now = new Date()) {
  let backup = null;
  if (fs.existsSync(plan.dbFile)) {
    backup = `${plan.dbFile}.bak-${now.toISOString().replace(/[:.]/g, "-")}`;
    fs.copyFileSync(plan.dbFile, backup);
  }
  for (const g of plan.groups) {
    const keep = g.moves.find((m) => m.keep);
    if (keep.from !== g.target) {
      fs.mkdirSync(path.dirname(g.target), { recursive: true });
      fs.renameSync(keep.from, g.target);
    }
    for (const m of g.moves) if (!m.keep) fs.rmSync(m.from, { force: true });
  }
  if (plan.refUpdates.length && fs.existsSync(plan.dbFile)) {
    const db = JSON.parse(fs.readFileSync(plan.dbFile, "utf8"));
    for (const u of plan.refUpdates) db[u.table][u.idx][u.field] = u.to;
    const tmp = `${plan.dbFile}.${Date.now()}.dedupe.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(tmp, plan.dbFile);
  }
  return { backup };
}

function formatBytes(n) {
  return n >= 1048576 ? `${(n / 1048576).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`;
}

function printPlan(plan) {
  console.log(`Thư mục dữ liệu: ${plan.dataDir}`);
  console.log(`Tệp hiện có: ${plan.totalFiles} (${formatBytes(plan.totalBytes)}) — ${plan.distinctContents} nội dung khác nhau`);
  console.log(`Sẽ xóa bản trùng: ${plan.duplicates} tệp, giải phóng ${formatBytes(plan.bytesFreed)}`);
  console.log(`Sẽ chuyển sang cấu trúc <yyyy>/<mm>/<sha8>_<ten>: ${plan.groups.length} tệp giữ lại`);
  console.log(`Liên kết cần cập nhật trong database.json: ${plan.refUpdates.length}`);
  const byTable = {};
  for (const u of plan.refUpdates) byTable[`${u.table}.${u.field}`] = (byTable[`${u.table}.${u.field}`] || 0) + 1;
  for (const [k, n] of Object.entries(byTable)) console.log(`  - ${k}: ${n}`);
  console.log("\nChi tiết (giữ ← số bản gộp vào):");
  for (const g of [...plan.groups].sort((a, b) => b.moves.length - a.moves.length)) {
    const keep = g.moves.find((m) => m.keep);
    console.log(`  ${g.targetId}  ←  ${g.moves.length} tệp (giữ ${keep.fromId}, ${formatBytes(keep.size)})`);
  }
}

function serverAlive(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port, path: "/api?action=health", timeout: 800 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main(argv) {
  const apply = argv.includes("--apply");
  const di = argv.indexOf("--data-dir");
  const dataDir = di >= 0 ? path.resolve(argv[di + 1]) : require("../backend/onpremise/db").DATA_DIR;
  const plan = planDedupe(dataDir);
  printPlan(plan);
  if (!apply) {
    console.log("\n[--dry-run] Chưa thay đổi gì. Chạy lại với --apply để thực hiện (dừng máy chủ trước).");
    return 0;
  }
  const ports = [...new Set([process.env.PORT, 8080, 8091].filter(Boolean).map(Number))];
  for (const p of ports) {
    if (await serverAlive(p)) {
      console.error(`\nMáy chủ đang chạy ở cổng ${p} — dừng máy chủ rồi chạy lại (máy chủ sẽ ghi đè database.json).`);
      return 2;
    }
  }
  const { backup } = applyPlan(plan);
  console.log(`\nĐã gom xong.${backup ? ` Bản sao lưu database: ${backup}` : ""}`);
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { planDedupe, applyPlan, remapValue };
