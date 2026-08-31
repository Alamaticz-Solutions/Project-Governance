from fpdf import FPDF

class PDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.cell(0, 10, 'PROJECT PROPOSAL DOCUMENT', 0, 1, 'C')
        self.ln(10)

def create_pdf():
    pdf = PDF()
    pdf.add_page()
    pdf.set_font('Arial', '', 11)

    with open('../sample_project_proposal.txt', 'r', encoding='utf-8') as f:
        for line in f:
            # fpdf doesn't like some characters, replace smart quotes etc. if needed
            line = line.replace('\u2019', "'").replace('\u201c', '"').replace('\u201d', '"')
            pdf.multi_cell(0, 7, line)
    
    pdf.output('../sample_project_proposal.pdf', 'F')

if __name__ == '__main__':
    create_pdf()
