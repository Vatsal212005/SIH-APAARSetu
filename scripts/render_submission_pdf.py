from pathlib import Path
import pypdfium2 as pdfium

root = Path(__file__).resolve().parents[1]
document = pdfium.PdfDocument(
    str(root / "docs" / "presentation" / "APAARSetu-SIH-draft.pdf")
)
assert len(document) == 6
for index in range(len(document)):
    page = document[index]
    bitmap = page.render(scale=1.2)
    bitmap.to_pil().save(
        root / "runtime" / "presentation-build" / f"pdf-page-{index + 1}.png"
    )
print("Rendered and checked six PDF pages.")
