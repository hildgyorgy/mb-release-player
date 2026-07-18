/* ============================================================
   Local audio playback
   ============================================================ */

const audio = new Audio();
let objectUrl = "";
let currentIndex = -1;
let currentOut = null;
let currentTracks = [];

function releaseObjectUrl() {
  if (!objectUrl) return;
  URL.revokeObjectURL(objectUrl);
  objectUrl = "";
}

function syncPlayerUi() {
  if (!currentOut) return;

  currentOut.querySelectorAll(".track-play").forEach((button) => {
    const index = Number(button.dataset.playTrack);
    const isCurrent = index === currentIndex;
    const isPlaying = isCurrent && !audio.paused && !audio.ended;
    const row = button.closest("tr.track");

    button.classList.toggle("is-current", isCurrent);
    button.classList.toggle("is-playing", isPlaying);
    button.setAttribute("aria-label", isPlaying ? "Pause track" : "Play track");
    button.setAttribute("title", isPlaying ? "Pause" : "Play");
    row?.classList.toggle("is-current", isCurrent);
    row?.classList.toggle("is-playing", isPlaying);
  });
}

function clearCurrentPlayback() {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  releaseObjectUrl();
  currentIndex = -1;
  syncPlayerUi();
}

async function playIndex(index) {
  const entry = currentTracks[index];
  const file = entry?.localTrack?.file;
  if (!file) return;

  if (currentIndex === index) {
    try {
      if (audio.paused) await audio.play();
      else audio.pause();
    } catch (error) {
      console.warn("Could not resume local track:", error);
      clearCurrentPlayback();
    }
    return;
  }

  audio.pause();
  releaseObjectUrl();

  objectUrl = URL.createObjectURL(file);
  currentIndex = index;
  audio.src = objectUrl;
  syncPlayerUi();

  try {
    await audio.play();
  } catch (error) {
    console.warn("Could not play local track:", error);
    clearCurrentPlayback();
  }
}

function playNextLocalTrack() {
  for (let index = currentIndex + 1; index < currentTracks.length; index += 1) {
    if (currentTracks[index]?.localTrack?.file) {
      playIndex(index);
      return;
    }
  }

  clearCurrentPlayback();
}

audio.addEventListener("play", syncPlayerUi);
audio.addEventListener("pause", syncPlayerUi);
audio.addEventListener("ended", playNextLocalTrack);

export function bindTrackPlayback(out, flatTracks) {
  clearCurrentPlayback();
  currentOut = out;
  currentTracks = flatTracks;

  out.querySelectorAll(".track-play").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const index = Number(button.dataset.playTrack);
      if (Number.isInteger(index)) await playIndex(index);
    });
  });

  syncPlayerUi();
}
