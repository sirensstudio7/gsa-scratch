const BUBBLE_POP_SOUNDS = [
  "/sounds/pop1.mp3",
  "/sounds/pop2.mp3",
  "/sounds/pop3.mp3",
] as const;

const templates: HTMLAudioElement[] = [];
let poolReady = false;

function ensurePool() {
  if (typeof window === "undefined" || poolReady) return;
  poolReady = true;
  for (const src of BUBBLE_POP_SOUNDS) {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.load();
    templates.push(audio);
  }
}

/** Call on first pointer on welcome field so clips are decoded before pops. */
export function warmBubblePopSounds() {
  ensurePool();
}

export function unlockBubblePopSounds() {
  ensurePool();
  for (const audio of templates) {
    audio.volume = 0.001;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 0.88;
      })
      .catch(() => {
        audio.volume = 0.88;
      });
  }
}

function playElement(el: HTMLAudioElement) {
  el.volume = 0.88;
  if (el.currentTime > 0.05) {
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
  void el.play().catch(() => {
    /* blocked or missing file */
  });
}

/** Play one of three pop clips (random). Call from a click/tap handler. */
export function playRandomBubblePop() {
  ensurePool();
  const index = Math.floor(Math.random() * BUBBLE_POP_SOUNDS.length);
  const template = templates[index];
  if (!template) {
    const fallback = new Audio(BUBBLE_POP_SOUNDS[index]);
    fallback.volume = 0.88;
    void fallback.play().catch(() => {});
    return;
  }

  if (!template.paused && template.currentTime > 0 && !template.ended) {
    const clone = template.cloneNode(true) as HTMLAudioElement;
    playElement(clone);
    return;
  }
  playElement(template);
}
