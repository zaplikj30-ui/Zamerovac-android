package cz.zamerovac.app;

/** A configurable per-attempt policy. A deferred object stays queued; size never excludes content. */
final class SyncNetworkPolicy {
    // Preserves the pre-existing conservative allowance; this is NOT a new product/tariff limit.
    static final long LEGACY_METERED_ATTEMPT_BYTES=1024*1024;
    final boolean wifiOnly;
    final long meteredAttemptBytes;
    SyncNetworkPolicy(boolean wifiOnly,long meteredAttemptBytes){
        if(meteredAttemptBytes<0)throw new IllegalArgumentException("Negative network allowance");
        this.wifiOnly=wifiOnly;this.meteredAttemptBytes=meteredAttemptBytes;
    }
    boolean allows(boolean online,boolean unmetered,boolean explicit,long accountedBytes){
        return accountedBytes>=0&&online&&(explicit||unmetered||!wifiOnly&&accountedBytes<=meteredAttemptBytes);
    }
    static long add(long left,long right)throws java.io.IOException{
        if(left<0||right<0||right>Long.MAX_VALUE-left)throw new java.io.IOException("Přenos překračuje bezpečný číselný rozsah");return left+right;
    }
}
