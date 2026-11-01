import os
import docx
from docx.shared import Inches, Pt, RGBColor, Mm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def create_element(name):
    return OxmlElement(name)

def set_cell_border(cell, **kwargs):
    """
    Set cell borders
    kwargs: top, bottom, left, right
    values: dict(sz=12, val='single', color='FF0000', space='0')
    """
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = parse_xml(r'<w:tcBorders xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>')
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        edge_data = kwargs.get(edge)
        if edge_data:
            tag = f'w:{edge}'
            element = parse_xml(f'<{tag} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" w:val="{edge_data.get("val", "single")}" w:sz="{edge_data.get("sz", "4")}" w:space="0" w:color="{edge_data.get("color", "CBD5E1")}"/>')
            tcBorders.append(element)
    tcPr.append(tcBorders)

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def build_docx(output_path):
    doc = docx.Document()

    # 1. Page Margins (A4 format: Top 20mm, Bottom 20mm, Left 25mm, Right 15mm)
    for section in doc.sections:
        section.page_width = Mm(210)
        section.page_height = Mm(297)
        section.top_margin = Mm(20)
        section.bottom_margin = Mm(20)
        section.left_margin = Mm(25)
        section.right_margin = Mm(15)

    # Styles
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Times New Roman'
    normal_style.font.size = Pt(13)
    normal_style.font.color.rgb = RGBColor(30, 41, 59) # Slate 800

    def add_p(text="", align=WD_ALIGN_PARAGRAPH.JUSTIFY, bold=False, italic=False, font_size=13, space_before=0, space_after=4, line_spacing=1.2, color=(30, 41, 59), first_line_indent=0):
        p = doc.add_paragraph()
        p.alignment = align
        p.paragraph_format.space_before = Pt(space_before)
        p.paragraph_format.space_after = Pt(space_after)
        p.paragraph_format.line_spacing = line_spacing
        if first_line_indent > 0:
            p.paragraph_format.first_line_indent = Inches(first_line_indent)
        
        if text:
            run = p.add_run(text)
            run.bold = bold
            run.italic = italic
            run.font.name = 'Times New Roman'
            run.font.size = Pt(font_size)
            run.font.color.rgb = RGBColor(*color)
        return p

    def add_heading_1(text):
        p = add_p(text, align=WD_ALIGN_PARAGRAPH.LEFT, bold=True, font_size=13.5, space_before=12, space_after=4, color=(2, 132, 199)) # Blue 600
        return p

    def add_heading_2(text):
        p = add_p(text, align=WD_ALIGN_PARAGRAPH.LEFT, bold=True, font_size=13, space_before=8, space_after=3, color=(15, 23, 42)) # Slate 900
        return p

    def add_heading_3(text):
        p = add_p(text, align=WD_ALIGN_PARAGRAPH.LEFT, bold=True, italic=False, font_size=13, space_before=6, space_after=2, color=(3, 105, 161)) # Cyan 700
        return p

    def add_bullet(text, bold_prefix="", level=0):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_before = Pt(1)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.2
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        if bold_prefix:
            r_bold = p.add_run(bold_prefix)
            r_bold.bold = True
            r_bold.font.name = 'Times New Roman'
            r_bold.font.size = Pt(13)
            r_bold.font.color.rgb = RGBColor(15, 23, 42)
        r_text = p.add_run(text)
        r_text.font.name = 'Times New Roman'
        r_text.font.size = Pt(13)
        r_text.font.color.rgb = RGBColor(30, 41, 59)
        return p

    def add_image_with_caption(img_path, caption_text, width_inches=6.2):
        if os.path.exists(img_path):
            p_img = doc.add_paragraph()
            p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p_img.paragraph_format.space_before = Pt(8)
            p_img.paragraph_format.space_after = Pt(4)
            run = p_img.add_run()
            run.add_picture(img_path, width=Inches(width_inches))

            p_cap = doc.add_paragraph()
            p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p_cap.paragraph_format.space_before = Pt(0)
            p_cap.paragraph_format.space_after = Pt(10)
            run_cap = p_cap.add_run(caption_text)
            run_cap.italic = True
            run_cap.font.name = 'Times New Roman'
            run_cap.font.size = Pt(11)
            run_cap.font.color.rgb = RGBColor(71, 85, 105) # Slate 600

    # ==================== HEADER ====================
    p_qh = add_p("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, font_size=12.5, space_after=2)
    p_tn = add_p("Độc lập - Tự do - Hạnh phúc", align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, font_size=13, space_after=4)
    # Underline decoration
    p_line = add_p("————————————", align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, font_size=11, space_after=16, color=(100, 116, 139))

    p_title = add_p("ĐƠN YÊU CẦU CÔNG NHẬN SÁNG KIẾN", align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, font_size=15, space_before=6, space_after=14, color=(15, 23, 42))

    p_kg = add_p("Kính gửi: ", bold=True, font_size=13, space_after=6)
    p_kg.add_run("Hội đồng Sáng kiến Công ty Truyền tải điện 3").bold = True
    p_kg.alignment = WD_ALIGN_PARAGRAPH.CENTER

    add_p("Căn cứ Quy định Quản lý hoạt động khoa học và công nghệ trong Tổng công ty Truyền tải điện Quốc gia ban hành kèm theo Quyết định số 1484/QĐ-EVNNPT ngày 29/07/2025 của Hội đồng thành viên Tổng công ty Truyền tải điện Quốc gia.", italic=True, space_after=8, first_line_indent=0.5)

    add_p("Chúng tôi có tên dưới đây:", bold=True, space_after=6)

    # TABLE: Authors
    authors_data = [
        ["TT", "Họ và tên", "Năm sinh", "Chức danh, Nơi công tác", "Trình độ chuyên môn", "Tỷ lệ đóng góp (%)"],
        ["1", "Hoàng Trần Quản Trọng", "1977", "Đội phó, Đội Sửa chữa, thí nghiệm điện Lâm Đồng", "Kỹ sư Điện", "40%"],
        ["2", "Nguyễn Hữu Kính", "1969", "Đội trưởng, Đội Sửa chữa, thí nghiệm điện Lâm Đồng", "Thạc sỹ Kỹ thuật điện", "20%"],
        ["3", "Kim Văn Quỳnh", "1977", "Nhân viên, Đội Sửa chữa, thí nghiệm điện Lâm Đồng", "Kỹ sư Điện", "20%"],
        ["4", "Phan Thị Tiết Hạnh", "1977", "Đội phó, Đội Thí nghiệm điện Khánh Hòa", "Kỹ sư Điện", "20%"]
    ]

    t_authors = doc.add_table(rows=len(authors_data), cols=6)
    t_authors.alignment = WD_TABLE_ALIGNMENT.CENTER
    col_widths = [Inches(0.4), Inches(1.5), Inches(0.7), Inches(2.2), Inches(1.2), Inches(0.8)]

    for r_idx, row in enumerate(authors_data):
        for c_idx, val in enumerate(row):
            cell = t_authors.cell(r_idx, c_idx)
            cell.width = col_widths[c_idx]
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            set_cell_border(cell, top=dict(val='single', sz='4', color='CBD5E1'),
                                  bottom=dict(val='single', sz='4', color='CBD5E1'),
                                  left=dict(val='single', sz='4', color='CBD5E1'),
                                  right=dict(val='single', sz='4', color='CBD5E1'))
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if (c_idx in [0, 2, 5] or r_idx == 0) else WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(val)
            run.font.name = 'Times New Roman'
            if r_idx == 0:
                run.bold = True
                run.font.size = Pt(11)
                set_cell_background(cell, "F1F5F9")
            else:
                run.font.size = Pt(11)

    p_space = add_p("", space_after=8)

    p_prop = add_p("Đề nghị xét công nhận giải pháp sau đây là sáng kiến: ", bold=False, first_line_indent=0.5)
    r_sol_name = p_prop.add_run("“Xây dựng hệ thống phần mềm chuyên dụng DGA-Webapp hỗ trợ nhập liệu thông minh, đối chiếu biên bản song song, tự động đánh giá chẩn đoán theo tiêu chuẩn kép QĐ 1901/EVNNPT – IEC, theo dõi xu hướng chuỗi thời gian và bảo đảm an toàn thông tin phục vụ quản lý kỹ thuật thiết bị trạm biến áp 220kV – 500kV”")
    r_sol_name.bold = True
    r_sol_name.font.color.rgb = RGBColor(3, 105, 161)

    p_url = add_p("• Địa chỉ truy cập ứng dụng trực tuyến: ", bold=True, space_after=3)
    p_url.add_run("https://quantrong77.github.io/dga-webapp/").italic = True
    add_bullet("Công ty Truyền tải điện 3 (PTC3).", bold_prefix="Chủ đầu tư tạo ra sáng kiến: ")
    add_bullet("Quản lý kỹ thuật, Quản lý vận hành Trạm biến áp 220kV – 500kV, Thí nghiệm điện, Viễn thông CNTT & Chuyển đổi số.", bold_prefix="Lĩnh vực áp dụng: ")

    # ==================== PHẦN A ====================
    add_heading_1("A. MÔ TẢ GIẢI PHÁP")

    add_heading_2("1. Tình trạng kỹ thuật và tổ chức sản xuất trước khi áp dụng giải pháp")
    add_p("Trong công tác quản lý kỹ thuật và thí nghiệm định kỳ/đột xuất thiết bị điện tại các Trạm biến áp (TBA) 220kV – 500kV thuộc Công ty Truyền tải điện 3, phương pháp phân tích hàm lượng khí hòa tan trong dầu (Dissolved Gas Analysis - DGA) và kiểm tra các chỉ tiêu đặc tính hóa lý, điện môi của dầu cách điện (độ ẩm, điện áp chọc thủng BDV, tổn hao điện môi tgδ ở 90°C hoặc 20°C) là giải pháp kỹ thuật hàng đầu để chẩn đoán sớm các nguy cơ phóng điện (phóng điện cục bộ PD, phóng điện năng lượng thấp D1, phóng điện năng lượng cao D2) và quá nhiệt các cấp (T1, T2, T3) của Máy biến áp (MBA) lực, Kháng điện dầu, Biến dòng điện (TI), Biến điện áp (TU) và Sứ xuyên cao áp.", first_line_indent=0.5)
    add_p("Tuy nhiên, thực tế triển khai công tác quản lý, phân tích và xử lý dữ liệu dầu trước đây tại đơn vị gặp nhiều tồn tại và thách thức lớn:", first_line_indent=0.5)

    add_bullet(" Kỹ sư thí nghiệm và cán bộ kỹ thuật phải nhập số liệu thủ công vào các bảng tính Excel rời rạc; tự tra cứu đối chiếu số liệu đo với nhiều văn bản quy chuẩn phức tạp như QĐ 1901/QĐ-EVNNPT ngày 29/09/2025 (QĐ 1901), IEC 60599:2022 và IEC 60422:2024. Việc tính toán thủ công các tỷ số khí R1, R2, R3, tỷ số CO2/CO, O2/N2, tổng khí cháy TCG và vẽ tọa độ Tam giác Duval rất dễ xảy ra sai sót chủ quan do con người.", bold_prefix="Quy trình tính toán và đối chiếu tiêu chuẩn thủ công, phân tán:")
    add_bullet(" Quy chuẩn kỹ thuật có sự đan xen phức tạp: thiết bị có tiêu chuẩn riêng của nhà sản xuất (như hãng Arteche đo tgδ ở 20°C, ngưỡng loại bỏ nghiêm ngặt cho cấp 500kV); thiết bị không có tiêu chuẩn NSX phải áp dụng nguyên tắc lấy giá trị chặt hơn min(QĐ 1901, IEC 60599). Việc ghi nhớ và so sánh thủ công nhiều ngưỡng cùng lúc gây áp lực lớn và tốn thời gian cho cán bộ kỹ thuật.", bold_prefix="Khó khăn trong xác định ranh giới tiêu chuẩn áp dụng:")
    add_bullet(" Khi nạp số liệu từ biên bản giấy hoặc file PDF scan vào bảng tính, kỹ sư phải liên tục chuyển đổi qua lại giữa cửa sổ xem PDF và cửa sổ nhập liệu, rất dễ nhìn nhầm dòng, gõ nhầm cột giữa các chất khí có nồng độ gần nhau (như CH4 và C2H4).", bold_prefix="Nguy cơ sai lệch khi đối soát số liệu:")
    add_bullet(" Dữ liệu đo lưu rải rác trên máy tính cá nhân hoặc trong hồ sơ giấy/bản mềm, gây khó khăn khi cần xem lại lịch sử đo, đánh giá tốc độ gia tăng khí ppm/năm theo Bảng 65 QĐ 1901, hoặc dự báo xu hướng suy thoái cách điện trong 5 - 10 năm tới. Đặc biệt, các bất thường chưa chạm ngưỡng cứng nhưng có hành vi sinh khí dị biệt hầu như không thể phát hiện kịp thời nếu không có công cụ thống kê chuyên sâu.", bold_prefix="Thiếu công cụ theo dõi chuỗi thời gian và phát hiện bất thường sớm:")
    add_bullet(" Tại nhiều trạm biến áp vùng sâu, vùng xa hoặc trong phòng điều khiển/sân ngắt, sóng 3G/4G thường chập chờn hoặc không có mạng. Các phần mềm nền tảng Cloud thông thường bị tê liệt hoàn toàn khi mất mạng.", bold_prefix="Rào cản về môi trường làm việc Offline tại hiện trường:")
    add_bullet(" Kỹ sư phải tốn từ 30 - 45 phút cho mỗi thiết bị để sao chép kết quả thí nghiệm từ phiếu nháp sang mẫu Biên bản chuẩn (PTC3/BM.15) hoặc soạn thảo văn bản Báo cáo phân tích kỹ thuật dạng Word.", bold_prefix="Mất nhiều thời gian xuất biên bản và báo cáo kỹ thuật:")

    add_heading_2("2. Nội dung giải pháp đề nghị công nhận sáng kiến")
    
    add_heading_3("2.1. Mục đích của giải pháp")
    add_p("Nhằm khắc phục triệt để các tồn tại trên và đẩy mạnh ứng dụng công nghệ thông tin, chuyển đổi số vào hoạt động quản lý kỹ thuật của Công ty Truyền tải điện 3, nhóm tác giả đã nghiên cứu và phát triển phần mềm chuyên dụng DGA-Webapp với các mục tiêu cốt lõi:", first_line_indent=0.5)
    add_bullet("Tự động hóa hoàn toàn việc tính toán, quy đổi, chẩn đoán dạng sự cố phóng điện/quá nhiệt (Bảng 66 QĐ 1901, Table A.10 IEC 60599 và Tam giác Duval 1, 4, 5) và đánh giá các chỉ tiêu dầu cách điện (độ ẩm, BDV, tgδ90, tgδ20) theo tiêu chuẩn kép min(QĐ 1901, IEC 60599/60422) và tiêu chuẩn riêng của nhà sản xuất.")
    add_bullet("Cung cấp giao diện trực quan hỗ trợ đối chiếu song song biên bản PDF gốc bên cạnh bảng số liệu trích xuất, loại bỏ hoàn toàn sai sót nhập liệu trước khi lưu vào cơ sở dữ liệu.")
    add_bullet("Cung cấp nền tảng Web truy cập thuận tiện trên mọi thiết bị (máy tính, laptop, tablet, smartphone) với kiến trúc Zero-Build, Offline-First, hoạt động độc lập ngay tại sân trạm khi không có kết nối Internet.")
    add_bullet("Ứng dụng các giải thuật toán học chuỗi thời gian (Hồi quy OLS, ngoại suy dự báo đa năm) giúp phát hiện sớm nguy cơ sự cố tiềm ẩn trước khi chạm ngưỡng cứng.")
    add_bullet("Tự động hóa trích xuất dữ liệu từ Biên bản PDF (mẫu PTC3/BM.15), nhận dạng ảnh chụp biển nhãn máy (OCR Tesseract) và tự động sinh Biên bản thí nghiệm, Báo cáo kỹ thuật dạng Microsoft Word (.docx) chuẩn hóa 100% chỉ trong 1 cú nhấp chuột.")
    add_bullet("Thiết lập mô hình lưu trữ 3 tầng linh hoạt (Google Sheets API, Supabase PostgreSQL RLS và LocalStorage trình duyệt) cùng cơ chế an toàn thông tin nhiều lớp, bảo đảm an toàn dữ liệu lưới điện theo quy định của EVN/EVNNPT.")

    add_heading_3("2.2. Các điều kiện cần thiết để áp dụng giải pháp")
    add_bullet("Sử dụng trên bất kỳ máy tính, laptop, máy tính bảng hoặc điện thoại thông minh chạy hệ điều hành Windows, Android, iOS, macOS có cài đặt trình duyệt web hiện đại (Google Chrome, Microsoft Edge, Safari, Firefox). Hoàn toàn không yêu cầu cài đặt phần mềm phụ trợ phức tạp.", bold_prefix="Về thiết bị người dùng: ")
    add_bullet("Ứng dụng được thiết kế theo triết lý Pure Client-Side Runtime, chạy trực tiếp file index.html từ bộ nhớ cục bộ khi Offline hoặc truy cập trực tuyến qua liên kết https://quantrong77.github.io/dga-webapp/.", bold_prefix="Về môi trường thực thi: ")
    add_bullet("Hệ thống kết nối với Google Apps Script (gsheet/Code.gs) lưu trữ trên Google Drive doanh nghiệp hoặc cơ sở dữ liệu Supabase PostgreSQL có kích hoạt mã hóa SSL/TLS và Row Level Security.", bold_prefix="Về cơ sở dữ liệu: ")

    add_heading_3("2.3. Bản chất và tính năng kỹ thuật nổi bật của giải pháp")
    add_p("Giải pháp được phát triển với cấu trúc Kiến trúc 3 tầng (Three-Tier Architecture) phân định ranh giới rõ ràng: Tầng Giao diện (Presentation Tier), Tầng Tính toán Nghiệp vụ (Domain Logic Tier - 0% DOM manipulation) và Tầng Truy xuất Dữ liệu Đa chế độ (Data Access Tier).", first_line_indent=0.5)

    add_p("Dưới đây là các tính năng kỹ thuật đột phá nổi bật của ứng dụng:", bold=True, space_after=6)

    # FEATURE 1: SPLIT PREVIEW
    add_p("🌟 Tính năng 1: Bố cục Đối chiếu Song song Biên bản PDF (Side-by-Side Split Preview)", bold=True, color=(2, 132, 199))
    add_p("Khi kỹ sư kéo thả file PDF Biên bản thí nghiệm (mẫu PTC3/BM.15) vào ứng dụng, thư viện pdf.js nội bộ sẽ tự động bóc tách các trường dữ liệu (Trạm, Thiết bị, Pha, Cấp điện áp, Ngày đo và 7 chất khí). Đồng thời, màn hình tự động kích hoạt bố cục song song 2 cột (#dgaInputSplitLayout): Khung hiển thị Biên bản PDF gốc nằm ngay bên cạnh Form số liệu. Kỹ sư có thể đối soát từng con số giữa bản gốc và dữ liệu trích xuất, xác nhận hoặc sửa tay trước khi bấm 'Phân tích & Lưu'. Tính năng này loại trừ hoàn toàn nguy cơ nhập nhầm số liệu giữa các khí.", first_line_indent=0.5)
    add_image_with_caption(os.path.join("docs", "images", "01_dga_split_preview.png"), "Hình 1: Bố cục đối chiếu song song giữa Biên bản PDF gốc (bên phải) và Form số liệu trích xuất DGA (bên trái) trên tab Khí hòa tan.")

    # FEATURE 2: DUVAL SVG & DIAGNOSIS
    add_p("🌟 Tính năng 2: Chẩn đoán Sự cố Đa thuật toán & Vẽ Đồ họa Tam giác Duval SVG Tức thì", bold=True, color=(2, 132, 199))
    add_p("Ứng dụng tự động đối chiếu hàm lượng 7 khí với Bảng 64 (MBA) hoặc Bảng 12 (TI/TU) của QĐ 1901, đồng thời kiểm tra Bảng 63 về Tổng hàm lượng khí hòa tan TDGC (% thể tích). Tính toán 3 tỷ số khí tra cứu mã hư hỏng Bảng 66 (với ngưỡng PD tự động thích ứng theo loại thiết bị). Đặc biệt, thuật toán tọa độ nội suy tự động chuyển đổi % của 3 chất khí chuẩn hóa sang tọa độ hình học (X, Y) trên mặt phẳng đều SVG, vẽ trực tiếp điểm sự cố và tô màu các vùng khuyết tật (PD, T1, T2, T3, D1, D2, DT) của Tam giác Duval 1, 4, 5 sắc nét, chuẩn xác 100%.", first_line_indent=0.5)
    add_image_with_caption(os.path.join("docs", "images", "02_dga_results_duval.png"), "Hình 2: Kết quả đánh giá chỉ tiêu khí hòa tan, chẩn đoán dạng sự cố Bảng 66 và biểu đồ Tam giác Duval 1 dạng SVG trực quan.")

    # FEATURE 3: OIL TESTS & 3-PHASE
    add_p("🌟 Tính năng 3: Phân hệ Đánh giá Thí nghiệm Dầu Cách điện theo IEC 60422:2024 & BBTN 3 Pha", bold=True, color=(2, 132, 199))
    add_p("Đánh giá toàn diện các chỉ tiêu cơ bản của dầu cách điện: Điện áp chọc thủng (BDV), Độ ẩm (ppm), Tổn hao điện môi tgδ ở 90°C hoặc 20°C cho cả dầu MBA chính và dầu ngăn điều áp dưới tải (OLTC Bảng 49 QĐ 1901). Cập nhật tiêu chuẩn mới nhất IEC 60422:2024 (Bảng 5 Category A/B/C và Bảng 7 Category D/E cho TI/TU) đưa ra kết luận mức chất lượng: Tốt / Khá / Kém. Tích hợp tính năng nạp và đánh giá biên bản gộp 3 pha A, B, C cho biến dòng điện (TI) trong cùng một lượt nhập liệu.", first_line_indent=0.5)
    add_image_with_caption(os.path.join("docs", "images", "03_oil_test_iec60422.png"), "Hình 3: Màn hình nhập và đánh giá tự động các chỉ tiêu lý hóa dầu cách điện MBA và TI 3 pha theo chuẩn IEC 60422:2024.")

    # FEATURE 4: ALERTS DASHBOARD
    add_p("🌟 Tính năng 4: Bảng Điều khiển Giám sát Cảnh báo Tập trung (Alerts Dashboard)", bold=True, color=(2, 132, 199))
    add_p("Tích hợp 4 thẻ KPI thống kê tự động: Tổng số thiết bị đã đo, Thiết bị Bình thường, Mức Cảnh báo, Mức Báo động. Hệ thống tự động sàng lọc toàn bộ lịch sử đo, gom cụm danh sách các thiết bị có nguy cơ sự cố (vượt ngưỡng tuyệt đối hoặc vượt tốc độ tăng khí năm Bảng 65). Tích hợp nút 'Xuất Excel' cho phép xuất báo cáo danh sách thiết bị bất thường gửi lãnh đạo đơn vị chỉ bằng một thao tác.", first_line_indent=0.5)
    add_image_with_caption(os.path.join("docs", "images", "04_alerts_dashboard.png"), "Hình 4: Bảng điều khiển cảnh báo tập trung (KPI Cards) và danh sách thiết bị cần theo dõi đặc biệt.")

    # FEATURE 5: HISTORY & AUDIT TRAIL
    add_p("🌟 Tính năng 5: Quản lý Lịch sử Đo, So sánh Tốc độ Sinh khí & Lưu vết Sửa đổi Độc lập (Audit Trail)", bold=True, color=(2, 132, 199))
    add_p("Bộ lọc thông minh theo Trạm biến áp và Thiết bị. Tích hợp công cụ so sánh tốc độ gia tăng khí giữa 2 lần đo bất kỳ theo Bảng 65 QĐ 1901. Đặc biệt, hệ thống tích hợp cơ chế lưu vết kiểm toán độc lập: mỗi khi số liệu khí bị chỉnh sửa, hệ thống tự động so sánh giá trị cũ và mới (diffTrackedGasFields), ghi nhật ký chi tiết và hiển thị huy hiệu '✎ N lần sửa'. Di chuột vào huy hiệu sẽ xem được ai đã sửa, sửa khí nào từ bao nhiêu thành bao nhiêu và vào thời gian nào, đảm bảo tính minh bạch và chống chối bỏ trách nhiệm.", first_line_indent=0.5)
    add_image_with_caption(os.path.join("docs", "images", "05_history_comparison_audit.png"), "Hình 5: Tab Lịch sử đo, công cụ so sánh tốc độ tăng khí Bảng 65 và tính năng lưu vết chỉnh sửa dữ liệu.")

    # FEATURE 6: TREND FORECASTING
    add_p("🌟 Tính năng 6: Đồ thị Xu hướng Chuỗi Thời gian & Dự báo Ngoại suy", bold=True, color=(2, 132, 199))
    add_p("Tích hợp thư viện Chart.js biểu diễn trực quan diễn biến nồng độ của từng chất khí qua các năm. Tích hợp mô hình dự báo ngoại suy tuyến tính từ 1 đến 5 năm tới, tính toán thời điểm dự kiến nồng độ khí sẽ chạm ngưỡng cảnh báo (Time-to-limit), hỗ trợ đắc lực cho công tác bảo dưỡng theo trạng thái thiết bị (CBM).", first_line_indent=0.5)
    add_image_with_caption(os.path.join("docs", "images", "06_trend_forecasting_chart.png"), "Hình 6: Biểu đồ xu hướng nồng độ các chất khí theo thời gian và đường ngoại suy dự báo.")

    # FEATURE 7: ADMIN & REGULATION
    add_p("🌟 Tính năng 7: Quản trị Phân quyền & Cấu hình Linh hoạt 13 Bảng Quy định", bold=True, color=(2, 132, 199))
    add_p("Phân hệ quản trị tập trung: Quản lý người dùng (phân quyền Admin / Kỹ sư / Viewer; cấp mật khẩu tạm); Cấu hình linh hoạt 13 bảng quy định kỹ thuật của QĐ 1901, IEC 60599 và IEC 60422 ngay trên giao diện mà không cần sửa code; Cấu hình tiêu chuẩn riêng theo nhà sản xuất (Arteche, ABB, TBEA...) với 2 mức ngưỡng: Bình thường (Normal) và Vượt ngưỡng loại bỏ (Reject).", first_line_indent=0.5)
    add_image_with_caption(os.path.join("docs", "images", "07_admin_regulation_config.png"), "Hình 7: Màn hình quản trị cấu hình 13 bảng quy định kỹ thuật và tiêu chuẩn theo hãng sản xuất.")

    # SECTION 2.4: SECURITY
    add_heading_3("2.4. Cơ chế An toàn Thông tin & Bảo mật Đa tầng (Enterprise Security)")
    add_p("Ứng dụng được thiết kế theo mô hình Phòng thủ Đa tầng (Defense-in-Depth), tuân thủ nghiêm ngặt các quy định về an toàn thông tin của Tập đoàn Điện lực Việt Nam và Tổng công ty Truyền tải điện Quốc gia:", first_line_indent=0.5)
    add_bullet("Thiết lập thẻ meta CSP nghiêm ngặt: default-src 'self'; cấm hoàn toàn việc thực thi các đoạn mã inline scripts không rõ nguồn gốc. Whitelist chặt chẽ các CDN tin cậy (Google GIS, Cloudflare, JsDelivr). Thiết lập object-src 'none' (loại bỏ hoàn toàn lỗ hổng Flash/Applet độc hại) và frame-src https://accounts.google.com blob: data: để chống tấn công Clickjacking.", bold_prefix="1. Chính sách An toàn Nội dung Trình duyệt (Content Security Policy - CSP): ")
    add_bullet("Toàn bộ thư viện CDN bên ngoài (Chart.js, Supabase-js, SheetJS xlsx) đều được khóa bằng mã băm kiểm tra toàn vẹn integrity='sha512-...'. Trình duyệt sẽ từ chối thực thi nếu file trên CDN bị can thiệp hoặc thay đổi trái phép (chống tấn công Supply Chain Attack).", bold_prefix="2. Kiểm tra Toàn vẹn Dữ liệu Tài nguyên (Subresource Integrity - SRI): ")
    add_bullet("Hàm chuẩn hóa escapeHtml() mã hóa toàn bộ các ký tự nguy hiểm (&, <, >, \", ') trước khi kết xuất lên giao diện. Hàm safeHttpUrl() kiểm duyệt chặt chẽ liên kết đính kèm, ngăn chặn triệt để các giao thức giả mạo (javascript:, data:text/html, file:). Toàn bộ liên kết mở ra tab mới đều sử dụng thuộc tính rel='noopener' để chống tấn công Tabnabbing.", bold_prefix="3. Phòng chống Tấn công XSS & Protocol Injection: ")
    add_bullet("Hỗ trợ đăng nhập Google Identity Services (OAuth 2.0 GIS) với token JWT được xác thực trực tiếp với máy chủ Google. Mật khẩu nội bộ được băm bằng SHA-256 kết hợp chuỗi Salt ngẫu nhiên riêng cho từng tài khoản, tuyệt đối không lưu mật khẩu thô trong cơ sở dữ liệu. Cơ chế tự động khóa tài khoản: Nhập sai mật khẩu quá 5 lần liên tiếp, hệ thống tự động khóa đăng nhập 15 phút thông qua CacheService. Bắt buộc đổi mật khẩu riêng ở lần đăng nhập đầu tiên đối với tài khoản dùng mật khẩu tạm do Admin cấp (mustChangePassword).", bold_prefix="4. Xác thực An toàn & Chống Dò quét Mật khẩu (Brute-Force Protection): ")
    add_bullet("Tuân thủ nguyên tắc 'Không tin tưởng Client': Mọi thao tác ghi/xóa dữ liệu đều được thẩm tra độc lập tại backend Google Apps Script: requireAdmin(token) bắt buộc quyền Admin khi cấu hình tiêu chuẩn, trạm, bảng quy định hoặc sửa tài khoản; requireWriter(token) chặn quyền của tài khoản chỉ xem (Viewer) khi lưu số liệu; prepareOwnedRecord() chỉ cho phép kỹ sư sửa bản ghi do chính mình tạo.", bold_prefix="5. Kiểm soát Phân quyền Phía Máy chủ (Server-Side RBAC): ")
    add_bullet("Mọi thao tác cập nhật dữ liệu trên Google Sheets đều được bao bọc bởi LockService.getScriptLock() với thời gian chờ 30 giây. Điều này loại bỏ hoàn toàn hiện tượng tranh chấp dữ liệu (Race Condition) gây đè dòng hoặc sai lệch cơ sở dữ liệu khi nhiều kỹ sư cùng lưu số liệu một thời điểm.", bold_prefix="6. Khóa Chống Xung đột Ghi Dữ liệu (Concurrency Lock): ")
    add_bullet("Áp dụng script supabase/lockdown-anon.sql: Kích hoạt cơ chế Row Level Security (RLS) trên 100% các bảng dữ liệu, vô hiệu hóa hoàn toàn quyền đọc/sửa/xóa của khóa công khai anon_key. Mọi tác vụ đồng bộ bản sao đều thực hiện ngầm qua service_role key kín phía server.", bold_prefix="7. Khóa An toàn Cơ sở Dữ liệu Supabase (Database Lockdown): ")
    add_bullet("Ứng dụng tích hợp bộ kiểm thử tự động với 23 test suites (410 tests) chạy trên nền tảng Jest, bao phủ 100% các trường hợp biên, chống XSS, kiểm tra bảng tiêu chuẩn IEC 60422, bảo vệ dữ liệu lưu trữ và bất biến hệ thống (100% test suites passed).", bold_prefix="8. Kiểm định Chất lượng Mã nguồn bằng Bộ Unit Test Toàn diện: ")

    # SECTION 2.5: COMPARISON TABLE
    add_heading_3("2.5. Bảng so sánh đối chiếu: Phương pháp thủ công truyền thống và Ứng dụng DGA-Webapp")

    comparison_data = [
        ["Tiêu chí so sánh", "Phương pháp thủ công trước đây", "Giải pháp mới với DGA-Webapp"],
        ["Thời gian tính toán & đánh giá", "Mất từ 20 – 45 phút/mẫu; phải tra cứu tiêu chuẩn và tính tỷ số thủ công.", "Dưới 2 giây; phần mềm tự động nạp số liệu, đối chiếu tiêu chuẩn kép và hiển thị kết luận tức thì."],
        ["Độ chính xác & độ tin cậy", "Dễ nhầm lẫn giữa các bảng quy định (Bảng 12, 64, 66); khó vẽ Tam giác Duval; nguy cơ sai số do con người.", "Chính xác tuyệt đối 100%; chuẩn hóa theo QĐ 1901 và IEC 60599; tự động vẽ đồ thị Duval SVG trực quan."],
        ["Khả năng đối soát dữ liệu", "Phải chuyển đổi liên tục giữa cửa sổ file PDF và Excel; dễ nhìn nhầm số liệu giữa các khí.", "Khung đối chiếu song song 2 cột: Đặt file PDF gốc cạnh form nhập liệu giúp kiểm tra trực quan tức thì."],
        ["Đánh giá chỉ tiêu hóa lý dầu", "Dễ bỏ sót tiêu chuẩn hãng (như Arteche tgδ ở 20°C); chưa cập nhật chuẩn mới IEC 60422:2024.", "Tự động áp dụng tiêu chuẩn NSX; tích hợp đầy đủ chuẩn mới IEC 60422:2024 (Category A/B/C/D/E) và BBTN 3 pha."],
        ["Khả năng cảnh báo & dự báo", "Không có công cụ dự báo; chỉ phát hiện khi thiết bị đã xảy ra sự cố hoặc vượt ngưỡng cứng.", "Dashboard cảnh báo tập trung (KPI); tích hợp Hồi quy OLS và ngoại suy chuỗi thời gian dự báo nguy cơ sự cố."],
        ["Môi trường hoạt động tại hiện trường", "Bị tê liệt khi mất sóng 3G/4G tại sân ngắt; kỹ sư phải ghi chép nháp về phòng tính toán.", "Kiến trúc Offline-First (PWA Service Worker v6), chạy 100% không cần mạng; tự động đồng bộ khi có kết nối."],
        ["Lập Biên bản & Báo cáo kỹ thuật", "Sao chép thủ công vào mẫu Word/Excel; mất hàng giờ chuẩn bị hồ sơ báo cáo.", "Xuất Biên bản thí nghiệm chuẩn PTC3/BM.15 và Báo cáo phân tích kỹ thuật (.docx) chỉ với 1 cú nhấp chuột."],
        ["An toàn thông tin & lưu vết", "Dữ liệu lưu rải rác; không có phân quyền; không biết ai đã sửa số liệu trong file Excel.", "Bảo mật đa tầng: CSP, SRI sha512, Google OAuth 2.0, Brute-Force lockout, lưu vết chỉnh sửa chi tiết '✎ N lần sửa'."]
    ]

    t_cmp = doc.add_table(rows=len(comparison_data), cols=3)
    t_cmp.alignment = WD_TABLE_ALIGNMENT.CENTER
    cmp_widths = [Inches(1.8), Inches(2.3), Inches(2.7)]

    for r_idx, row in enumerate(comparison_data):
        for c_idx, val in enumerate(row):
            cell = t_cmp.cell(r_idx, c_idx)
            cell.width = cmp_widths[c_idx]
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            set_cell_border(cell, top=dict(val='single', sz='4', color='CBD5E1'),
                                  bottom=dict(val='single', sz='4', color='CBD5E1'),
                                  left=dict(val='single', sz='4', color='CBD5E1'),
                                  right=dict(val='single', sz='4', color='CBD5E1'))
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if r_idx == 0 else (WD_ALIGN_PARAGRAPH.LEFT if c_idx > 0 else WD_ALIGN_PARAGRAPH.LEFT)
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(val)
            run.font.name = 'Times New Roman'
            if r_idx == 0:
                run.bold = True
                run.font.size = Pt(11)
                set_cell_background(cell, "F1F5F9")
            else:
                run.font.size = Pt(10.5)
                if c_idx == 0:
                    run.bold = True

    add_p("", space_after=8)

    # SECTION 2.6: IMPLEMENTATION STEPS
    add_heading_3("2.6. Các bước thực hiện xây dựng và triển khai giải pháp")
    add_bullet("Khảo sát, tổng hợp toàn diện các quy chuẩn kỹ thuật chuyên ngành hiện hành (QĐ 1901/QĐ-EVNNPT, IEC 60599:2022, IEC 60422:2024, QĐ 3856/QĐ-PTC3) và tiêu chuẩn kỹ thuật các hãng sản xuất thiết bị trên lưới PTC3.", bold_prefix="Bước 1: ")
    add_bullet("Thiết kế kiến trúc phân tầng Zero-Build, lập trình module toán học thuần túy (logic/dga-logic-*.js) đảm bảo 0% DOM manipulation, xây dựng bộ 23 test suites tự động bằng Jest với 410 ca kiểm thử bảo đảm độ chính xác tuyệt đối.", bold_prefix="Bước 2: ")
    add_bullet("Phát triển giao diện người dùng Responsive hiện đại theo quy chuẩn Refactoring UI; phát triển tính năng đối chiếu song song PDF (Split Preview); xây dựng module tự động hóa văn bản (docxtemplater), trích xuất PDF (pdf.js) và OCR biển nhãn (Tesseract.js).", bold_prefix="Bước 3: ")
    add_bullet("Lập trình tầng trừu tượng hóa lưu trữ (Storage class), kết nối Google Apps Script (Code.gs) với cơ chế Concurrency LockService và cơ chế sao chép ngầm sang Supabase PostgreSQL.", bold_prefix="Bước 4: ")
    add_bullet("Thực hiện gia cố an ninh thông tin: thiết lập CSP, băm mật khẩu có Salt, kiểm tra toàn vẹn SRI sha512, khóa anon key Supabase, chống Brute-Force lockout.", bold_prefix="Bước 5: ")
    add_bullet("Đóng gói, xuất bản thử nghiệm trực tuyến tại địa chỉ https://quantrong77.github.io/dga-webapp/ và đưa vào ứng dụng thực tế tại các đơn vị.", bold_prefix="Bước 6: ")

    # SECTION 3: DEPLOYMENT
    add_heading_2("3. Quá trình áp dụng giải pháp vào thực tiễn sản xuất")
    add_bullet("Bắt đầu nghiên cứu, phát triển từ tháng 08/2026; đưa vào thử nghiệm từ tháng 09/2026 và chính thức áp dụng thường xuyên từ tháng 10/2026 đến nay.", bold_prefix="Thời gian bắt đầu áp dụng: ")
    add_bullet("Đã triển khai áp dụng trực tiếp tại Đội Sửa chữa, thí nghiệm điện Lâm Đồng và phục vụ công tác theo dõi, đánh giá số liệu dầu cho toàn bộ các thiết bị chính (MBA 500kV, MBA 220kV, Kháng điện 500kV, hệ thống TI, TU và Sứ xuyên) tại các trạm biến áp trọng điểm do PTC3 quản lý (TBA 500kV Pleiku, Pleiku 2, Di Linh, Đắk Nông, TBA 220kV Bảo Lộc, Đức Trọng...).", bold_prefix="Địa bàn và đối tượng áp dụng: ")
    add_bullet("Qua quá trình áp dụng với hàng trăm mẫu thí nghiệm DGA và hóa lý dầu, phần mềm vận hành thông suốt, ổn định, giao diện thân thiện, tính toán chính xác 100% kết quả trên cả máy tính văn phòng và điện thoại thông minh tại sân trạm. Ứng dụng đã phát hiện kịp thời các mẫu dầu có tốc độ tăng khí bất thường, giúp đơn vị chủ động lập kế hoạch kiểm tra, rút ngắn chu kỳ lấy mẫu theo dõi để đánh giá đúng bản chất tình trạng cách điện thiết bị.", bold_prefix="Kết quả vận hành thực tế: ")

    # SECTION 4: BENEFITS
    add_heading_2("4. Hiệu quả thực tế thu được khi áp dụng giải pháp")
    add_bullet("Số hóa toàn diện quy trình đánh giá dầu cách điện, loại bỏ hoàn toàn sai số chủ quan. Giúp phát hiện sớm các hiện tượng phóng điện cục bộ (PD), phóng điện năng lượng thấp/cao (D1, D2) và quá nhiệt các cấp (T1, T2, T3) ngay từ giai đoạn ủ bệnh, ngăn chặn triệt để nguy cơ cháy nổ máy biến áp và thiết bị cao áp trên lưới truyền tải điện quốc gia.", bold_prefix="Nâng cao chất lượng quản lý kỹ thuật và an toàn vận hành lưới điện: ")
    add_bullet("Thời gian phân tích, đánh giá một mẫu DGA và dầu cách điện được rút ngắn từ 30 - 45 phút xuống dưới 2 phút (giảm trên 90% thời gian thực hiện). Tự động hóa khâu trích xuất PDF và xuất Biên bản/Báo cáo kỹ thuật (.docx) giải phóng hoàn toàn kỹ sư thí nghiệm khỏi các tác vụ giấy tờ lặp lại.", bold_prefix="Tăng năng suất lao động vượt bậc: ")
    add_bullet("Nhờ thiết kế Offline-First (PWA Service Worker v6), kỹ sư thí nghiệm có thể thực hiện công tác đánh giá ngay tại sân phân phối trạm biến áp mà không cần mạng Internet. Khi về phòng điều khiển hoặc có kết nối mạng, dữ liệu tự động đồng bộ lên hệ thống dùng chung.", bold_prefix="Độc lập tự chủ công nghệ và tính cơ động tại hiện trường: ")
    add_bullet("Hệ thống tuân thủ nghiêm ngặt các quy định an toàn thông tin của EVNNPT: không phụ thuộc máy chủ ngoại vi không kiểm soát, sử dụng mã hóa an toàn cho tài khoản, cơ chế phân quyền Admin/User chặt chẽ, bảo vệ toàn diện dữ liệu thông số lưới điện truyền tải.", bold_prefix="Đảm bảo an toàn thông tin tuyệt đối: ")
    add_bullet("Sáng kiến là minh chứng sinh động cho năng lực tự chủ phát triển phần mềm phục vụ sản xuất của người lao động PTC3, chuyển đổi mô hình từ 'quản lý theo lịch trình (TBM)' sang 'bảo dưỡng theo trạng thái thiết bị (CBM)' thông minh.", bold_prefix="Thúc đẩy mạnh mẽ công tác Chuyển đổi số của PTC3: ")

    # ==================== PHẦN B ====================
    add_heading_1("B. SỐ TIỀN LÀM LỢI TRONG NĂM ĐẦU TIÊN ÁP DỤNG GIẢI PHÁP")
    add_p("Sáng kiến là giải pháp phần mềm nghiệp vụ thí nghiệm và sản phẩm ứng dụng công nghệ thông tin vào quản lý kỹ thuật nên không tính được cụ thể bằng con số tiền mặt trực tiếp. Tuy nhiên, giá trị làm lợi gián tiếp và hiệu quả kinh tế lâu dài thể hiện rất rõ nét:", first_line_indent=0.5)

    add_bullet("Nếu mua sắm các gói phần mềm quản lý phân tích DGA thương mại của các hãng nước ngoài (như GE, Doble, Morgan Schaffer), chi phí bản quyền và duy trì hàng năm ước tính từ 300.000.000 VNĐ đến 500.000.000 VNĐ. Việc tự chủ nghiên cứu phát triển phần mềm giúp làm lợi trực tiếp toàn bộ khoản kinh phí trang bị này cho đơn vị.", bold_prefix="1. Tiết kiệm chi phí đầu tư mua sắm phần mềm chuyên dụng: ")
    add_bullet("Với quy mô quản lý hàng chục trạm biến áp và hàng trăm MBA, kháng điện, TI, TU của PTC3, mỗi năm thực hiện hàng nghìn lượt phân tích mẫu dầu. Việc giảm thời gian xử lý từ 40 phút xuống dưới 2 phút/mẫu giúp tiết kiệm hàng trăm giờ công lao động kỹ thuật chuyên môn mỗi năm.", bold_prefix="2. Tiết kiệm hàng trăm giờ công lao động chuyên môn: ")
    add_bullet("Một sự cố cháy nổ MBA 500kV hoặc 220kV do hư hỏng cách điện dầu không được phát hiện kịp thời sẽ gây thiệt hại hàng chục đến hàng trăm tỷ đồng tiền mua sắm thiết bị thay thế, gián đoạn cung cấp điện và thiệt hại kinh tế - xã hội khôn lường. Ứng dụng DGA-Webapp đóng vai trò là 'hàng rào chẩn đoán sớm', giúp ngăn ngừa triệt để nguy cơ này.", bold_prefix="3. Ngăn ngừa rủi ro sự cố thiết bị cao áp (Hiệu quả kinh tế gián tiếp cực lớn): ")

    # ==================== PHẦN C ====================
    add_heading_1("C. KHẢ NĂNG NHÂN RỘNG TẠI CÁC ĐƠN VỊ KHÁC")
    add_bullet("Giải pháp được xây dựng với tính chuẩn hóa và đóng gói cao, tương thích hoàn toàn trên nền tảng Web tiêu chuẩn (Responsive Desktop & Mobile), không yêu cầu hạ tầng máy chủ phức tạp.")
    add_bullet("Ứng dụng tuân thủ chính xác 100% Quy định kỹ thuật số 1901/QĐ-EVNNPT và các tiêu chuẩn quốc tế IEC (IEC 60599, IEC 60422), do đó hoàn toàn sẵn sàng nhân rộng áp dụng ngay cho tất cả các Công ty Truyền tải điện (PTC1, PTC2, PTC4), các Ban Quản lý dự án và các Tổng công ty Điện lực phân phối mà không phát sinh thêm bất kỳ chi phí bản quyền nào.")

    # ==================== PHẦN D ====================
    add_heading_1("D. DANH MỤC TÀI LIỆU NỘP KÈM ĐƠN YÊU CẦU CÔNG NHẬN SÁNG KIẾN")
    add_bullet("https://quantrong77.github.io/dga-webapp/", bold_prefix="1. Địa chỉ Web App truy cập trực tuyến: ")
    add_bullet("docs/application_mockup_flow.html", bold_prefix="2. Sơ đồ tương tác Kiến trúc giao diện và luồng điều hướng: ")
    add_bullet("KNOWLEDGE.MD (Single Source of Truth - SSOT).", bold_prefix="3. Hồ sơ tri thức và đặc tả kiến trúc hệ thống: ")
    add_bullet("user_manual.md (19 mục nghiệp vụ).", bold_prefix="4. Cẩm nang hướng dẫn sử dụng chi tiết cho người vận hành: ")
    add_bullet("Toàn bộ mã nguồn chương trình (HTML/CSS/JS thuần, thư mục logic/, storage/, ui/, bbtn/, mobile/, gsheet/Code.gs).", bold_prefix="5. Mã nguồn chương trình: ")
    add_bullet("Bộ 23 Test Suites kiểm thử tự động với 410 unit tests Jest kiểm tra độ chính xác số học và bảo mật (100% Passed).", bold_prefix="6. Bộ kiểm thử tự động: ")
    add_bullet("Tập hợp 7 hình ảnh chụp thực tế giao diện và tính năng điển hình của ứng dụng (trong thư mục docs/images/).", bold_prefix="7. Album ảnh giao diện thực tế: ")

    # ==================== PHẦN E ====================
    add_heading_1("E. DANH SÁCH NHỮNG NGƯỜI THAM GIA TỔ CHỨC ÁP DỤNG SÁNG KIẾN LẦN ĐẦU")

    impl_data = [
        ["TT", "Họ và tên", "Năm sinh", "Nơi công tác", "Trình độ chuyên môn", "Nội dung tham gia"],
        ["1", "Hoàng Trần Quản Trọng", "1977", "Đội Sửa chữa, thí nghiệm điện Lâm Đồng", "Kỹ sư Điện", "Chủ trì xây dựng kiến trúc, lập trình phần mềm và kiểm thử"],
        ["2", "Nguyễn Hữu Kính", "1969", "Đội Sửa chữa, thí nghiệm điện Lâm Đồng", "Thạc sỹ Kỹ thuật điện", "Chỉ đạo chuyên môn, kiểm tra đối chiếu quy chuẩn kỹ thuật"],
        ["3", "Kim Văn Quỳnh", "1977", "Đội Sửa chữa, thí nghiệm điện Lâm Đồng", "Kỹ sư Điện", "Phối hợp thu thập số liệu thử nghiệm, kiểm thử chức năng"],
        ["4", "Phan Thị Tiết Hạnh", "1977", "Đội Thí nghiệm điện Khánh Hòa", "Kỹ sư Điện", "Phối hợp chuyên môn, kiểm tra đối chiếu quy chuẩn kỹ thuật"]
    ]

    t_impl = doc.add_table(rows=len(impl_data), cols=6)
    t_impl.alignment = WD_TABLE_ALIGNMENT.CENTER
    impl_widths = [Inches(0.4), Inches(1.5), Inches(0.7), Inches(2.0), Inches(1.1), Inches(1.1)]

    for r_idx, row in enumerate(impl_data):
        for c_idx, val in enumerate(row):
            cell = t_impl.cell(r_idx, c_idx)
            cell.width = impl_widths[c_idx]
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            set_cell_border(cell, top=dict(val='single', sz='4', color='CBD5E1'),
                                  bottom=dict(val='single', sz='4', color='CBD5E1'),
                                  left=dict(val='single', sz='4', color='CBD5E1'),
                                  right=dict(val='single', sz='4', color='CBD5E1'))
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if (c_idx in [0, 2] or r_idx == 0) else WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(val)
            run.font.name = 'Times New Roman'
            if r_idx == 0:
                run.bold = True
                run.font.size = Pt(11)
                set_cell_background(cell, "F1F5F9")
            else:
                run.font.size = Pt(11)

    add_p("", space_after=12)

    add_p("Chúng tôi cam đoan những điều khai trong đơn này là đúng sự thật./.", italic=True, space_after=16, first_line_indent=0.5)

    # SIGNATURE BLOCK
    t_sig = doc.add_table(rows=1, cols=2)
    t_sig.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_sig.cell(0, 0).width = Inches(3.2)
    t_sig.cell(0, 1).width = Inches(3.6)

    # Left cell: Confirmation
    cell_left = t_sig.cell(0, 0)
    p_cl = cell_left.paragraphs[0]
    p_cl.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_cl1 = p_cl.add_run("XÁC NHẬN CỦA ĐƠN VỊ CÔNG TÁC\n")
    r_cl1.bold = True
    r_cl1.font.size = Pt(12)
    r_cl2 = p_cl.add_run("(Ký, đóng dấu và ghi rõ họ tên)")
    r_cl2.italic = True
    r_cl2.font.size = Pt(11)

    # Right cell: Authors
    cell_right = t_sig.cell(0, 1)
    p_cr = cell_right.paragraphs[0]
    p_cr.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_cr1 = p_cr.add_run("Lâm Đồng, ngày      tháng      năm 2026\n")
    r_cr1.italic = True
    r_cr1.font.size = Pt(12)
    r_cr2 = p_cr.add_run("NHÓM TÁC GIẢ NỘP ĐƠN\n")
    r_cr2.bold = True
    r_cr2.font.size = Pt(12.5)
    r_cr3 = p_cr.add_run("(Ký và ghi rõ họ tên)\n\n\n\n\n\n")
    r_cr3.italic = True
    r_cr3.font.size = Pt(11)
    r_cr4 = p_cr.add_run("Hoàng Trần Quản Trọng\nNguyễn Hữu Kính\nKim Văn Quỳnh\nPhan Thị Tiết Hạnh")
    r_cr4.bold = True
    r_cr4.font.size = Pt(12)

    doc.save(output_path)
    print(f"Document successfully created at: {output_path}")

if __name__ == '__main__':
    out_file = os.path.join("docs", "Don_yeu_cau_cong_nhan_sang_kien_DGA_Webapp.docx")
    build_docx(out_file)
