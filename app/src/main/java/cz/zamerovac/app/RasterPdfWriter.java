package cz.zamerovac.app;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Flattened RGB pages only: no metadata, attachments or editable project objects.
 * Writes one page at a time so a long note does not retain all image bytes in RAM. */
final class RasterPdfWriter {
    private RasterPdfWriter() {}
    static void write(OutputStream out,int width,int height,byte[] jpeg)throws IOException {
        Document document=new Document(out);document.add(width,height,jpeg);document.finish();
    }
    static final class Document {
        private final OutputStream out;
        private long position;
        private final ArrayList<Long> offsets=new ArrayList<>(Arrays.asList(0L,0L,0L));
        private int pages;
        private boolean finished;
        Document(OutputStream out)throws IOException {this.out=out;text("%PDF-1.4\n%âãÏÓ\n");}
        void add(int width,int height,byte[] jpeg)throws IOException {
            if(finished||pages>=200||width<1||height<1||jpeg==null||jpeg.length<4||
                    jpeg[0]!=(byte)0xff||jpeg[1]!=(byte)0xd8)throw new IOException("Neplatný obrázek PDF");
            int page=3+pages*3,image=page+1,content=page+2;
            object(page,"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "+width+" "+height+"] /Resources << /XObject << /Im0 "+image+" 0 R >> >> /Contents "+content+" 0 R >>");
            start(image);text("<< /Type /XObject /Subtype /Image /Width "+width+" /Height "+height+
                " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+jpeg.length+" >>\nstream\n");
            bytes(jpeg);text("\nendstream\nendobj\n");
            String draw="q\n"+width+" 0 0 "+height+" 0 0 cm\n/Im0 Do\nQ\n";
            start(content);text("<< /Length "+draw.getBytes(StandardCharsets.ISO_8859_1).length+" >>\nstream\n"+draw+"endstream\nendobj\n");
            pages++;
        }
        void finish()throws IOException {
            if(finished||pages==0)throw new IOException("Prázdné nebo uzavřené PDF");
            object(1,"<< /Type /Catalog /Pages 2 0 R >>");
            StringBuilder kids=new StringBuilder();for(int i=0;i<pages;i++)kids.append(3+i*3).append(" 0 R ");
            object(2,"<< /Type /Pages /Kids ["+kids+"] /Count "+pages+" >>");
            long xref=position;int count=offsets.size();
            text("xref\n0 "+count+"\n0000000000 65535 f \n");
            for(int i=1;i<count;i++)text(String.format(Locale.ROOT,"%010d 00000 n \n",offsets.get(i)));
            text("trailer\n<< /Size "+count+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF\n");
            out.flush();finished=true;
        }
        private void start(int id)throws IOException {
            while(offsets.size()<=id)offsets.add(0L);offsets.set(id,position);text(id+" 0 obj\n");
        }
        private void object(int id,String body)throws IOException {start(id);text(body+"\nendobj\n");}
        private void text(String value)throws IOException {bytes(value.getBytes(StandardCharsets.ISO_8859_1));}
        private void bytes(byte[] value)throws IOException {out.write(value);position+=value.length;}
    }
}
