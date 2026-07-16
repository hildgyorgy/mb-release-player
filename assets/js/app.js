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

// A már meglévő Lejátszás gombunk
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
                console.log(`Betöltve ${playlist.length} dal. Metaadatok olvasása...`);
                
                // Megpróbáljuk beolvasni az első fájl tagjeit
                readTagsAndFetchRelease(playlist[0].url);
            }
        }
    };

    Dropbox.choose(options);
});

// Zene lejátszása gomb eseménye
playBtn.addEventListener('click', function() {
    playTrack(currentTrackIndex);
    playBtn.style.display = 'none'; 
});

// ÚJ FÜGGVÉNY: Metaadatok kiolvasása a Dropbox linkből
function readTagsAndFetchRelease(fileUrl) {
    console.log("📥 Fájl letöltése a memóriába a metaadatok olvasásához...");

    // 1. Letöltjük a teljes fájlt Blob-ként / ArrayBuffer-ként (ez kikerüli a CORS preflight hibát)
    fetch(fileUrl)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP hiba! Státusz: ${response.status}`);
            return response.blob(); // Letöltjük a teljes fájlt a memóriába
        })
        .then(blob => {
            console.log("✅ Fájl sikeresen letöltve. Metaadatok kibányászása...");

            // 2. Odaadjuk a memóriában lévő fájlt a jsmediatags-nek
            window.jsmediatags.read(blob, {
                onSuccess: function(tag) {
                    console.log("=== PONTOS METAADATOK BEOLVASVA ===");
                    console.log("Összes elérhető tag:", tag.tags);

                    // Kikeressük a garantáltan pontos MusicBrainz Album ID-t
                    let mbid = null;

                    // iTunes / .m4a formátum esetén az MBID-t gyakran egyedi atomokba menti a Picard
                    if (tag.tags.MUSICBRAINZ_ALBUMID) {
                        mbid = tag.tags.MUSICBRAINZ_ALBUMID;
                    } else if (tag.tags.ufid && tag.tags.ufid.description === 'http://musicbrainz.org') {
                        mbid = tag.tags.ufid.owner_identifier;
                    } else {
                        // Megnézzük, hátha a kiterjesztett (raw) tag-ek között van ott
                        // pl. XID vagy egyéb iTunes specifikus tagek
                        for (let key in tag.tags) {
                            if (key.toUpperCase().includes('MUSICBRAINZ_ALBUMID') || key.toUpperCase().includes('MUSICBRAINZ_RELEASEID')) {
                                mbid = tag.tags[key];
                                break;
                            }
                        }
                    }

                    if (mbid) {
                        console.log("🎯 Egzakt, hivatalos MBID megtalálva a fájlban:", mbid);
                        alert(`Talált pontos MBID: ${mbid}`);
                        // Itt fogjuk meghívni a betöltő függvényedet!
                    } else {
                        console.error("❌ A fájl nem tartalmaz hivatalos MusicBrainz Album ID-t.");
                        alert("Hiba: Ez a fájl nincs megcímkézve MusicBrainz ID-val!");
                    }

                    showPlayButton();
                },
                onError: function(error) {
                    console.error("❌ Hiba a helyi tag-olvasás során:", error.type, error.info);
                    showPlayButton();
                }
            });
        })
        .catch(error => {
            console.error("❌ Nem sikerült letölteni a fájlt:", error);
            showPlayButton();
        });
}

function showPlayButton() {
    if (playlist.length > 0) {
        playBtn.innerText = `▶️ Lejátszás: ${playlist[0].name}`;
        playBtn.style.display = 'block';
    }
}

function playTrack(index) {
    if (index >= playlist.length) {
        console.log("A lista végére értünk.");
        return;
    }

    currentTrackIndex = index;
    const currentTrack = playlist[index];
    console.log(`🎶 Lejátszás: ${currentTrack.name}`);

    audioPlayer.src = currentTrack.url;
    audioPlayer.play().catch(err => console.error("Hiba:", err));

    audioPlayer.onended = function() {
        playTrack(index + 1);
    };
}