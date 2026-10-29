from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

root = Path(__file__).resolve().parents[1]
destination = root / "docs" / "presentation" / "APAARSetu-SIH-draft.pdf"
destination.parent.mkdir(exist_ok=True, parents=True)
document = canvas.Canvas(str(destination), pagesize=(960, 540))
document.setTitle("APAARSetu SIH26263 - Non-official six-slide template draft")
for index in range(1, 7):
    source = root / "runtime" / "presentation-build" / f"slide-{index}.png"
    document.drawImage(ImageReader(str(source)), 0, 0, width=960, height=540)
    document.showPage()
document.save()
print(destination)
