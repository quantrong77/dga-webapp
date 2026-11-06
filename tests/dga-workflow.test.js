/* Lưu đồ "Quy trình nghiệp vụ đánh giá DGA" (src/presentation/tabs/ui-dga-workflow.js) — dựng được SVG, đủ các nhánh
 * của Điều 54 QĐ1901 / IEC 60599, mọi mũi tên đều chạm 1 khối (không mũi tên lơ lửng). */
const fs = require("fs");
const path = require("path");
const W = require("../src/presentation/tabs/ui-dga-workflow");

const byId = Object.fromEntries(W.WF_NODES.map((n) => [n.id, n]));
const text = W.WF_NODES.map((n) => n.lines.join(" ")).join(" ");

test("có đủ các bước/nhánh chính của Điều 54 và IEC 60599", () => {
  for (const s of ["Bảng 64", "Bảng 65", "C2H2/H2 > 2 – 3", "Bảng 66", "PD / D / T", "Duval", "Bảng 67", "CO2/CO", "O2/N2", "Bảng 63", "loại sự cố đổi khác", "3 ngày, 1, 3, 6 tháng"]) {
    expect(text).toContain(s);
  }
  expect(W.WF_NODES.map((n) => n.type)).toEqual(expect.arrayContaining(["normal", "alert", "alarm", "decision"]));
});

test("Tỷ lệ bổ sung đánh giá cho mọi dầu; Bảng 63 là nhánh rẽ riêng cho dầu mới/sau sửa chữa", () => {
  expect(byId.extra.lines.join(" ")).toMatch(/CO2\/CO, O2\/N2.*MỌI dầu/);
  expect(byId.extra.lines.join(" ")).not.toContain("Bảng 63");
  expect(byId.d_b63.type).toBe("decision");
  expect(byId.d_b63.lines.join(" ")).toMatch(/Dầu mới/);
  expect(byId.b63.lines.join(" ")).toContain("Bảng 63");
});

test("điểm cuối mỗi mũi tên nằm trên viền 1 khối", () => {
  const onBorder = ([x, y], n) => {
    const dx = Math.abs(x - n.x), dy = Math.abs(y - n.y);
    if (n.type === "decision") return Math.abs(dx / (n.w / 2) + dy / (n.h / 2) - 1) < 0.08;
    const inX = dx <= n.w / 2 + 2, inY = dy <= n.h / 2 + 2;
    return (inX && Math.abs(dy - n.h / 2) <= 6) || (inY && Math.abs(dx - n.w / 2) <= 6);
  };
  W.WF_EDGES.forEach((e) => {
    const end = e.pts[e.pts.length - 1];
    expect([end, W.WF_NODES.some((n) => onBorder(end, n))]).toEqual([end, true]);
  });
});

test("SVG dựng ra không có NaN, có chỉ số dưới cho công thức khí", () => {
  const svg = W.buildDgaWorkflowSvg();
  expect(svg).not.toMatch(/NaN|undefined/);
  expect(W.wfText("C2H2/H2 -> x")).toBe('C<tspan baseline-shift="sub" class="wf-sub">2</tspan>H<tspan baseline-shift="sub" class="wf-sub">2</tspan>/H<tspan baseline-shift="sub" class="wf-sub">2</tspan> → x');
  for (const id of Object.keys(byId)) expect(svg).toContain(`data-node="${id}"`);
});

test("index.html có khung lưu đồ và nạp script/CSS", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  expect(html).toContain('id="dgaWorkflowSvg"');
  expect(html).toContain('<script src="src/presentation/tabs/ui-dga-workflow.js"></script>');
  expect(html).toContain('href="src/presentation/styles/style-dga-workflow.css"');
});

test("các khối không chồng lên nhau (VD ô Bình thường không đè ô Xác định tiêu chuẩn)", () => {
  const box = (n) => [n.x - n.w / 2, n.y - n.h / 2, n.x + n.w / 2, n.y + n.h / 2];
  const overlap = (a, b) => a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1;
  for (let i = 0; i < W.WF_NODES.length; i++) {
    for (let j = i + 1; j < W.WF_NODES.length; j++) {
      const a = W.WF_NODES[i], b = W.WF_NODES[j];
      expect([a.id, b.id, overlap(box(a), box(b))]).toEqual([a.id, b.id, false]);
    }
  }
});

test("nhãn rẽ nhánh nằm ngay trên/cạnh đường mũi tên, không đè lên khối", () => {
  const approxW = (t) => t.length * 6.6; // ~12px chữ
  W.WF_EDGES.filter((e) => e.label).forEach((e) => {
    const { x, y, anchor } = e.labelPos;
    const [a, b] = e.pts;
    if (a[1] === b[1]) expect(a[1] - y).toBeGreaterThan(4); // nằm TRÊN đường ngang
    const w = approxW(e.label);
    const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
    const lbl = [x0, y - 7, x0 + w, y + 7];
    W.WF_NODES.forEach((n) => {
      if (n.type === "decision") return; // nhãn có thể chạm mép chéo của hình thoi
      const nb = [n.x - n.w / 2, n.y - n.h / 2, n.x + n.w / 2, n.y + n.h / 2];
      const hit = lbl[0] < nb[2] && nb[0] < lbl[2] && lbl[1] < nb[3] && nb[1] < lbl[3];
      expect([e.label, n.id, hit]).toEqual([e.label, n.id, false]);
    });
  });
});
