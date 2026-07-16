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
    // AUDIO PLAYER & LOCAL LIBRARY INTEGRATION (Dinamikus DOM eléréssel)
    // ============================================================
    let musicLibrary = [];
    const audioPlayer = new Audio();
    let currentPlaylist = [];
    let currentTrackIndex = 0;

    // Az elemeket csak itt, az init futásakor kérjük le!
    const jsonFileInput = document.getElementById('json-file-input');
    const albumListDiv = document.getElementById('album-list');

    // 1. Fájlbeolvasás eseménykezelője
    if (jsonFileInput) {
        jsonFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(evt) {
                try {
                    musicLibrary = JSON.parse(evt.target.result);
                    console.log("🎯 Könyvtár sikeresen betöltve! Albumok száma:", musicLibrary.length);
                    renderAlbumLibrary(musicLibrary);
                } catch (err) {
                    alert("Hiba a JSON fájl beolvasásakor! Biztosan a jó fájlt választottad?");
                    console.error(err);
                }
            };
            reader.readAsText(file);
        });
    }

    // 2. Az albumlista kirajzolása a képernyőre
    function renderAlbumLibrary(library) {
        if (!albumListDiv) return;
        albumListDiv.innerHTML = ''; // Kiürítjük a korábbi listát (ha volt)

        library.forEach((album) => {
            const albumCard = document.createElement('div');
            // Kicsit formába hozzuk az album kártyákat, hogy jól mutassanak
            albumCard.style.cssText = 'border: 1px solid #e0e0e0; border-radius: 12px; padding: 20px; text-align: center; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.05); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;';
            
            // Egy kis hover effekt, hogy érezze a user, hogy kattintható
            albumCard.onmouseover = () => {
                albumCard.style.transform = 'translateY(-5px)';
                albumCard.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)';
            };
            albumCard.onmouseout = () => {
                albumCard.style.transform = 'translateY(0)';
                albumCard.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
            };

            albumCard.innerHTML = `
                <div style="width: 100%; height: 160px; background: #f0f0f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 15px; font-size: 2.5em;">
                    💿
                </div>
                <strong style="display: block; font-size: 1.1em; margin-bottom: 5px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${album.album_name}</strong>
                <span style="color: #666; font-size: 0.9em; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${album.artist_name}</span>
            `;

            // Ha rákattintunk az albumra
            albumCard.addEventListener('click', () => {
                selectAndLoadAlbum(album);
            });

            albumListDiv.appendChild(albumCard);
        });
    }

    // 3. Album kiválasztása és összekötése a MusicBrainz-zel
    function selectAndLoadAlbum(album) {
        console.log("🎯 Kiválasztott album MBID:", album.album_mbid);
        
        // 1. Elindítjuk az app saját betöltési folyamatát az MBID-vel!
        if (album.album_mbid) {
            goByMbidWrapped(album.album_mbid);
        } else {
            console.warn("Ehhez az albumhoz nincs rögzítve MBID!");
        }

        // 2. Előkészítjük a lejátszási listát a library.json-ben lévő adatokból
        currentPlaylist = album.tracks.map(track => {
            return {
                title: track.title,
                filename: track.filename
            };
        });
        
        console.log("Helyi lejátszási lista előkészítve:", currentPlaylist);
    }

    // 4. Play gombra való kattintás delegálása (Apple Music-féle lejátszás)
    const outContainer = document.getElementById("out");
    if (outContainer) {
        outContainer.addEventListener("click", (e) => {
            const playBtn = e.target.closest(".track-play-btn");
            if (playBtn) {
                // Megállítjuk az eseményt, hogy ne nyíljon le a trackdetails panel!
                e.stopPropagation();

                const trackIdx = parseInt(playBtn.dataset.trackIndex, 10);

                if (currentPlaylist && currentPlaylist[trackIdx]) {
                    currentTrackIndex = trackIdx;
                    const trackToPlay = currentPlaylist[currentTrackIndex];
                    console.log("▶ Lejátszás indítása:", trackToPlay.title);
                    
                    alert(`Most lejátszandó fájl: ${trackToPlay.filename}`);
                    
                    // Ide teheted majd a konkrét audio lejátszó integrációdat:
                    // audioPlayer.src = trackToPlay.filename; (vagy Dropbox link)
                    // audioPlayer.play();
                } else {
                    alert("Ehhez a számhoz nincs betöltött helyi lejátszási lista!");
                }
            }
        });
    }
  },
});

// Csak akkor indul el az App.init, ha a teljes DOM betöltődött
document.addEventListener("DOMContentLoaded", App.init);