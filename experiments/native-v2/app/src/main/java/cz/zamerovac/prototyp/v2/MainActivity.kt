package cz.zamerovac.prototyp.v2

import android.graphics.BitmapFactory
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.snapshots.SnapshotStateMap
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.consume
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.math.hypot
import kotlin.math.roundToInt

private sealed interface Screen {
    data object Projects : Screen
    data class Project(val id: String, val title: String) : Screen
    data class Photo(val photo: PhotoRow, val owner: Project) : Screen
    data class Note(val note: NoteRow, val owner: Project) : Screen
}

/**
 * Vertical slice of a completely new Android app, NOT the shipped editor:
 * projects -> photos -> editable dimensions, plus notes -> image/audio attachments.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val repo = PrototypeRepository(applicationContext, PrototypeDatabase.open(applicationContext))
        setContent {
            MaterialTheme {
                val scope = rememberCoroutineScope()
                var screen by remember { mutableStateOf<Screen>(Screen.Projects) }
                var error by remember { mutableStateOf<String?>(null) }
                var pendingPhotoOwner by remember { mutableStateOf<String?>(null) }
                var pendingNoteOwner by remember { mutableStateOf<String?>(null) }

                val choosePhoto = rememberLauncherForActivityResult(
                    ActivityResultContracts.OpenDocument()
                ) { uri ->
                    val owner = pendingPhotoOwner
                    pendingPhotoOwner = null
                    if (uri != null && owner != null) scope.launch {
                        try { repo.photo(owner, uri) }
                        catch (e: Exception) { error = e.message ?: "Fotografii nelze přidat" }
                    }
                }
                val chooseAttachment = rememberLauncherForActivityResult(
                    ActivityResultContracts.OpenDocument()
                ) { uri ->
                    val owner = pendingNoteOwner
                    pendingNoteOwner = null
                    if (uri != null && owner != null) scope.launch {
                        try { repo.noteAttachment(owner, uri) }
                        catch (e: Exception) { error = e.message ?: "Přílohu nelze přidat" }
                    }
                }
                fun back() {
                    screen = when (val p = screen) {
                        Screen.Projects -> Screen.Projects
                        is Screen.Project -> Screen.Projects
                        is Screen.Photo -> p.owner
                        is Screen.Note -> p.owner
                    }
                }

                BackHandler(enabled = screen !is Screen.Projects) { back() }
                Column(Modifier.fillMaxSize().padding(16.dp)) {
                    Text("Zaměřovač V2 – experiment", style = MaterialTheme.typography.titleLarge)
                    Text("Samostatný prototyp. Žádná ostrá zákaznická data.",
                        style = MaterialTheme.typography.bodySmall)
                    if (screen !is Screen.Projects) {
                        TextButton(onClick = { back() }) { Text("← Zpět") }
                    }
                    if (error != null) {
                        Text("Chyba: " + error, color = MaterialTheme.colorScheme.error)
                        TextButton(onClick = { error = null }) { Text("Skrýt") }
                    }
                    when (val page = screen) {
                        Screen.Projects -> ProjectsPage(repo,
                            onOpen = { id, name -> screen = Screen.Project(id, name) },
                            onError = { error = it })
                        is Screen.Project -> ProjectPage(repo, page,
                            onPhoto = { screen = Screen.Photo(it, page) },
                            onNote = { screen = Screen.Note(it, page) },
                            onAddPhoto = {
                                pendingPhotoOwner = page.id
                                choosePhoto.launch(arrayOf("image/*"))
                            }, onError = { error = it })
                        is Screen.Photo -> PhotoPage(repo, page.photo, onError = { error = it })
                        is Screen.Note -> NotePage(repo, page.note,
                            onAttach = {
                                pendingNoteOwner = page.note.id
                                chooseAttachment.launch(arrayOf("image/*", "audio/*"))
                            }, onError = { error = it })
                    }
                }
            }
        }
    }
}

@Composable
private fun ProjectsPage(repo: PrototypeRepository, onOpen: (String, String) -> Unit,
                         onError: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    val projects by repo.dao.projects().collectAsState(initial = emptyList())
    var title by remember { mutableStateOf("") }
    OutlinedTextField(title, { title = it }, label = { Text("Nová zakázka") },
        modifier = Modifier.fillMaxWidth())
    Button(onClick = {
        val label = title
        scope.launch {
            try { repo.project(label); title = "" }
            catch (e: Exception) { onError(e.message ?: "Zakázku nelze založit") }
        }
    }) { Text("Přidat zakázku") }
    LazyColumn {
        items(projects, key = { it.id }) { project ->
            TextButton(onClick = { onOpen(project.id, project.title) }) {
                Text(project.title)
            }
        }
    }
}

@Composable
private fun ProjectPage(repo: PrototypeRepository, page: Screen.Project,
                        onPhoto: (PhotoRow) -> Unit, onNote: (NoteRow) -> Unit,
                        onAddPhoto: () -> Unit, onError: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    val photos by repo.dao.photos(page.id).collectAsState(initial = emptyList())
    val notes by repo.dao.notes(page.id).collectAsState(initial = emptyList())
    Text(page.title, style = MaterialTheme.typography.titleMedium)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(onClick = onAddPhoto) { Text("Přidat fotografii") }
        Button(onClick = {
            scope.launch {
                try { repo.note(page.id) }
                catch (e: Exception) { onError(e.message ?: "Poznámku nelze přidat") }
            }
        }) { Text("Poznámka") }
    }
    Text("Fotografie (" + photos.size + ")", style = MaterialTheme.typography.titleSmall)
    LazyColumn(Modifier.weight(1f)) {
        items(photos, key = { it.id }) { photo ->
            TextButton(onClick = { onPhoto(photo) }) { Text(photo.title) }
        }
    }
    Text("Poznámky (" + notes.size + ")", style = MaterialTheme.typography.titleSmall)
    LazyColumn(Modifier.weight(1f)) {
        items(notes, key = { it.id }) { note ->
            TextButton(onClick = { onNote(note) }) {
                Text(note.text.take(55).ifBlank { "Poznámka" })
            }
        }
    }
}

@Composable
private fun PhotoPage(repo: PrototypeRepository, photo: PhotoRow,
                      onError: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    val dimensions by repo.dao.dimensions(photo.id).collectAsState(initial = emptyList())
    val media by produceState<MediaRow?>(initialValue = null, photo.mediaId) {
        value = repo.dao.media(photo.mediaId)
    }
    val bitmap by produceState<ImageBitmap?>(initialValue = null, media?.id) {
        val id = media?.id
        value = if (id == null) null else withContext(Dispatchers.IO) {
            loadSampledBitmap(repo.localOriginal(id))
        }
    }
    val draft = remember(photo.id) { mutableStateMapOf<String, Pair<Double, Double>>() }
    Text(photo.title, style = MaterialTheme.typography.titleMedium)
    DimensionSurface(bitmap, dimensions, draft) { id, x, y ->
        scope.launch {
            try { repo.moveDimensionA(id, x, y) }
            catch (e: Exception) { onError(e.message ?: "Nelze posunout kótu") }
            finally { draft.remove(id) }
        }
    }
    Button(onClick = {
        scope.launch {
            try { repo.dimension(photo.id) }
            catch (e: Exception) { onError(e.message ?: "Kótu nelze přidat") }
        }
    }) { Text("Nová editovatelná kóta") }
    Text("Kóty: " + dimensions.size + ". Levý bod lze táhnout.")
    Text("Hodnoty laseru se nikdy nepočítají z pixelů.")
    LazyColumn {
        items(dimensions, key = { it.id }) { item ->
            var value by remember(item.id, item.laserValue) { mutableStateOf(item.laserValue) }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                OutlinedTextField(value, { value = it }, label = { Text("mm") },
                    modifier = Modifier.weight(1f), singleLine = true)
                TextButton(onClick = {
                    scope.launch {
                        try { repo.setMeasurement(item.id, value) }
                        catch (e: Exception) { onError(e.message ?: "Hodnotu nelze uložit") }
                    }
                }) { Text("Uložit") }
            }
        }
    }
}

/** Bounded image decode: display only the active image, never all project originals. */
private fun loadSampledBitmap(path: File): ImageBitmap? {
    if (!path.isFile) return null
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(path.absolutePath, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    var sample = 1
    while (bounds.outWidth / sample > 1024 || bounds.outHeight / sample > 1024) {
        sample *= 2
    }
    val resized = BitmapFactory.Options().apply { inSampleSize = sample }
    return BitmapFactory.decodeFile(path.absolutePath, resized)?.asImageBitmap()
}

@Composable
private fun DimensionSurface(
    image: ImageBitmap?, dimensions: List<DimensionRow>,
    draft: SnapshotStateMap<String, Pair<Double, Double>>,
    onMove: (String, Double, Double) -> Unit
) {
    var dragging by remember { mutableStateOf<String?>(null) }
    Canvas(
        modifier = Modifier.fillMaxWidth().height(330.dp)
            .pointerInput(dimensions) {
                detectDragGestures(
                    onDragStart = { point ->
                        dragging = dimensions.minByOrNull { d ->
                            val p = draft[d.id] ?: (d.ax to d.ay)
                            hypot(point.x - p.first.toFloat() * size.width,
                                  point.y - p.second.toFloat() * size.height)
                        }?.takeIf { d ->
                            val p = draft[d.id] ?: (d.ax to d.ay)
                            hypot(point.x - p.first.toFloat() * size.width,
                                  point.y - p.second.toFloat() * size.height) <= 56.dp.toPx()
                        }?.id
                    },
                    onDrag = { change, _ ->
                        dragging?.let { id ->
                            draft[id] =
                                (change.position.x / size.width).toDouble().coerceIn(0.0, 1.0) to
                                (change.position.y / size.height).toDouble().coerceIn(0.0, 1.0)
                            change.consume()
                        }
                    },
                    onDragEnd = {
                        dragging?.let { id ->
                            draft[id]?.let { (x, y) -> onMove(id, x, y) }
                        }
                        dragging = null
                    },
                    onDragCancel = {
                        dragging?.let { draft.remove(it) }
                        dragging = null
                    }
                )
            }
    ) {
        drawRect(Color(0xffeeeeee))
        image?.let {
            drawImage(it, dstSize = IntSize(size.width.roundToInt(), size.height.roundToInt()))
        }
        dimensions.forEach { d ->
            val a = draft[d.id] ?: (d.ax to d.ay)
            val start = Offset((a.first * size.width).toFloat(), (a.second * size.height).toFloat())
            val end = Offset((d.bx * size.width).toFloat(), (d.by * size.height).toFloat())
            drawLine(Color(0xffd23421), start, end, strokeWidth = 3.dp.toPx())
            drawCircle(Color.White, radius = 7.dp.toPx(), center = start)
            drawCircle(Color(0xffd23421), radius = 3.dp.toPx(), center = start)
        }
    }
}

@Composable
private fun NotePage(repo: PrototypeRepository, note: NoteRow,
                     onAttach: () -> Unit, onError: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    val attachments by repo.dao.attachments(note.id).collectAsState(initial = emptyList())
    var text by remember(note.id) { mutableStateOf(note.text) }
    Text("Poznámka", style = MaterialTheme.typography.titleMedium)
    OutlinedTextField(text, { text = it }, label = { Text("Text poznámky") },
        minLines = 4, modifier = Modifier.fillMaxWidth())
    Button(onClick = {
        scope.launch {
            try { repo.setNoteText(note.id, text) }
            catch (e: Exception) { onError(e.message ?: "Poznámku nelze uložit") }
        }
    }) { Text("Uložit text") }
    Button(onClick = onAttach) { Text("Připojit obrázek nebo zvuk") }
    Text("Přílohy (" + attachments.size + ") – originální bajty zachovány.")
    LazyColumn {
        items(attachments, key = { it.id }) { media ->
            Text(media.fileName + " · " + media.bytes + " B · " + media.mime,
                style = MaterialTheme.typography.bodySmall)
        }
    }
}
