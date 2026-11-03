package cz.zamerovac.app;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.UUID;

/** Vlastni minimalni dekoder oznameni BLE z rady Bosch GLM.
 * Ramec a UUID podle verejne popsaneho GLM BLE protokolu.
 * U konkretniho GLM 100-25 C je nutne overit prijem na zarizeni.
 */
public final class BoschBleProtocol {
    private BoschBleProtocol() {}
    public static final UUID SERVICE_UUID =
        UUID.fromString("02a6c0d0-0451-4000-b000-fb3210111989");
    public static final UUID CCCD_UUID =
        UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    public static final UUID MEASUREMENT_UUID =
        UUID.fromString("02a6c0d1-0451-4000-b000-fb3210111989");
    public static final byte[] START_STREAM =
        {(byte)0xC0, (byte)0x55, 0x02, 0x01, 0x00, 0x1A};

    // Experimentální příkaz vzdáleného měření z GLM 120 C / GLM 400 C.
    // U GLM 100-25 C není veřejně potvrzený; nikdy jej neposílat automaticky.
    public static final byte[] REMOTE_TRIGGER =
        {(byte)0xC0, (byte)0x56, 0x01, 0x00, 0x1E};


    /** Metry v IEEE754 little-endian float32 od pozice 7. Vracime milimetry,
     * vcetne pulmilimetru; ostatni zpravy, statusy a chyby ignorujeme. */
    public static Double millimeters(byte[] data) {
        if (data == null || data.length < 11) return null;
        if ((data[0] & 255) != 0xC0 || (data[1] & 255) != 0x55
                || (data[2] & 255) != 0x10) return null;
        int kind = data[3] & 255;
        if (kind != 0x06 && kind != 0x0A) return null;
        float metres = ByteBuffer.wrap(data, 7, 4).order(ByteOrder.LITTLE_ENDIAN).getFloat();
        if (!Float.isFinite(metres) || metres < 0.08f || metres > 250f) return null;
        double mm = Math.round((double)metres * 2000d) / 2d;
        return mm > 0 ? mm : null;
    }

    public static String millimetersText(byte[] data) {
        Double mm = millimeters(data);
        if (mm == null) return null;
        long whole = mm.longValue();
        return mm.doubleValue() == whole ? Long.toString(whole) : Double.toString(mm);
    }
}
