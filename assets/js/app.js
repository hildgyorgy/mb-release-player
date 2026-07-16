/* ============================================================
   App entry (ES modules)
   ============================================================ */

import { bootFromUrl } from "./core/boot.js";
import { createReleaseNavigator } from "./services/navigation.js";
import { applyTheme, getPreferredTheme, bindThemeToggleOnce } from "./ui/theme.js";
import { createSearchController } from "./ui/searchController.js";

import { loadRelease, loadFirstReleaseOfGroup } from "./services/api.js";
import { renderReleasePage } from "./features/releasePage.js";

import { createMobileHeaderController } from "./ui/mobileHeader.js";

// ------------------------------
// Loading / navigation
// ------------------------------

async function goFallback() {
  // Reserved fallback hook for empty searches.
}

// Globális állapot a lejátszónak (Az initen kívülre helyezve, hogy globálisan elérhető legyen)
let musicLibrary = [];
let currentPlaylist = [];
let currentTrackIndex = 0;

// ------------------------------
// App init
// ------------------------------
export const App = Object.freeze({
  init() {
    applyTheme(getPreferredTheme());
    bindThemeToggleOnce(document);

    const emptyStateHtml = document.getElementById("emptyState")?.outerHTML || "";

    const Nav = createReleaseNavigator({
      getOut: () => document.getElementById("out"),
      loadRelease,

      // Wrap renderReleasePage to inject the onLoadRelease callback
      // so the artist panel discography can navigate to a release
      renderReleasePage: (out, data) =>
        renderReleasePage(out, data,
          // onLoadRelease: artist panel passes a release GROUP id
          async (rgId) => {
            try {
              const release = await loadFirstReleaseOfGroup(rgId);
              if (release?.id) await goByMbidWrapped(release.id);
            } catch (err) {
              console.warn("Could not navigate to release group:", err);
            }
          },
          // onNavigateToRelease: versions tab passes a release id directly
          async (releaseId) => {
            try {
              await goByMbidWrapped(releaseId);
            } catch (err) {
              console.warn("Could not navigate to release:", err);
            }
          }
        ),
    });

    const MobileHdr = createMobileHeaderController();
    MobileHdr.bind();

    const goByMbidWrapped = async (mbid) => {
      await Nav.goByMbid(mbid);
      MobileHdr.onReleaseLoaded();
    };

    const Search = createSearchController({
      onGoByMbid: goByMbidWrapped,
      onGoFallback: goFallback,
    });
    Search.init();

    const homeLink = document.getElementById("homeLink");
    homeLink?.addEventListener("click", () => {
      const out = document.getElementById("out");
      const omni = document.getElementById("omni");

      if (out) {
        out.innerHTML = emptyStateHtml;
      }

      if (omni) {
        omni.value = "";
        omni.classList.remove("is-loaded");
      }

      history.replaceState({}, "", window.location.pathname);
    });

    bootFromUrl({ onGoByMbid: goByMbidWrapped });

    // ============================================================
    // LOCAL LIBRARY & PLAY BUTTON INTEGRATION
    // ============================================================
    setupLibraryAndPlayer(goByMbidWrapped);
  },
});

/**
 * Könyvtárkezelő és Lejátszó inicializálása
 */
function setupLibraryAndPlayer(goByMbidWrapped) {
    const jsonFileInput = document.getElementById('json-file-input');
    const albumListDiv = document.getElementById('album-list');

    if (!jsonFileInput) {
        console.error("❌ Hiba: A 'json-file-input' ID-jú elem nem található a DOM-ban!");
        return;
    }

    console.log("🚀 Könyvtárkezelő sikeresen inicializálva!");

    // 1. JSON fájl betöltése
    jsonFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                musicLibrary = JSON.parse(evt.target.result);
                console.log("🎯 Könyvtár sikeresen betöltve! Albumok száma:", musicLibrary.length);
                renderAlbumLibrary(musicLibrary, albumListDiv, goByMbidWrapped);
            } catch (err) {
                alert("Hiba a JSON fájl beolvasásakor! Biztosan megfelelő formátumú fájlt választottad?");
                console.error("JSON parszolási hiba:", err);
            }
        };
        reader.readAsText(file);
    });

    // 2. Play gomb delegált eseménykezelője a teljes dokumentumra (Globális delegáció)
    // Így ha az #out konténer tartalma dinamikusan újra is generálódik, a kattintás megmarad!
    document.addEventListener("click", (e) => {
        const playBtn = e.target.closest(".track-play-btn");
        if (playBtn) {
            e.preventDefault();
            e.stopPropagation();

            const trackIdx = parseInt(playBtn.getAttribute("data-track-index"), 10);

            if (currentPlaylist && currentPlaylist[trackIdx]) {
                currentTrackIndex = trackIdx;
                const trackToPlay = currentPlaylist[currentTrackIndex];
                console.log("▶ Lejátszás indítása:", trackToPlay.title);
                
                alert(`Most lejátszandó fájl: ${trackToPlay.filename}`);
            } else {
                alert("Ehhez a számhoz nincs betöltött helyi lejátszási lista! Kérlek, előbb kattints az egyik albumra a saját könyvtáradban.");
            }
        }
    });
}

/**
 * Album kártyák kirajzolása
 */
function renderAlbumLibrary(library, container, goByMbidWrapped) {
    if (!container) return;
    container.innerHTML = ''; 

    library.forEach((album) => {
        const albumCard = document.createElement('div');
        albumCard.className = "album-card";
        albumCard.style.cssText = 'border: 1px solid var(--border); border-radius: 12px; padding: 20px; text-align: center; background: var(--panel); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;';
        
        albumCard.onmouseover = () => {
            albumCard.style.transform = 'translateY(-5px)';
            albumCard.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)';
        };
        albumCard.onmouseout = () => {
            albumCard.style.transform = 'translateY(0)';
            albumCard.style.boxShadow = 'none';
        };

        albumCard.innerHTML = `
            <div style="width: 100%; height: 160px; background: var(--panel-2); border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 15px; font-size: 2.5em;">
                💿
            </div>
            <strong style="display: block; font-size: 1.1em; margin-bottom: 5px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${album.album_name}</strong>
            <span style="color: var(--meta); font-size: 0.9em; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${album.artist_name}</span>
        `;

        albumCard.addEventListener('click', () => {
            console.log("🎯 Kiválasztott album MBID:", album.album_mbid);
            
            if (album.album_mbid) {
                goByMbidWrapped(album.album_mbid);
            } else {
                console.warn("Ehhez az albumhoz nincs rögzítve MBID!");
            }

            // Playlist feltöltése
            if (album.tracks) {
                currentPlaylist = album.tracks.map(track => ({
                    title: track.title,
                    filename: track.filename
                }));
                console.log("Helyi lejátszási lista előkészítve:", currentPlaylist);
            }
        });

        container.appendChild(albumCard);
    });
}

// Csak akkor indul el az App.init, ha a teljes DOM betöltődött
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", App.init);
} else {
    App.init();
}