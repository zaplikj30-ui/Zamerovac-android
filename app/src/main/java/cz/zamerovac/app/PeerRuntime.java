package cz.zamerovac.app;

import android.content.*;
import org.json.*;
import java.util.concurrent.CopyOnWriteArraySet;

/** One application-scoped coordinator; an Activity is only a temporary UI observer. */
final class PeerRuntime {
    interface Factory {PeerCoordinator create(Context context,SharedPreferences prefs,PeerCoordinator.Events events)throws Exception;}
    private static PeerRuntime shared;
    static synchronized PeerRuntime get(Context context){if(shared==null)shared=new PeerRuntime(context,PeerCoordinator::new);return shared;}
    private final Context context;private final SharedPreferences prefs;private final Factory factory;
    private final CopyOnWriteArraySet<PeerCoordinator.Events> observers=new CopyOnWriteArraySet<>();
    private PeerCoordinator coordinator;private volatile String serviceProblem="";
    PeerRuntime(Context context,Factory factory){this.context=context.getApplicationContext();prefs=this.context.getSharedPreferences("zamerovac",Context.MODE_PRIVATE);this.factory=factory;}
    synchronized PeerCoordinator coordinator()throws Exception{
        if(coordinator==null)coordinator=factory.create(context,prefs,new PeerCoordinator.Events(){
            public void state(JSONObject state){for(PeerCoordinator.Events observer:observers)try{observer.state(withProblem(new JSONObject(state.toString())));}catch(Exception failure){log(failure);}}
            public void pairing(JSONObject request){for(PeerCoordinator.Events observer:observers)try{observer.pairing(new JSONObject(request.toString()));}catch(Exception failure){log(failure);}}
            public void saved(JSONObject data,String transport){for(PeerCoordinator.Events observer:observers)try{observer.saved(new JSONObject(data.toString()),transport);}catch(Exception failure){log(failure);}}
        });return coordinator;
    }
    void observe(PeerCoordinator.Events observer){observers.add(observer);}
    private JSONObject withProblem(JSONObject state)throws Exception{if(!serviceProblem.isEmpty())state.put("problem",serviceProblem);return state;}
    JSONObject snapshot()throws Exception{return withProblem(coordinator().snapshot());}
    void ready(){serviceProblem="";}
    void problem(String message){serviceProblem=message;try{coordinator().publish();}catch(Exception failure){log(failure);}}
    void unobserve(PeerCoordinator.Events observer){observers.remove(observer);if(observers.isEmpty()){PeerCoordinator current;synchronized(this){current=coordinator;}if(current!=null)current.stopPairing();}}
    void stop(){PeerCoordinator old;synchronized(this){old=coordinator;coordinator=null;}if(old!=null){old.close();try{JSONObject state=old.snapshot();for(PeerCoordinator.Events observer:observers)try{observer.state(new JSONObject(state.toString()));}catch(Exception failure){log(failure);}}catch(Exception failure){log(failure);}}}
    private static void log(Exception failure){android.util.Log.w("Zamerovac","Sync UI observer unavailable",failure);}
}
