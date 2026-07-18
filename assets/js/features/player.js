/* ============================================================
   Local audio playback
   ============================================================ */

const audio = new Audio();
let objectUrl = "";
let currentIndex = -1;
let currentOut = null;
let currentTracks = [];
let miniPlayer = null;

const ICONS = {
  previous: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14M18 6l-8 6 8 6V6z"/></svg>`,
  play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM14 5h4v14h-4z"/></svg>`,
  next: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 5v14M6 6l8 6-8 6V6z"/></svg>`,
};

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function ensureMiniPlayer() {
  if (miniPlayer?.isConnected) return miniPlayer;

  miniPlayer = document.createElement("section");
  miniPlayer.className = "mini-player";
  miniPlayer.setAttribute("aria-label", "Now playing");
  miniPlayer.hidden = true;
  miniPlayer.innerHTML = `
    <div class="mini-player-controls">
      <button class="mini-player-button" type="button" data-player-action="previous" aria-label="Previous track">${ICONS.previous}</button>
      <button class="mini-player-button mini-player-toggle" type="button" data-player-action="toggle" aria-label="Play">${ICONS.play}</button>
      <button class="mini-player-button" type="button" data-player-action="next" aria-label="Next track">${ICONS.next}</button>
    </div>
    <div class="mini-player-main">
      <div class="mini-player-copy">
        <span class="mini-player-title"></span>
        <span class="mini-player-artist"></span>
      </div>
      <div class="mini-player-timeline">
        <input class="mini-player-progress" type="range" min="0" max="0" value="0" step="0.1" aria-label="Track position">
        <span class="mini-player-time">0:00 / 0:00</span>
      </div>
    </div>`;

  miniPlayer.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-player-action]")?.dataset.playerAction;
    if (action === "previous") playPreviousLocalTrack();
    if (action === "next") playNextLocalTrack();
    if (action === "toggle" && currentIndex >= 0) await playIndex(currentIndex);
  });

  miniPlayer.querySelector(".mini-player-progress").addEventListener("input", (event) => {
    const nextTime = Number(event.target.value);
    if (Number.isFinite(nextTime)) audio.currentTime = nextTime;
  });

  document.body.appendChild(miniPlayer);
  return miniPlayer;
}

function syncMiniPlayer() {
  const player = ensureMiniPlayer();
  const entry = currentTracks[currentIndex];
  const hasTrack = currentIndex >= 0 && !!entry?.localTrack?.file;

  player.hidden = !hasTrack;
  document.body.classList.toggle("has-mini-player", hasTrack);
  if (!hasTrack) return;

  const isPlaying = !audio.paused && !audio.ended;
  const toggle = player.querySelector(".mini-player-toggle");
  toggle.innerHTML = isPlaying ? ICONS.pause : ICONS.play;
  toggle.setAttribute("aria-label", isPlaying ? "Pause" : "Play");

  player.querySelector(".mini-player-title").textContent =
    entry.title || entry.localTrack.track?.title || entry.localTrack.file.name;
  player.querySelector(".mini-player-artist").textContent =
    entry.localTrack.album?.artist_name || "";

  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  const progress = player.querySelector(".mini-player-progress");
  progress.max = String(duration);
  progress.value = String(Math.min(currentTime, duration || currentTime));
  progress.style.setProperty(
    "--player-progress",
    duration ? `${(currentTime / duration) * 100}%` : "0%"
  );
  const time = player.querySelector(".mini-player-time");
  time.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  time.dataset.currentTime = formatTime(currentTime);
}

function releaseObjectUrl() {
  if (!objectUrl) return;
  URL.revokeObjectURL(objectUrl);
  objectUrl = "";
}

function syncPlayerUi() {
  if (currentOut) {
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
  syncMiniPlayer();
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

function playPreviousLocalTrack() {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (currentTracks[index]?.localTrack?.file) {
      playIndex(index);
      return;
    }
  }
  audio.currentTime = 0;
}

audio.addEventListener("play", syncPlayerUi);
audio.addEventListener("pause", syncPlayerUi);
audio.addEventListener("ended", playNextLocalTrack);
audio.addEventListener("timeupdate", syncMiniPlayer);
audio.addEventListener("durationchange", syncMiniPlayer);
audio.addEventListener("loadedmetadata", syncMiniPlayer);

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
