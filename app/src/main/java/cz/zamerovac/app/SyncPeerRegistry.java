package cz.zamerovac.app;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.NoSuchFileException;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;

/** Explicitly approved device-to-certificate bindings, outside Android Auto Backup. */
final class SyncPeerRegistry {
    private static final Object LOCK=new Object();private final File target;
    // Pending sockets belong to this process. A forget invalidates every pending approval,
    // including one using another registry instance for the same installation.
    private static final Map<String,Long> REVISIONS=new HashMap<>();
    long revision(){synchronized(LOCK){return REVISIONS.getOrDefault(target.getAbsolutePath(),0L);}}
    void confirmHandshake(String id,String fingerprint,String name,long revision,boolean known,java.security.cert.X509Certificate certificate)throws Exception{synchronized(LOCK){
        checkHandshake(id,fingerprint,revision,false);
        if(known&&!isTrusted(id,fingerprint))throw new IOException("Párování bylo odebráno");
        if(!known)approve(id,fingerprint,name);
        rememberCertificate(id,certificate);
    }}
    void checkHandshake(String id,String fingerprint,long revision,boolean requireTrusted)throws Exception{synchronized(LOCK){
        if(revision()!=revision||(requireTrusted&&!isTrusted(id,fingerprint)))throw new IOException("Párování bylo během spojování odebráno. Spusť nové výslovné párování.");
    }}
    SyncPeerRegistry(File noBackup){target=new File(noBackup,"sync-peers-v2.json");}
    private JSONObject load()throws Exception{
        AtomicFile file=new AtomicFile(target);if(!target.exists()&&!new File(target+".bak").exists()){
            // A parallel database bootstrap writes its no_backup marker BEFORE
            // the first primary commit. Never create an apparently fresh peer
            // registry in that window: it would weaken selective-loss safety.
            boolean initialized=DatabaseInstallEvidence.exists(target.getParentFile());
            if(initialized)DatabaseInstallEvidence.verify(target.getParentFile());
            return new JSONObject().put("version",2).put("peers",new JSONObject())
                .put("databaseEverInitialized",initialized);
        }
        if(target.length()>1024*1024||new File(target+".bak").length()>1024*1024)throw new IOException("Seznam zařízení je příliš velký");JSONObject data=JsonInput.object(file.readFully());
        if(data.optInt("version")!=2||data.optJSONObject("peers")==null||data.getJSONObject("peers").length()>1024)throw new IOException("Neplatný seznam spárovaných zařízení");
        JSONObject peers=data.getJSONObject("peers");Set<String> fingerprints=new HashSet<>();for(Iterator<String> it=peers.keys();it.hasNext();){String id=it.next();JSONObject peer=peers.getJSONObject(id);if(!DeviceIdentity.valid(id)||!peer.getString("fingerprint").matches("[0-9a-f]{64}")||!fingerprints.add(peer.getString("fingerprint")))throw new IOException("Neplatná identita spárovaného zařízení");}
        return data;
    }
    private void write(JSONObject data)throws Exception{
        if(!target.getParentFile().isDirectory()&&!target.getParentFile().mkdirs())throw new IOException("Nelze uložit párování");
        AtomicFile file=new AtomicFile(target);FileOutputStream out=null;byte[] bytes=data.toString().getBytes(StandardCharsets.UTF_8);
        try{out=file.startWrite();out.write(bytes);out.getFD().sync();file.finishWrite(out);out=null;if(!Arrays.equals(file.readFully(),bytes))throw new IOException("Párování nebylo potvrzeno");}catch(Exception failure){if(out!=null)file.failWrite(out);throw failure;}
    }
    /**
     * The registry itself is not evidence of a prior project: devices can be
     * paired BEFORE the first photo is received. A missing field in an older
     * registry is deliberately ambiguous and therefore fails closed.
     */
    static boolean pairingOnlyBeforeFirstDatabase(File noBackup)throws IOException {
        File target=new File(noBackup,"sync-peers-v2.json");
        BasicFileAttributes attributes;
        try {
            attributes=Files.readAttributes(target.toPath(),BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        } catch(NoSuchFileException absent) {
            return false; // Not a verified new pairing record.
        }
        if(!attributes.isRegularFile()||attributes.isSymbolicLink()||
            attributes.size()<2||attributes.size()>1024*1024)
            throw new IOException("Doklady párování nejsou bezpečně čitelné");
        try {
            JSONObject data=JsonInput.object(Files.readAllBytes(target.toPath()));
            if(data.optInt("version")!=2||data.optJSONObject("peers")==null)
                throw new IOException("Neplatná evidence spárování");
            if(!Boolean.FALSE.equals(data.opt("databaseEverInitialized"))||
                data.has("localRecovery"))return false;
            JSONObject peers=data.getJSONObject("peers");
            if(peers.length()>1024)throw new IOException("Příliš mnoho párovacích dokladů");
            Set<String> fingerprints=new HashSet<>();
            for(Iterator<String> it=peers.keys();it.hasNext();) {
                String id=it.next();
                JSONObject peer=peers.getJSONObject(id);
                String fp=peer.getString("fingerprint");
                if(!DeviceIdentity.valid(id)||!fp.matches("[0-9a-f]{64}")||
                    !fingerprints.add(fp))
                    throw new IOException("Neplatná identita historického párování");
                if(peer.has("lastAck")||peer.has("lastSuccess")||
                    peer.has("recovery"))return false;
            }
            return true;
        } catch(IOException error){throw error;}
        catch(Exception invalid){throw new IOException("Doklady spárování nelze prověřit",invalid);}
    }
    /** Monotonic proof recorded BEFORE the first database commit. */
    static void recordDatabaseInitialized(File noBackup)throws IOException {
        if(noBackup==null)return;
        synchronized(LOCK){
            File target=new File(noBackup,"sync-peers-v2.json");
            try {
                BasicFileAttributes attrs=Files.readAttributes(target.toPath(),
                    BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
                if(!attrs.isRegularFile()||attrs.isSymbolicLink()||attrs.size()>1024*1024)
                    throw new IOException("Nelze ověřit uložené párování");
                SyncPeerRegistry registry=new SyncPeerRegistry(noBackup);
                JSONObject data=registry.load();
                if(Boolean.TRUE.equals(data.opt("databaseEverInitialized")))return;
                data.put("databaseEverInitialized",true);
                registry.write(data);
            } catch(NoSuchFileException absent){
                // No pairing registry exists; the independent no_backup
                // initialization marker already protects the first write.
            } catch(IOException error){throw error;}
            catch(Exception invalid){throw new IOException("Nelze potvrdit inicializaci párování",invalid);}
        }
    }
    boolean hasFingerprint(String fingerprint)throws Exception{synchronized(LOCK){JSONObject peers=load().getJSONObject("peers");for(Iterator<String> it=peers.keys();it.hasNext();)if(fingerprint.equals(peers.getJSONObject(it.next()).getString("fingerprint")))return true;return false;}}
    boolean isTrusted(String id,String fingerprint)throws Exception{synchronized(LOCK){if(!DeviceIdentity.valid(id)||!fingerprint.matches("[0-9a-f]{64}"))throw new IOException("Neplatná identita zařízení");JSONObject peers=load().getJSONObject("peers");JSONObject known=peers.optJSONObject(id);if(known!=null&&!fingerprint.equals(known.getString("fingerprint")))throw new IOException("Identita zařízení se změnila. Nejdříve odeber staré párování.");for(Iterator<String> it=peers.keys();it.hasNext();){String other=it.next();if(!other.equals(id)&&fingerprint.equals(peers.getJSONObject(other).getString("fingerprint")))throw new IOException("Certifikát patří jinému zařízení");}return known!=null;}}
    void approve(String id,String fingerprint,String name)throws Exception{synchronized(LOCK){if(isTrusted(id,fingerprint))return;JSONObject data=load(),peers=data.getJSONObject("peers");if(peers.length()>=1024)throw new IOException("Seznam zařízení je plný");if(name==null||name.length()>80||name.matches(".*[\\p{Cntrl}].*"))throw new IOException("Neplatný název zařízení");peers.put(id,new JSONObject().put("fingerprint",fingerprint).put("name",name).put("pairedAt",java.time.Instant.now().toString()));write(data);}}
    void forget(String id)throws Exception{synchronized(LOCK){if(!DeviceIdentity.valid(id))throw new IOException("Neplatná identita zařízení");REVISIONS.put(target.getAbsolutePath(),revision()+1);JSONObject data=load();data.getJSONObject("peers").remove(id);write(data);}}
    /** An address is only a private routing hint. It can never approve a certificate. */
    void rememberNearby(String id,String fingerprint,String address)throws Exception{synchronized(LOCK){if(!PeerWifiDirect.validAddress(address))return;if(!isTrusted(id,fingerprint))throw new IOException("Zařízení už není spárované");String normalized=address.toLowerCase(Locale.ROOT);JSONObject data=load(),peers=data.getJSONObject("peers"),peer=peers.getJSONObject(id);if(normalized.equals(peer.optString("nearbyAddress")))return;for(Iterator<String> it=peers.keys();it.hasNext();){String other=it.next();if(!other.equals(id)&&normalized.equalsIgnoreCase(peers.getJSONObject(other).optString("nearbyAddress")))peers.getJSONObject(other).remove("nearbyAddress");}peer.put("nearbyAddress",normalized);write(data);}}
    Map<String,String> nearbyRoutes()throws Exception{synchronized(LOCK){Map<String,String> result=new HashMap<>();JSONObject peers=load().getJSONObject("peers");for(Iterator<String> it=peers.keys();it.hasNext();){String id=it.next(),address=peers.getJSONObject(id).optString("nearbyAddress");if(PeerWifiDirect.validAddress(address))result.put(address.toLowerCase(Locale.ROOT),id);}return result;}}
    void rememberCertificate(String id,java.security.cert.X509Certificate certificate)throws Exception{synchronized(LOCK){String fingerprint=SyncTls.fingerprint(certificate);if(!isTrusted(id,fingerprint))throw new IOException("Certifikát zařízení není schválený");String encoded=java.util.Base64.getEncoder().encodeToString(certificate.getEncoded());JSONObject data=load(),peer=data.getJSONObject("peers").getJSONObject(id);if(encoded.equals(peer.optString("certificate")))return;peer.put("certificate",encoded);write(data);}}
    java.security.cert.X509Certificate certificate(String id)throws Exception{synchronized(LOCK){JSONObject peer=load().getJSONObject("peers").optJSONObject(id);if(peer==null||!peer.has("certificate"))throw new IOException("Nejdříve znovu spoj spárovaná zařízení místní cestou, aby se uložil ověřený veřejný certifikát.");String encoded=peer.getString("certificate");if(encoded.length()>24000)throw new IOException("Certifikát je příliš velký");java.security.cert.X509Certificate certificate=(java.security.cert.X509Certificate)java.security.cert.CertificateFactory.getInstance("X.509").generateCertificate(new ByteArrayInputStream(java.util.Base64.getDecoder().decode(encoded)));if(!isTrusted(id,SyncTls.fingerprint(certificate)))throw new IOException("Certifikát není schválený");return certificate;}}
    /**
     * R9: independent no_backup evidence is authoritative after a recovery.
     * A missing or substituted files/ recovery journal must NEVER turn a
     * recovered peer snapshot back into its pre-recovery ACK hash.
     *
     * Legacy registries without localRecovery remain valid only while the
     * journal has no recovery epoch. Unknown/invalid evidence fails closed.
     * This method never authorizes ACKs or resets the recovery journal.
     */
    static void requireMatchingRecoveryEpoch(File noBackup,String journalEpoch)throws IOException{
        if(noBackup==null)return;
        synchronized(LOCK){
            try{
                if(journalEpoch==null||!journalEpoch.isEmpty()&&!DeviceIdentity.valid(journalEpoch))
                    throw new IOException("Neplatná epocha databázové obnovy");
                JSONObject registry=new SyncPeerRegistry(noBackup).load();
                Object witness=registry.opt("localRecovery");
                if(witness!=null){
                    if(!(witness instanceof String)||!DeviceIdentity.valid((String)witness)||
                        !witness.equals(journalEpoch))
                        throw new IOException("Nesoulad evidence obnovy: synchronizace je bezpečně zablokována");
                }else if(!journalEpoch.isEmpty()){
                    // The peer registry is missing or predates this recovery;
                    // do not approve new ACKs without an independent witness.
                    throw new IOException("Chybí nezávislá evidence epochy obnovy");
                }
            }catch(IOException blocked){throw blocked;}
            catch(Exception unknown){throw new IOException("Evidenci obnovy nelze nezávisle ověřit",unknown);}
        }
    }
    /** Durable local loss barrier: remove ALL cached success receipts once per recovery epoch. */
    void localRecovery(String epoch)throws Exception{synchronized(LOCK){
        if(!DeviceIdentity.valid(epoch))throw new IOException("Neplatná místní recovery epoch");
        JSONObject data=load();
        if(epoch.equals(data.optString("localRecovery")))return;
        JSONObject peers=data.getJSONObject("peers");
        for(Iterator<String> it=peers.keys();it.hasNext();){
            JSONObject peer=peers.getJSONObject(it.next());
            peer.remove("lastAck");peer.remove("lastSuccess");
        }
        data.put("localRecovery",epoch);
        write(data);
    }}
    /**
     * Existing signed cloud ACKs do not identify the recipient's recovery era.
     * Once a verified remote recovery is observed, old immutable receipts cannot
     * establish delivery in the new era. Hold cloud ACK retirement until a
     * separately authorized recovery reconciliation (Stage 3). No wire change.
     */
    boolean cloudAckAllowed(String id)throws Exception{synchronized(LOCK){
        if(!DeviceIdentity.valid(id))throw new IOException("Neplatný partner cloudového potvrzení");
        JSONObject peer=load().getJSONObject("peers").optJSONObject(id);
        if(peer==null)throw new IOException("Cloudové potvrzení patří neznámému zařízení");
        return peer.optString("recovery","").isEmpty();
    }}
    String lastAck(String id)throws Exception{synchronized(LOCK){JSONObject peer=load().getJSONObject("peers").optJSONObject(id);return peer==null?"":peer.optString("lastAck","");}}
    void recovered(String id,String epoch)throws Exception{synchronized(LOCK){if(!DeviceIdentity.valid(epoch))throw new IOException("Neplatná obnova zařízení");JSONObject data=load(),peer=data.getJSONObject("peers").optJSONObject(id);if(peer==null)throw new IOException("Zařízení už není spárované");if(epoch.equals(peer.optString("recovery")))return;peer.put("recovery",epoch);peer.remove("lastAck");peer.remove("lastSuccess");write(data);}}
    void acknowledged(String id,String hash)throws Exception{synchronized(LOCK){if(!hash.matches("[0-9a-f]{64}"))throw new IOException("Neplatné potvrzení");JSONObject data=load(),peer=data.getJSONObject("peers").optJSONObject(id);if(peer==null)throw new IOException("Zařízení už není spárované");peer.put("lastAck",hash).put("lastSuccess",java.time.Instant.now().toString());write(data);}}
    JSONObject snapshot()throws Exception{synchronized(LOCK){return new JSONObject(load().getJSONObject("peers").toString());}}
}
