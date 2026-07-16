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

// 1. Létrehozunk egy letisztult felületet a könyvtár betöltéséhez
const container = document.createElement('div');
container.id = 'library-container';
container.style.cssText = 'max-width: 800px; margin: 20px auto; padding: 20px; font-family: sans-serif;';
document.body.appendChild(container);

const controlsDiv = document.createElement('div');
controlsDiv.innerHTML = `
    <h3>🎵 MusiCards Release Player</h3>
    <p>Töltsd be a legenerált <code>library.json</code> fájlt a könyvtárad eléréséhez:</p>
    <input type="file" id="json-file-input" accept=".json" style="padding: 10px; border: 1px solid #ccc; border-radius: 5px; margin-bottom: 20px;">
`;
container.appendChild(controlsDiv);

const albumListDiv = document.createElement('div');
albumListDiv.id = 'album-list';
albumListDiv.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px;';
container.appendChild(albumListDiv);

// 2. Fájlbeolvasás eseménykezelője (Helyi vagy Dropboxból letöltött JSON-höz)
document.getElementById('json-file-input').addEventListener('change', function(e) {
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

// 3. Az albumlista kirajzolása a képernyőre
function renderAlbumLibrary(library) {
    albumListDiv.innerHTML = ''; // Kiürítjük a listát

    library.forEach((album, index) => {
        const albumCard = document.createElement('div');
        albumCard.style.cssText = 'border: 1px solid #ddd; border-radius: 8px; padding: 15px; text-align: center; background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.05); cursor: pointer; transition: transform 0.2s;';
        albumCard.innerHTML = `
            <div style="width: 100%; height: 150px; background: #eaeaea; border-radius: 4px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; font-weight: bold; color: #666;">
                📻 ALBUM
            </div>
            <strong style="display: block; font-size: 1.1em; margin-bottom: 5px;">${album.album_name}</strong>
            <span style="color: #666; font-size: 0.9em;">${album.artist_name}</span>
        `;

        // Ha rákattintunk egy album kártyára
        albumCard.addEventListener('click', () => {
            selectAndLoadAlbum(album);
        });

        albumListDiv.appendChild(albumCard);
    });
}

// 4. Album kiválasztása és összekötése a MusicBrainz Release Viewer-eddel
function selectAndLoadAlbum(album) {
    console.log("🎯 Kiválasztott album MBID:", album.album_mbid);
    
    // Ide ágyazzuk be a te meglévő MusicBrainz API hívásodat!
    // Pl: fetchReleaseDetails(album.album_mbid);
    alert(`Kiválasztottad: ${album.artist_name} - ${album.album_name}\nMusicBrainz ID: ${album.album_mbid}`);

    // Előkészítjük a lejátszási listát a library.json-ben lévő adatokból
    // Mivel egyelőre helyi / Dropbox relatív utakat használunk, meg kell adnunk az elérést.
    // Ha Dropbox streamet akarsz, a fájlokat le kell kérni a mappából, vagy a fix bázis URL-edhez fűzni.
    currentPlaylist = album.tracks.map(track => {
        return {
            title: track.title,
            // A lejátszási URL-t dinamikusan állítjuk össze attól függően, hogy local vagy Dropbox módban vagyunk
            url: track.filename 
        };
    });
    
    console.log("Lejátszási lista előkészítve:", currentPlaylist);
}