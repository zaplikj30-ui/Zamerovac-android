package cz.zamerovac.app;

import android.accounts.Account;
import android.content.Context;
import android.os.Looper;
import android.os.SystemClock;
import com.google.android.gms.auth.api.identity.*;
import com.google.android.gms.common.GoogleApiAvailabilityLight;
import com.google.android.gms.common.api.*;
import com.google.android.gms.tasks.Tasks;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.LongSupplier;

/** Android SDK token access, separate from UI consent and all project/backup data. */
final class DriveAuthorization implements DriveHttp.Credentials {
    static final String SCOPE="https://www.googleapis.com/auth/drive.appdata";
    static final class NeedsConsent extends IOException {NeedsConsent(){super("Google Disk vyžaduje potvrzení účtu. Otevři připojení Disku v příslušné funkci.");}}
    private final AuthorizationClient client;private final Account account;private final ImmutableStore.Checkpoint binding;private final LongSupplier clock;private String cached;private long cachedAt;
    static void configured()throws IOException{if(!BuildConfig.DRIVE_CLOUD_PROJECT.matches("[a-z][a-z0-9-]{4,61}[a-z0-9]"))throw new IOException("Připojení Disku čeká na dokončení nastavení aplikace.");}
    static AuthorizationClient client(Context context)throws IOException{configured();if(GoogleApiAvailabilityLight.getInstance().isGooglePlayServicesAvailable(context)!=0)throw new IOException("Google Disk vyžaduje dostupné služby Google Play. Místní práce a přímý přenos fungují samostatně.");return Identity.getAuthorizationClient(context);}
    DriveAuthorization(Context context,Account account,ImmutableStore.Checkpoint binding)throws IOException{this(client(context),account,binding,SystemClock::elapsedRealtime);}
    DriveAuthorization(AuthorizationClient client,Account account,ImmutableStore.Checkpoint binding,LongSupplier clock)throws IOException{if(account==null||!"com.google".equals(account.type)||!DriveAccounts.valid(account.name))throw new IOException("Neplatný účet Disku");this.client=client;this.account=account;this.binding=binding;this.clock=clock;}
    static AuthorizationRequest request(Account account){return AuthorizationRequest.builder().setAccount(account).setRequestedScopes(Collections.singletonList(new Scope(SCOPE))).build();}
    static String verified(AuthorizationResult result)throws IOException{
        if(result==null)throw new IOException("Google nevrátil potvrzení přístupu");if(result.hasResolution())throw new NeedsConsent();String token=result.getAccessToken();List<String> scopes=result.getGrantedScopes();if(scopes==null||!scopes.contains(SCOPE)||token==null||!token.matches("[A-Za-z0-9._~+/=-]{1,8192}"))throw new IOException("Google nepotvrdil oprávnění k datům aplikace na Disku");return token;
    }
    static IOException problem(Throwable failure){if(failure instanceof ApiException&&((ApiException)failure).getStatusCode()==10)return new IOException("Google: registrace této verze aplikace není dokončená. Nastavení musí dokončit vývojář.");return new IOException("Google přístup k Disku nebyl potvrzen. Ověř připojení a zkus účet připojit znovu.");}
    @Override public synchronized String token()throws IOException{
        binding.check();long now=clock.getAsLong();if(cached!=null&&now>=cachedAt&&now-cachedAt<5*60*1000L)return cached;if(Looper.myLooper()==Looper.getMainLooper())throw new IOException("Přihlášení Disku nesmí blokovat obrazovku");
        try{AuthorizationResult result=Tasks.await(client.authorize(request(account)),30,TimeUnit.SECONDS);String token=verified(result);binding.check();cached=token;cachedAt=clock.getAsLong();return token;}
        catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw new InterruptedIOException("Přihlášení Disku bylo přerušeno");}catch(TimeoutException timeout){throw new IOException("Google nepotvrdil přístup včas. Přenos zůstává čekající.");}catch(ExecutionException failure){throw problem(failure.getCause());}catch(CancellationException cancelled){throw new IOException("Přihlášení Disku bylo zrušeno");}catch(RuntimeException failure){throw problem(failure);}
    }
    @Override public synchronized void rejected(String token){if(token!=null&&token.equals(cached)){cached=null;cachedAt=0;}try{client.clearToken(ClearTokenRequest.builder().setToken(token).build()).addOnFailureListener(failure->{/* A failed cache clear is never an ACK or a reason to log the token. */});}catch(RuntimeException ignored){}}
}
