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

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function searchTokens(value) {
  return normalizeSearchText(value).split(" ").filter(Boolean);
}

function includesEvery(haystack, tokens) {
  return tokens.length > 0 && tokens.every((token) => haystack.includes(token));
}

function scoreLocalAlbum(album, query) {
  const artist = normalizeSearchText(album.artist_name);
  const title = normalizeSearchText(album.album_name);
  const tracks = (album.tracks || []).map((track) => ({
    title: String(track?.title || track?.filename || ""),
    normalized: normalizeSearchText(track?.title || track?.filename),
  }));

  const commaIndex = query.indexOf(",");
  let matches = false;

  if (commaIndex !== -1) {
    const artistTokens = searchTokens(query.slice(0, commaIndex));
    const releaseTokens = searchTokens(query.slice(commaIndex + 1));
    const artistMatches = !artistTokens.length || includesEvery(artist, artistTokens);
    const releaseMatches =
      !releaseTokens.length ||
      includesEvery(title, releaseTokens) ||
      tracks.some((track) => includesEvery(track.normalized, releaseTokens));

    matches = artistMatches && releaseMatches && (artistTokens.length > 0 || releaseTokens.length > 0);
  } else {
    const tokens = searchTokens(query);
    const allText = `${artist} ${title} ${tracks.map((track) => track.normalized).join(" ")}`;
    matches = includesEvery(allText, tokens);
  }

  if (!matches) return null;

  const normalizedQuery = normalizeSearchText(query.replace(",", " "));
  let score = 10;
  if (title === normalizedQuery) score += 100;
  if (artist === normalizedQuery) score += 80;
  if (title.startsWith(normalizedQuery)) score += 40;
  if (artist.startsWith(normalizedQuery)) score += 30;

  const trackNeedle = normalizeSearchText(
    commaIndex !== -1 ? query.slice(commaIndex + 1) : query
  );
  const matchingTrack = trackNeedle
    ? tracks.find((track) => track.normalized.includes(trackNeedle))
    : null;
  if (matchingTrack) score += 20;

  return { score, matchingTrack: matchingTrack?.title || "" };
}

export function searchLocalLibrary(query, limit = 50) {
  if (!selectedLibrary) return [];

  return selectedLibrary
    .map((album) => ({ album, match: scoreLocalAlbum(album, String(query || "").trim()) }))
    .filter((item) => item.match && item.album.album_mbid)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, limit)
    .map(({ album, match }) => {
      const artist = String(album.artist_name || "Unknown artist");
      const title = String(album.album_name || "Untitled album");
      const trackCount = album.tracks.length;
      const matchedTrack = match.matchingTrack ? ` · Track: ${match.matchingTrack}` : "";

      return {
        mbid: album.album_mbid,
        title: `${artist} — ${title}`,
        sub: `Local library · ${trackCount} tracks${matchedTrack}`,
        source: "local",
      };
    });
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
