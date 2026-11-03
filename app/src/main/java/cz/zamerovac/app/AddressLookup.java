package cz.zamerovac.app;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/** Vyhledání českých adresních míst z registru RÚIAN (ČÚZK).
 * Používá tabulku 1 (AdresniMisto), aby výsledky obsahovaly čísla domů,
 * nikoli jen bod uprostřed obce.
 */
final class AddressLookup {
    private AddressLookup() {}
    static String find(String query) throws Exception {
        String q=query==null?"":query.trim();
        if(q.length()<3||q.length()>100)throw new IllegalArgumentException("Zadej část adresy (3–100 znaků)");
        String endpoint="https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates"
            +"?SingleLine="+URLEncoder.encode(q,"UTF-8")
            +"&outSR=4326&outFields=*&maxLocations=10&f=pjson";
        HttpURLConnection connection=(HttpURLConnection)new URL(endpoint).openConnection();
        connection.setConnectTimeout(9000);
        connection.setReadTimeout(13000);
        connection.setRequestProperty("Accept","application/json");
        connection.setRequestProperty("User-Agent","Zamerovac-Android/1.2");
        try {
            if(connection.getResponseCode()!=200)throw new java.io.IOException("Server adres odpověděl "+connection.getResponseCode());
            byte[] buffer=new byte[8192];int n;
            ByteArrayOutputStream output=new ByteArrayOutputStream();
            try(InputStream input=connection.getInputStream()){
                while((n=input.read(buffer))!=-1){
                    output.write(buffer,0,n);
                    if(output.size()>1000000)throw new java.io.IOException("Příliš mnoho dat");
                }
            }
            JSONObject root=new JSONObject(output.toString(StandardCharsets.UTF_8.name()));
            if(root.has("error"))throw new java.io.IOException("Služba adres je momentálně nedostupná");
            JSONArray candidates=root.optJSONArray("candidates");
            JSONArray found=new JSONArray();
            if(candidates!=null)for(int i=0;i<candidates.length()&&found.length()<10;i++){
                JSONObject candidate=candidates.optJSONObject(i);
                if(candidate==null)continue;
                JSONObject coordinates=candidate.optJSONObject("location");
                if(coordinates==null)continue;
                double lat=coordinates.optDouble("y",Double.NaN),lon=coordinates.optDouble("x",Double.NaN);
                if(!Double.isFinite(lat)||!Double.isFinite(lon)||lat<48||lat>52||lon<12||lon>19)continue;
                found.put(new JSONObject()
                    .put("address",candidate.optString("address",""))
                    .put("score",candidate.optDouble("score",0))
                    .put("lat",lat).put("lon",lon));
            }
            return new JSONObject().put("query",q).put("candidates",found).toString();
        }finally{connection.disconnect();}
    }
}
