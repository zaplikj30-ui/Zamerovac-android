package cz.zamerovac.app;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** Minimal single-page PDF 1.4. The sole content is a flattened RGB JPEG image.
 * No text objects, annotations, metadata, embedded files or editable project data. */
final class RasterPdfWriter {
    private RasterPdfWriter() {}
    static void write(OutputStream destination,int width,int height,byte[] jpeg)throws IOException {
        if(width<1||height<1||jpeg==null||jpeg.length<4||jpeg[0]!=(byte)0xff||jpeg[1]!=(byte)0xd8)
            throw new IOException("Neplatný obrázek PDF");
        ByteArrayOutputStream pdf=new ByteArrayOutputStream(jpeg.length+1024);
        long[] offsets=new long[6];
        text(pdf,"%PDF-1.4\n%âãÏÓ\n");
        object(pdf,offsets,1,"<< /Type /Catalog /Pages 2 0 R >>");
        object(pdf,offsets,2,"<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
        object(pdf,offsets,3,"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "+width+" "+height+"] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");
        offsets[4]=pdf.size();
        text(pdf,"4 0 obj\n<< /Type /XObject /Subtype /Image /Width "+width+" /Height "+height+
            " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+jpeg.length+" >>\nstream\n");
        pdf.write(jpeg);text(pdf,"\nendstream\nendobj\n");
        String content="q\n"+width+" 0 0 "+height+" 0 0 cm\n/Im0 Do\nQ\n";
        offsets[5]=pdf.size();
        text(pdf,"5 0 obj\n<< /Length "+content.getBytes(StandardCharsets.ISO_8859_1).length+" >>\nstream\n"+content+"endstream\nendobj\n");
        long xref=pdf.size();
        text(pdf,"xref\n0 6\n0000000000 65535 f \n");
        for(int i=1;i<=5;i++)text(pdf,String.format(Locale.ROOT,"%010d 00000 n \n",offsets[i]));
        text(pdf,"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF\n");
        pdf.writeTo(destination);
    }
    private static void object(ByteArrayOutputStream pdf,long[] offsets,int id,String body)throws IOException {
        offsets[id]=pdf.size();text(pdf,id+" 0 obj\n"+body+"\nendobj\n");
    }
    private static void text(OutputStream out,String text)throws IOException {out.write(text.getBytes(StandardCharsets.ISO_8859_1));}
}
