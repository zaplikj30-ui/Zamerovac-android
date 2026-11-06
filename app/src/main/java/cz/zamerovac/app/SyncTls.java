package cz.zamerovac.app;
import android.security.keystore.*;
import javax.net.ssl.*;
import java.math.BigInteger;
import java.net.Socket;
import java.security.*;
import java.security.cert.*;
import java.security.interfaces.*;
import java.util.*;
import java.util.function.BooleanSupplier;
import javax.security.auth.x500.X500Principal;

/** Platform TLS and Android Keystore. No custom cipher or permissive data channel. */
final class SyncTls {
    static final String ALIAS="zamerovac-sync-tls-v2";
    final PrivateKey key;final X509Certificate[] chain;
    SyncTls(PrivateKey key,X509Certificate[] chain){this.key=key;this.chain=chain.clone();}
    X509Certificate certificate(){return chain[0];}
    byte[] sign(byte[] message)throws Exception{java.security.Signature signer=java.security.Signature.getInstance("SHA256withECDSA");signer.initSign(key);signer.update(message);return signer.sign();}
    static synchronized SyncTls androidIdentity()throws Exception{
        KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);
        if(!keys.containsAlias(ALIAS)){
            KeyPairGenerator generator=KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC,"AndroidKeyStore");long now=System.currentTimeMillis();
            generator.initialize(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_SIGN|KeyProperties.PURPOSE_VERIFY)
                .setAlgorithmParameterSpec(new java.security.spec.ECGenParameterSpec("secp256r1")).setDigests(KeyProperties.DIGEST_SHA256)
                .setCertificateSubject(new X500Principal("CN=Zamerovac Sync"))
                .setCertificateSerialNumber(new BigInteger(128,new SecureRandom()).add(BigInteger.ONE))
                .setCertificateNotBefore(new Date(now-86400000L)).setCertificateNotAfter(new Date(now+3650L*86400000L)).setUserAuthenticationRequired(false).build());generator.generateKeyPair();
        }
        PrivateKey key=(PrivateKey)keys.getKey(ALIAS,null);X509Certificate certificate=(X509Certificate)keys.getCertificate(ALIAS);
        if(key==null||certificate==null)throw new java.io.IOException("Soukromý klíč zařízení není dostupný");certificate.checkValidity();return new SyncTls(key,new X509Certificate[]{certificate});
    }
    static String fingerprint(X509Certificate certificate)throws Exception{return PeerWire.hash(certificate.getEncoded());}
    String fingerprint()throws Exception{return fingerprint(chain[0]);}
    SSLContext context(SyncPeerRegistry peers,BooleanSupplier pairingActive)throws Exception{
        X509ExtendedKeyManager manager=new X509ExtendedKeyManager(){
            private boolean supports(String type){return type!=null&&(key.getAlgorithm().equalsIgnoreCase(type)||"EC".equals(key.getAlgorithm())&&type.startsWith("EC"));}
            public String[] getClientAliases(String type,Principal[] issuers){return supports(type)?new String[]{ALIAS}:null;}
            public String chooseClientAlias(String[] types,Principal[] issuers,Socket socket){for(String type:types)if(supports(type))return ALIAS;return null;}
            public String[] getServerAliases(String type,Principal[] issuers){return supports(type)?new String[]{ALIAS}:null;}
            public String chooseServerAlias(String type,Principal[] issuers,Socket socket){return supports(type)?ALIAS:null;}
            public X509Certificate[] getCertificateChain(String alias){return chain.clone();}
            public PrivateKey getPrivateKey(String alias){return key;}
            public String chooseEngineClientAlias(String[] types,Principal[] issuers,SSLEngine engine){return chooseClientAlias(types,issuers,null);}
            public String chooseEngineServerAlias(String type,Principal[] issuers,SSLEngine engine){return chooseServerAlias(type,issuers,null);}
        };
        X509TrustManager trust=new X509TrustManager(){
            public X509Certificate[] getAcceptedIssuers(){return new X509Certificate[0];}
            public void checkClientTrusted(X509Certificate[] chain,String type)throws CertificateException{check(chain);}
            public void checkServerTrusted(X509Certificate[] chain,String type)throws CertificateException{check(chain);}
            private void check(X509Certificate[] chain)throws CertificateException{
                try{if(chain==null||chain.length<1||chain.length>4)throw new CertificateException("Neplatný certifikát zařízení");X509Certificate leaf=chain[0];leaf.checkValidity();PublicKey publicKey=leaf.getPublicKey();
                    boolean strong=publicKey instanceof ECPublicKey&&((ECPublicKey)publicKey).getParams().getOrder().bitLength()>=256||publicKey instanceof RSAPublicKey&&((RSAPublicKey)publicKey).getModulus().bitLength()>=2048;
                    if(!strong)throw new CertificateException("Nepodporovaný klíč zařízení");
                    if(!peers.hasFingerprint(fingerprint(leaf))&&!pairingActive.getAsBoolean())throw new CertificateException("Zařízení není spárované");
                }catch(CertificateException error){throw error;}catch(Exception error){throw new CertificateException("Identitu zařízení nelze ověřit",error);}
            }
        };
        SSLContext context=SSLContext.getInstance("TLS");context.init(new KeyManager[]{manager},new TrustManager[]{trust},new SecureRandom());return context;
    }
    static void secure(SSLSocket socket){socket.setEnabledProtocols(protocols(socket.getSupportedProtocols()));}
    static void secure(SSLServerSocket socket){socket.setEnabledProtocols(protocols(socket.getSupportedProtocols()));socket.setNeedClientAuth(true);}
    private static String[] protocols(String[] supported){Set<String> all=new HashSet<>(Arrays.asList(supported));ArrayList<String> enabled=new ArrayList<>();if(all.contains("TLSv1.3"))enabled.add("TLSv1.3");if(all.contains("TLSv1.2"))enabled.add("TLSv1.2");if(enabled.isEmpty())throw new IllegalStateException("Zařízení nepodporuje bezpečné TLS");return enabled.toArray(new String[0]);}
}
