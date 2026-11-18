package cz.zamerovac.app;
import android.database.sqlite.SQLiteDatabase;
import java.io.File;
/** A real SQLite statement failure replaces obsolete AtomicFile .new write-fault fixtures. */
final class LedgerTestFault {
    static void block(File home){try(SQLiteDatabase db=SQLiteDatabase.openDatabase(new File(home,"sync-ledger-v1.sqlite").getPath(),null,SQLiteDatabase.OPEN_READWRITE)){
        db.execSQL("CREATE TRIGGER synthetic_disk_full BEFORE INSERT ON documents BEGIN SELECT RAISE(ABORT, 'synthetic ENOSPC'); END");
    }}
    static void unblock(File home){try(SQLiteDatabase db=SQLiteDatabase.openDatabase(new File(home,"sync-ledger-v1.sqlite").getPath(),null,SQLiteDatabase.OPEN_READWRITE)){db.execSQL("DROP TRIGGER synthetic_disk_full");}}
}
