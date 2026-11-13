"""Independently parse and rasterize the real browser -> Java customer PDF export."""
import io,json,zipfile,hashlib
from pathlib import Path
from PIL import Image,ImageChops,ImageStat
from pypdf import PdfReader
import pymupdf
root=Path('/workspace/integration-evidence')
source=Path('/workspace/qa-results/Zamerovac-QA/browser/run-2026-11-13T12-09-45-020Z-3549/evidence/gallery-state/rotated-inset-with-caption.png')
original=Image.open(source).convert('RGB')
checks=[]
with zipfile.ZipFile(root/'browser-to-native-pdf.zip') as archive:
 names=archive.namelist()
 assert len(names)==1 and names[0].endswith('.pdf') and '/' not in names[0]
 data=archive.read(names[0]);reader=PdfReader(io.BytesIO(data),strict=True)
 assert len(reader.pages)==2 and not reader.metadata
 assert not reader.trailer['/Root'].get('/Names')
 with pymupdf.open(stream=data,filetype='pdf') as pdf:
  for index,page in enumerate(reader.pages):
   assert len(page.images)==1 and page.extract_text()=='' and not page.get('/Annots')
   assert [float(x) for x in page.mediabox]==[0,0,*original.size]
   embedded=page.images[0].image.convert('RGB')
   assert embedded.size==original.size
   pix=pdf[index].get_pixmap();render=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
   assert render.size==original.size
   diff=ImageStat.Stat(ImageChops.difference(original,render))
   assert max(diff.mean)<3, diff.mean
   # Compare dark glyphs and yellow annotation pixels separately, preventing a
   # blank page or missing dimensions/caption from hiding behind mean background.
   points=list(original.getdata());actual=list(render.getdata())
   yellow=[i for i,(r,g,b) in enumerate(points) if r>180 and g>150 and b<100]
   dark=[i for i,(r,g,b) in enumerate(points) if max(r,g,b)<65]
   assert len(yellow)>50 and len(dark)>50
   for group in [yellow,dark]:
    error=sum(sum(abs(points[i][k]-actual[i][k]) for k in range(3))/3 for i in group)/len(group)
    assert error<25,error
   glyphs=[]
   for name,box in [('measure1585,800001',(510,320,665,384)),('nested987,000001',(945,800,1067,925)),('caption',(910,980,1100,1020))]:
    ref=original.crop(box);out=render.crop(box)
    pairs=list(zip(ref.getdata(),out.getdata()))
    selected=[(a,b) for a,b in pairs if a[0]>180 and a[1]>150 and a[2]<100]
    assert len(selected)>20,(name,len(selected))
    error=sum(sum(abs(a[k]-b[k]) for k in range(3))/3 for a,b in selected)/len(selected)
    assert error<25,(name,error)
    glyphs.append({'name':name,'yellowPixels':len(selected),'meanError':error})
   if index==0: render.save(root/'native-pdf-render.png')
   checks.append({'glyphChecks':glyphs,'page':index+1,'size':original.size,'meanRGBError':diff.mean,'yellowAnnotationPixels':len(yellow),'darkGlyphPixels':len(dark)})
result={'status':'PASS','tested_sha':'ae3b4df53c25557f28b4a25ccb65adc2abdff639','sourcePNG_SHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'zipSHA256':hashlib.sha256((root/'browser-to-native-pdf.zip').read_bytes()).hexdigest(),'pages':checks,'scope':'Actual synthetic browser PNG with dimension 1585,800001 and rotated inset -> production CustomerPdfExport/RasterPdfWriter -> independent pypdf/PyMuPDF; JPEG94 is intentionally lossy. Original media byte integrity is separately checked in browser/native suites.'}
(root/'browser-to-native-pdf-check.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
