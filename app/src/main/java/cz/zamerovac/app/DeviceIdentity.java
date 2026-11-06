package cz.zamerovac.app;
import android.util.AtomicFile;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Random installation identity stored OUTSIDE Android Auto Backup. No account or hardware IDs. */
final class DeviceIdentity {
    static boolean valid(String value){return value!=null&&value.matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}");}
    static synchronized String get(File noBackupDirectory)throws IOException{
        if(!noBackupDirectory.isDirectory()&&!noBackupDirectory.mkdirs())throw new IOException("Nelze připravit identitu instalace");
        File target=new File(noBackupDirectory,"sync-installation-id");AtomicFile file=new AtomicFile(target);
        if(target.exists()||new File(target+".bak").exists()){
            if(target.length()>100||new File(target+".bak").length()>100)throw new IOException("Neplatná identita instalace");
            String id=new String(file.readFully(),StandardCharsets.US_ASCII);if(!valid(id))throw new IOException("Identitu instalace nelze bezpečně načíst");return id;
        }
        String id=UUID.randomUUID().toString();FileOutputStream out=null;
        try{out=file.startWrite();out.write(id.getBytes(StandardCharsets.US_ASCII));out.getFD().sync();file.finishWrite(out);out=null;if(!id.equals(new String(file.readFully(),StandardCharsets.US_ASCII)))throw new IOException("Identita nebyla potvrzena");return id;}
        catch(IOException failure){if(out!=null)file.failWrite(out);throw failure;}
    }
}
