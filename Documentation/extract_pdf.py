import PyPDF2

def extract_text_from_pdf(pdf_path):
    with open(pdf_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        text = ""
        for page_num in range(len(reader.pages)):
            page = reader.pages[page_num]
            text += f"--- Page {page_num + 1} ---\n"
            text += page.extract_text() + "\n\n"
        return text

if __name__ == "__main__":
    pdf_path = "Mana_Forge_Task_Specification_v3.pdf"
    try:
        text = extract_text_from_pdf(pdf_path)
        print(text)
    except Exception as e:
        print(f"Error reading PDF: {e}")
