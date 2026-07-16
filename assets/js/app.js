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

const audioPlayer = new Audio();
let playlist = []; 
let currentTrackIndex = 0;

const playBtn = document.createElement('button');
playBtn.id = 'control-play-btn';
playBtn.innerText = '▶️ Zene Lejátszása';
playBtn.style.cssText = 'display: none; padding: 15px 30px; background-color: #25D366; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 1.2em; margin: 20px auto;';
document.body.appendChild(playBtn);

document.getElementById('dropbox-chooser-btn').addEventListener('click', function() {
    
    const options = {
        // Átváltunk direct-re, hogy megkapjuk a kiterjesztett adatokat
        linkType: "direct", 
        multiselect: true,   
        extensions: ['.mp3', '.flac', '.m4a'], 
        
        success: function(files) {
            playlist = []; 
            currentTrackIndex = 0;

            console.log("=== DROPBOX HIVATALOS VÁLASZ ===");
            
            // Megnézzük az ELSŐ fájl teljes struktúráját, amit a Dropbox küldött
            // A konzolon látni fogjuk, hogy a Dropbox API beolvasta-e a tag-eket nekünk!
            console.log("Első fájl nyers adatai a Dropboxból:", files[0]);

            files.forEach(function(file) {
                // A direct linket is átírhatjuk raw-ra, ha szükséges a lejátszáshoz
                const directLink = file.link.replace('dl=0', 'raw=1');
                playlist.push({
                    name: file.name,
                    url: directLink
                });
            });

            // Megpróbáljuk kihalászni az MBID-t a Dropbox által küldött objektumban
            // Sok esetben a Dropbox a 'metadata' mezőben küld részleteket
            let mbid = null;
            if (files[0].metadata) {
                console.log("Dropbox belső metaadatok:", files[0].metadata);
            }

            // Mivel a CORS hibát kikerültük, azonnal mutathatjuk a gombot
            if (playlist.length > 0) {
                playBtn.innerText = `▶️ Lejátszás: ${playlist[0].name}`;
                playBtn.style.display = 'block';
            }
        },
        cancel: function() {
            console.log("Nem választottál ki zenét.");
        }
    };

    Dropbox.choose(options);
});

playBtn.addEventListener('click', function() {
    playTrack(currentTrackIndex);
    playBtn.style.display = 'none'; 
});

function playTrack(index) {
    if (index >= playlist.length) return;
    currentTrackIndex = index;
    const currentTrack = playlist[index];
    console.log(`🎶 Lejátszás: ${currentTrack.name}`);
    audioPlayer.src = currentTrack.url;
    audioPlayer.play().catch(err => console.error("Lejátszási hiba:", err));
    audioPlayer.onended = function() { playTrack(index + 1); };
}