package cz.zamerovac.app;
import android.graphics.*;
import android.media.ExifInterface;
import java.io.*;
import java.nio.file.*;
import java.util.UUID;

/** Cold browser thumbnails sample original pixels outside the shared DB lock. Originals never change. */
class PhotoThumbnails {
    private final Object[] locks=new Object[16];
    PhotoThumbnails(){for(int i=0;i<locks.length;i++)locks[i]=new Object();}
    protected Bitmap decode(File source,BitmapFactory.Options options){return BitmapFactory.decodeFile(source.getAbsolutePath(),options);}
    InputStream open(File source,File directory)throws IOException{
        if(Files.isSymbolicLink(source.toPath())||!source.isFile())return null;
        synchronized(locks[Math.floorMod(source.getName().hashCode(),locks.length)]){
            long modified=source.lastModified(),length=source.length();if(length<1)return null;
            if(!directory.isDirectory()&&!directory.mkdirs()&&!directory.isDirectory())throw new IOException("Nelze vytvořit cache náhledů");File cached=new File(directory,source.getName()+".jpg");
            if(cached.isFile()&&cached.length()>0&&cached.lastModified()>=modified)return new FileInputStream(cached);
            BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;decode(source,bounds);if(bounds.outWidth<=0||bounds.outHeight<=0)return null;int sample=1;while(Math.max(bounds.outWidth/sample,bounds.outHeight/sample)>512)sample*=2;
            BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=sample;options.inPreferredConfig=Bitmap.Config.RGB_565;Bitmap decoded=null,oriented=null,thumb=null;File temporary=new File(directory,source.getName()+"-"+UUID.randomUUID()+".tmp");
            try{
                decoded=decode(source,options);if(decoded==null)return null;int orientation=ExifInterface.ORIENTATION_NORMAL;try{orientation=new ExifInterface(source.getPath()).getAttributeInt(ExifInterface.TAG_ORIENTATION,ExifInterface.ORIENTATION_NORMAL);}catch(IOException ignored){}
                Matrix matrix=new Matrix();switch(orientation){case ExifInterface.ORIENTATION_FLIP_HORIZONTAL:matrix.setScale(-1,1);break;case ExifInterface.ORIENTATION_ROTATE_180:matrix.setRotate(180);break;case ExifInterface.ORIENTATION_FLIP_VERTICAL:matrix.setScale(1,-1);break;case ExifInterface.ORIENTATION_TRANSPOSE:matrix.setRotate(90);matrix.postScale(-1,1);break;case ExifInterface.ORIENTATION_ROTATE_90:matrix.setRotate(90);break;case ExifInterface.ORIENTATION_TRANSVERSE:matrix.setRotate(-90);matrix.postScale(-1,1);break;case ExifInterface.ORIENTATION_ROTATE_270:matrix.setRotate(-90);break;}
                oriented=matrix.isIdentity()?decoded:Bitmap.createBitmap(decoded,0,0,decoded.getWidth(),decoded.getHeight(),matrix,true);thumb=Bitmap.createBitmap(144,144,Bitmap.Config.RGB_565);float side=Math.min(oriented.getWidth(),oriented.getHeight());Rect crop=new Rect((int)((oriented.getWidth()-side)/2),(int)((oriented.getHeight()-side)/2),(int)((oriented.getWidth()+side)/2),(int)((oriented.getHeight()+side)/2));new Canvas(thumb).drawBitmap(oriented,crop,new RectF(0,0,144,144),new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG));
                try(FileOutputStream out=new FileOutputStream(temporary)){if(!thumb.compress(Bitmap.CompressFormat.JPEG,82,out))throw new IOException("Nelze uložit náhled fotografie");}
                synchronized(TrashPurger.LOCK){if(!source.isFile()||source.lastModified()!=modified||source.length()!=length||Files.isSymbolicLink(source.toPath()))return null;try{Files.move(temporary.toPath(),cached.toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}catch(AtomicMoveNotSupportedException unsupported){Files.move(temporary.toPath(),cached.toPath(),StandardCopyOption.REPLACE_EXISTING);}return new FileInputStream(cached);}
            }catch(OutOfMemoryError insufficient){return null;}
            finally{temporary.delete();if(thumb!=null)thumb.recycle();if(oriented!=null&&oriented!=decoded)oriented.recycle();if(decoded!=null)decoded.recycle();}
        }
    }
}
