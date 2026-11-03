package cz.zamerovac.app;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Address;
import android.location.Geocoder;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

/**
 * Optional, on-demand address lookup for a photograph captured by the user.
 * No continuous tracking; coordinates never leave this class or get stored
 * in a record. Geocoding may need an Internet connection/provider.
 */
public final class PhotoAddressResolver {
    private PhotoAddressResolver(){}

    public static void resolve(Activity activity,Consumer<String> result){
        boolean precise=activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED;
        boolean approximate=activity.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;
        if(!precise&&!approximate){result.accept("");return;}
        LocationManager lm=(LocationManager)activity.getSystemService(Context.LOCATION_SERVICE);
        if(lm==null){result.accept("");return;}
        String provider=precise?LocationManager.GPS_PROVIDER:LocationManager.NETWORK_PROVIDER;
        try{
            if(!lm.isProviderEnabled(provider)){
                if(approximate&&lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER))provider=LocationManager.NETWORK_PROVIDER;
                else {result.accept("");return;}
            }
            AtomicBoolean finished=new AtomicBoolean(false);
            Handler main=new Handler(Looper.getMainLooper());
            Runnable fallback=()->{
                if(finished.compareAndSet(false,true)){
                    Location gps=null,network=null;
                    try{
                        if(precise)gps=lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                        network=lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                    }catch(SecurityException ignored){}
                    // Fallback if there was no fresh GPS fix (common indoors).
                    Location best=isFresh(gps)?gps:null;
                    if(isFresh(network)&&(best==null||
                        network.getTime()>best.getTime()+30000L))best=network;
                    if(best!=null)geocode(activity,best,result);
                    else result.accept("");
                }
            };
            main.postDelayed(fallback,14000);
            Consumer<Location> location=loc->{
                // A null GPS result must NOT complete the lookup: the
                // network provider may still return a usable indoor fix.
                if(!isFresh(loc))return;
                if(!finished.compareAndSet(false,true))return;
                main.removeCallbacks(fallback);
                geocode(activity,loc,result);
            };
            // Indoors GPS may never lock; after four seconds also try the
            // network/Wi-Fi provider. Whichever returns a fresh fix first wins.
            if(precise&&lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)){
                main.postDelayed(()->{
                    if(finished.get())return;
                    try{
                        if(Build.VERSION.SDK_INT>=30){
                            lm.getCurrentLocation(LocationManager.NETWORK_PROVIDER,
                                null,activity.getMainExecutor(),location::accept);
                        }else{
                            lm.requestSingleUpdate(LocationManager.NETWORK_PROVIDER,
                                new android.location.LocationListener(){
                                  @Override public void onLocationChanged(Location l){location.accept(l);}
                                  @Override public void onStatusChanged(String p,int status,android.os.Bundle extras){}
                                  @Override public void onProviderEnabled(String p){}
                                  @Override public void onProviderDisabled(String p){}
                                },Looper.getMainLooper());
                        }
                    }catch(Exception ignored){}
                },4000);
            }
            if(Build.VERSION.SDK_INT>=30){
                lm.getCurrentLocation(provider,null,activity.getMainExecutor(),location::accept);
            }else{
                lm.requestSingleUpdate(provider,new android.location.LocationListener(){
                    @Override public void onLocationChanged(Location newLocation){location.accept(newLocation);}
                    @Override public void onStatusChanged(String p,int status,android.os.Bundle extras){}
                    @Override public void onProviderEnabled(String p){}
                    @Override public void onProviderDisabled(String p){}
                },Looper.getMainLooper());
            }
        }catch(Exception e){result.accept("");}
    }
    private static boolean isFresh(Location loc){
        return loc!=null&&loc.getTime()>0&&
          Math.abs(System.currentTimeMillis()-loc.getTime())<5*60*1000L;
    }
    private static void geocode(Activity activity,Location loc,Consumer<String> result){
        new Thread(()->{
            String value="";
            try{
                if(Geocoder.isPresent()){
                    Geocoder coder=new Geocoder(activity,Locale.forLanguageTag("cs-CZ"));
                    @SuppressWarnings("deprecation")
                    List<Address> found=coder.getFromLocation(loc.getLatitude(),loc.getLongitude(),1);
                    if(found!=null&&!found.isEmpty()){
                        Address a=found.get(0);
                        // Human-readable address only (no latitude/longitude).
                        String street=a.getThoroughfare(),number=a.getSubThoroughfare();
                        String city=a.getLocality();
                        if(city==null||city.isEmpty())city=a.getSubAdminArea();
                        String postcode=a.getPostalCode();
                        StringBuilder sb=new StringBuilder();
                        if(street!=null&&!street.isEmpty()){
                            sb.append(street);
                            if(number!=null&&!number.isEmpty())sb.append(" ").append(number);
                        }
                        if(postcode!=null&&!postcode.isEmpty()||city!=null&&!city.isEmpty()){
                            if(sb.length()>0)sb.append(", ");
                            if(postcode!=null&&!postcode.isEmpty())sb.append(postcode).append(" ");
                            if(city!=null)sb.append(city);
                        }
                        value=sb.toString().trim();
                        if(value.isEmpty()&&a.getMaxAddressLineIndex()>=0)
                            value=a.getAddressLine(0);
                    }
                }
            }catch(Exception ignored){}
            final String address=value;
            activity.runOnUiThread(()->result.accept(address));
        },"Photo-address-geocoder").start();
    }
}
