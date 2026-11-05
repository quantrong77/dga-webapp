/* Lưu đồ "Quy trình nghiệp vụ đánh giá DGA" (ui/ui-dga-workflow.js) — dựng được SVG, đủ các nhánh
 * của Điều 54 QĐ1901 / IEC 60599, mọi mũi tên đều chạm 1 khối (không mũi tên lơ lửng). */
const fs = require("fs");
const path = require("path");
const W = require("../ui/ui-dga-workflow");

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
  expect(html).toContain('<script src="ui/ui-dga-workflow.js"></script>');
  expect(html).toContain('href="css/style-dga-workflow.css"');
});
