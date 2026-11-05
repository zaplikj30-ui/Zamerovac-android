package cz.zamerovac.app;
import android.security.keystore.KeyGenParameterSpec;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.security.*;
import java.security.cert.Certificate;
import java.security.spec.AlgorithmParameterSpec;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import static org.junit.Assert.*;

/** Actual JCA boundary with a synthetic provider; not an Android hardware Keystore acceptance test. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class SyncTlsIdentityTest {
 static volatile SyncTls material,other,stored;static AtomicInteger generated;static CountDownLatch generating,release;
 public static class Store extends KeyStoreSpi {
  public Key engineGetKey(String alias,char[] password){return stored==null?null:stored.key;}
  public Certificate[] engineGetCertificateChain(String alias){return stored==null?null:stored.chain.clone();}
  public Certificate engineGetCertificate(String alias){return stored==null?null:stored.certificate();}
  public Date engineGetCreationDate(String alias){return new Date(0);}
  public boolean engineContainsAlias(String alias){return stored!=null;}
  public Enumeration<String> engineAliases(){return Collections.enumeration(stored==null?Collections.emptyList():Collections.singletonList(SyncTls.ALIAS));}
  public int engineSize(){return stored==null?0:1;}
  public boolean engineIsKeyEntry(String alias){return stored!=null;}
  public boolean engineIsCertificateEntry(String alias){return false;}
  public String engineGetCertificateAlias(Certificate certificate){return SyncTls.ALIAS;}
  public void engineLoad(InputStream input,char[] password){}
  public void engineStore(OutputStream output,char[] password){}
  public void engineSetKeyEntry(String alias,Key key,char[] password,Certificate[] chain){throw new UnsupportedOperationException();}
  public void engineSetKeyEntry(String alias,byte[] key,Certificate[] chain){throw new UnsupportedOperationException();}
  public void engineSetCertificateEntry(String alias,Certificate certificate){throw new UnsupportedOperationException();}
  public void engineDeleteEntry(String alias){throw new UnsupportedOperationException();}
 }
 public static class Generator extends KeyPairGeneratorSpi {
  public void initialize(int size,SecureRandom random){throw new UnsupportedOperationException();}
  public void initialize(AlgorithmParameterSpec spec,SecureRandom random){assertTrue(spec instanceof KeyGenParameterSpec);assertEquals(SyncTls.ALIAS,((KeyGenParameterSpec)spec).getKeystoreAlias());}
  public KeyPair generateKeyPair(){int round=generated.incrementAndGet();generating.countDown();try{if(!release.await(5,TimeUnit.SECONDS))throw new ProviderException("Synthetic key generation timeout");}catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw new ProviderException(interrupted);}stored=round==1?material:other;return new KeyPair(stored.certificate().getPublicKey(),stored.key);}
 }
 @Test public void simultaneousStartupCannotRegenerateOrMixTheInstallationKey()throws Exception{
  material=PeerTlsTest.material("a");other=PeerTlsTest.material("b");stored=null;generated=new AtomicInteger();generating=new CountDownLatch(1);release=new CountDownLatch(1);Provider previous=Security.getProvider("AndroidKeyStore");if(previous!=null)Security.removeProvider(previous.getName());Provider provider=new Provider("AndroidKeyStore",1.0,"Synthetic test provider"){};provider.put("KeyStore.AndroidKeyStore",Store.class.getName());provider.put("KeyPairGenerator.EC",Generator.class.getName());Security.insertProviderAt(provider,1);ExecutorService workers=Executors.newFixedThreadPool(2);AtomicReference<Thread> secondThread=new AtomicReference<>();CountDownLatch requested=new CountDownLatch(1);
  try{Future<SyncTls> first=workers.submit(SyncTls::androidIdentity);assertTrue(generating.await(2,TimeUnit.SECONDS));Future<SyncTls> second=workers.submit(()->{secondThread.set(Thread.currentThread());requested.countDown();return SyncTls.androidIdentity();});assertTrue(requested.await(2,TimeUnit.SECONDS));long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(2);boolean blockedAtIdentity=false;
   while(System.nanoTime()<deadline&&generated.get()==1){Thread thread=secondThread.get();StackTraceElement[] stack=thread.getStackTrace();if(thread.getState()==Thread.State.BLOCKED&&stack.length>0&&stack[0].getClassName().equals(SyncTls.class.getName())&&stack[0].getMethodName().equals("androidIdentity")){blockedAtIdentity=true;break;}Thread.sleep(5);}assertTrue("Second startup entered key creation instead of waiting for the confirmed identity",blockedAtIdentity);assertEquals(1,generated.get());release.countDown();SyncTls one=first.get(5,TimeUnit.SECONDS),two=second.get(5,TimeUnit.SECONDS);assertEquals(material.fingerprint(),one.fingerprint());assertEquals(one.fingerprint(),two.fingerprint());assertSame(one.key,two.key);assertEquals(1,generated.get());
  }finally{release.countDown();workers.shutdownNow();workers.awaitTermination(5,TimeUnit.SECONDS);Security.removeProvider(provider.getName());if(previous!=null)Security.addProvider(previous);}
 }
}
