package cz.zamerovac.app;

import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.util.Log;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.UUID;
import java.util.function.Consumer;

/** Bosch GLM 50C / GLM 100C: Bluetooth Classic SPP transport.
 * Only interprets push-mode distance packets. Model and firmware vary:
 * this implementation must be checked against the user's physical meter.
 */
public final class BoschClassicReader {
    private static final UUID SPP=UUID.fromString("00001101-0000-1000-8000-00805f9b34fb");
    private final BluetoothDevice device;
    private final Consumer<String> onRead,onError,onStatus;
    private volatile BluetoothSocket socket;
    private volatile boolean closed,connected;
    public BoschClassicReader(BluetoothDevice d,Consumer<String> measurement,Consumer<String> error,Consumer<String> status){device=d;onRead=measurement;onError=error;onStatus=status;}
    public void start(){new Thread(()->{
        try{
            BluetoothSocket s=device.createRfcommSocketToServiceRecord(SPP);
            synchronized(this){if(closed){s.close();return;}socket=s;}
            s.connect();if(closed)return;connected=true;onStatus.accept("connected");
            OutputStream out=s.getOutputStream();out.write(new byte[]{(byte)0xc0,0x55,0x02,0x01,0x00,0x1a});out.flush();
            InputStream in=s.getInputStream();byte[] data=new byte[20];
            int state=0,n=0;
            while(socket==s&&!Thread.currentThread().isInterrupted()){
                int v=in.read();if(v<0)break;
                if(state==0){if(v==0xc0){data[0]=(byte)v;state=1;}}else if(state==1){if(v==0x55){data[1]=(byte)v;state=2;}else state=0;}
                else if(state==2){if(v==0x10){data[2]=(byte)v;n=3;state=3;}else state=0;}
                else{data[n++]=(byte)v;if(n==20){decode(data);state=0;}}
            }
        }catch(Exception e){if(!closed)onError.accept("Bosch Bluetooth Classic: "+e.getMessage());}
        finally{close();onStatus.accept("off");}
    },"BoschGLM-Classic").start();}
    private void decode(byte[] data){
        try{
            // 20-byte GLM push frame: current distance is LE float32 at offset 7 (metres).
            // Ignore status/error frames and implausible measurements.
            if((data[3]&0xff)!=0x0a)return;
            float metres=ByteBuffer.wrap(data,7,4).order(ByteOrder.LITTLE_ENDIAN).getFloat();
            if(Float.isFinite(metres)&&metres>=0.01f&&metres<250f){
                long mm=Math.round(metres*1000);onRead.accept(Long.toString(mm));
            }
        }catch(Exception e){Log.w("Zamerovac","Invalid Bosch frame",e);}
    }
    public boolean isConnected(){return connected&&!closed;}
    public synchronized void close(){closed=true;connected=false;BluetoothSocket s=socket;socket=null;if(s!=null)try{s.close();}catch(Exception ignored){}}
}
