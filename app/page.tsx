"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Reciter = {
  id: string;
  name: string;
  // Template should return a playable URL for surah+ayah (3 digits each is common, but depends on your provider)
  // You MUST use sources you have permission to stream.
  urlForAyah: (surah: number, ayah: number) => string;
  attribution?: string;
};

type Ayah = { surah: number; ayah: number; arabic: string };

const SURAH = 3; // Āl-ʿImrān
const RANGE_START = 1;
const RANGE_END = 9;

// Because you replied "9" — we’ll default to starting at ayah 9.
const DEFAULT_START_AYAH = 9;

// Minimal Arabic text for 3:1–9 (Uthmani-style-ish; you can replace with a verified text dataset)
const AYAT_3_1_TO_9: Ayah[] = [
  { surah: 3, ayah: 1, arabic: "الم" },
  { surah: 3, ayah: 2, arabic: "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ" },
  { surah: 3, ayah: 3, arabic: "نَزَّلَ عَلَيْكَ الْكِتَابَ بِالْحَقِّ مُصَدِّقًا لِمَا بَيْنَ يَدَيْهِ وَأَنْزَلَ التَّوْرَاةَ وَالْإِنْجِيلَ" },
  { surah: 3, ayah: 4, arabic: "مِنْ قَبْلُ هُدًى لِلنَّاسِ وَأَنْزَلَ الْفُرْقَانَ ۗ إِنَّ الَّذِينَ كَفَرُوا بِآيَاتِ اللَّهِ لَهُمْ عَذَابٌ شَدِيدٌ ۗ وَاللَّهُ عَزِيزٌ ذُو انْتِقَامٍ" },
  { surah: 3, ayah: 5, arabic: "إِنَّ اللَّهَ لَا يَخْفَىٰ عَلَيْهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ" },
  { surah: 3, ayah: 6, arabic: "هُوَ الَّذِي يُصَوِّرُكُمْ فِي الْأَرْحَامِ كَيْفَ يَشَاءُ ۚ لَا إِلَٰهَ إِلَّا هُوَ الْعَزِيزُ الْحَكِيمُ" },
  { surah: 3, ayah: 7, arabic: "هُوَ الَّذِي أَنْزَلَ عَلَيْكَ الْكِتَابَ مِنْهُ آيَاتٌ مُحْكَمَاتٌ هُنَّ أُمُّ الْكِتَابِ وَأُخَرُ مُتَشَابِهَاتٌ ۖ فَأَمَّا الَّذِينَ فِي قُلُوبِهِمْ زَيْغٌ فَيَتَّبِعُونَ مَا تَشَابَهَ مِنْهُ ابْتِغَاءَ الْفِتْنَةِ وَابْتِغَاءَ تَأْوِيلِهِ ۗ وَمَا يَعْلَمُ تَأْوِيلَهُ إِلَّا اللَّهُ ۗ وَالرَّاسِخُونَ فِي الْعِلْمِ يَقُولُونَ آمَنَّا بِهِ كُلٌّ مِنْ عِنْدِ رَبِّنَا ۗ وَمَا يَذَّكَّرُ إِلَّا أُولُو الْأَلْبَابِ" },
  { surah: 3, ayah: 8, arabic: "رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِنْ لَدُنْكَ رَحْمَةً ۚ إِنَّكَ أَنْتَ الْوَهَّابُ" },
  { surah: 3, ayah: 9, arabic: "رَبَّنَا إِنَّكَ جَامِعُ النَّاسِ لِيَوْمٍ لَا رَيْبَ فِيهِ ۚ إِنَّ اللَّهَ لَا يُخْلِفُ الْمِيعَادَ" }
];

// IMPORTANT: Replace these URL templates with a provider you are allowed to stream.
// Many providers store audio as: /{surah:03}{ayah:03}.mp3 or /{surah:03}/{ayah:03}.mp3 etc.
function pad3(n: number) {
  return String(n).padStart(3, "0");
}

const RECITERS: Reciter[] = [
  {
    id: "reciter1",
    name: "Mishary (template)",
    urlForAyah: (s, a) => `https://YOUR-ALLOWED-AUDIO-HOST/mishary/${pad3(s)}${pad3(a)}.mp3`,
    attribution: "Audio streamed via your licensed/allowed host."
  },
  {
    id: "reciter2",
    name: "AbdulBasit (template)",
    urlForAyah: (s, a) => `https://YOUR-ALLOWED-AUDIO-HOST/abdulbasit/${pad3(s)}${pad3(a)}.mp3`,
    attribution: "Audio streamed via your licensed/allowed host."
  },
  {
    id: "reciter3",
    name: "Al-Husary (template)",
    urlForAyah: (s, a) => `https://YOUR-ALLOWED-AUDIO-HOST/husary/${pad3(s)}${pad3(a)}.mp3`,
    attribution: "Audio streamed via your licensed/allowed host."
  }
];

type RepeatMode = "off" | "one" | "range";

export default function Page() {
  const ayat = useMemo(() => AYAT_3_1_TO_9, []);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [reciterId, setReciterId] = useState(RECITERS[0].id);
  const reciter = useMemo(() => RECITERS.find(r => r.id === reciterId)!, [reciterId]);

  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = ayat.findIndex(x => x.ayah === DEFAULT_START_AYAH);
    return idx >= 0 ? idx : 0;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("range");
  const [rate, setRate] = useState(1);

  // Range repeat boundaries (1–9 by default)
  const [rangeStart, setRangeStart] = useState(RANGE_START);
  const [rangeEnd, setRangeEnd] = useState(RANGE_END);

  const currentAyah = ayat[currentIndex];

  const currentUrl = useMemo(() => {
    return reciter.urlForAyah(currentAyah.surah, currentAyah.ayah);
  }, [reciter, currentAyah]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = rate;
  }, [rate]);

  // When reciter changes, keep index but reload audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = currentUrl;
    if (isPlaying) void audio.play();
  }, [currentUrl, isPlaying]);

  function withinRange(ayahNum: number) {
    return ayahNum >= rangeStart && ayahNum <= rangeEnd;
  }

  function goToAyah(ayahNum: number) {
    const idx = ayat.findIndex(a => a.ayah === ayahNum);
    if (idx >= 0) setCurrentIndex(idx);
  }

  function next() {
    const nextIndex = Math.min(currentIndex + 1, ayat.length - 1);
    setCurrentIndex(nextIndex);
  }

  function prev() {
    const prevIndex = Math.max(currentIndex - 1, 0);
    setCurrentIndex(prevIndex);
  }

  async function play() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = currentUrl;
    audio.playbackRate = rate;
    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
      alert("Audio failed to play. Check your audio URL template / permissions / CORS.");
    }
  }

  function pause() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
  }

  // Auto-advance / repeat logic
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      const ayahNum = currentAyah.ayah;

      if (repeatMode === "one") {
        audio.currentTime = 0;
        void audio.play();
        return;
      }

      if (repeatMode === "range") {
        // If we're outside the range, jump into it
        if (!withinRange(ayahNum)) {
          goToAyah(rangeStart);
          return;
        }
        // If at end, loop to start
        if (ayahNum === rangeEnd) {
          goToAyah(rangeStart);
          return;
        }
        // Else go next ayah
        goToAyah(ayahNum + 1);
        return;
      }

      // repeat off: advance until end
      if (currentIndex < ayat.length - 1) setCurrentIndex(currentIndex + 1);
      else setIsPlaying(false);
    };

    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [currentAyah, repeatMode, rangeStart, rangeEnd, currentIndex, ayat.length]);

  // When currentIndex changes during playing, start next automatically
  useEffect(() => {
    if (!isPlaying) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = currentUrl;
    audio.playbackRate = rate;
    void audio.play();
  }, [currentIndex]);

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 4 }}>Qur’an Recitation</h1>
      <div style={{ opacity: 0.8, marginBottom: 16 }}>
        <div><b>Surah:</b> Āl-ʿImrān (3)</div>
        <div><b>Range:</b> {RANGE_START}–{RANGE_END} (Defaults start at <b>ayah {DEFAULT_START_AYAH}</b>)</div>
      </div>

      <section style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr" }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}><b>Reciter</b></label>
          <select
            value={reciterId}
            onChange={(e) => setReciterId(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10 }}
          >
            {RECITERS.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          {reciter.attribution && (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              {reciter.attribution}
            </div>
          )}
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {!isPlaying ? (
              <button onClick={play} style={btnStyle}>Play</button>
            ) : (
              <button onClick={pause} style={btnStyle}>Pause</button>
            )}
            <button onClick={prev} style={btnStyle}>Prev</button>
            <button onClick={next} style={btnStyle}>Next</button>

            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ fontSize: 14 }}>Speed</label>
              <select value={rate} onChange={(e) => setRate(Number(e.target.value))} style={{ padding: 8, borderRadius: 10 }}>
                {[0.75, 1, 1.25, 1.5].map(v => <option key={v} value={v}>{v}x</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ fontSize: 14 }}><b>Repeat</b></label>
            <select
              value={repeatMode}
              onChange={(e) => setRepeatMode(e.target.value as RepeatMode)}
              style={{ padding: 8, borderRadius: 10 }}
            >
              <option value="off">Off</option>
              <option value="one">This ayah</option>
              <option value="range">Range</option>
            </select>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ fontSize: 14 }}>From</label>
              <input
                type="number"
                min={RANGE_START}
                max={RANGE_END}
                value={rangeStart}
                onChange={(e) => setRangeStart(Number(e.target.value))}
                style={numStyle}
              />
              <label style={{ fontSize: 14 }}>To</label>
              <input
                type="number"
                min={RANGE_START}
                max={RANGE_END}
                value={rangeEnd}
                onChange={(e) => setRangeEnd(Number(e.target.value))}
                style={numStyle}
              />
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
            <div><b>Now:</b> 3:{currentAyah.ayah}</div>
            <div style={{ wordBreak: "break-all" }}><b>URL:</b> {currentUrl}</div>
          </div>

          <audio ref={audioRef} />
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>Āyāt (1–9)</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {ayat.map((a, idx) => {
              const active = idx === currentIndex;
              return (
                <button
                  key={`${a.surah}:${a.ayah}`}
                  onClick={() => setCurrentIndex(idx)}
                  style={{
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 12,
                    border: active ? "2px solid #000" : "1px solid #ddd",
                    background: active ? "#f3f3f3" : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontSize: 14, opacity: 0.75 }}>3:{a.ayah}</div>
                    <div style={{ fontSize: 20, direction: "rtl", textAlign: "right", flex: 1 }}>
                      {a.arabic}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
          <b>Licensing:</b> This app is a player. You must configure reciter audio URLs from a source you’re permitted to stream/use.
        </div>
      </section>
    </main>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
};

const numStyle: React.CSSProperties = {
  width: 80,
  padding: 8,
  borderRadius: 10,
  border: "1px solid #ddd",
};
