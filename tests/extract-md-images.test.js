const { extractImages, slugify } = require("../scripts/extract-md-images");

const PNG_1PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("scripts/extract-md-images.js", () => {
  test("tách hình kiểu tham chiếu của Google Docs và đổi link", () => {
    const md = `# A\n\n![Hình 1][image1]\n\n[image1]: <data:image/png;base64,${PNG_1PX}>\n`;
    const { text, images } = extractImages(md, "docs/images/a");
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ name: "image1", ext: "png" });
    expect(images[0].buffer.slice(1, 4).toString()).toBe("PNG");
    expect(text).toContain("[image1]: docs/images/a/image1.png");
    expect(text).not.toContain("base64");
  });

  test("tách hình nhúng trực tiếp ![alt](data:...)", () => {
    const { text, images } = extractImages(`x ![sơ đồ](data:image/jpeg;base64,${PNG_1PX}) y`, "img");
    expect(images[0].ext).toBe("jpg");
    expect(text).toBe("x ![sơ đồ](img/inline1.jpg) y");
  });

  test("không có hình nhúng -> giữ nguyên nội dung", () => {
    const md = "[image1]: docs/images/a/image1.png\n";
    expect(extractImages(md, "x")).toEqual({ text: md, images: [] });
  });

  test("slugify bỏ dấu tiếng Việt và dấu cách", () => {
    expect(slugify("Điều 54 QĐ1901")).toBe("dieu-54-qd1901");
  });
});
