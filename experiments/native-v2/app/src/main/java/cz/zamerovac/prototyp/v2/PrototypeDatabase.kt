package cz.zamerovac.prototyp.v2

import android.content.Context
import androidx.room.*
import kotlinx.coroutines.flow.Flow

/**
 * Fresh design experiment. Records are independent rows.
 * No production data, no sync, no migrations, no destructive fallback.
 */
@Entity(tableName = "projects")
data class ProjectRow(
    @PrimaryKey val id: String,
    val title: String,
    val createdAt: Long
)

@Entity(
    tableName = "photos",
    indices = [Index("projectId")],
    foreignKeys = [ForeignKey(
        entity = ProjectRow::class, parentColumns = ["id"], childColumns = ["projectId"],
        onDelete = ForeignKey.RESTRICT
    )]
)
data class PhotoRow(
    @PrimaryKey val id: String,
    val projectId: String,
    val title: String,
    val mediaId: String
)

@Entity(
    tableName = "dimensions",
    indices = [Index("photoId")],
    foreignKeys = [ForeignKey(
        entity = PhotoRow::class, parentColumns = ["id"], childColumns = ["photoId"],
        onDelete = ForeignKey.RESTRICT
    )]
)
data class DimensionRow(
    @PrimaryKey val id: String,
    val photoId: String,
    val ax: Double, val ay: Double,
    val bx: Double, val by: Double,
    // Keep exact measurement text and unit. Never infer physical laser values from pixels.
    val laserValue: String,
    val unit: String
)

@Entity(
    tableName = "notes",
    indices = [Index("projectId")],
    foreignKeys = [ForeignKey(
        entity = ProjectRow::class, parentColumns = ["id"], childColumns = ["projectId"],
        onDelete = ForeignKey.RESTRICT
    )]
)
data class NoteRow(
    @PrimaryKey val id: String,
    val projectId: String,
    val text: String
)

@Entity(
    tableName = "media",
    indices = [Index(value = ["ownerId"]), Index(value = ["sha256"])],
)
data class MediaRow(
    @PrimaryKey val id: String,
    val ownerId: String,
    val mime: String,
    val fileName: String,
    val sha256: String,
    val bytes: Long
)

@Dao
interface PrototypeDao {
    @Query("SELECT * FROM projects ORDER BY createdAt DESC")
    fun projects(): Flow<List<ProjectRow>>

    @Query("SELECT * FROM photos WHERE projectId = :projectId ORDER BY title")
    fun photos(projectId: String): Flow<List<PhotoRow>>

    @Query("SELECT * FROM notes WHERE projectId = :projectId ORDER BY id")
    fun notes(projectId: String): Flow<List<NoteRow>>

    @Query("SELECT * FROM dimensions WHERE photoId = :photoId ORDER BY id")
    fun dimensions(photoId: String): Flow<List<DimensionRow>>

    @Query("SELECT * FROM media WHERE ownerId = :ownerId ORDER BY id")
    fun attachments(ownerId: String): Flow<List<MediaRow>>

    @Query("SELECT * FROM media WHERE id = :id LIMIT 1")
    suspend fun media(id: String): MediaRow?

    @Insert
    suspend fun insertProject(project: ProjectRow)

    @Insert
    suspend fun insertPhoto(photo: PhotoRow)

    @Insert
    suspend fun insertDimension(dimension: DimensionRow)

    @Insert
    suspend fun insertNote(note: NoteRow)

    @Insert
    suspend fun insertMedia(media: MediaRow)

    @Query("UPDATE dimensions SET ax = :ax, ay = :ay WHERE id = :id")
    suspend fun moveEndpointA(id: String, ax: Double, ay: Double): Int

    @Query("UPDATE dimensions SET laserValue = :value, unit = :unit WHERE id = :id")
    suspend fun changeDimensionValue(id: String, value: String, unit: String): Int

    @Query("UPDATE notes SET text = :text WHERE id = :id")
    suspend fun updateNote(id: String, text: String): Int

    @Query("SELECT COUNT(*) FROM projects")
    suspend fun projectCount(): Int

    @Query("SELECT COUNT(*) FROM photos")
    suspend fun photoCount(): Int

    @Query("SELECT COUNT(*) FROM dimensions")
    suspend fun dimensionCount(): Int
}

@Database(
    entities = [ProjectRow::class, PhotoRow::class, DimensionRow::class,
        NoteRow::class, MediaRow::class],
    version = 1,
    exportSchema = false // prototype only; schema exports mandatory before any real migration
)
abstract class PrototypeDatabase : RoomDatabase() {
    abstract fun dao(): PrototypeDao

    companion object {
        @Volatile private var instance: PrototypeDatabase? = null

        fun open(context: Context): PrototypeDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    PrototypeDatabase::class.java,
                    "zamerovac-v2-prototype.db"
                )
                    .setJournalMode(JournalMode.WRITE_AHEAD_LOGGING)
                    // Deliberately no fallbackToDestructiveMigration.
                    .build()
                    .also { instance = it }
            }
    }
}
