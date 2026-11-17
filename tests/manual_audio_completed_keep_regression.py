#!/usr/bin/env python3
"""Manual Java source regression for QA-107-03. Never runs Android or SCM.

Default mode asserts completed source audio survives a failed SharedPreferences
metadata commit: the current vulnerable source MUST FAIL this assertion.
--expect-red verifies the exact historical PR #107 blobs and exits 0 *only*
when the expected data-loss bug is reproduced. This is evidence, not a fix.
"""
from __future__ import annotations
import argparse
import hashlib
from pathlib import Path
import subprocess
import sys
import shutil
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[1]
PRODUCTION = ROOT / 'app/src/main/java/cz/zamerovac/app'
BLOBS = {
 'AudioCapture.java':'37c5166e2478e7db63f3a4c3a44deb79b022fe5d',
 'MediaStaging.java':'92314d0b0391e3b9715da6eec0b18a5d5b6dfd70',
}
FILES = {
 'android/content/SharedPreferences.java': '''package android.content;
public interface SharedPreferences {
 Editor edit();
 interface Editor { Editor putString(String key,String value); boolean commit(); }
}''',
 'android/media/MediaRecorder.java': '''package android.media;
public class MediaRecorder {
 public static final class AudioSource { public static final int MIC=1; }
 public static final class OutputFormat { public static final int MPEG_4=2; }
 public static final class AudioEncoder { public static final int AAC=3; }
 public void setAudioSource(int a){} public void setOutputFormat(int a){}
 public void setAudioEncoder(int a){} public void setOutputFile(String p){}
 public void prepare(){} public void start(){} public void stop(){}
 public void release(){}
}''',
 'android/util/Log.java': '''package android.util;
public class Log { public static int w(String tag,String text){return 0;} }''',
 'cz/zamerovac/app/PeerSnapshot.java': '''package cz.zamerovac.app;
class PeerSnapshot { static boolean validMime(String mime){return mime!=null && mime.equals("audio/mp4");}}''',
 'cz/zamerovac/app/JsonInput.java': '''package cz.zamerovac.app;
class JsonInput { static void unicode(String input){} }''',
 'cz/zamerovac/app/TrashPurger.java': '''package cz.zamerovac.app;
class TrashPurger { static final Object LOCK = new Object(); }''',
 'cz/zamerovac/app/AudioLossProbe.java': r'''package cz.zamerovac.app;
import java.io.*;
import java.nio.file.*;
import java.security.*;
import android.content.SharedPreferences;
public final class AudioLossProbe {
 static final byte[] CONTENT=new byte[]{0,1,2,3,4,5,20,40,80,(byte)255};
 static String digest(byte[] bytes)throws Exception{
  byte[] hash=MessageDigest.getInstance("SHA-256").digest(bytes);
  StringBuilder out=new StringBuilder();for(byte b:hash)out.append(String.format("%02x",b&255));return out.toString();
 }
 static SharedPreferences prefs(final boolean commitOK){
  return ()->new SharedPreferences.Editor(){
   public SharedPreferences.Editor putString(String key,String value){return this;}
   public boolean commit(){return commitOK;}
  };
 }
 static AudioCapture.Recorder recorder(){return new AudioCapture.Recorder(){
  public void start(File output)throws Exception{Files.write(output.toPath(),CONTENT);}
  public void stop(){} public void release(){}
 };}
 public static void main(String[] ignored)throws Exception{
  File root=Files.createTempDirectory("audio-qa107-").toFile();
  String original=digest(CONTENT);
  if(!original.equals("86d5b35cddd2c4be8c0ba478afe72ab809717878b5bce1d8e9865f5cb3f7d50a"))
    throw new AssertionError("unexpected exact synthetic recording bytes");
  File working=new File(root,"fail-metadata");
  AudioCapture capture=new AudioCapture(working,prefs(false),()->recorder());
  if(!capture.start("audio_107_03"))throw new AssertionError("cannot start recorder");
  boolean failed=false;
  try{capture.stop();}catch(IOException expected){failed=true;}
  if(!failed)throw new AssertionError("false prefs commit was acknowledged");
  File finalAudio=new File(working,"audio_107_03");
  File[] leftovers=working.listFiles();
  boolean kept=false;
  if(leftovers!=null)for(File f:leftovers){
    if(f.isFile()&&digest(Files.readAllBytes(f.toPath())).equals(original))kept=true;
  }
  System.out.println("EXPECTED_AUDIO_SHA256="+original);
  System.out.println("AFTER_FAILED_METADATA: original_survived="+kept+" final_exists="+finalAudio.exists());
  File controlDir=new File(root,"success-control");
  AudioCapture successful=new AudioCapture(controlDir,prefs(true),()->recorder());
  if(!successful.start("audio_control")||!successful.stop())throw new AssertionError("success control failed");
  File control=new File(controlDir,"audio_control");
  if(!control.isFile()||!digest(Files.readAllBytes(control.toPath())).equals(original))
    throw new AssertionError("control successful recording changed bytes");
  System.out.println("PASS successful_metadata_control_sha256="+original);
  if(!kept)System.exit(19); // EXPECTED RED until Codex B; FAIL protection invariant.
  System.out.println("PASS completed original survived commit(false) byte-exact");
 }
}''',
}


def run() -> int:
    parser=argparse.ArgumentParser()
    parser.add_argument('--expect-red', action='store_true',help='Verify exact old blobs and reproduce known RED')
    args=parser.parse_args()
    # Variant B adds the real AtomicFile/JSON journal. Run its byte-exact production
    # regression in Robolectric rather than mocking the new storage contract.
    if not args.expect_red and (PRODUCTION / 'PendingAudio.java').is_file():
        gradle = shutil.which('gradle')
        if not gradle:
            print('BLOCKED: Gradle/JDK17/Android SDK required for durable variant B regression', file=sys.stderr)
            return 2
        return subprocess.run([gradle, '--offline', '--no-daemon', '--max-workers=1',
            ':app:testPreviewUnitTest', '--rerun-tasks', '--tests',
            'cz.zamerovac.app.AudioCompletedKeepTest'], cwd=ROOT).returncode
    sources=[PRODUCTION/name for name in BLOBS]
    if not all(f.is_file() for f in sources):
        print('BLOCKED: production Java sources absent', file=sys.stderr)
        return 2
    for f in sources:
        blob=subprocess.check_output(['git','hash-object',str(f)],text=True).strip()
        print('SOURCE_GIT_BLOB',f.name,blob)
        if args.expect_red and blob!=BLOBS[f.name]:
            print('BLOCKED: source SHA changed; historical RED cannot be assumed',file=sys.stderr)
            return 2
    with TemporaryDirectory(prefix='qa107-audio-probe-') as temp:
        base=Path(temp)
        paths=list(sources)
        for name,content in FILES.items():
            p=base/name;p.parent.mkdir(parents=True,exist_ok=True)
            p.write_text(content,encoding='utf-8');paths.append(p)
        classes=base/'classes';classes.mkdir()
        compile=subprocess.run(['javac','--release','17','-d',str(classes),*[str(p) for p in paths]],
                               capture_output=True,text=True,timeout=40)
        if compile.returncode:
            print('FAIL JAVAC',compile.stderr,file=sys.stderr);return 2
        print('PASS JAVAC actual AudioCapture + MediaStaging (minimal Android stubs)')
        child=subprocess.run(['java','-Djava.io.tmpdir='+str(base),'-cp',str(classes),'cz.zamerovac.app.AudioLossProbe'],
                             capture_output=True,text=True,timeout=30)
        print(child.stdout.strip())
        if child.stderr:print(child.stderr,file=sys.stderr)
        if args.expect_red:
            if child.returncode==19 and 'original_survived=false' in child.stdout:
                print('EXPECTED RED REPRODUCED: completed audio lost, regression invariant FAILED')
                return 0
            print('RED REPRODUCTION NOT CONFIRMED',file=sys.stderr);return 2
        if child.returncode==19:
            print('FAIL QA-107-03: completed original lost after metadata commit(false)',file=sys.stderr)
            return 1
        return child.returncode


if __name__=='__main__':
    sys.exit(run())
