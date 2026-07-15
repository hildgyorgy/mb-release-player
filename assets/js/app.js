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

const audioPlayer = new Audio();
let playlist = []; 
let currentTrackIndex = 0;

// Létrehozunk egy Play gombot dinamikusan, de még elrejtjük
const playBtn = document.createElement('button');
playBtn.id = 'control-play-btn';
playBtn.innerText = '▶️ Zene Lejátszása';
playBtn.style.cssText = 'display: none; padding: 15px 30px; background-color: #25D366; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 1.2em; margin: 20px auto;';
document.body.appendChild(playBtn);

document.getElementById('dropbox-chooser-btn').addEventListener('click', function() {
    
    const options = {
        linkType: "preview", 
        multiselect: true,   
        extensions: ['.mp3', '.flac', '.m4a'], 
        
        success: function(files) {
            playlist = []; 
            currentTrackIndex = 0;

            files.forEach(function(file) {
                const directLink = file.link.replace('dl=0', 'raw=1');
                playlist.push({
                    name: file.name,
                    url: directLink
                });
            });

            if (playlist.length > 0) {
                console.log(`Betöltve ${playlist.length} dal. Várjuk az indítást...`);
                
                // Megjelenítjük a nagy zöld lejátszás gombot!
                playBtn.innerText = `▶️ Lejátszás: ${playlist[0].name}`;
                playBtn.style.display = 'block'; 
            }
        }
    };

    Dropbox.choose(options);
});

// Amikor a felhasználó rákattint a PLAY gombra, a böngésző engedni fogja a lejátszást!
playBtn.addEventListener('click', function() {
    playTrack(currentTrackIndex);
    // Ha elindult, elrejthetjük a gombot, vagy átírhatjuk "Szünet"-re
    playBtn.style.display = 'none'; 
});

function playTrack(index) {
    if (index >= playlist.length) {
        console.log("A lista végére értünk.");
        return;
    }

    currentTrackIndex = index;
    const currentTrack = playlist[index];
    console.log(`🎶 Lejátszás: ${currentTrack.name}`);

    audioPlayer.src = currentTrack.url;
    
    audioPlayer.play()
        .then(() => {
            console.log("▶️ Sikeresen megszólalt!");
        })
        .catch(err => {
            console.error("Hiba:", err);
        });

    audioPlayer.onended = function() {
        playTrack(index + 1);
    };
}