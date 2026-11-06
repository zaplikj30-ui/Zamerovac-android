package cz.zamerovac.app;

/** Fixed external map destination; no caller-controlled URL or HTML. */
final class AddressMapLink {
    private AddressMapLink() {}

    static String forCoordinates(double latitude,double longitude) {
        if(Double.isNaN(latitude)||Double.isInfinite(latitude)||Math.abs(latitude)>90||
           Double.isNaN(longitude)||Double.isInfinite(longitude)||Math.abs(longitude)>180)
            throw new IllegalArgumentException("Invalid coordinates");
        String lat=Double.toString(latitude),lon=Double.toString(longitude);
        return "https://www.openstreetmap.org/?mlat="+lat+"&mlon="+lon+"#map=17/"+lat+"/"+lon;
    }
}
