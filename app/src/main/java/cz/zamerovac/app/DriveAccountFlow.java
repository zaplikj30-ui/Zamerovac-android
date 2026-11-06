package cz.zamerovac.app;

import android.accounts.*;
import android.app.*;
import android.content.*;
import android.os.Bundle;
import com.google.android.gms.auth.api.identity.*;
import com.google.android.gms.common.AccountPicker;
import java.io.*;
import java.util.*;

/** Explicit account picker/consent lifecycle. It cannot mutate projects, media, pairing or history. */
final class DriveAccountFlow {
    static final int PICK=36,CONSENT=37;
    interface Platform {AuthorizationClient client()throws IOException;Intent picker();}
    interface Events {void changed(String kind,String message);}
    private final Activity activity;private final DriveAccounts accounts;private final Platform platform;private final Events events;
    private String kind,stage,session;private boolean authorizing;private int authorizationRound;private long expectedRevision;private Account selected;private AuthorizationClient client;
    DriveAccountFlow(Activity activity,DriveAccounts accounts,Events events){this(activity,accounts,events,new Platform(){
        public AuthorizationClient client()throws IOException{return DriveAuthorization.client(activity);}
        public Intent picker(){return AccountPicker.newChooseAccountIntent(new AccountPicker.AccountChooserOptions.Builder().setAllowableAccountsTypes(Collections.singletonList("com.google")).setAlwaysShowAccountPicker(true).build());}
    });}
    DriveAccountFlow(Activity activity,DriveAccounts accounts,Events events,Platform platform){this.activity=activity;this.accounts=accounts;this.events=events;this.platform=platform;}
    boolean busy(){return session!=null;}
    private boolean current(String value){return value!=null&&value.equals(session)&&!activity.isFinishing()&&!activity.isDestroyed();}
    void begin(String kind)throws Exception{
        DriveAccounts.kind(kind);if(busy())throw new IOException("Dokonči nejdříve otevřený výběr účtu");long expected=accounts.revision(kind);AuthorizationClient client=platform.client();expectedRevision=expected;this.kind=kind;this.client=client;session=UUID.randomUUID().toString();stage="picker";
        try{activity.startActivityForResult(platform.picker(),PICK);}catch(RuntimeException unavailable){finish("Výběr Google účtu není dostupný. Původní nastavení zůstává.");}
    }
    boolean result(int request,int result,Intent data){
        if(request!=PICK&&request!=CONSENT)return false;if(!busy())return true;if(result!=Activity.RESULT_OK||data==null){finish("Připojení účtu bylo zrušeno. Původní nastavení zůstává.");return true;}
        try{
            if(request==PICK){if(!"picker".equals(stage))return true;String name=data.getStringExtra(AccountManager.KEY_ACCOUNT_NAME),type=data.getStringExtra(AccountManager.KEY_ACCOUNT_TYPE);if(!DriveAccounts.valid(name)||!"com.google".equals(type))throw new IOException("Výběr nevrátil platný Google účet");selected=new Account(name,type);authorize();}
            else{if(!"consent".equals(stage)||selected==null)return true;if(client==null)client=platform.client();complete(client.getAuthorizationResultFromIntent(data),session);}
        }catch(Exception failure){finish(failure instanceof IOException?failure.getMessage():DriveAuthorization.problem(failure).getMessage());}return true;
    }
    private void authorize()throws IOException{
        if(authorizing)return;if(selected==null)throw new IOException("Chybí vybraný účet Disku");if(client==null)client=platform.client();stage="authorizing";authorizing=true;String attempt=session;int round=++authorizationRound;
        client.authorize(DriveAuthorization.request(selected)).addOnSuccessListener(activity,result->{if(!current(attempt)||round!=authorizationRound)return;authorizing=false;try{
            if(result.hasResolution()){PendingIntent permission=result.getPendingIntent();if(permission==null)throw new IOException("Google nevrátil možnost potvrzení přístupu");stage="consent";activity.startIntentSenderForResult(permission.getIntentSender(),CONSENT,null,0,0,0);}
            else complete(result,attempt);
        }catch(Exception failure){finish(failure instanceof IOException?failure.getMessage():DriveAuthorization.problem(failure).getMessage());}}).addOnFailureListener(activity,failure->{if(current(attempt)&&round==authorizationRound){authorizing=false;finish(DriveAuthorization.problem(failure).getMessage());}});
    }
    private void complete(AuthorizationResult result,String attempt)throws Exception{if(!current(attempt))return;DriveAuthorization.verified(result);accounts.select(kind,selected,expectedRevision);finish("Google účet byl vybrán. Stav přenosu ověř v příslušné funkci.");}
    private void finish(String message){String completed=kind;authorizationRound++;authorizing=false;session=null;stage=null;selected=null;kind=null;client=null;if(completed!=null)events.changed(completed,message);}
    void save(Bundle out){if(!busy())return;out.putLong("drive-revision",expectedRevision);out.putString("drive-kind",kind);out.putString("drive-stage",stage);out.putString("drive-session",session);if(selected!=null)out.putString("drive-account",selected.name);}
    void restore(Bundle saved){if(saved==null)return;String kind=saved.getString("drive-kind"),stage=saved.getString("drive-stage"),session=saved.getString("drive-session");if(!Arrays.asList("sync","backup").contains(kind)||!Arrays.asList("picker","consent","authorizing").contains(stage)||!DeviceIdentity.valid(session))return;String name=saved.getString("drive-account");if(!"picker".equals(stage)&&!DriveAccounts.valid(name))return;this.expectedRevision=saved.getLong("drive-revision",-1);if(expectedRevision<0)return;this.kind=kind;this.stage=stage;this.session=session;if(name!=null)selected=new Account(name,"com.google");}
    void suspend(){if(authorizing){authorizing=false;authorizationRound++;}}
    void resume(){if("authorizing".equals(stage))try{authorize();}catch(Exception failure){finish(failure instanceof IOException?failure.getMessage():DriveAuthorization.problem(failure).getMessage());}}
    void close(){authorizationRound++;authorizing=false;session=null;stage=null;kind=null;selected=null;client=null;}
}
