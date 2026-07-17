/* ============================================================
   Local library: user-approved folder access and file registry
   ============================================================ */

let selectedFilesByPath = new Map();

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

function statusText(count) {
  return count
    ? `${count.toLocaleString()} files available from the selected folder.`
    : "No local music folder selected.";
}

export function getLocalFile(relativePath) {
  return selectedFilesByPath.get(String(relativePath || "")) || null;
}

export function bindLocalLibraryPicker(root = document) {
  const button = root.getElementById("openMusicFolder");
  const input = root.getElementById("musicFolderInput");
  const status = root.getElementById("musicFolderStatus");

  if (!button || !input || !status || button.dataset.bound === "1") return;
  button.dataset.bound = "1";
  status.textContent = statusText(selectedFilesByPath.size);

  button.addEventListener("click", () => input.click());

  input.addEventListener("change", () => {
    const count = storeSelectedFiles(input.files);
    status.textContent = statusText(count);
  });
}
