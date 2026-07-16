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
  },
});

document.addEventListener("DOMContentLoaded", App.init);

// ------------------------------
// Audio player for Dropbox music files
// ------------------------------

// Globális változók a könyvtárnak és a lejátszónak
let musicLibrary = [];
const audioPlayer = new Audio();
let currentPlaylist = [];
let currentTrackIndex = 0;

// Megkeressük a HTML-ben már létező elemeket
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

    library.forEach((album, index) => {
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
    
    // 1. Megjelenítjük a felületen, hogy mi töltődik be
    alert(`Kiválasztottad: ${album.artist_name} - ${album.album_name}\nMusicBrainz ID: ${album.album_mbid}`);

    // 2. ITT fogod meghívni a te már létező MusicBrainz betöltődet!
    // fetchReleaseDetails(album.album_mbid); 

    // 3. Előkészítjük a lejátszási listát a library.json-ben lévő adatokból
    currentPlaylist = album.tracks.map(track => {
        return {
            title: track.title,
            filename: track.filename
        };
    });
    
    console.log("Helyi lejátszási lista előkészítve:", currentPlaylist);
}export const App = Object.freeze({
  init() {
    applyTheme(getPreferredTheme());
    bindThemeToggleOnce(document);

    const emptyStateHtml = document.getElementById("emptyState")?.outerHTML || "";

    const Nav = createReleaseNavigator({
      getOut: () => document.getElementById("out"),
      loadRelease,
      renderReleasePage: (out, data) =>
        renderReleasePage(out, data,
          async (rgId) => {
            try {
              const release = await loadFirstReleaseOfGroup(rgId);
              if (release?.id) await goByMbidWrapped(release.id);
            } catch (err) {
              console.warn("Could not navigate to release group:", err);
            }
          },
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

    // Ez a kulcsfontosságú függvényünk!
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

      if (out) out.innerHTML = emptyStateHtml;
      if (omni) {
        omni.value = "";
        omni.classList.remove("is-loaded");
      }
      history.replaceState({}, "", window.location.pathname);
    });

    bootFromUrl({ onGoByMbid: goByMbidWrapped });

    // ============================================================
    // AUDIO PLAYER & LOCAL LIBRARY INTEGRATION (Ide költöztetve)
    // ============================================================
    
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
        albumListDiv.innerHTML = '';

        library.forEach((album) => {
            const albumCard = document.createElement('div');
            albumCard.style.cssText = 'border: 1px solid #e0e0e0; border-radius: 12px; padding: 20px; text-align: center; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.05); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;';
            
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

            albumCard.addEventListener('click', () => {
                selectAndLoadAlbum(album);
            });

            albumListDiv.appendChild(albumCard);
        });
    }

    // 3. Album kiválasztása és betöltése
    function selectAndLoadAlbum(album) {
        console.log("🎯 Kiválasztott album MBID:", album.album_mbid);
        
        // Elindítjuk az app saját betöltési folyamatát az MBID-vel!
        if (album.album_mbid) {
            goByMbidWrapped(album.album_mbid);
        } else {
            console.warn("Ehhez az albumhoz nincs rögzítve MBID!");
        }

        // Helyi lejátszási lista előkészítése
        currentPlaylist = album.tracks.map(track => {
            return {
                title: track.title,
                filename: track.filename
            };
        });
        
        console.log("Helyi lejátszási lista előkészítve:", currentPlaylist);
    }

  }, // init vége
});