"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  autoFillRemainingMs,
  FILL_MINUTES,
  isFillMinutes,
  type AutoFill,
  type FillMinutes,
} from "@/lib/scratch-progress";

const SCRATCH_SOUND_SRC = "/sounds/paper-scratch.mp3";
const SOUND_FLAG_KEY = "gsa_wall_scratch_sound";

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function StaffPage() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [total, setTotal] = useState(0);
  const [male, setMale] = useState(0);
  const [female, setFemale] = useState(0);
  const [other, setOther] = useState(0);
  const [expectedTotal, setExpectedTotal] = useState(20);
  const [expectedDraft, setExpectedDraft] = useState("20");
  const [wallComplete, setWallComplete] = useState(false);
  const [autoFill, setAutoFill] = useState<AutoFill | null>(null);
  const [fillNow, setFillNow] = useState(Date.now());
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [simDone, setSimDone] = useState(0);
  const simAbort = useRef(false);
  const scratchAudio = useRef<HTMLAudioElement | null>(null);
  const lastTotalForSound = useRef<number | null>(null);
  const soundOnRef = useRef(false);
  const expectedTotalRef = useRef(expectedTotal);
  const expectedDraftRef = useRef(expectedDraft);
  expectedTotalRef.current = expectedTotal;
  expectedDraftRef.current = expectedDraft;

  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    try {
      setSoundOn(localStorage.getItem(SOUND_FLAG_KEY) === "1");
    } catch {
      /* ignore */
    }
    const audio = new Audio(SCRATCH_SOUND_SRC);
    audio.preload = "auto";
    audio.volume = 1;
    scratchAudio.current = audio;
    audio.load();
    return () => {
      audio.pause();
      scratchAudio.current = null;
    };
  }, []);

  const playScratchSound = useCallback(() => {
    if (!soundOnRef.current) return;
    const audio = scratchAudio.current;
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      /* ignore */
    }
    void audio.play().catch(() => setSoundOn(false));
  }, []);

  const enableSound = useCallback(() => {
    const audio = scratchAudio.current ?? new Audio(SCRATCH_SOUND_SRC);
    scratchAudio.current = audio;
    audio.volume = 1;
    try {
      audio.currentTime = 0;
    } catch {
      /* ignore */
    }
    void audio
      .play()
      .then(() => {
        setSoundOn(true);
        try {
          localStorage.setItem(SOUND_FLAG_KEY, "1");
        } catch {
          /* ignore */
        }
        try {
          new BroadcastChannel("gsa-scratch-sound").postMessage({
            enabled: true,
          });
        } catch {
          /* ignore */
        }
        setMessage("Suara scratch aktif — bunyi saat wall fill naik.");
      })
      .catch(() => {
        setMessage("Gagal mengaktifkan suara. Coba lagi.");
      });
  }, []);

  const disableSound = useCallback(() => {
    setSoundOn(false);
    try {
      localStorage.setItem(SOUND_FLAG_KEY, "0");
    } catch {
      /* ignore */
    }
    try {
      new BroadcastChannel("gsa-scratch-sound").postMessage({ enabled: false });
    } catch {
      /* ignore */
    }
    scratchAudio.current?.pause();
  }, []);

  const refreshStats = useCallback(async () => {
    const [statsRes, scratchRes] = await Promise.all([
      fetch("/api/stats"),
      fetch("/api/scratch"),
    ]);
    if (statsRes.status === 401) {
      setAuthed(false);
      return;
    }
    if (statsRes.ok) {
      const data = await statsRes.json();
      const nextTotal = data.total ?? 0;
      setTotal(nextTotal);
      setMale(data.male ?? 0);
      setFemale(data.female ?? 0);
      setOther(data.other ?? 0);
      setAuthed(true);

      if (lastTotalForSound.current === null) {
        lastTotalForSound.current = nextTotal;
      } else if (nextTotal > lastTotalForSound.current) {
        playScratchSound();
        lastTotalForSound.current = nextTotal;
      } else {
        lastTotalForSound.current = nextTotal;
      }
    }
    if (scratchRes.ok) {
      const scratch = await scratchRes.json();
      if (typeof scratch.target === "number") {
        setExpectedTotal(scratch.target);
        const draft = expectedDraftRef.current;
        const saved = String(expectedTotalRef.current);
        if (draft === saved) {
          setExpectedDraft(String(scratch.target));
        }
      }
      setWallComplete(scratch.complete === true);
      const fill = scratch.fill as AutoFill | null;
      if (
        fill?.startedAt &&
        isFillMinutes(fill.minutes) &&
        scratch.complete !== true
      ) {
        setAutoFill(fill);
      } else {
        setAutoFill(null);
      }
    }
  }, [playScratchSound]);

  useEffect(() => {
    void refreshStats();
    const t = setInterval(() => void refreshStats(), 4000);
    return () => clearInterval(t);
  }, [refreshStats]);

  useEffect(() => {
    if (!autoFill) return;
    const t = setInterval(() => setFillNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [autoFill]);

  const login = async () => {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/staff-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setLoading(false);
    if (!res.ok) {
      setMessage("Token salah.");
      return;
    }
    setAuthed(true);
    setToken("");
    await refreshStats();
  };

  const logout = async () => {
    await fetch("/api/staff-login", { method: "DELETE" });
    setAuthed(false);
  };

  const saveExpectedTotal = async () => {
    const n = Number(expectedDraft);
    if (!Number.isFinite(n) || n < 1) {
      setMessage("Masukkan angka total participant (min 1).");
      return;
    }
    const res = await fetch("/api/scratch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: n }),
    });
    if (!res.ok) {
      setMessage("Gagal menyimpan total participant.");
      return;
    }
    const data = await res.json();
    const next = data.target ?? n;
    setExpectedTotal(next);
    setExpectedDraft(String(next));
    setMessage(`Target disimpan: ${next} siswa.`);
  };

  const fillWall = async () => {
    if (wallComplete) return;
    if (
      !confirm(
        "Isi wall sampai 100% sekarang? Scratch akan jalan sampai penuh, lalu finale.",
      )
    ) {
      return;
    }
    const res = await fetch("/api/scratch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complete: true }),
    });
    if (!res.ok) {
      setMessage("Gagal mengisi wall.");
      return;
    }
    setWallComplete(true);
    setAutoFill(null);
    setMessage("Wall diisi penuh. Cek projector /wall.");
  };

  const startTimedFill = async (minutes: FillMinutes) => {
    if (
      !confirm(
        `Isi wall penuh dalam ${minutes} menit?\n\nBuka /wall di projector. #Team Google, hat, pencil, ribbon, dan books akan terisi sendiri sampai finale.`,
      )
    ) {
      return;
    }
    const res = await fetch("/api/scratch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fillMinutes: minutes }),
    });
    if (!res.ok) {
      setMessage("Gagal memulai isi wall.");
      return;
    }
    const data = await res.json();
    const fill = data.fill as AutoFill | null;
    if (fill?.startedAt && isFillMinutes(fill.minutes)) {
      setAutoFill(fill);
      setFillNow(Date.now());
    }
    setWallComplete(false);
    setMessage(`Wall mulai terisi — penuh dalam ${minutes} menit. Cek /wall.`);
  };

  const reopenWall = async () => {
    const res = await fetch("/api/scratch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complete: false, stopFill: true }),
    });
    if (!res.ok) {
      setMessage("Gagal membuka wall lagi.");
      return;
    }
    setWallComplete(false);
    setAutoFill(null);
    setMessage("Wall dibuka lagi. Nama siswa tetap. 3 / 5 / 7 min siap dipakai.");
  };

  const stopTimedFill = async () => {
    const res = await fetch("/api/scratch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stopFill: true }),
    });
    if (!res.ok) {
      setMessage("Gagal menghentikan isi wall.");
      return;
    }
    setAutoFill(null);
    setMessage("Isi wall otomatis dihentikan.");
  };

  const resetEvent = async () => {
    if (simRunning) simAbort.current = true;
    if (!confirm("Reset semua participant data? Tidak bisa dibatalkan.")) {
      return;
    }
    const res = await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    if (!res.ok) {
      setMessage("Reset gagal.");
      return;
    }
    setMessage("Event data di-reset.");
    lastTotalForSound.current = 0;
    await refreshStats();
  };

  const simulate100 = async () => {
    if (simRunning) {
      simAbort.current = true;
      return;
    }
    if (
      !confirm(
        "Simulasi 100 siswa ke /wall?\n\nReset dulu kalau sudah ada data nyata.\nTarget di-set ke 100, lalu nama palsu masuk satu per satu (~35 detik) supaya progress + toast kelihatan di projector.\n\nReset Event Data lagi setelah tes.",
      )
    ) {
      return;
    }
    simAbort.current = false;
    setSimRunning(true);
    setSimDone(0);
    setMessage("Simulasi jalan… buka /wall di projector.");

    const targetRes = await fetch("/api/scratch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: 100 }),
    });
    if (!targetRes.ok) {
      setSimRunning(false);
      setMessage("Gagal set target 100.");
      return;
    }
    setExpectedTotal(100);
    setExpectedDraft("100");

    const total = 100;
    let done = 0;
    for (let i = 0; i < total; i += 1) {
      if (simAbort.current) break;
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 1, offset: i }),
      });
      if (!res.ok) {
        setMessage(`Simulasi gagal di ${i + 1}/100.`);
        break;
      }
      done = i + 1;
      setSimDone(done);
      await new Promise((r) => setTimeout(r, 320));
    }

    const stopped = simAbort.current;
    simAbort.current = false;
    setSimRunning(false);
    await refreshStats();
    setMessage(
      stopped
        ? `Simulasi dihentikan di ${done}/100. Cek /wall.`
        : "Simulasi 100 siswa selesai. Cek projector /wall.",
    );
  };

  return (
    <div className="min-h-dvh bg-[#f8fbff] px-4 py-8 text-[#1f1f1f]">
      <div className="mx-auto max-w-lg rounded-[24px] border border-[#d2e3fc] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-black text-[#1a73e8]">Staff Dashboard</h1>
        <p className="mt-1 text-sm text-[#5f6368]">
          Google Student Ambasador 2026
        </p>

        {!authed ? (
          <div className="mt-6 space-y-3">
            <label className="block text-sm font-semibold">
              Staff token
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="mt-2 w-full rounded-xl border-2 border-[#dadce0] px-3 py-2.5 outline-none focus:border-[#1a73e8]"
                placeholder="Enter token"
              />
            </label>
            <button
              type="button"
              onClick={login}
              disabled={loading || !token}
              className="w-full rounded-full bg-[#1a73e8] py-3 font-bold text-white disabled:opacity-40"
            >
              Unlock
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl bg-[#e8f0fe] px-4 py-5">
              <p className="text-sm font-semibold text-[#1a73e8]">
                Live participants
              </p>
              <p className="text-4xl font-black">{total}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-semibold text-[#3c4043]">
                <div className="rounded-xl bg-white/70 px-2 py-2">
                  <div className="text-lg font-black text-[#1a73e8]">{male}</div>
                  Pria
                </div>
                <div className="rounded-xl bg-white/70 px-2 py-2">
                  <div className="text-lg font-black text-[#1a73e8]">
                    {female}
                  </div>
                  Wanita
                </div>
                <div className="rounded-xl bg-white/70 px-2 py-2">
                  <div className="text-lg font-black text-[#1a73e8]">{other}</div>
                  Lainnya
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-[#d2e3fc]">
              <p className="text-sm font-bold text-[#1f1f1f]">
                Suara scratch (wall fill)
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#5f6368]">
                Aktifkan sekali di sini. Bunyi scratch diputar tiap kali
                participant bertambah (wall fill naik).
              </p>
              {soundOn ? (
                <div className="mt-3 flex items-center gap-2">
                  <p className="flex-1 rounded-xl bg-[#e6f4ea] px-3 py-2.5 text-sm font-semibold text-[#137333]">
                    Suara aktif
                  </p>
                  <button
                    type="button"
                    onClick={disableSound}
                    className="rounded-xl px-3 py-2.5 text-sm font-semibold text-[#5f6368] ring-1 ring-[#dadce0]"
                  >
                    Matikan
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={enableSound}
                  className="mt-3 w-full rounded-xl bg-[#1a73e8] py-3 text-sm font-bold text-white"
                >
                  Aktifkan suara scratch
                </button>
              )}
            </div>

            <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-[#d2e3fc]">
              <p className="text-sm font-bold text-[#1f1f1f]">
                Berapa siswa hari ini?
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#5f6368]">
                Isi jumlah siswa yang ikut. Wall mulai dari putih, lalu
                berwarna bertahap setiap siswa submit — penuh warna saat
                mencapai target.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#f8fbff] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
                    Sudah submit
                  </p>
                  <p className="mt-1 text-2xl font-black text-[#1a73e8]">
                    {total}
                  </p>
                </div>
                <div className="rounded-xl bg-[#f8fbff] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
                    Target hari ini
                  </p>
                  <p className="mt-1 text-2xl font-black text-[#1f1f1f]">
                    {expectedTotal}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={expectedDraft}
                  onChange={(e) => setExpectedDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveExpectedTotal();
                  }}
                  placeholder="contoh: 80"
                  className="h-11 w-full rounded-xl bg-[#f8fbff] px-3 text-base font-bold tabular-nums text-[#1f1f1f] outline-none ring-1 ring-[#d2e3fc] focus:ring-2 focus:ring-[#1a73e8]"
                />
                <button
                  type="button"
                  onClick={saveExpectedTotal}
                  disabled={Number(expectedDraft) === expectedTotal}
                  className="h-11 shrink-0 rounded-xl bg-[#1a73e8] px-5 text-sm font-bold text-white disabled:opacity-30"
                >
                  Simpan
                </button>
              </div>
            </div>

            <div className="grid gap-3">
              <Link
                href="/wall"
                target="_blank"
                className="cursor-pointer rounded-full bg-[#1a73e8] py-3 text-center font-bold text-white transition hover:bg-[#174ea6] hover:shadow-md active:scale-[0.98]"
              >
                Open Projector Wall
              </Link>
              <button
                type="button"
                onClick={() => void simulate100()}
                className="cursor-pointer rounded-full bg-[#fbbc05] py-3 font-bold text-[#1f1f1f] transition hover:bg-[#f9ab00] hover:shadow-md active:scale-[0.98]"
              >
                {simRunning
                  ? `Stop simulasi (${simDone}/100)`
                  : "Simulasi 100 siswa"}
              </button>
              <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-[#d2e3fc]">
                <p className="text-sm font-bold text-[#1f1f1f]">
                  Isi wall otomatis
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#5f6368]">
                  Pilih durasi. Projector /wall terisi sendiri sampai penuh,
                  lalu finale.
                </p>
                {autoFill ? (
                  <div className="mt-3 space-y-2">
                    <p className="rounded-xl bg-[#e6f4ea] px-3 py-2.5 text-sm font-semibold text-[#137333]">
                      Berjalan {autoFill.minutes} min — sisa{" "}
                      {formatRemaining(autoFillRemainingMs(autoFill, fillNow))}
                    </p>
                    <button
                      type="button"
                      onClick={() => void stopTimedFill()}
                      className="w-full cursor-pointer rounded-full border-2 border-[#5f6368] py-2.5 text-sm font-bold text-[#3c4043] transition hover:bg-[#f1f3f4] active:scale-[0.98]"
                    >
                      Stop
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {FILL_MINUTES.map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        onClick={() => void startTimedFill(minutes)}
                        className="cursor-pointer rounded-full bg-[#e8f0fe] py-3 text-sm font-bold text-[#1a73e8] transition hover:bg-[#d2e3fc] hover:shadow-sm active:scale-[0.98]"
                      >
                        {minutes} min
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {wallComplete ? (
                <button
                  type="button"
                  onClick={() => void reopenWall()}
                  className="cursor-pointer rounded-full bg-[#1a73e8] py-3 font-bold text-white transition hover:bg-[#174ea6] hover:shadow-md active:scale-[0.98]"
                >
                  Buka wall lagi
                </button>
              ) : (
                <button
                  type="button"
                  onClick={fillWall}
                  className="cursor-pointer rounded-full bg-[#34a853] py-3 font-bold text-white transition hover:bg-[#2d8a46] hover:shadow-md active:scale-[0.98]"
                >
                  Isi wall penuh
                </button>
              )}
              <a
                href="/api/export"
                className="cursor-pointer rounded-full border-2 border-[#1a73e8] py-3 text-center font-bold text-[#1a73e8] transition hover:bg-[#e8f0fe] hover:shadow-sm active:scale-[0.98]"
              >
                Export CSV
              </a>
              <button
                type="button"
                onClick={resetEvent}
                className="cursor-pointer rounded-full border-2 border-[#c5221f] py-3 font-bold text-[#c5221f] transition hover:bg-[#fce8e6] hover:shadow-sm active:scale-[0.98]"
              >
                Reset Event Data
              </button>
              <button
                type="button"
                onClick={logout}
                className="cursor-pointer rounded-full py-2 text-sm font-semibold text-[#5f6368] transition hover:bg-[#f1f3f4] hover:text-[#1f1f1f]"
              >
                Log out
              </button>
            </div>
          </div>
        )}

        {message && (
          <p className="mt-4 rounded-xl bg-[#fef7e0] px-3 py-2 text-sm">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
