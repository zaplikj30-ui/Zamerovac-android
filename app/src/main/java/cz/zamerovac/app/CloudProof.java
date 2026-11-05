package cz.zamerovac.app;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.Signature;
import java.security.cert.X509Certificate;
import java.util.Base64;

/** Standard ECDSA P-256/SHA-256 signatures over RFC8785 UTF-8 bodies, with domain separation. */
final class CloudProof {
 static final String MESSAGE="cz.zamerovac.sync.cloud.message",ACK="cz.zamerovac.sync.cloud.ack";
 private static byte[] signed(JSONObject body)throws Exception{return ("cz.zamerovac.cloud.proof.v2\n"+CausalClock.canonical(body)).getBytes(StandardCharsets.UTF_8);}
 static JSONObject body(String format,String author,String recipient,String hash,long size)throws Exception{
  if(!DeviceIdentity.valid(author)||!DeviceIdentity.valid(recipient)||author.equals(recipient)||!hash.matches("[a-f0-9]{64}")||size<1||size>PeerWire.MAX_JSON||!MESSAGE.equals(format)&&!ACK.equals(format))throw new IOException("Neplatná podepisovaná zpráva");
  return new JSONObject().put("format",format).put("version",2).put("author",author).put("recipient",recipient).put("hash",hash).put("size",size).put("committed",ACK.equals(format));
 }
 static JSONObject sign(JSONObject body,SyncTls identity)throws Exception{return new JSONObject().put("body",body).put("signature",Base64.getEncoder().encodeToString(identity.sign(signed(body))));}
 static JSONObject verify(JSONObject envelope,X509Certificate certificate,String format,String author,String recipient)throws Exception{
  JSONObject body=envelope.getJSONObject("body");String signature=envelope.getString("signature");if(signature.length()>256||!format.equals(body.optString("format"))||PeerSnapshot.integer(body,"version",2)!=2||!author.equals(body.optString("author"))||!recipient.equals(body.optString("recipient"))||!Boolean.valueOf(ACK.equals(format)).equals(body.opt("committed")))throw new IOException("Cizí nebo neplatné potvrzení cloudu");
  body(format,author,recipient,body.getString("hash"),PeerSnapshot.integer(body,"size",PeerWire.MAX_JSON));Signature verifier=Signature.getInstance("SHA256withECDSA");verifier.initVerify(certificate.getPublicKey());verifier.update(signed(body));if(!verifier.verify(Base64.getDecoder().decode(signature)))throw new IOException("Podpis cloudové zprávy neodpovídá spárovanému zařízení");return body;
 }
 static byte[] bytes(JSONObject envelope)throws Exception{byte[] bytes=CausalClock.canonical(envelope).getBytes(StandardCharsets.UTF_8);if(bytes.length>PeerWire.MAX_HELLO)throw new IOException("Podpisová zpráva je příliš velká");return bytes;}
 static JSONObject read(InputStream source,int limit)throws Exception{byte[] bytes=CloudFiles.read(source,limit);String text=JsonInput.decode(bytes);JsonInput.check(text);new org.erdtman.jcs.JsonCanonicalizer(text);return JsonInput.object(bytes);}
}
