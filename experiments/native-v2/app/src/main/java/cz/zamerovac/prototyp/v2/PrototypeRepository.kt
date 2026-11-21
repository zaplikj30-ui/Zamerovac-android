package cz.zamerovac.prototyp.v2

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.room.withTransaction
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.util.UUID

/**
 * A deliberately isolated experiment. Android SAF handles source access.
 * Binary originals are immutable, stored separately from Room metadata.
 * A crash before DB commit may leave a private orphan; never silently delete it.
 */
class PrototypeRepository(
    private val context: Context,
    private val database: PrototypeDatabase
) {
    val dao = database.dao()
    private val originals = File(context.filesDir, "v2-originals")
    private fun id(): String = UUID.randomUUID().toString()

    suspend fun project(title: String): String {
        val record = ProjectRow(id(), title.ifBlank { "Nová zakázka" }, System.currentTimeMillis())
        dao.insertProject(record)
        return record.id
    }

    suspend fun photo(projectId: String, uri: Uri): String {
        val recordId = id()
        val original = importOriginal(uri, recordId)
        // One metadata+photo transaction. File has already been committed to private storage.
        database.withTransaction {
            dao.insertMedia(original)
            dao.insertPhoto(PhotoRow(recordId, projectId, original.fileName, original.id))
        }
        return recordId
    }

    suspend fun note(projectId: String): String {
        val record = NoteRow(id(), projectId, "")
        dao.insertNote(record)
        return record.id
    }

    suspend fun noteAttachment(noteId: String, uri: Uri) {
        val original = importOriginal(uri, noteId)
        dao.insertMedia(original)
    }

    suspend fun dimension(photoId: String): String {
        val item = DimensionRow(
            id(), photoId, 0.20, 0.30, 0.75, 0.42,
            "", "mm"
        )
        dao.insertDimension(item)
        return item.id
    }

    suspend fun moveDimensionA(id: String, x: Double, y: Double) {
        require(x in 0.0..1.0 && y in 0.0..1.0)
        check(dao.moveEndpointA(id, x, y) == 1) { "Kóta už neexistuje" }
    }

    suspend fun setMeasurement(id: String, text: String) {
        // Preserve the user's exact decimal input; no conversion from image pixels.
        require(text.length <= 256 && text.none { it.isISOControl() })
        check(dao.changeDimensionValue(id, text, "mm") == 1)
    }

    suspend fun setNoteText(id: String, text: String) {
        require(text.length <= 250_000)
        check(dao.updateNote(id, text) == 1)
    }

    fun localOriginal(mediaId: String): File = File(originals, mediaId)

    private suspend fun importOriginal(uri: Uri, ownerId: String): MediaRow =
        withContext(Dispatchers.IO) {
            require(uri.scheme == "content") { "Import pouze přes systémový výběr souborů" }
            if (!originals.isDirectory && !originals.mkdirs()) {
                throw IllegalStateException("Nelze připravit soukromé úložiště")
            }
            val mediaId = id()
            val name = try {
                context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME),
                    null, null, null)?.use { cur ->
                    if (cur.moveToFirst()) cur.getString(0) else null
                }
            } catch (_: Exception) { null }
            val readableName = name?.take(180)?.takeIf { it.isNotBlank() } ?: mediaId
            val mime = context.contentResolver.getType(uri) ?: "application/octet-stream"
            val partial = File(originals, "$mediaId.partial")
            val complete = File(originals, mediaId)
            val hash = MessageDigest.getInstance("SHA-256")
            var count = 0L
            context.contentResolver.openInputStream(uri).use { input ->
                checkNotNull(input) { "Soubor není dostupný" }
                FileOutputStream(partial).use { output ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        val n = input.read(buffer)
                        if (n < 0) break
                        if (n == 0) continue
                        count += n
                        require(count <= 250L * 1024 * 1024) { "Příloha přesahuje limit prototypu" }
                        hash.update(buffer, 0, n)
                        output.write(buffer, 0, n)
                    }
                    output.fd.sync()
                }
            }
            require(count > 0) { "Prázdná příloha" }
            Files.move(partial.toPath(), complete.toPath(), StandardCopyOption.ATOMIC_MOVE)
            MediaRow(
                mediaId, ownerId, mime, readableName,
                hash.digest().joinToString("") { "%02x".format(it) }, count
            )
        }
}
