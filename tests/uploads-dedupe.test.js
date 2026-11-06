// Tệp đính kèm on-premise lưu theo mã băm nội dung (server/uploads.js) + script gom tệp trùng (scripts/dedupe-uploads.js).
// Bộ test dùng thư mục dữ liệu tạm riêng (tests/setup-test-env.js) — không đụng data/ thật.
const fs = require("fs");
const os = require("os");
const path = require("path");
const EventEmitter = require("events");
const uploads = require("../server/uploads");
const { UPLOADS_DIR } = require("../server/db");
const auth = require("../server/auth");
const { handleApiRequest, handleFileDownload } = require("../server/api");
const { planDedupe, applyPlan, remapValue } = require("../scripts/dedupe-uploads");

function tmpDir(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `dga-uploads-${tag}-`));
}

describe("server/uploads.js — lưu theo mã băm nội dung", () => {
  let dir;
  beforeEach(() => {
    dir = tmpDir("store");
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test("đường dẫn <yyyy>/<mm>/<sha8>_<ten-an-toan>", () => {
    const buf = Buffer.from("noi dung BBTN 1");
    const r = uploads.storeUpload(dir, buf, "Biên bản DGA (AT2).pdf", new Date(2026, 10, 6));
    const sha8 = uploads.sha256(buf).slice(0, 8);
    expect(r.id).toBe(`2026/11/${sha8}_Bi_n_b_n_DGA__AT2_.pdf`);
    expect(r.reused).toBe(false);
    expect(fs.readFileSync(path.join(dir, r.id), "utf8")).toBe("noi dung BBTN 1");
  });

  test("cùng nội dung tải lại (khác tên, khác tháng) → dùng lại file cũ, không lưu trùng", () => {
    const buf = Buffer.from("cung 1 bien ban");
    const a = uploads.storeUpload(dir, buf, "a.pdf", new Date(2026, 0, 1));
    const b = uploads.storeUpload(dir, buf, "b.pdf", new Date(2026, 5, 1));
    expect(b.reused).toBe(true);
    expect(b.id).toBe(a.id);
    const all = [];
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : all.push(e.name)));
    walk(dir);
    expect(all).toHaveLength(1);
  });

  test("khác nội dung → 2 file riêng", () => {
    const a = uploads.storeUpload(dir, Buffer.from("A"), "x.pdf");
    const b = uploads.storeUpload(dir, Buffer.from("B"), "x.pdf");
    expect(a.id).not.toBe(b.id);
  });

  test("trùng 8 ký tự băm đầu nhưng khác nội dung → không ghi đè (thêm hậu tố)", () => {
    const real = Buffer.from("noi dung that");
    const sha8 = uploads.sha256(real).slice(0, 8);
    const now = new Date();
    const mdir = path.join(dir, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"));
    fs.mkdirSync(mdir, { recursive: true });
    fs.writeFileSync(path.join(mdir, `${sha8}_x.pdf`), "noi dung khac, gia lap va cham");
    const r = uploads.storeUpload(dir, real, "x.pdf", now);
    expect(r.reused).toBe(false);
    expect(path.basename(r.id)).toBe(`${sha8}-2_x.pdf`);
    expect(fs.readFileSync(path.join(mdir, `${sha8}_x.pdf`), "utf8")).toBe("noi dung khac, gia lap va cham");
  });

  test("fileUrl giữ dạng /api/files/<id mã hóa>", () => {
    expect(uploads.fileUrl("2026/11/abcd1234_a.pdf")).toBe("/api/files/2026%2F11%2Fabcd1234_a.pdf");
  });
});

describe("API uploadAttachment / tải tệp", () => {
  let token;
  beforeAll(() => {
    auth.initDefaultAdmin();
    token = auth.login("admin@ptc3.evnnpt.vn", "admin123456").token;
  });

  function call(method, url, body) {
    const urlObj = new URL(url, "http://localhost:8080");
    const req = new EventEmitter();
    req.method = method;
    req.headers = { host: "localhost:8080" };
    const res = {
      statusCode: 200,
      headers: {},
      body: "",
      writeHead(code, h) {
        this.statusCode = code;
        this.headers = h || {};
      },
      end(chunk) {
        if (chunk) this.body += chunk;
      },
    };
    setImmediate(() => {
      if (body) req.emit("data", JSON.stringify(body));
      req.emit("end");
    });
    return { req, res, urlObj };
  }

  async function upload(filename, text) {
    const { req, res, urlObj } = call("POST", "/api", {
      action: "uploadAttachment",
      token,
      filename,
      base64Data: Buffer.from(text).toString("base64"),
    });
    await handleApiRequest(req, res, urlObj);
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body);
  }

  test("tải lên 2 lần cùng nội dung → cùng id/url, name là tên gốc từng lần", async () => {
    const a = await upload("BBTN lần 1.pdf", "%PDF-1.4 cung noi dung");
    const b = await upload("BBTN lần 2.pdf", "%PDF-1.4 cung noi dung");
    expect(b.id).toBe(a.id);
    expect(b.url).toBe(a.url);
    expect(a.name).toBe("BBTN lần 1.pdf");
    expect(b.name).toBe("BBTN lần 2.pdf");
    expect(a.id).toMatch(/^\d{4}\/\d{2}\/[0-9a-f]{8}_BBTN_l_n_1\.pdf$/);
  });

  function download(url) {
    const urlObj = new URL(url, "http://localhost:8080");
    const chunks = [];
    const res = new (require("stream").Writable)({
      write(c, _e, cb) {
        chunks.push(c);
        cb();
      },
    });
    res.writeHead = (code, h) => {
      res.statusCode = code;
      res.headers = h;
    };
    const done = new Promise((resolve) => {
      res.on("finish", resolve);
      const origEnd = res.end.bind(res);
      res.end = (c) => {
        if (c) chunks.push(Buffer.from(c));
        origEnd();
      };
    });
    handleFileDownload({}, res, urlObj);
    return done.then(() => ({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
  }

  test("tải về tệp kiểu mới (thư mục con) và tệp kiểu cũ (phẳng)", async () => {
    const a = await upload("moi.pdf", "%PDF tep kieu moi");
    expect(await download(a.url)).toEqual({ status: 200, body: "%PDF tep kieu moi" });
    fs.writeFileSync(path.join(UPLOADS_DIR, "1700000000000_cu.pdf"), "%PDF tep kieu cu");
    expect(await download("/api/files/1700000000000_cu.pdf")).toEqual({ status: 200, body: "%PDF tep kieu cu" });
  });

  test("đường dẫn tới THƯ MỤC hoặc ra ngoài uploads → 404 (không stream thư mục)", async () => {
    await upload("x.pdf", "%PDF bat ky");
    const year = String(new Date().getFullYear());
    expect((await download(`/api/files/${year}`)).status).toBe(404);
    expect((await download(`/api/files/${encodeURIComponent("../database.json")}`)).status).toBe(404);
  });
});

describe("scripts/dedupe-uploads.js", () => {
  let dataDir;
  beforeEach(() => {
    dataDir = tmpDir("dedupe");
    const up = path.join(dataDir, "uploads");
    fs.mkdirSync(up, { recursive: true });
    fs.writeFileSync(path.join(up, ".gitkeep"), "");
    const put = (name, text, isoDate) => {
      const p = path.join(up, name);
      fs.writeFileSync(p, text);
      const t = new Date(isoDate);
      fs.utimesSync(p, t, t);
    };
    put("1790000000001_bb.pdf", "NOI DUNG A", "2026-10-01T08:00:00Z");
    put("1790000000002_bb.pdf", "NOI DUNG A", "2026-11-02T08:00:00Z");
    put("1790000000003_bb_copy.pdf", "NOI DUNG A", "2026-11-03T08:00:00Z");
    put("1790000000004_khac.pdf", "NOI DUNG B", "2026-11-04T08:00:00Z");
    const db = {
      measurements: [
        { id: "m1", bbtn_url: "/api/files/1790000000002_bb.pdf", bbtn_name: "Biên bản.pdf", bbtn_file_id: "1790000000002_bb.pdf" },
        { id: "m2", bbtn_url: "http://192.168.1.5:8080/api/files/1790000000004_khac.pdf", bbtn_name: "khác.pdf" },
        { id: "m3", bbtn_url: "local:m3", bbtn_name: "x.pdf" },
      ],
      feedback: [{ id: "f1", image_url: "/api/files/1790000000003_bb_copy.pdf", image_file_id: "1790000000003_bb_copy.pdf" }],
      users: [],
    };
    fs.writeFileSync(path.join(dataDir, "database.json"), JSON.stringify(db, null, 2));
  });
  afterEach(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  test("dry-run: lập kế hoạch, KHÔNG đổi gì trên đĩa", () => {
    const before = fs.readdirSync(path.join(dataDir, "uploads")).sort();
    const dbBefore = fs.readFileSync(path.join(dataDir, "database.json"), "utf8");
    const plan = planDedupe(dataDir);
    expect(plan.totalFiles).toBe(4);
    expect(plan.distinctContents).toBe(2);
    expect(plan.duplicates).toBe(2);
    expect(plan.refUpdates).toHaveLength(5);
    expect(fs.readdirSync(path.join(dataDir, "uploads")).sort()).toEqual(before);
    expect(fs.readFileSync(path.join(dataDir, "database.json"), "utf8")).toBe(dbBefore);
  });

  test("apply: giữ bản sớm nhất theo tháng của nó, xóa bản trùng, cập nhật liên kết, có bản sao lưu", () => {
    const plan = planDedupe(dataDir);
    const { backup } = applyPlan(plan);
    expect(fs.existsSync(backup)).toBe(true);

    const shaA = uploads.sha256(Buffer.from("NOI DUNG A")).slice(0, 8);
    const shaB = uploads.sha256(Buffer.from("NOI DUNG B")).slice(0, 8);
    const idA = `2026/10/${shaA}_bb.pdf`;
    const idB = `2026/11/${shaB}_khac.pdf`;
    const up = path.join(dataDir, "uploads");
    expect(fs.readFileSync(path.join(up, idA), "utf8")).toBe("NOI DUNG A");
    expect(fs.readFileSync(path.join(up, idB), "utf8")).toBe("NOI DUNG B");
    expect(fs.readdirSync(up).sort()).toEqual([".gitkeep", "2026"]);

    const db = JSON.parse(fs.readFileSync(path.join(dataDir, "database.json"), "utf8"));
    expect(db.measurements[0].bbtn_url).toBe(uploads.fileUrl(idA));
    expect(db.measurements[0].bbtn_file_id).toBe(idA);
    expect(db.measurements[0].bbtn_name).toBe("Biên bản.pdf");
    expect(db.measurements[1].bbtn_url).toBe(`http://192.168.1.5:8080${uploads.fileUrl(idB)}`);
    expect(db.measurements[2].bbtn_url).toBe("local:m3");
    expect(db.feedback[0].image_url).toBe(uploads.fileUrl(idA));
    expect(db.feedback[0].image_file_id).toBe(idA);
  });

  test("chạy lại sau khi đã gom → không còn gì để làm", () => {
    applyPlan(planDedupe(dataDir));
    const again = planDedupe(dataDir);
    expect(again.groups).toEqual([]);
    expect(again.refUpdates).toEqual([]);
  });

  test("remapValue chỉ đổi đúng id/URL trong bảng ánh xạ", () => {
    const map = new Map([["1_a.pdf", "2026/11/abcdef12_a.pdf"]]);
    expect(remapValue("1_a.pdf", map)).toBe("2026/11/abcdef12_a.pdf");
    expect(remapValue("/api/files/1_a.pdf", map)).toBe("/api/files/2026%2F11%2Fabcdef12_a.pdf");
    expect(remapValue("/api/files/9_khac.pdf", map)).toBe("/api/files/9_khac.pdf");
    expect(remapValue(42, map)).toBe(42);
  });
});
