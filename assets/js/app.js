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

// 1. Létrehozzuk a globális lejátszót a háttérben
const audioPlayer = new Audio();
let playlist = []; // Ide mentjük a lejátszható dalokat

document.getElementById('dropbox-chooser-btn').addEventListener('click', function() {
    
    const options = {
        linkType: "preview", // Első körben jó a preview
        multiselect: true,   
        extensions: ['.mp3', '.flac', '.m4a'], 
        
        success: function(files) {
            console.log("=== DROPBOX LEJÁTSZÁS INDÍTÁSA ===");
            playlist = []; // Alaphelyzetbe állítjuk a listát

            files.forEach(function(file, index) {
                // A zseniális trükk: lecseréljük a link végén a dl=0-t raw=1-re
                const directLink = file.link.replace('dl=0', 'raw=1');
                
                // Elmentjük a dal adatait a belső lejátszási listánkba
                playlist.push({
                    name: file.name,
                    url: directLink
                });

                console.log(`${index + 1}. hozzáadva: ${file.name}`);
            });

            // Ha van a listában dal, azonnal elindítjuk az elsőt!
            if (playlist.length > 0) {
                playTrack(0);
            }
        },
        
        cancel: function() {
            console.log("Nem választottál ki zenét.");
        }
    };

    Dropbox.choose(options);
});

// 2. A lejátszó függvény
function playTrack(index) {
    if (index >= playlist.length) {
        console.log("A lejátszási lista végére értünk.");
        return;
    }

    const currentTrack = playlist[index];
    console.log(`🎶 Most játszott dal: ${currentTrack.name}`);
    console.log(`🔗 Link: ${currentTrack.url}`);

    // Betöltjük a közvetlen Dropbox linket a lejátszóba
    audioPlayer.src = currentTrack.url;
    
    // Elindítjuk a lejátszást
    audioPlayer.play()
        .then(() => {
            console.log("▶️ A lejátszás sikeresen elindult!");
        })
        .catch(err => {
            console.error("❌ Hiba a lejátszás során. Lehet, hogy a böngésző blokkolja az automatikus indítást?", err);
            alert("Kattints a képernyőre egyszer, hogy a böngésző engedélyezze a hang lejátszását!");
        });

    // Ha véget ér a szám, automatikusan jöhet a következő!
    audioPlayer.onended = function() {
        console.log("🎵 Szám véget ért, ugrás a következőre...");
        playTrack(index + 1);
    };
}