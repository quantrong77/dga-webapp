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
    Set cell borders.
    kwargs: top, bottom, left, right, insideH, insideV
    values: dict(sz='4', val='single', color='CBD5E1')
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
        return p

    def add_image_with_caption(img_path, caption_text, width=Inches(5.8)):
        if os.path.exists(img_path):
            p_img = doc.add_paragraph()
            p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p_img.paragraph_format.space_before = Pt(6)
            p_img.paragraph_format.space_after = Pt(2)
            run = p_img.add_run()
            run.add_picture(img_path, width=width)
            
            p_cap = doc.add_paragraph()
            p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p_cap.paragraph_format.space_before = Pt(1)
            p_cap.paragraph_format.space_after = Pt(8)
            run_cap = p_cap.add_run(caption_text)
            run_cap.italic = True
            run_cap.font.name = 'Times New Roman'
            run_cap.font.size = Pt(11)
            run_cap.font.color.rgb = RGBColor(71, 85, 105) # Slate 600
        else:
            p_warn = add_p(f"[Hình ảnh chưa sẵn sàng: {img_path}]", italic=True, color=(220, 38, 38))

    # ==================== HEADER ====================
    p_header = add_p("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, font_size=12.5, space_after=0)
    p_sub = add_p("Độc lập - Tự do - Hạnh phúc", align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, font_size=13, space_after=2)
    p_line = add_p("---------------------------------", align=WD_ALIGN_PARAGRAPH.CENTER, bold=False, font_size=10, space_after=10)

    p_title = add_p("ĐƠN YÊU CẦU CÔNG NHẬN SÁNG KIẾN", align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, font_size=15, space_before=6, space_after=4, color=(15, 23, 42))

    p_to = add_p("Kính gửi: ", align=WD_ALIGN_PARAGRAPH.CENTER, italic=True, font_size=13, space_after=10)
    p_to.add_run("Hội đồng Sáng kiến Công ty Truyền tải điện 3").bold = True

    p_intro = add_p("Chúng tôi ghi tên dưới đây:", italic=True, space_after=4, first_line_indent=0.5)

    # TABLE: AUTHORS
    authors_data = [
        ["TT", "Họ và tên", "Ngày tháng năm sinh", "Nơi công tác", "Chức danh", "Trình độ CM", "Tỷ lệ đóng góp"],
        ["1", "Hoàng Trần Quản Trọng", "18/06/1977", "Đội Sửa chữa, thí nghiệm điện Lâm Đồng - PTC3", "Đội phó", "Kỹ sư Điện", "40%"],
        ["2", "Nguyễn Hữu Kính", "16/09/1969", "Đội Sửa chữa, thí nghiệm điện Lâm Đồng - PTC3", "Đội trưởng", "Thạc sỹ KT điện", "20%"],
        ["3", "Kim Văn Quỳnh", "26/04/1977", "Đội Sửa chữa, thí nghiệm điện Lâm Đồng - PTC3", "Kỹ thuật viên", "Kỹ sư Điện", "20%"],
        ["4", "Phan Thị Tiết Hạnh", "08/11/1977", "Đội Thí nghiệm điện Khánh Hòa - PTC3", "Kỹ thuật viên", "Kỹ sư Điện", "20%"]
    ]

    t_authors = doc.add_table(rows=len(authors_data), cols=7)
    t_authors.alignment = WD_TABLE_ALIGNMENT.CENTER
    col_widths = [Inches(0.35), Inches(1.3), Inches(0.9), Inches(1.7), Inches(0.85), Inches(0.95), Inches(0.75)]

    for r_idx, row in enumerate(authors_data):
        for c_idx, val in enumerate(row):
            cell = t_authors.cell(r_idx, c_idx)
            cell.width = col_widths[c_idx]
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_margins(cell, top=80, bottom=80, left=90, right=90)
            set_cell_border(cell, top=dict(val='single', sz='4', color='CBD5E1'),
                                  bottom=dict(val='single', sz='4', color='CBD5E1'),
                                  left=dict(val='single', sz='4', color='CBD5E1'),
                                  right=dict(val='single', sz='4', color='CBD5E1'))
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if (c_idx in [0, 2, 6] or r_idx == 0) else WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(val)
            run.font.name = 'Times New Roman'
            if r_idx == 0:
                run.bold = True
                run.font.size = Pt(10.5)
                set_cell_background(cell, "F1F5F9")
            else:
                run.font.size = Pt(10.5)

    add_p("", space_after=6)

    p_prop = add_p("Đề nghị xét công nhận giải pháp sau đây là sáng kiến: ", bold=False, first_line_indent=0.5)
    r_sol_name = p_prop.add_run("“Xây dựng ứng dụng DGA-Webapp hỗ trợ Đơn vị Quản lý vận hành tự nạp biên bản quá khứ, tự động đánh giá chẩn đoán theo quy chuẩn EVNNPT – IEC, theo dõi xu hướng chuỗi thời gian và cảnh báo sớm bất thường thiết bị trạm biến áp 220kV – 500kV”")
    r_sol_name.bold = True
    r_sol_name.font.color.rgb = RGBColor(3, 105, 161)

    p_url = add_p("• Địa chỉ truy cập ứng dụng trực tuyến: ", bold=True, space_after=3)
    p_url.add_run("https://quantrong77.github.io/dga-webapp/").italic = True
    add_bullet("Công ty Truyền tải điện 3 (PTC3).", bold_prefix="Chủ đầu tư tạo ra sáng kiến: ")
    add_bullet("Quản lý kỹ thuật và Quản lý vận hành Trạm biến áp 220kV – 500kV, Thí nghiệm điện, Viễn thông CNTT & Chuyển đổi số.", bold_prefix="Lĩnh vực áp dụng: ")

    # ==================== PHẦN A ====================
    add_heading_1("A. MÔ TẢ GIẢI PHÁP")

    add_heading_2("1. Tình trạng kỹ thuật và thực tiễn quản lý vận hành trước khi áp dụng giải pháp")
    add_p("Trong công tác quản lý kỹ thuật và quản lý vận hành các Trạm biến áp (TBA) 220kV – 500kV thuộc Công ty Truyền tải điện 3 (PTC3), phương pháp phân tích hàm lượng khí hòa tan trong dầu (Dissolved Gas Analysis - DGA) và kiểm tra các đặc tính hóa lý, điện môi của dầu cách điện (độ ẩm, điện áp chọc thủng BDV, tổn hao điện môi tgδ ở 90°C hoặc 20°C) là biện pháp kỹ thuật quan trọng nhất để chẩn đoán sớm các nguy cơ hư hỏng phóng điện (phóng điện cục bộ PD, phóng điện năng lượng thấp D1, phóng điện năng lượng cao D2) và quá nhiệt các cấp (T1, T2, T3) của Máy biến áp (MBA) lực, Kháng điện dầu, Biến dòng điện (TI), Biến điện áp (TU) và Sứ xuyên cao áp.", first_line_indent=0.5)
    
    add_p("Đối với các Đơn vị Quản lý vận hành (bao gồm các Truyền tải điện khu vực, Đội Truyền tải điện và các Trạm biến áp 220kV - 500kV), dữ liệu DGA đóng vai trò 'hồ sơ sức khỏe' của thiết bị trong suốt vòng đời vận hành. Tuy nhiên, trước khi giải pháp này được áp dụng, công tác theo dõi, quản lý và phân tích số liệu DGA tại các đơn vị gặp nhiều khó khăn, tồn tại lớn:", first_line_indent=0.5)

    add_bullet(" Định kỳ hàng năm hoặc sau các đợt thí nghiệm đột xuất/sau bảo dưỡng, Đơn vị Quản lý vận hành tiếp nhận kết quả thí nghiệm DGA từ các đơn vị thí nghiệm dưới dạng các file PDF riêng lẻ hoặc bản in scan. Hồ sơ qua các năm nằm rải rác trong nhiều thư mục máy tính cá nhân hoặc trong tủ hồ sơ lưu trữ giấy, dẫn đến tình trạng dữ liệu bị cô lập, thiếu một cơ sở dữ liệu số hóa tập trung xuyên suốt theo mã định danh từng thiết bị.", bold_prefix="Biên bản thí nghiệm quá khứ bị lưu trữ phân tán, rời rạc:")
    add_bullet(" Khi cần đánh giá mức độ suy thoái hoặc so sánh tốc độ tăng trưởng khí theo Bảng 65 Quy định QĐ 1901/QĐ-EVNNPT (nhằm xác định tốc độ tăng tuyệt đối ppm/năm và tương đối %/tháng), cán bộ kỹ thuật tại trạm phải lục tìm lại từng biên bản cũ của các năm trước, mở từng file PDF và dùng máy tính bấm tay để trừ thủ công từng chất khí. Quá trình này mất rất nhiều thời gian, công sức và dễ xảy ra sai sót, dẫn đến việc theo dõi xu hướng thường bị bỏ ngỏ hoặc chỉ thực hiện khi nồng độ khí đã vượt ngưỡng nghiêm trọng.", bold_prefix="Khó khăn, tốn nhiều công sức khi muốn tra cứu lịch sử và theo dõi xu hướng:")
    add_bullet(" Để đánh giá chính xác một kết quả DGA, người vận hành phải tra cứu, đối chiếu đồng thời nhiều văn bản quy chuẩn phức tạp: Quyết định 1901/QĐ-EVNNPT ngày 29/09/2025 (Bảng 64 ngưỡng khí, Bảng 65 tốc độ tăng, Bảng 66 mã chẩn đoán hư hỏng), IEC 60599:2022, IEC 60422:2024 và tiêu chuẩn riêng của nhà sản xuất thiết bị (như hãng Arteche đối với biến dòng điện 500kV). Việc ghi nhớ và so sánh thủ công nhiều bảng ngưỡng cùng lúc là thách thức lớn đối với nhân viên vận hành tại trạm.", bold_prefix="Quy chuẩn kỹ thuật đan xen phức tạp, nhiều ngưỡng đánh giá:")
    add_bullet(" Phương pháp Tam giác Duval (Duval Triangle) là công cụ chẩn đoán trực quan hàng đầu thế giới được IEC công nhận. Tuy nhiên, để xác định được dạng hư hỏng đòi hỏi phải tính toán tỷ lệ % của 3 chất khí chuẩn hóa và đối chiếu tọa độ hình học trên đồ thị tam giác đều. Cán bộ quản lý vận hành không thể vẽ hoặc kiểm tra nhanh phương pháp này tại hiện trường nếu không có công cụ phần mềm chuyên dụng hỗ trợ.", bold_prefix="Thiếu công cụ trực quan hóa dạng sự cố bằng đồ họa Tam giác Duval:")
    add_bullet(" Khi cán bộ trạm sao chép số liệu từ biên bản PDF vào bảng tính để quản lý, việc chuyển đổi qua lại giữa cửa sổ xem PDF và bảng tính rất dễ dẫn đến nhìn nhầm dòng, gõ nhầm cột giữa các chất khí có nồng độ gần nhau (như CH4 và C2H4), dẫn đến kết quả phân tích bị sai lệch hoàn toàn.", bold_prefix="Nguy cơ nhầm lẫn số liệu khi nhập thủ công từ biên bản PDF:")
    add_bullet(" Các bảng tính Excel lưu trữ nội bộ không có cơ chế phân quyền, không kiểm soát được ai đã sửa số liệu, sửa vào lúc nào và sửa giá trị gì. Đồng thời, việc sử dụng các dịch vụ đám mây công cộng bên ngoài tiềm ẩn rủi ro rò rỉ thông số kỹ thuật vận hành của hệ thống truyền tải điện quốc gia.", bold_prefix="Thiếu cơ chế an toàn thông tin và nhật ký lưu vết chỉnh sửa:")

    add_heading_2("2. Nội dung giải pháp đề nghị công nhận sáng kiến")
    
    add_heading_3("2.1. Mục đích của giải pháp")
    add_p("Nhằm tháo gỡ triệt để các khó khăn nêu trên và đẩy mạnh ứng dụng chuyển đổi số vào công tác quản lý kỹ thuật thiết bị trạm biến áp, nhóm tác giả đã xây dựng phần mềm chuyên dụng DGA-Webapp với các mục tiêu trọng tâm:", first_line_indent=0.5)
    add_bullet("Trao quyền chủ động cho các Đơn vị Quản lý vận hành (Truyền tải điện khu vực, Đội TTĐ, Trạm biến áp 220kV - 500kV): Dễ dàng tự nạp các biên bản DGA quá khứ vào hệ thống (cả nạp đơn lẻ từng file hoặc nạp hàng loạt nhiều file PDF cùng lúc) để thiết lập kho dữ liệu lịch sử số hóa cho từng thiết bị.")
    add_bullet("Tự động hóa hoàn toàn việc trích xuất số liệu từ file PDF biên bản thí nghiệm và cung cấp giao diện đối chiếu song song trực quan, loại bỏ nguy cơ gõ nhầm số liệu.")
    add_bullet("Tự động đánh giá chẩn đoán toàn diện tình trạng khí cháy và dầu cách điện theo tiêu chuẩn kép QĐ 1901/EVNNPT, IEC 60599:2022, IEC 60422:2024 và tiêu chuẩn nhà sản xuất; tự động trực quan hóa điểm làm việc trên Tam giác Duval tức thì.")
    add_bullet("Tự động thiết lập đồ thị diễn biến xu hướng chuỗi thời gian, tính toán tốc độ tăng khí Bảng 65 và đưa ra cảnh báo sớm bất thường thiết bị trước khi chạm ngưỡng nguy hiểm.")
    add_bullet("Đảm bảo an toàn thông tin, kiểm soát phân quyền chặt chẽ, chống dò mật khẩu, lưu vết chỉnh sửa minh bạch và hoạt động linh hoạt (cả Online lẫn Offline tại sân trạm).")

    add_heading_3("2.2. Các điều kiện cần thiết để áp dụng giải pháp")
    add_bullet("Ứng dụng chạy trực tiếp trên trình duyệt Web hiện đại (Google Chrome, Microsoft Edge, Safari, Firefox, Cốc Cốc...) trên mọi loại máy tính để bàn, laptop, máy tính bảng hoặc điện thoại thông minh. Hoàn toàn không đòi hỏi cài đặt thêm phần mềm phức tạp.", bold_prefix="Về thiết bị người dùng: ")
    add_bullet("Cán bộ quản lý vận hành có thể truy cập trực tuyến qua liên kết https://quantrong77.github.io/dga-webapp/ hoặc chạy trực tiếp từ bộ nhớ cục bộ máy tính khi làm việc tại các trạm biến áp vùng sâu vùng xa bị mất mạng Internet.", bold_prefix="Về môi trường làm việc linh hoạt: ")
    add_bullet("Cơ sở dữ liệu được lưu trữ an toàn trong hạ tầng lưu trữ nội bộ / Google Drive của doanh nghiệp, có cơ chế đồng bộ và phân quyền truy cập nghiêm ngặt theo đúng quy định an toàn thông tin của Tập đoàn Điện lực Việt Nam và Tổng công ty Truyền tải điện Quốc gia.", bold_prefix="Về cơ sở dữ liệu và bảo mật: ")

    add_heading_3("2.3. Các tính năng nghiệp vụ cốt lõi của giải pháp")
    add_p("Khác với các ứng dụng mang nặng tính lý thuyết, DGA-Webapp được xây dựng bám sát nhu cầu nghiệp vụ thực tế hàng ngày của người làm công tác quản lý vận hành và thí nghiệm điện. Ứng dụng tập trung vào các tính năng cốt lõi sau:", first_line_indent=0.5)

    # FEATURE 1: BATCH & SPLIT PREVIEW
    add_p("🌟 Tính năng 1: Đơn vị Quản lý vận hành tự nạp biên bản quá khứ & Giao diện Đối chiếu Song song PDF", bold=True, color=(2, 132, 199))
    add_p("Đây là tính năng đột phá giải quyết bài toán lịch sử cho các Đơn vị QLVH. Khi tiếp nhận hồ sơ quản lý hoặc cần chuẩn hóa dữ liệu cũ, cán bộ kỹ thuật chỉ cần kéo thả 1 file hoặc sử dụng tính năng Nạp hàng loạt (Batch Import) hàng chục file PDF biên bản DGA của các năm trước vào ứng dụng. Hệ thống tự động bóc tách ngày lấy mẫu, mã thiết bị, cấp điện áp và nồng độ 7 chất khí, đồng thời tự sắp xếp chuỗi thời gian theo đúng thứ tự lịch sử.", first_line_indent=0.5)
    add_p("Đặc biệt, giao diện thông minh tự động kích hoạt bố cục Đối chiếu Song song (Side-by-Side Split Preview): Biên bản PDF gốc hiển thị ngay bên phải, còn form số liệu trích xuất nằm bên trái. Cán bộ vận hành có thể đối soát trực quan từng con số giữa bản gốc và dữ liệu trích xuất trước khi lưu vào hệ thống, đảm bảo độ chính xác tuyệt đối.", first_line_indent=0.5)
    add_image_with_caption(os.path.join("docs", "images", "01_dga_split_preview.png"), "Hình 1: Giao diện đối chiếu song song giữa Biên bản PDF gốc (bên phải) và Form dữ liệu trích xuất DGA (bên trái) trên ứng dụng.")

    # FEATURE 2: DUVAL & DGA DIAGNOSIS
    add_p("🌟 Tính năng 2: Tự động Đánh giá Chẩn đoán DGA theo chuẩn EVNNPT – IEC & Tam giác Duval Trực quan", bold=True, color=(2, 132, 199))
    add_p("Ngay khi có số liệu khí, hệ thống tức thì đối chiếu với Bảng 64 QĐ 1901 (hoặc Bảng 12 đối với thiết bị đo lường TI/TU), kiểm tra Bảng 63 về Tổng hàm lượng khí hòa tan TDGC. Ứng dụng tự động tính toán 3 tỷ số khí kinh điển theo chuẩn IEC 60599 để xác định chính xác dạng hư hỏng theo Bảng 66 (Phóng điện cục bộ PD, Phóng điện năng lượng thấp D1, Phóng điện năng lượng cao D2, Quá nhiệt các mức T1, T2, T3).", first_line_indent=0.5)
    add_p("Đồng thời, ứng dụng tự động tính tỷ lệ % của 3 chất khí chuẩn hóa (%CH4, %C2H4, %C2H2) và vẽ trực tiếp điểm làm việc lên đồ thị Tam giác Duval 1 dạng đồ họa SVG sắc nét, giúp cán bộ QLVH nhìn thấy trực quan vị trí điểm sự cố rơi vào vùng nào mà không cần tính toán thủ công.", first_line_indent=0.5)
    add_image_with_caption(os.path.join("docs", "images", "02_dga_results_duval.png"), "Hình 2: Kết quả đánh giá chỉ tiêu khí hòa tan theo QĐ 1901, chẩn đoán dạng sự cố Bảng 66 và đồ họa Tam giác Duval 1 trực quan.")

    # FEATURE 3: OIL TEST & 3-PHASE
    add_p("🌟 Tính năng 3: Đánh giá Chỉ tiêu Hóa lý Dầu Cách điện theo IEC 60422:2024 & Hỗ trợ TI 3 Pha Đồng bộ", bold=True, color=(2, 132, 199))
    add_p("Bên cạnh khí DGA, ứng dụng hỗ trợ phân hệ đánh giá toàn diện các chỉ tiêu cơ bản của dầu cách điện: Điện áp chọc thủng (BDV), Độ ẩm (ppm), Tổn hao điện môi tgδ ở 90°C hoặc 20°C cho cả dầu MBA chính và dầu ngăn điều áp dưới tải (OLTC Bảng 49 QĐ 1901). Cập nhật tiêu chuẩn quốc tế mới nhất IEC 60422:2024 đưa ra kết luận rõ ràng: Tốt / Khá / Kém.", first_line_indent=0.5)
    add_p("Đặc biệt, ứng dụng tích hợp sẵn chức năng nạp và đánh giá đồng thời biên bản gộp cả 3 pha A, B, C của giàn máy biến dòng điện (TI) trong cùng một lượt nhập liệu, giúp tiết kiệm tối đa thời gian thao tác cho người dùng.", first_line_indent=0.5)
    add_image_with_caption(os.path.join("docs", "images", "03_oil_test_iec60422.png"), "Hình 3: Màn hình nhập và đánh giá tự động các chỉ tiêu lý hóa dầu cách điện MBA và TI 3 pha theo chuẩn IEC 60422:2024.")

    # FEATURE 4: ALERTS DASHBOARD
    add_p("🌟 Tính năng 4: Bảng Điều khiển Giám sát Cảnh báo Tập trung (Alerts Dashboard)", bold=True, color=(2, 132, 199))
    add_p("Bảng điều khiển trung tâm cung cấp 4 thẻ chỉ số KPI tự động: Tổng số thiết bị đã theo dõi, Số thiết bị Bình thường, Số thiết bị mức Cảnh báo và Mức Báo động nguy hiểm. Ứng dụng tự động quét toàn bộ kho dữ liệu lịch sử, gom cụm danh sách các thiết bị có nguy cơ (vượt ngưỡng nồng độ hoặc có tốc độ tăng khí vượt Bảng 65). Người quản lý có thể bấm nút 'Xuất Excel' để trích xuất ngay danh sách thiết bị bất thường báo cáo cấp trên chỉ trong 1 giây.", first_line_indent=0.5)
    add_image_with_caption(os.path.join("docs", "images", "04_alerts_dashboard.png"), "Hình 4: Bảng điều khiển cảnh báo tập trung (KPI Cards) và danh sách thiết bị cần theo dõi đặc biệt.")

    # FEATURE 5: HISTORY & AUDIT TRAIL
    add_p("🌟 Tính năng 5: Quản lý Lịch sử Thiết bị, So sánh Tốc độ Sinh khí Bảng 65 & Nhật ký Sửa đổi (Audit Trail)", bold=True, color=(2, 132, 199))
    add_p("Ứng dụng trang bị bộ lọc thông minh theo từng Trạm biến áp và Thiết bị. Người dùng có thể tích chọn 2 lần đo bất kỳ trong lịch sử để hệ thống tự động tính toán tốc độ gia tăng khí tuyệt đối (ppm/năm) và tương đối (%/tháng) đối chiếu trực tiếp với Bảng 65 QĐ 1901.", first_line_indent=0.5)
    add_p("Đặc biệt, hệ thống tích hợp cơ chế lưu vết kiểm toán độc lập: mỗi khi số liệu bị chỉnh sửa, ứng dụng tự động hiển thị huy hiệu '✎ N lần sửa'. Rà chuột vào huy hiệu sẽ xem được chi tiết ai đã sửa, sửa chất khí nào, từ giá trị bao nhiêu sang bao nhiêu và vào thời gian nào, đảm bảo tính khách quan và chống chối bỏ trách nhiệm.", first_line_indent=0.5)
    add_image_with_caption(os.path.join("docs", "images", "05_history_comparison_audit.png"), "Hình 5: Tab Lịch sử đo, công cụ so sánh tốc độ tăng khí Bảng 65 và huy hiệu lưu vết chỉnh sửa dữ liệu minh bạch.")

    # FEATURE 6: TREND FORECASTING
    add_p("🌟 Tính năng 6: Đồ thị Xu hướng Chuỗi Thời gian & Dự báo Phát triển Khí Sớm", bold=True, color=(2, 132, 199))
    add_p("Từ dữ liệu quá khứ được nạp vào, ứng dụng tự động tổng hợp và vẽ đồ thị diễn biến nồng độ của từng chất khí qua các năm một cách trực quan. Hệ thống tính toán xu hướng tăng trưởng và ước tính thời gian dự kiến nồng độ khí có thể chạm ngưỡng cảnh báo, giúp Đơn vị QLVH chủ động đề xuất phương án bảo dưỡng (rút ngắn chu kỳ lấy mẫu, lọc dầu hoặc cô lập thiết bị) trước khi xảy ra sự cố nghiêm trọng.", first_line_indent=0.5)
    add_image_with_caption(os.path.join("docs", "images", "06_trend_forecasting_chart.png"), "Hình 6: Đồ thị diễn biến xu hướng nồng độ các chất khí theo chuỗi thời gian và dự báo tăng trưởng khí.")

    # FEATURE 7: REGULATION CONFIG & WORD EXPORT
    add_p("🌟 Tính năng 7: Quản trị Cấu hình Tiêu chuẩn Kỹ thuật & Xuất Báo cáo Chuẩn Word Nhanh chóng", bold=True, color=(2, 132, 199))
    add_p("Ứng dụng cho phép cấu hình linh hoạt toàn bộ 13 bảng quy chuẩn kỹ thuật của QĐ 1901/EVNNPT cũng như tiêu chuẩn riêng của các hãng chế tạo thiết bị (như Arteche). Khi quy định của Tập đoàn có sự thay đổi, người dùng chỉ cần cập nhật lại thông số trên giao diện cấu hình mà không cần phải lập trình lại phần mềm.", first_line_indent=0.5)
    add_p("Đồng thời, ứng dụng tích hợp tính năng tự động sinh Biên bản thí nghiệm và Báo cáo phân tích chuyên nghiệp định dạng Microsoft Word (.docx) chuẩn theo biểu mẫu quy định của PTC3/EVNNPT chỉ với một cú nhấp chuột, giúp tiết kiệm hàng giờ soạn thảo văn bản thủ công.", first_line_indent=0.5)
    add_image_with_caption(os.path.join("docs", "images", "07_admin_regulation_config.png"), "Hình 7: Giao diện quản trị cấu hình 13 bảng quy chuẩn QĐ 1901/EVNNPT và tiêu chuẩn kỹ thuật nhà sản xuất.")

    add_heading_3("2.4. Công tác An toàn thông tin và Bảo mật dữ liệu")
    add_p("Là ứng dụng phục vụ trực tiếp công tác quản lý kỹ thuật thiết bị trạm biến áp truyền tải điện, yếu tố an toàn thông tin được nhóm tác giả chú trọng hàng đầu và thiết kế chặt chẽ theo các quy định của EVN/EVNNPT:", first_line_indent=0.5)
    add_bullet("Hệ thống thiết lập cơ chế phân quyền người dùng (Role-Based Access Control - RBAC) rõ ràng giữa vai trò Quản trị viên (Admin - được quyền cấu hình ngưỡng tiêu chuẩn, quản lý người dùng) và Cán bộ QLVH/Người dùng (User/Viewer - chỉ được nạp biên bản, tra cứu và xuất báo cáo), ngăn chặn triệt để nguy cơ can thiệp trái phép làm sai lệch quy chuẩn kỹ thuật.", bold_prefix="Cơ chế phân quyền người dùng chặt chẽ (RBAC): ")
    add_bullet("Hệ thống tự động theo dõi số lần đăng nhập không thành công; nếu phát hiện hành vi cố ý dò quét mật khẩu liên tiếp, tài khoản sẽ tự động bị khóa tạm thời trong một khoảng thời gian quy định nhằm triệt tiêu hoàn toàn nguy cơ tấn công chiếm quyền điều khiển.", bold_prefix="Khóa tài khoản chống tấn công dò mật khẩu (Brute-Force Lockout): ")
    add_bullet("Hệ thống trang bị cơ chế khóa đồng thời nhằm bảo vệ tính toàn vẹn của dữ liệu khi nhiều cán bộ kỹ thuật cùng thao tác cập nhật biên bản trên hệ thống, loại trừ hoàn toàn nguy cơ xung đột hoặc ghi đè làm mất dữ liệu.", bold_prefix="Kiểm soát xung đột ghi dữ liệu (Concurrency Lock): ")
    add_bullet("Cơ sở dữ liệu và các file biên bản được lưu trữ tập trung trên hệ thống hạ tầng lưu trữ nội bộ / Google Drive của doanh nghiệp được phân quyền nghiêm ngặt. Hệ thống không sử dụng các dịch vụ đám mây công cộng bên ngoài không kiểm soát, bảo đảm an toàn tuyệt đối các thông số vận hành của lưới điện quốc gia.", bold_prefix="Lưu trữ dữ liệu trong hạ tầng an toàn nội bộ: ")

    # SECTION 3: DEPLOYMENT
    add_heading_2("3. Quá trình áp dụng giải pháp vào thực tiễn sản xuất")
    add_bullet("Bắt đầu nghiên cứu, khảo sát nhu cầu từ tháng 08/2026; đưa vào thử nghiệm từ tháng 09/2026 và chính thức áp dụng thường xuyên từ tháng 10/2026 đến nay.", bold_prefix="Thời gian bắt đầu áp dụng: ")
    add_bullet("Sáng kiến đã được triển khai áp dụng thực tế tại Đội Sửa chữa, thí nghiệm điện Lâm Đồng và phối hợp cùng các Đơn vị Quản lý vận hành thuộc PTC3 (Truyền tải điện Lâm Đồng, Đội Truyền tải điện, các Trạm biến áp 500kV Di Linh, TBA 500kV Pleiku 2, TBA 220kV Bảo Lộc, Đức Trọng...).", bold_prefix="Địa bàn và đối tượng áp dụng: ")
    add_bullet("Các Đơn vị QLVH đã tiến hành nạp thành công hàng trăm biên bản DGA quá khứ của các MBA 500kV, MBA 220kV, Kháng điện 500kV và hệ thống TI 3 pha vào ứng dụng, bước đầu hình thành kho dữ liệu chuỗi thời gian số hóa cho các thiết bị trọng điểm. Ngay sau khi tiếp nhận biên bản thí nghiệm mới, cán bộ QLVH tự nạp vào ứng dụng, đối chiếu song song với bản gốc và theo dõi ngay biến động tốc độ tăng khí Bảng 65. Nhờ đó, đơn vị đã phát hiện sớm một số thiết bị có tốc độ tăng khí dị biệt để chủ động rút ngắn chu kỳ theo dõi, bảo đảm an toàn tuyệt đối cho thiết bị vận hành.", bold_prefix="Kết quả vận hành thực tế: ")

    # SECTION 4: BENEFITS
    add_heading_2("4. Hiệu quả thực tế thu được khi áp dụng giải pháp")
    add_bullet("Đơn vị Quản lý vận hành hoàn toàn làm chủ cơ sở dữ liệu DGA lịch sử của thiết bị do mình quản lý. Chấm dứt hoàn toàn tình trạng thất lạc biên bản giấy hoặc mất nhiều ngày tìm kiếm dữ liệu cũ khi có sự cố bất thường xảy ra.", bold_prefix="Số hóa toàn diện và làm chủ dữ liệu lịch sử thiết bị: ")
    add_bullet("Thời gian tra cứu, tính toán tỷ số khí, đối chiếu ngưỡng và đánh giá một biên bản DGA được rút ngắn từ 30 - 45 phút xuống dưới 2 phút (giảm trên 90% thời gian lao động). Tự động hóa khâu bóc tách dữ liệu PDF và xuất báo cáo Word chuẩn giúp giải phóng sức lao động cho cán bộ kỹ thuật.", bold_prefix="Tăng năng suất lao động vượt bậc: ")
    add_bullet("Loại trừ hoàn toàn sai sót do con người khi tính toán thủ công các tỷ số khí, tốc độ tăng khí và vẽ tam giác Duval; tự động hóa việc áp dụng tiêu chuẩn kép chặt chẽ min(QĐ 1901, IEC).", bold_prefix="Nâng cao chất lượng chẩn đoán và độ tin cậy kỹ thuật: ")
    add_bullet("Chuyển đổi phương thức quản lý vận hành từ bị động (chờ thiết bị hư hỏng hoặc chờ thông báo từ xa) sang chủ động theo dõi xu hướng chuỗi thời gian, phát hiện nguy cơ phóng điện/quá nhiệt ngay từ giai đoạn khởi phát để xử lý kịp thời, ngăn chặn triệt để nguy cơ sự cố cháy nổ thiết bị cao áp trên lưới truyền tải.", bold_prefix="Ngăn ngừa sớm rủi ro sự cố cháy nổ thiết bị trạm: ")
    add_bullet("Nhờ thiết kế gọn nhẹ, linh hoạt, cán bộ QLVH có thể tra cứu và đánh giá số liệu trực tiếp tại trạm biến áp ngay cả khi mất mạng Internet, đáp ứng tốt yêu cầu công tác tại hiện trường.", bold_prefix="Tính linh hoạt và cơ động cao tại hiện trường: ")

    # ==================== PHẦN B ====================
    add_heading_1("B. HIỆU QUẢ KINH TẾ VÀ XÃ HỘI CỦA GIẢI PHÁP")
    add_p("Sáng kiến là sản phẩm phần mềm chuyên dụng phục vụ công tác quản lý kỹ thuật và vận hành trạm biến áp, giá trị làm lợi thể hiện rõ nét qua các mặt kinh tế và an toàn vận hành:", first_line_indent=0.5)

    add_bullet("Nếu mua sắm các phần mềm thương mại quản lý DGA của các hãng nước ngoài (như GE, Doble, Morgan Schaffer), chi phí bản quyền và duy trì hàng năm ước tính từ 300.000.000 VNĐ đến 500.000.000 VNĐ. Việc tự chủ nghiên cứu, xây dựng ứng dụng nội bộ giúp tiết kiệm toàn bộ khoản kinh phí đầu tư này cho Công ty.", bold_prefix="1. Tiết kiệm chi phí đầu tư mua sắm phần mềm nước ngoài: ")
    add_bullet("Với quy mô quản lý hàng chục trạm biến áp và hàng trăm thiết bị chính của PTC3, mỗi năm thực hiện hàng nghìn lượt phân tích mẫu dầu. Việc rút ngắn thời gian xử lý từ 40 phút xuống dưới 2 phút/mẫu giúp tiết kiệm hàng trăm giờ công lao động kỹ thuật chuyên môn mỗi năm cho các đơn vị QLVH và thí nghiệm.", bold_prefix="2. Tiết kiệm hàng trăm giờ công lao động chuyên môn: ")
    add_bullet("Một sự cố cháy nổ máy biến áp 500kV hoặc 220kV do hư hỏng cách điện dầu không được phát hiện kịp thời sẽ gây thiệt hại hàng chục đến hàng trăm tỷ đồng tiền mua sắm thiết bị thay thế, gián đoạn cung cấp điện và thiệt hại kinh tế - xã hội khôn lường. Ứng dụng DGA-Webapp đóng vai trò là 'hàng rào chẩn đoán sớm', giúp ngăn ngừa triệt để các rủi ro này.", bold_prefix="3. Ngăn ngừa sự cố thiết bị cao áp (Hiệu quả kinh tế gián tiếp cực lớn): ")

    # ==================== PHẦN C ====================
    add_heading_1("C. KHẢ NĂNG NHÂN RỘNG TẠI CÁC ĐƠN VỊ KHÁC")
    add_bullet("Ứng dụng chạy trực tiếp trên nền tảng Web tiêu chuẩn, giao diện Responsive tương thích trên cả máy tính và thiết bị di động, không yêu cầu đầu tư phần cứng máy chủ đắt tiền, hoàn toàn sẵn sàng để mở rộng cho tất cả các Truyền tải điện khu vực trong toàn PTC3.")
    add_bullet("Hệ thống tuân thủ chính xác 100% Quy định kỹ thuật số 1901/QĐ-EVNNPT và các tiêu chuẩn quốc tế IEC (IEC 60599, IEC 60422), do đó hoàn toàn có thể nhân rộng áp dụng ngay cho tất cả các Công ty Truyền tải điện (PTC1, PTC2, PTC4), các Ban Quản lý dự án và các Tổng công ty Điện lực trong toàn Tập đoàn Điện lực Việt Nam mà không phát sinh thêm bất kỳ chi phí bản quyền nào.")

    # ==================== PHẦN D ====================
    add_heading_1("D. DANH MỤC TÀI LIỆU NỘP KÈM ĐƠN YÊU CẦU CÔNG NHẬN SÁNG KIẾN")
    add_bullet("https://quantrong77.github.io/dga-webapp/", bold_prefix="1. Địa chỉ Web App truy cập trực tuyến: ")
    add_bullet("docs/application_mockup_flow.html", bold_prefix="2. Sơ đồ tương tác Kiến trúc giao diện và luồng điều hướng: ")
    add_bullet("user_manual.md (Tài liệu hướng dẫn sử dụng 19 mục nghiệp vụ).", bold_prefix="3. Cẩm nang hướng dẫn sử dụng chi tiết cho người vận hành: ")
    add_bullet("Toàn bộ mã nguồn chương trình ứng dụng (HTML/CSS/JS thuần, các module logic, lưu trữ, giao diện và kịch bản kết nối dữ liệu nội bộ).", bold_prefix="4. Mã nguồn chương trình: ")
    add_bullet("Bộ kiểm thử tự động toàn diện với 23 test suites và 410 ca kiểm thử Jest đạt tỷ lệ vượt qua 100% (bảo đảm tính toán chính xác và an toàn).", bold_prefix="5. Báo cáo kết quả kiểm thử tự động: ")
    add_bullet("Tập hợp 7 hình ảnh chụp thực tế giao diện và các tính năng cốt lõi của ứng dụng (trong thư mục docs/images/).", bold_prefix="6. Album ảnh minh họa tính năng thực tế: ")

    # ==================== PHẦN E ====================
    add_heading_1("E. DANH SÁCH NHỮNG NGƯỜI THAM GIA TỔ CHỨC ÁP DỤNG SÁNG KIẾN LẦN ĐẦU")

    impl_data = [
        ["TT", "Họ và tên", "Năm sinh", "Nơi công tác", "Trình độ chuyên môn", "Nội dung tham gia"],
        ["1", "Hoàng Trần Quản Trọng", "1977", "Đội Sửa chữa, thí nghiệm điện Lâm Đồng - PTC3", "Kỹ sư Điện", "Chủ trì xây dựng phần mềm, thiết kế tính năng nạp biên bản quá khứ, giải thuật phân tích và kiểm thử"],
        ["2", "Nguyễn Hữu Kính", "1969", "Đội Sửa chữa, thí nghiệm điện Lâm Đồng - PTC3", "Thạc sỹ Kỹ thuật điện", "Chỉ đạo chuyên môn, rà soát quy chuẩn EVNNPT/IEC và đối soát dữ liệu vận hành"],
        ["3", "Kim Văn Quỳnh", "1977", "Đội Sửa chữa, thí nghiệm điện Lâm Đồng - PTC3", "Kỹ sư Điện", "Phối hợp thu thập biên bản DGA lịch sử các trạm biến áp, kiểm thử chức năng nạp dữ liệu và đối soát"],
        ["4", "Phan Thị Tiết Hạnh", "1977", "Đội Thí nghiệm điện Khánh Hòa - PTC3", "Kỹ sư Điện", "Phối hợp chuyên môn nghiệp vụ thí nghiệm hóa dầu, kiểm thử chẩn đoán và xuất báo cáo"]
    ]

    t_impl = doc.add_table(rows=len(impl_data), cols=6)
    t_impl.alignment = WD_TABLE_ALIGNMENT.CENTER
    impl_widths = [Inches(0.4), Inches(1.4), Inches(0.65), Inches(1.8), Inches(1.0), Inches(1.5)]

    for r_idx, row in enumerate(impl_data):
        for c_idx, val in enumerate(row):
            cell = t_impl.cell(r_idx, c_idx)
            cell.width = impl_widths[c_idx]
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_margins(cell, top=80, bottom=80, left=90, right=90)
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
                run.font.size = Pt(10.5)
                set_cell_background(cell, "F1F5F9")
            else:
                run.font.size = Pt(10.5)

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
