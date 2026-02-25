import React, { useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView, View, Text, Pressable, FlatList, StyleSheet, Platform } from "react-native";
import { Audio } from "expo-av";
import { Picker } from "@react-native-picker/picker";

type Ayah = { surah: number; ayah: number; arabic: string };
type RepeatMode = "off" | "one" | "range";

type Reciter = {
  id: string;
  name: string;
  urlForAyah: (surah: number, ayah: number) => string;
  attribution?: string;
};

const SURAH = 3; // Āl-ʿImrān
const RANGE_START = 1;
const RANGE_END = 9;

// change this to 1 if you want start at ayah 1
const DEFAULT_START_AYAH = 1;

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

// Replace with your permitted audio host/provider templates.
const RECITERS: Reciter[] = [
  {
    id: "mishary",
    name: "Mishary (template)",
    urlForAyah: (s, a) => `https://YOUR-ALLOWED-AUDIO-HOST/mishary/${pad3(s)}${pad3(a)}.mp3`,
    attribution: "Streamed via your allowed source.",
  },
  {
    id: "abdulbasit",
    name: "AbdulBasit (template)",
    urlForAyah: (s, a) => `https://YOUR-ALLOWED-AUDIO-HOST/abdulbasit/${pad3(s)}${pad3(a)}.mp3`,
    attribution: "Streamed via your allowed source.",
  },
  {
    id: "husary",
    name: "Al-Husary (template)",
    urlForAyah: (s, a) => `https://YOUR-ALLOWED-AUDIO-HOST/husary/${pad3(s)}${pad3(a)}.mp3`,
    attribution: "Streamed via your allowed source.",
  },
];

const AYAT_3_1_TO_9: Ayah[] = [
  { surah: 3, ayah: 1, arabic: "الم" },
  { surah: 3, ayah: 2, arabic: "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ" },
  { surah: 3, ayah: 3, arabic: "نَزَّلَ عَلَيْكَ الْكِتَابَ بِالْحَقِّ مُصَدِّقًا لِمَا بَيْنَ يَدَيْهِ وَأَنْزَلَ التَّوْرَاةَ وَالْإِنْجِيلَ" },
  { surah: 3, ayah: 4, arabic: "مِنْ قَبْلُ هُدًى لِلنَّاسِ وَأَنْزَلَ الْفُرْقَانَ ۗ إِنَّ الَّذِينَ كَفَرُوا بِآيَاتِ اللَّهِ لَهُمْ عَذَابٌ شَدِيدٌ ۗ وَاللَّهُ عَزِيزٌ ذُو انْتِقَامٍ" },
  { surah: 3, ayah: 5, arabic: "إِنَّ اللَّهَ لَا يَخْفَىٰ عَلَيْهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ" },
  { surah: 3, ayah: 6, arabic: "هُوَ الَّذِي يُصَوِّرُكُمْ فِي الْأَرْحَامِ كَيْفَ يَشَاءُ ۚ لَا إِلَٰهَ إِلَّا هُوَ الْعَزِيزُ الْحَكِيمُ" },
  { surah: 3, ayah: 7, arabic: "هُوَ الَّذِي أَنْزَلَ عَلَيْكَ الْكِتَابَ مِنْهُ آيَاتٌ مُحْكَمَاتٌ هُنَّ أُمُّ الْكِتَابِ وَأُخَرُ مُتَشَابِهَاتٌ ۖ ..." },
  { surah: 3, ayah: 8, arabic: "رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِنْ لَدُنْكَ رَحْمَةً ۚ إِنَّكَ أَنْتَ الْوَهَّابُ" },
  { surah: 3, ayah: 9, arabic: "رَبَّنَا إِنَّكَ جَامِعُ النَّاسِ لِيَوْمٍ لَا رَيْبَ فِيهِ ۚ إِنَّ اللَّهَ لَا يُخْلِفُ الْمِيعَادَ" },
];

export default function App() {
  const ayat = useMemo(() => AYAT_3_1_TO_9, []);
  const [reciterId, setReciterId] = useState(RECITERS[0].id);
  const reciter = useMemo(() => RECITERS.find(r => r.id === reciterId)!, [reciterId]);

  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = ayat.findIndex(a => a.ayah === DEFAULT_START_AYAH);
    return idx >= 0 ? idx : 0;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("range");
  const [rate, setRate] = useState(1);

  const [rangeStart, setRangeStart] = useState(RANGE_START);
  const [rangeEnd, setRangeEnd] = useState(RANGE_END);

  const soundRef = useRef<Audio.Sound | null>(null);

  const currentAyah = ayat[currentIndex];
  const currentUrl = reciter.urlForAyah(currentAyah.surah, currentAyah.ayah);

  function withinRange(ayahNum: number) {
    return ayahNum >= rangeStart && ayahNum <= rangeEnd;
  }

  function indexByAyah(ayahNum: number) {
    return ayat.findIndex(a => a.ayah === ayahNum);
  }

  async function unload() {
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
  }

  async function playCurrent() {
    await unload();

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: currentUrl },
        { shouldPlay: true, rate, shouldCorrectPitch: true },
        onPlaybackStatusUpdate
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
      alert("Audio failed to play. Check URL template / permissions / CORS / network.");
    }
  }

  async function pause() {
    if (!soundRef.current) return;
    await soundRef.current.pauseAsync();
    setIsPlaying(false);
  }

  async function resume() {
    if (!soundRef.current) return;
    await soundRef.current.setRateAsync(rate, true);
    await soundRef.current.playAsync();
    setIsPlaying(true);
  }

  async function togglePlay() {
    if (!soundRef.current) return playCurrent();
    return isPlaying ? pause() : resume();
  }

  function next() {
    setCurrentIndex(i => Math.min(i + 1, ayat.length - 1));
  }

  function prev() {
    setCurrentIndex(i => Math.max(i - 1, 0));
  }

  function onPlaybackStatusUpdate(status: any) {
    if (!status?.isLoaded) return;

    if (status.didJustFinish) {
      const ayahNum = currentAyah.ayah;

      if (repeatMode === "one") {
        // replay same ayah
        void playCurrent();
        return;
      }

      if (repeatMode === "range") {
        // If outside range, jump into it
        if (!withinRange(ayahNum)) {
          const idx = indexByAyah(rangeStart);
          if (idx >= 0) setCurrentIndex(idx);
          return;
        }

        // Loop range
        if (ayahNum === rangeEnd) {
          const idx = indexByAyah(rangeStart);
          if (idx >= 0) setCurrentIndex(idx);
          return;
        }

        // Next ayah in range
        const idx = indexByAyah(ayahNum + 1);
        if (idx >= 0) setCurrentIndex(idx);
        return;
      }

      // repeat off
      if (currentIndex < ayat.length - 1) setCurrentIndex(currentIndex + 1);
      else setIsPlaying(false);
    }
  }

  // When index changes: if playing, auto-play next ayah
  useEffect(() => {
    if (!isPlaying) return;
    void playCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // When reciter changes: reload if playing
  useEffect(() => {
    if (!isPlaying) return;
    void playCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reciterId]);

  // When rate changes: apply to playing sound
  useEffect(() => {
    (async () => {
      if (soundRef.current) {
        try {
          await soundRef.current.setRateAsync(rate, true);
        } catch {}
      }
    })();
  }, [rate]);

  // Cleanup
  useEffect(() => {
    return () => {
      void unload();
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Qur’an Recitation</Text>
        <Text style={styles.sub}>
          Surah Āl-ʿImrān (3) • Āyāt 1–9 • Start: {DEFAULT_START_AYAH}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Reciter</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={reciterId} onValueChange={setReciterId}>
            {RECITERS.map(r => (
              <Picker.Item key={r.id} label={r.name} value={r.id} />
            ))}
          </Picker>
        </View>
        {!!reciter.attribution && <Text style={styles.mini}>{reciter.attribution}</Text>}
      </View>

      <View style={styles.card}>
        <View style={styles.controlsRow}>
          <Pressable style={styles.btn} onPress={prev}><Text style={styles.btnText}>Prev</Text></Pressable>
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={togglePlay}>
            <Text style={[styles.btnText, styles.btnPrimaryText]}>{isPlaying ? "Pause" : "Play"}</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={next}><Text style={styles.btnText}>Next</Text></Pressable>
        </View>

        <View style={styles.controlsRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Repeat</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={repeatMode} onValueChange={(v) => setRepeatMode(v)}>
                <Picker.Item label="Off" value="off" />
                <Picker.Item label="This ayah" value="one" />
                <Picker.Item label="Range" value="range" />
              </Picker>
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Speed</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={rate} onValueChange={(v) => setRate(Number(v))}>
                <Picker.Item label="0.75x" value={0.75} />
                <Picker.Item label="1.0x" value={1} />
                <Picker.Item label="1.25x" value={1.25} />
                <Picker.Item label="1.5x" value={1.5} />
              </Picker>
            </View>
          </View>
        </View>

        <Text style={styles.now}>
          Now: <Text style={styles.bold}>3:{currentAyah.ayah}</Text>
        </Text>
        <Text style={styles.url} numberOfLines={2}>
          {currentUrl}
        </Text>

        <Text style={styles.mini}>
          Range repeat: {rangeStart}–{rangeEnd} (edit in code or I can add +/- UI)
        </Text>
      </View>

      <View style={[styles.card, { flex: 1 }]}>
        <Text style={styles.label}>Āyāt</Text>

        <FlatList
          data={ayat}
          keyExtractor={(item) => `${item.surah}:${item.ayah}`}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item, index }) => {
            const active = index === currentIndex;
            return (
              <Pressable
                onPress={() => setCurrentIndex(index)}
                style={[styles.ayahRow, active && styles.ayahRowActive]}
              >
                <Text style={styles.ayahNum}>3:{item.ayah}</Text>
                <Text style={[styles.ayahText, active && styles.ayahTextActive]}>
                  {item.arabic}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      <Text style={styles.footer}>
        Licensing note: configure reciter URLs from sources you’re permitted to stream/use.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff", paddingTop: Platform.OS === "android" ? 12 : 0 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  title: { fontSize: 22, fontWeight: "700" },
  sub: { marginTop: 4, opacity: 0.75 },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 16,
    padding: 12,
  },
  label: { fontWeight: "700", marginBottom: 6 },
  pickerWrap: {
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 14,
    overflow: "hidden",
  },
  controlsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  btn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnPrimary: { borderColor: "#111", backgroundColor: "#111" },
  btnText: { fontWeight: "700" },
  btnPrimaryText: { color: "#fff" },
  now: { marginTop: 4 },
  bold: { fontWeight: "800" },
  url: { marginTop: 4, fontSize: 12, opacity: 0.75 },
  mini: { marginTop: 8, fontSize: 12, opacity: 0.7 },
  ayahRow: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ayahRowActive: { borderColor: "#111", backgroundColor: "#f5f5f5" },
  ayahNum: { width: 52, opacity: 0.75, fontWeight: "700" },
  ayahText: { flex: 1, fontSize: 20, textAlign: "right", writingDirection: "rtl" as any },
  ayahTextActive: { fontWeight: "800" },
  footer: { textAlign: "center", fontSize: 11, opacity: 0.6, paddingBottom: 10 },
});
