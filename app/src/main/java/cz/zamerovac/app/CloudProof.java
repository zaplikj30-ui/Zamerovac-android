package cz.zamerovac.app;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.Signature;
import java.security.cert.X509Certificate;
import java.util.Base64;

/** Standard ECDSA P-256/SHA-256 signatures over RFC8785 UTF-8 bodies, with domain separation. */
final class CloudProof {
 static final String MESSAGE="cz.zamerovac.sync.cloud.message",ACK="cz.zamerovac.sync.cloud.ack",NEED="cz.zamerovac.sync.cloud.need";
 private static byte[] signed(JSONObject body)throws Exception{return ("cz.zamerovac.cloud.proof.v2\n"+CausalClock.canonical(body)).getBytes(StandardCharsets.UTF_8);}
 static JSONObject body(String format,String author,String recipient,String hash,long size)throws Exception{
  if(!DeviceIdentity.valid(author)||!DeviceIdentity.valid(recipient)||author.equals(recipient)||!hash.matches("[a-f0-9]{64}")||size<1||size>PeerWire.MAX_JSON||!MESSAGE.equals(format)&&!ACK.equals(format)&&!NEED.equals(format))throw new IOException("Neplatná podepisovaná zpráva");
  return new JSONObject().put("format",format).put("version",2).put("author",author).put("recipient",recipient).put("hash",hash).put("size",size).put("committed",ACK.equals(format));
 }
 static JSONObject need(String author,String recipient,String hash,long size,String blob,long blobSize,long sequence,String request)throws Exception{
  if(blob==null||!blob.matches("[a-f0-9]{64}")||blobSize<1||blobSize>PeerSnapshot.MAX_MEDIA||sequence<1||sequence>9007199254740991L||!DeviceIdentity.valid(request))throw new IOException("Neplatná žádost o opravu");return body(NEED,author,recipient,hash,size).put("blob",blob).put("blobSize",blobSize).put("sequence",sequence).put("request",request);
 }
 static JSONObject sign(JSONObject body,SyncTls identity)throws Exception{return new JSONObject().put("body",body).put("signature",Base64.getEncoder().encodeToString(identity.sign(signed(body))));}
 static JSONObject verify(JSONObject envelope,X509Certificate certificate,String format,String author,String recipient)throws Exception{
  JSONObject body=envelope.getJSONObject("body");String signature=envelope.getString("signature");if(signature.length()>256||!format.equals(body.optString("format"))||PeerSnapshot.integer(body,"version",2)!=2||!author.equals(body.optString("author"))||!recipient.equals(body.optString("recipient"))||!Boolean.valueOf(ACK.equals(format)).equals(body.opt("committed")))throw new IOException("Cizí nebo neplatné potvrzení cloudu");
  body(format,author,recipient,body.getString("hash"),PeerSnapshot.integer(body,"size",PeerWire.MAX_JSON));if(NEED.equals(format))need(author,recipient,body.getString("hash"),body.getLong("size"),body.getString("blob"),PeerSnapshot.integer(body,"blobSize",PeerSnapshot.MAX_MEDIA),PeerSnapshot.integer(body,"sequence",9007199254740991L),body.getString("request"));Signature verifier=Signature.getInstance("SHA256withECDSA");verifier.initVerify(certificate.getPublicKey());verifier.update(signed(body));if(!verifier.verify(Base64.getDecoder().decode(signature)))throw new IOException("Podpis cloudové zprávy neodpovídá spárovanému zařízení");return body;
 }
 static byte[] bytes(JSONObject envelope)throws Exception{byte[] bytes=CausalClock.canonical(envelope).getBytes(StandardCharsets.UTF_8);if(bytes.length>PeerWire.MAX_HELLO)throw new IOException("Podpisová zpráva je příliš velká");return bytes;}
 static JSONObject read(InputStream source,int limit)throws Exception{byte[] bytes=CloudFiles.read(source,limit);String text=JsonInput.decode(bytes);JsonInput.check(text);new org.erdtman.jcs.JsonCanonicalizer(text);return JsonInput.object(bytes);}
}
