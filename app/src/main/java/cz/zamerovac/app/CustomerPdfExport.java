package cz.zamerovac.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.pdf.PdfDocument;
import android.util.Base64;
import java.io.*;
import java.util.*;
import java.util.zip.*;

/** Separate customer archive: only flattened PDF pages, never a project backup. */
final class CustomerPdfExport {
    private final File directory;
    private int count;
    CustomerPdfExport(File cache) throws IOException {
        directory=new File(cache,"customer-"+UUID.randomUUID());
        if(!directory.mkdirs())throw new IOException("Nelze připravit zákaznický export");
    }
    synchronized void add(String title,String png) throws IOException {
        if(count>=200||png==null||png.length()>32*1024*1024)throw new IOException("Export je příliš velký");
        byte[] bytes;
        try{bytes=Base64.decode(png,Base64.DEFAULT);}catch(IllegalArgumentException ex){throw new IOException("Neplatný obrázek",ex);}
        BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;
        BitmapFactory.decodeByteArray(bytes,0,bytes.length,bounds);
        if(bounds.outWidth<1||bounds.outHeight<1||bounds.outWidth>2400||bounds.outHeight>2400)
            throw new IOException("Neplatné rozlišení exportu");
        Bitmap bitmap=BitmapFactory.decodeByteArray(bytes,0,bytes.length);
        if(bitmap==null)throw new IOException("Fotografii nelze vykreslit");
        try(PdfDocument pdf=new PdfDocument()){
            PdfDocument.Page page=pdf.startPage(new PdfDocument.PageInfo.Builder(bitmap.getWidth(),bitmap.getHeight(),1).create());
            page.getCanvas().drawBitmap(bitmap,0,0,null);
            pdf.finishPage(page);
            File output=new File(directory,String.format(Locale.ROOT,"%03d-",count+1)+safeName(title)+".pdf");
            try(OutputStream out=new FileOutputStream(output)){pdf.writeTo(out);}
            count++;
        }finally{bitmap.recycle();}
    }
    synchronized File archive() throws IOException {
        if(count==0)throw new IOException("Vyber alespoň jednu fotografii");
        File target=new File(directory,"Zakaznicke-PDF.zip");
        File[] pages=directory.listFiles((dir,name)->name.endsWith(".pdf"));
        if(pages==null||pages.length!=count)throw new IOException("Neúplný PDF export");
        Arrays.sort(pages,Comparator.comparing(File::getName));
        try(ZipOutputStream zip=new ZipOutputStream(new FileOutputStream(target))){
            byte[] buffer=new byte[65536];
            for(File page:pages){
                zip.putNextEntry(new ZipEntry(page.getName()));
                try(InputStream in=new FileInputStream(page)){int n;while((n=in.read(buffer))!=-1)zip.write(buffer,0,n);}
                zip.closeEntry();
            }
        }
        return target;
    }
    synchronized void close(){
        File[] files=directory.listFiles();if(files!=null)for(File f:files)f.delete();
        directory.delete();
    }
    static String safeName(String title){
        String name=(title==null?"Fotografie":title).replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]","_").replaceAll("(?i)\\.(jpe?g|png|webp|pdf)$","").trim();
        if(name.isEmpty()||name.equals(".")||name.equals(".."))name="Fotografie";
        return name.length()>100?name.substring(0,100):name;
    }
}
