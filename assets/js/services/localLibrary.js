/* ============================================================
   Local library: user-approved folder access and file registry
   ============================================================ */

let selectedFilesByPath = new Map();
let selectedLibrary = null;
let libraryError = "";

function normalizeRelativePath(file) {
  const raw = String(file?.webkitRelativePath || file?.name || "");
  const parts = raw.split("/").filter(Boolean);

  // Folder inputs include the selected root folder as the first segment.
  return parts.length > 1 ? parts.slice(1).join("/") : parts.join("/");
}

function storeSelectedFiles(fileList) {
  const next = new Map();

  for (const file of Array.from(fileList || [])) {
    const path = normalizeRelativePath(file);
    if (path) next.set(path, file);
  }

  selectedFilesByPath = next;
  return selectedFilesByPath.size;
}

function summarizeLibrary(albums) {
  const trackCount = albums.reduce(
    (total, album) => total + (Array.isArray(album?.tracks) ? album.tracks.length : 0),
    0
  );

  return { albumCount: albums.length, trackCount };
}

function validateLibrary(data) {
  if (!Array.isArray(data)) {
    throw new Error("library.json must contain an array of albums.");
  }

  const invalidAlbum = data.find(
    (album) => !album || typeof album !== "object" || !Array.isArray(album.tracks)
  );
  if (invalidAlbum) {
    throw new Error("At least one album in library.json has no valid tracks list.");
  }

  return data;
}

async function loadLibraryJson() {
  const file = selectedFilesByPath.get("library.json");
  if (!file) throw new Error("No library.json found in the selected folder.");

  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("library.json is not valid JSON.");
  }

  return validateLibrary(data);
}

function statusText() {
  if (libraryError) return libraryError;
  if (!selectedLibrary) return "No local music folder selected.";

  const { albumCount, trackCount } = summarizeLibrary(selectedLibrary);
  return `Library loaded: ${albumCount.toLocaleString()} albums, ${trackCount.toLocaleString()} tracks · ${selectedFilesByPath.size.toLocaleString()} files available.`;
}

function renderStatus(status) {
  status.textContent = statusText();
  status.classList.toggle("err", !!libraryError);
}

export function getLocalFile(relativePath) {
  return selectedFilesByPath.get(String(relativePath || "")) || null;
}

export function getLocalLibrary() {
  return selectedLibrary;
}

export function bindLocalLibraryPicker(root = document) {
  const button = root.getElementById("openMusicFolder");
  const input = root.getElementById("musicFolderInput");
  const status = root.getElementById("musicFolderStatus");

  if (!button || !input || !status || button.dataset.bound === "1") return;
  button.dataset.bound = "1";
  renderStatus(status);

  button.addEventListener("click", () => input.click());

  input.addEventListener("change", async () => {
    storeSelectedFiles(input.files);
    selectedLibrary = null;
    libraryError = "";
    status.classList.remove("err");
    status.textContent = "Reading library.json…";

    try {
      selectedLibrary = await loadLibraryJson();
    } catch (error) {
      libraryError = error?.message || "Could not read library.json.";
    }

    renderStatus(status);
  });
}
