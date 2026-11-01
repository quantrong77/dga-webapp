/**
 * Unit Test Suite for scripts/md-to-html.js (Markdown to HTML parser)
 * Senior QA Engineer & Test Automation Specialist
 * Structure: AAA (Arrange - Act - Assert)
 * Coverage: Headings, inline styling, links, blockquotes, tables, lists, edge cases
 */

const { mdToHtml } = require("../scripts/md-to-html.js");

describe("md-to-html: Headings & Inline Formatting", () => {
  test("Arrange/Act/Assert: converts h3 (###) and h4 (####)", () => {
    // Arrange
    const md = "### Tiêu đề cấp 3\n#### Tiêu đề cấp 4";

    // Act
    const html = mdToHtml(md);

    // Assert
    expect(html).toContain("<h3>Tiêu đề cấp 3</h3>");
    expect(html).toContain("<h4>Tiêu đề cấp 4</h4>");
  });

  test("Inline tags: converts bold, italic, and inline code", () => {
    // Arrange
    const md = "Văn bản **chữ đậm**, *chữ nghiêng*, và `mã code`.";

    // Act
    const html = mdToHtml(md);

    // Assert
    expect(html).toContain("<strong>chữ đậm</strong>");
    expect(html).toContain("<em>chữ nghiêng</em>");
    expect(html).toContain("<code>mã code</code>");
  });

  test("Links: converts external links to <a> tags and strips internal anchor links", () => {
    // Arrange
    const md = "Xem [Trang chủ](https://example.com) hoặc [Phần 1](#section-1).";

    // Act
    const html = mdToHtml(md);

    // Assert
    expect(html).toContain('<a href="https://example.com">Trang chủ</a>');
    expect(html).toContain("hoặc Phần 1."); // Stripped anchor link
    expect(html).not.toContain('href="#section-1"');
  });

  test("XSS Escaping: escapes HTML special chars in raw text", () => {
    // Arrange
    const md = "Đánh giá khi H2 < 100 & CH4 > 50.";

    // Act
    const html = mdToHtml(md);

    // Assert
    expect(html).toContain("&lt; 100 &amp; CH4 &gt; 50");
  });
});

describe("md-to-html: Block Elements (Blockquotes, Tables, Lists)", () => {
  test("Blockquotes: converts > syntax into sm-note paragraph", () => {
    // Arrange
    const md = "> Lưu ý quan trọng: kiểm tra lại trước khi đóng điện.";

    // Act
    const html = mdToHtml(md);

    // Assert
    expect(html).toBe('<p class="sm-note">Lưu ý quan trọng: kiểm tra lại trước khi đóng điện.</p>');
  });

  test("Tables: parses GFM markdown tables with column alignment classes", () => {
    // Arrange
    const md = `| Khí | Giới hạn | Đánh giá |
|:---|:---:|---:|
| H2 | 100 | Đạt |
| C2H2 | 2 | Cảnh báo |`;

    // Act
    const html = mdToHtml(md);

    // Assert
    expect(html).toContain('<div class="table-scroll"><table>');
    expect(html).toContain("<th>Khí</th>");
    expect(html).toContain('<th style="text-align: center;">Giới hạn</th>');
    expect(html).toContain('<th style="text-align: right;">Đánh giá</th>');
    expect(html).toContain("<td>H2</td>");
    expect(html).toContain('<td style="text-align: center;">100</td>');
    expect(html).toContain('<td style="text-align: right;">Đạt</td>');
  });

  test("Lists: parses unordered (-/ *) and ordered (1.) lists", () => {
    // Arrange
    const md = `- Mục thứ nhất
- Mục thứ hai

1. Bước 1
2. Bước 2`;

    // Act
    const html = mdToHtml(md);

    // Assert
    expect(html).toContain('<ul class="rec-list">');
    expect(html).toContain("<li>Mục thứ nhất</li>");
    expect(html).toContain("<li>Mục thứ hai</li>");
    expect(html).toContain('<ol type="1">');
    expect(html).toContain("<li>Bước 1</li>");
    expect(html).toContain("<li>Bước 2</li>");
  });

  test("Edge case: handles empty string, whitespace lines, and single line text", () => {
    // Arrange & Act & Assert
    expect(mdToHtml("")).toBe("");
    expect(mdToHtml("\n\n   \n")).toBe("");
    expect(mdToHtml("Đoạn văn bình thường.")).toBe("<p>Đoạn văn bình thường.</p>");
  });
});

