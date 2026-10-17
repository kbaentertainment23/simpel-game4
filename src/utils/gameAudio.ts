// Web Audio API Synthesizer for Game Sound Effects & Dynamic Procedural BGM (Zero External Files, Zero Network Lag)

let audioCtx: AudioContext | null = null;
let hasAttachedUnlockListeners = false;

/**
 * Autoplay unlock helper: if audio context is suspended by browser policy,
 * resume automatically on first user click/touch anywhere on the window.
 */
function setupAudioAutoplayUnlock(ctx: AudioContext) {
  if (ctx.state === 'running' || hasAttachedUnlockListeners) return;

  const unlockAudio = () => {
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    // Also re-align next step time if BGM is running
    if (isBgmRunning && nextStepTime < ctx.currentTime) {
      nextStepTime = ctx.currentTime + 0.05;
    }
    ['click', 'touchstart', 'touchend', 'keydown', 'pointerdown'].forEach((evt) => {
      window.removeEventListener(evt, unlockAudio);
    });
    hasAttachedUnlockListeners = false;
  };

  ['click', 'touchstart', 'touchend', 'keydown', 'pointerdown'].forEach((evt) => {
    window.addEventListener(evt, unlockAudio, { once: true, passive: true });
  });
  hasAttachedUnlockListeners = true;
}

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx) {
      if (audioCtx.state === 'suspended') {
        setupAudioAutoplayUnlock(audioCtx);
      }
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Explicit helper to unlock/resume audio immediately on any user gesture (tap/click).
 * Call this synchronously inside button click handlers (e.g., 'Join Game', 'Enter Room').
 */
export function unlockAudioContext(): void {
  const ctx = getAudioContext();
  if (ctx) {
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        if (isBgmRunning && nextStepTime < ctx.currentTime) {
          nextStepTime = ctx.currentTime + 0.05;
        }
      }).catch(() => {});
    }
  }
}

// -------------------------------------------------------------
// SOUND EFFECTS (SFX)
// -------------------------------------------------------------

/**
 * Play a fast, tense ticking clock sound (800Hz pulse)
 */
export function playTickSound(isUrgent = false) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isUrgent ? 950 : 800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(isUrgent ? 1100 : 400, ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.045);
  } catch {}
}

/**
 * Play cheerful two-tone chime when answering correctly (520Hz -> 660Hz)
 */
export function playCorrectSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.1); // E5

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.12);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.35);

    // Haptic success
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 40, 80]);
    }
  } catch {}
}

/**
 * Play descending buzzer sound on wrong answer (180Hz -> 100Hz)
 */
export function playWrongSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.28);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);

    // Haptic buzz
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  } catch {}
}

/**
 * Temporarily ducks BGM volume for dramatic silence during explosions
 */
export function duckIcebreakingBGM(duckDurationMs: number = 1400) {
  if (bgmMasterGain && audioCtx && !isBgmMutedState) {
    try {
      const now = audioCtx.currentTime;
      bgmMasterGain.gain.setValueAtTime(bgmMasterGain.gain.value, now);
      bgmMasterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      setTimeout(() => {
        if (bgmMasterGain && audioCtx && !isBgmMutedState && isBgmRunning) {
          try {
            const resumeTime = audioCtx.currentTime;
            bgmMasterGain.gain.setValueAtTime(0.0001, resumeTime);
            bgmMasterGain.gain.linearRampToValueAtTime(0.85, resumeTime + 0.35);
          } catch {}
        }
      }, duckDurationMs);
    } catch {}
  }
}

/**
 * Play dramatic mega explosion sound:
 * 1. Lowpass filtered white noise sweep (950Hz -> 35Hz)
 * 2. Sub-bass sine wave boom (50Hz -> 25Hz) with deep body
 * 3. Debris crackle & resonant distortion
 * 4. Automatic BGM ducking for dramatic silence
 * 5. High-intensity haptic vibration pattern
 */
export function playExplosionSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // 1. Duck BGM for 1.3 seconds
    duckIcebreakingBGM(1300);

    // 2. White Noise Blast Sweep
    const noiseDuration = 1.1;
    const bufferSize = Math.floor(ctx.sampleRate * noiseDuration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // Add slight brownian filtering for meatier texture
      output[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(950, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(35, now + 0.95);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.85, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.05);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    whiteNoise.start(now);
    whiteNoise.stop(now + 1.1);

    // 3. Sub-Bass Sine Wave Boom (Chest-thumping explosion punch)
    const boomOsc = ctx.createOscillator();
    const boomGain = ctx.createGain();

    boomOsc.type = 'sine';
    boomOsc.frequency.setValueAtTime(55, now);
    boomOsc.frequency.exponentialRampToValueAtTime(22, now + 0.85);

    boomGain.gain.setValueAtTime(0.9, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    boomOsc.connect(boomGain);
    boomGain.connect(ctx.destination);

    boomOsc.start(now);
    boomOsc.stop(now + 0.95);

    // 4. Debris Crackle (Sparks & burning fragments)
    const crackleCount = 8;
    for (let i = 0; i < crackleCount; i++) {
      const crackleTime = now + 0.15 + i * 0.09 + Math.random() * 0.04;
      const crackleOsc = ctx.createOscillator();
      const crackleGain = ctx.createGain();

      crackleOsc.type = 'square';
      crackleOsc.frequency.setValueAtTime(220 + Math.random() * 600, crackleTime);
      crackleOsc.frequency.exponentialRampToValueAtTime(60, crackleTime + 0.05);

      crackleGain.gain.setValueAtTime(0.12, crackleTime);
      crackleGain.gain.exponentialRampToValueAtTime(0.001, crackleTime + 0.06);

      crackleOsc.connect(crackleGain);
      crackleGain.connect(ctx.destination);

      crackleOsc.start(crackleTime);
      crackleOsc.stop(crackleTime + 0.07);
    }

    // 5. Intense Haptic Rumble: [150ms rumble, 50ms pause, 300ms strong, 80ms pause, 500ms grand finale]
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([150, 50, 300, 80, 500]);
    }
  } catch {}
}

/**
 * Play cheer trumpet fanfare when a winner emerges
 */
export function playVictoryFanfare() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const now = ctx.currentTime;

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + index * 0.12);

      gain.gain.setValueAtTime(0.2, now + index * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.12 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + index * 0.12);
      osc.stop(now + index * 0.12 + 0.4);
    });
  } catch {}
}

// -------------------------------------------------------------
// DYNAMIC PROCEDURAL BGM ENGINE (ICEBREAKING PARTY GAME SOUNDTRACK)
// -------------------------------------------------------------
// Upbeat, joyful, energetic arcade rhythm: 132 BPM, 8-bar loop
// Zero external mp3/wav files required, zero loading delays, 100% reliable.

let bgmSchedulerTimer: any = null;
let bgmMasterGain: GainNode | null = null;
let bgmCompressor: DynamicsCompressorNode | null = null;
let isBgmRunning = false;
let isBgmMutedState = false;
let isBgmUrgentState = false;
let nextStepTime = 0;
let currentBgmStep = 0;
const TOTAL_BGM_STEPS = 128; // 8 bars * 16 steps
const DEFAULT_BPM = 132;
const URGENT_BPM = 144;

// Musical Chords & Bass progression for 8-bar party loop:
// Bars 1-2: F Maj -> G Maj
// Bars 3-4: E min -> A min
// Bars 5-6: F Maj -> G Maj
// Bars 7-8: C Maj -> A min (resolution)
const BAR_HARMONY: {
  [bar: number]: {
    bassRoot: number;
    bassFifth: number;
    bassOctave: number;
    chordNotes: number[];
  };
} = {
  0: { bassRoot: 87.31, bassFifth: 130.81, bassOctave: 174.61, chordNotes: [349.23, 440.0, 523.25] }, // F2, F3, F-A-C
  1: { bassRoot: 98.0, bassFifth: 146.83, bassOctave: 196.0, chordNotes: [392.0, 493.88, 587.33] }, // G2, G3, G-B-D
  2: { bassRoot: 82.41, bassFifth: 123.47, bassOctave: 164.81, chordNotes: [329.63, 392.0, 493.88] }, // E2, E3, E-G-B
  3: { bassRoot: 110.0, bassFifth: 164.81, bassOctave: 220.0, chordNotes: [440.0, 523.25, 659.25] }, // A2, A3, A-C-E
  4: { bassRoot: 87.31, bassFifth: 130.81, bassOctave: 174.61, chordNotes: [349.23, 440.0, 523.25] }, // F2
  5: { bassRoot: 98.0, bassFifth: 146.83, bassOctave: 196.0, chordNotes: [392.0, 493.88, 587.33] }, // G2
  6: { bassRoot: 65.41, bassFifth: 98.0, bassOctave: 130.81, chordNotes: [261.63, 329.63, 392.0] }, // C2, C-E-G
  7: { bassRoot: 110.0, bassFifth: 164.81, bassOctave: 220.0, chordNotes: [440.0, 523.25, 659.25] }, // A2
};

// Catchy, joyful lead melody notes (step: 0-127, freq in Hz, duration in steps)
const BGM_MELODY_STEPS: { [step: number]: { freq: number; durSteps: number } } = {
  // Bar 1 (F)
  0: { freq: 523.25, durSteps: 2 }, // C5
  3: { freq: 440.0, durSteps: 1 }, // A4
  4: { freq: 523.25, durSteps: 2 }, // C5
  8: { freq: 587.33, durSteps: 2 }, // D5
  12: { freq: 523.25, durSteps: 3 }, // C5

  // Bar 2 (G)
  16: { freq: 493.88, durSteps: 2 }, // B4
  19: { freq: 392.0, durSteps: 1 }, // G4
  20: { freq: 493.88, durSteps: 2 }, // B4
  24: { freq: 587.33, durSteps: 2 }, // D5
  28: { freq: 493.88, durSteps: 3 }, // B4

  // Bar 3 (Em)
  32: { freq: 392.0, durSteps: 2 }, // G4
  35: { freq: 329.63, durSteps: 1 }, // E4
  36: { freq: 392.0, durSteps: 2 }, // G4
  40: { freq: 523.25, durSteps: 2 }, // C5
  44: { freq: 392.0, durSteps: 3 }, // G4

  // Bar 4 (Am - playful turnaround)
  48: { freq: 440.0, durSteps: 2 }, // A4
  52: { freq: 523.25, durSteps: 2 }, // C5
  56: { freq: 659.25, durSteps: 2 }, // E5
  59: { freq: 587.33, durSteps: 1 }, // D5
  60: { freq: 523.25, durSteps: 1 }, // C5
  62: { freq: 493.88, durSteps: 2 }, // B4

  // Bar 5 (F - celebration peak)
  64: { freq: 440.0, durSteps: 2 }, // A4
  66: { freq: 523.25, durSteps: 2 }, // C5
  68: { freq: 698.46, durSteps: 3 }, // F5
  72: { freq: 659.25, durSteps: 2 }, // E5
  74: { freq: 587.33, durSteps: 2 }, // D5
  76: { freq: 523.25, durSteps: 3 }, // C5

  // Bar 6 (G - rising energy)
  80: { freq: 493.88, durSteps: 2 }, // B4
  82: { freq: 587.33, durSteps: 2 }, // D5
  84: { freq: 783.99, durSteps: 3 }, // G5
  88: { freq: 698.46, durSteps: 2 }, // F5
  90: { freq: 659.25, durSteps: 2 }, // E5
  92: { freq: 587.33, durSteps: 3 }, // D5

  // Bar 7 (C - upbeat bounce)
  96: { freq: 659.25, durSteps: 2 }, // E5
  98: { freq: 523.25, durSteps: 2 }, // C5
  100: { freq: 659.25, durSteps: 2 }, // E5
  104: { freq: 783.99, durSteps: 3 }, // G5
  108: { freq: 659.25, durSteps: 3 }, // E5

  // Bar 8 (Am - resolution)
  112: { freq: 440.0, durSteps: 1 }, // A4
  114: { freq: 493.88, durSteps: 1 }, // B4
  116: { freq: 523.25, durSteps: 2 }, // C5
  120: { freq: 587.33, durSteps: 2 }, // D5
  124: { freq: 523.25, durSteps: 4 }, // C5
};

// Kick drum synthesizer node
function scheduleKick(ctx: AudioContext, time: number, destination: AudioNode) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, time);
  osc.frequency.exponentialRampToValueAtTime(45, time + 0.08);

  gain.gain.setValueAtTime(0.2, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

  osc.connect(gain);
  gain.connect(destination);

  osc.start(time);
  osc.stop(time + 0.12);
}

// Snare / Handclap synthesizer node
function scheduleSnare(ctx: AudioContext, time: number, destination: AudioNode) {
  const bufferSize = Math.floor(ctx.sampleRate * 0.085);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1600, time);
  filter.Q.setValueAtTime(1.8, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.09, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(destination);

  noise.start(time);
  noise.stop(time + 0.085);
}

// Crisp Hi-Hat synthesizer node
function scheduleHiHat(ctx: AudioContext, time: number, isAccented: boolean, destination: AudioNode) {
  const bufferSize = Math.floor(ctx.sampleRate * 0.035);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(7500, time);

  const gain = ctx.createGain();
  const vol = isAccented ? 0.045 : 0.022;
  gain.gain.setValueAtTime(vol, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + (isAccented ? 0.04 : 0.025));

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(destination);

  noise.start(time);
  noise.stop(time + 0.045);
}

// Bouncy funk bass synthesizer node
function scheduleBass(ctx: AudioContext, freq: number, time: number, durSeconds: number, destination: AudioNode) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, time);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(450, time);
  filter.frequency.exponentialRampToValueAtTime(180, time + durSeconds);

  gain.gain.setValueAtTime(0.14, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + durSeconds);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(destination);

  osc.start(time);
  osc.stop(time + durSeconds + 0.02);
}

// Cheerful chord stabs node
function scheduleChord(ctx: AudioContext, freqs: number[], time: number, destination: AudioNode) {
  freqs.forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.035, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(time);
    osc.stop(time + 0.11);
  });
}

// Joyful synth lead melody node
function scheduleMelody(
  ctx: AudioContext,
  freq: number,
  time: number,
  durSeconds: number,
  destination: AudioNode
) {
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(freq, time);

  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq * 2, time); // Bright chime shimmer

  const noteGain = 0.07;
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(noteGain, time + 0.015);
  gain.gain.setValueAtTime(noteGain * 0.8, time + durSeconds * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.001, time + durSeconds);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(destination);

  osc1.start(time);
  osc2.start(time);
  osc1.stop(time + durSeconds + 0.02);
  osc2.stop(time + durSeconds + 0.02);
}

// Urgent panic pulse arpeggio node (when holding bomb with low timer)
function scheduleUrgentPing(ctx: AudioContext, step: number, time: number, destination: AudioNode) {
  const urgentFreqs = [783.99, 880.0, 1046.5, 1174.66]; // G5, A5, C6, D6
  const freq = urgentFreqs[step % urgentFreqs.length];

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, time);

  gain.gain.setValueAtTime(0.04, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

  osc.connect(gain);
  gain.connect(destination);

  osc.start(time);
  osc.stop(time + 0.06);
}

// Core lookahead step scheduler
function scheduleBgmStep(step: number, time: number, ctx: AudioContext, destination: AudioNode) {
  const bpm = isBgmUrgentState ? URGENT_BPM : DEFAULT_BPM;
  const stepDuration = 60 / bpm / 4;
  const currentBar = Math.floor(step / 16) % 8;
  const stepInBar = step % 16;
  const harmony = BAR_HARMONY[currentBar];

  // 1. Kick Drum: beats 1, 2, 3, 4 + syncopation
  const isKickStep =
    stepInBar === 0 ||
    stepInBar === 4 ||
    stepInBar === 8 ||
    stepInBar === 12 ||
    (stepInBar === 10 && currentBar % 2 === 1);
  if (isKickStep) {
    scheduleKick(ctx, time, destination);
  }

  // 2. Snare / Clap: beats 2 and 4 (steps 4 and 12)
  if (stepInBar === 4 || stepInBar === 12) {
    scheduleSnare(ctx, time, destination);
  }

  // 3. Hi-Hat: 8th notes with off-beat accents + 16th rapid ticks if urgent
  const isEighthStep = stepInBar % 2 === 0;
  if (isEighthStep || isBgmUrgentState) {
    const isAccented = stepInBar === 2 || stepInBar === 6 || stepInBar === 10 || stepInBar === 14;
    scheduleHiHat(ctx, time, isAccented, destination);
  }

  // 4. Bouncy Funk Bassline
  let bassFreq: number | null = null;
  if (stepInBar === 0 || stepInBar === 8) {
    bassFreq = harmony.bassRoot;
  } else if (stepInBar === 3 || stepInBar === 11) {
    bassFreq = harmony.bassRoot;
  } else if (stepInBar === 6 || stepInBar === 14) {
    bassFreq = harmony.bassFifth;
  }
  if (bassFreq) {
    const durSec = stepDuration * 2.2;
    scheduleBass(ctx, bassFreq, time, durSec, destination);
  }

  // 5. Upbeat Chord Stabs (steps 2, 6, 10, 14)
  if (stepInBar === 2 || stepInBar === 6 || stepInBar === 10 || stepInBar === 14) {
    scheduleChord(ctx, harmony.chordNotes, time, destination);
  }

  // 6. Cheerful Lead Melody
  const melodyNote = BGM_MELODY_STEPS[step];
  if (melodyNote) {
    scheduleMelody(ctx, melodyNote.freq, time, stepDuration * melodyNote.durSteps, destination);
  }

// (Step 7 logic continues)
  // 7. Urgent Pulse Arpeggios (if player holds bomb with low timer)
  if (isBgmUrgentState) {
    scheduleUrgentPing(ctx, step, time, destination);
  }
}

/**
 * Start playing the Icebreaking Game procedural background music (BGM).
 * Automatically schedules seamless infinite upbeat party music loop.
 */
export function startIcebreakingBGM(options?: { isMuted?: boolean; isUrgent?: boolean }) {
  if (typeof window === 'undefined') return;

  const ctx = getAudioContext();
  if (!ctx) return;

  // Immediate resume attempt
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  if (options?.isMuted !== undefined) {
    isBgmMutedState = options.isMuted;
  }
  if (options?.isUrgent !== undefined) {
    isBgmUrgentState = options.isUrgent;
  }

  // Setup master compressor & gain node if not created
  if (!bgmCompressor) {
    bgmCompressor = ctx.createDynamicsCompressor();
    bgmCompressor.threshold.setValueAtTime(-24, ctx.currentTime);
    bgmCompressor.knee.setValueAtTime(30, ctx.currentTime);
    bgmCompressor.ratio.setValueAtTime(12, ctx.currentTime);
    bgmCompressor.attack.setValueAtTime(0.003, ctx.currentTime);
    bgmCompressor.release.setValueAtTime(0.25, ctx.currentTime);
  }

  if (!bgmMasterGain) {
    bgmMasterGain = ctx.createGain();
    bgmCompressor.connect(bgmMasterGain);
    bgmMasterGain.connect(ctx.destination);
  }

  // Apply mute state cleanly with volume ramp
  const targetGain = isBgmMutedState ? 0.0001 : 0.85;
  bgmMasterGain.gain.setValueAtTime(bgmMasterGain.gain.value, ctx.currentTime);
  bgmMasterGain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.1);

  setupAudioAutoplayUnlock(ctx);

  if (isBgmRunning) return;
  isBgmRunning = true;

  currentBgmStep = 0;
  nextStepTime = ctx.currentTime + 0.05;

  const lookaheadMs = 25;
  const scheduleAheadSec = 0.12;

  const runScheduler = () => {
    if (!isBgmRunning || !bgmCompressor) return;
    const currentAudioTime = ctx.currentTime;

    // In case audio context just resumed after being suspended, catch up nextStepTime
    if (nextStepTime < currentAudioTime) {
      nextStepTime = currentAudioTime + 0.02;
    }

    while (nextStepTime < currentAudioTime + scheduleAheadSec) {
      scheduleBgmStep(currentBgmStep, nextStepTime, ctx, bgmCompressor);

      const bpm = isBgmUrgentState ? URGENT_BPM : DEFAULT_BPM;
      const stepDuration = 60 / bpm / 4;
      nextStepTime += stepDuration;
      currentBgmStep = (currentBgmStep + 1) % TOTAL_BGM_STEPS;
    }
  };

  bgmSchedulerTimer = setInterval(runScheduler, lookaheadMs);
}

/**
 * Stop the background music completely and clean up scheduling timers.
 */
export function stopIcebreakingBGM() {
  isBgmRunning = false;

  if (bgmSchedulerTimer) {
    clearInterval(bgmSchedulerTimer);
    bgmSchedulerTimer = null;
  }

  if (bgmMasterGain && audioCtx) {
    try {
      bgmMasterGain.gain.setValueAtTime(bgmMasterGain.gain.value, audioCtx.currentTime);
      bgmMasterGain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);
    } catch {}
  }

  currentBgmStep = 0;
}

/**
 * Toggle mute state for the background music.
 */
export function setIcebreakingBGMMuted(muted: boolean) {
  isBgmMutedState = muted;
  if (bgmMasterGain && audioCtx) {
    try {
      const targetGain = muted ? 0.0001 : 0.85;
      bgmMasterGain.gain.setValueAtTime(bgmMasterGain.gain.value, audioCtx.currentTime);
      bgmMasterGain.gain.linearRampToValueAtTime(targetGain, audioCtx.currentTime + 0.08);
    } catch {}
  }
}

/**
 * Set urgent / panic intensity (e.g. when holding bomb with < 15 seconds remaining)
 */
export function setIcebreakingBGMUrgent(isUrgent: boolean) {
  isBgmUrgentState = isUrgent;
}

/**
 * Check if the background music is currently running
 */
export function isIcebreakingBGMRunning(): boolean {
  return isBgmRunning;
}

