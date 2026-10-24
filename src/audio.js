// Original Web Audio sound design. No downloads, recordings or gameplay RNG.
'use strict';

class GardenAudio {
  constructor() {
    this.settings = { master: 55, effects: 75, ambience: 45, music: 0, muted: false };
    try {
      const saved = JSON.parse(localStorage.getItem('allotment-wars-audio-v1'));
      if (saved && typeof saved === 'object') {
        for (const key of ['master', 'effects', 'ambience', 'music'])
          if (Number.isFinite(saved[key])) this.settings[key] = clamp(saved[key], 0, 100);
        if (typeof saved.muted === 'boolean') this.settings.muted = saved.muted;
      }
    } catch (_) {
      /* Private browsing and file:// may not offer storage. */
    }
    this.supported = !!(window.AudioContext || window.webkitAudioContext);
    this.ctx = null;
    this.voices = new Set();
    this.cooldowns = new Map();
    this.random = mulberry32(0x736f756e);
    this.active = false;
    this.nextNature = 0;
    this.nextMusic = 0;
    this.musicStep = 0;
  }
  async unlock() {
    if (!this.supported) return;
    try {
      if (!this.ctx) {
        const AudioAPI = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioAPI({ latencyHint: 'interactive' });
        const c = this.ctx;
        this.master = c.createGain();
        const limiter = c.createDynamicsCompressor();
        limiter.threshold.value = -12;
        limiter.knee.value = 12;
        limiter.ratio.value = 6;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.18;
        this.master.connect(limiter);
        limiter.connect(c.destination);
        this.buses = {};
        for (const name of ['effects', 'ambience', 'music', 'ui']) {
          this.buses[name] = c.createGain();
          this.buses[name].connect(this.master);
        }
        this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = this.random() * 2 - 1;
        this.wind = c.createBufferSource();
        this.wind.buffer = this.noise;
        this.wind.loop = true;
        const low = c.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.value = 650;
        const high = c.createBiquadFilter();
        high.type = 'highpass';
        high.frequency.value = 140;
        this.windGain = c.createGain();
        this.windGain.gain.value = 0;
        this.wind.connect(low);
        low.connect(high);
        high.connect(this.windGain);
        this.windGain.connect(this.buses.ambience);
        this.wind.start();
        this.nextNature = c.currentTime + 2;
        this.nextMusic = c.currentTime + 0.5;
      }
      if (!document.hidden && this.ctx.state !== 'running') await this.ctx.resume();
      this.apply();
    } catch (_) {
      // Audio is optional. A browser refusal must never stop a match.
      this.stopVoices();
    }
  }
  playing() {
    return !!(
      G &&
      G.started &&
      !G.headless &&
      !G.paused &&
      !G.over &&
      !document.hidden &&
      !document.body.classList.contains('menu-open')
    );
  }
  save() {
    try {
      localStorage.setItem('allotment-wars-audio-v1', JSON.stringify(this.settings));
    } catch (_) {}
  }
  set(key, value) {
    if (key === 'muted') this.settings.muted = !!value;
    else if (['master', 'effects', 'ambience', 'music'].includes(key) && Number.isFinite(value))
      this.settings[key] = clamp(value, 0, 100);
    if (this.settings.muted || this.settings.master === 0) this.stopVoices();
    this.save();
    this.apply();
    this.refreshControls();
  }
  apply() {
    if (!this.ctx || !this.buses) return;
    const c = this.ctx,
      s = this.settings;
    this.master.gain.setTargetAtTime(s.muted ? 0 : (s.master / 100) * 0.7, c.currentTime, 0.02);
    for (const key of ['effects', 'ambience', 'music'])
      this.buses[key].gain.setTargetAtTime(s[key] / 100, c.currentTime, 0.02);
    this.buses.ui.gain.setTargetAtTime(s.effects / 100, c.currentTime, 0.02);
    const active = this.playing();
    if (this.active && !active) this.stopVoices();
    this.active = active;
    this.windGain.gain.setTargetAtTime(active ? 0.12 : 0, c.currentTime, 0.08);
  }
  stopVoices() {
    for (const v of [...this.voices]) {
      for (const source of v.sources) {
        try {
          source.stop();
        } catch (_) {}
      }
      v.clean();
    }
  }
  reset() {
    this.stopVoices();
    this.cooldowns.clear();
    this.musicStep = 0;
    if (this.ctx) {
      this.nextNature = this.ctx.currentTime + 2;
      this.nextMusic = this.ctx.currentTime + 0.5;
    }
    this.apply();
  }
  location(x, y) {
    if (!G || !S || !Number.isFinite(x) || !Number.isFinite(y) || !visibleToPlayerPt(x, y)) return null;
    const v = S.cameras.main.worldView;
    const dx = Math.max(0, Math.abs(x - v.centerX) - v.width / 2),
      dy = Math.max(0, Math.abs(y - v.centerY) - v.height / 2);
    const distance = Math.hypot(dx, dy),
      reach = 5 * T;
    if (distance > reach) return null;
    return {
      gain: 0.8 * (1 - distance / reach),
      pan: clamp((x - v.centerX) / Math.max(T, v.width * 0.6), -0.8, 0.8),
    };
  }
  sound(kind, x, y, global = false) {
    const c = this.ctx;
    if (
      !c ||
      c.state !== 'running' ||
      !this.supported ||
      this.settings.muted ||
      this.settings.master === 0 ||
      document.hidden ||
      (G && G.headless)
    )
      return false;
    if (!global && !this.playing()) return false;
    const bus = global ? 'ui' : 'effects';
    if (this.settings[global ? 'effects' : bus] === 0) return false;
    const point = global ? { gain: 0.65, pan: 0 } : this.location(x, y);
    if (!point || point.gain <= 0) return false;
    const limits = {
      ui: 0.07,
      order: 0.18,
      fork: 0.1,
      hose: 0.12,
      tiller: 0.18,
      cata: 0.25,
      splash: 0.15,
      soil: 0.15,
      buzz: 0.3,
      destroy: 0.3,
      ready: 0.8,
      harvest: 0.35,
      capture: 1,
      warn: 2.5,
      place: 0.15,
    };
    if (c.currentTime < (this.cooldowns.get(kind) || 0)) return false;
    if (this.voices.size >= 20) return false;
    this.cooldowns.set(kind, c.currentTime + (limits[kind] || 0.2));
    this.play(kind, bus, point.gain, point.pan);
    return true;
  }
  // Each effect owns its sources and connections, and releases all of them.
  play(kind, bus, level = 1, pan = 0, notes = null, at = null) {
    const c = this.ctx;
    if (!c || this.voices.size >= 20) return;
    const root = c.createGain();
    root.gain.value = level;
    const panner = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
    if (panner.pan) panner.pan.value = pan;
    root.connect(panner);
    panner.connect(this.buses[bus]);
    const voice = { sources: [], nodes: [root, panner], clean: null };
    let remaining = 0,
      cleaned = false;
    voice.clean = () => {
      if (cleaned) return;
      cleaned = true;
      voice.nodes.forEach(n => n.disconnect());
      this.voices.delete(voice);
    };
    this.voices.add(voice);
    const pitch = 0.97 + this.random() * 0.06;
    const layer = (noise, frequency, endFrequency, duration, volume, delay = 0, type = 'sine') => {
      const t = (at == null ? c.currentTime : at) + delay,
        end = t + duration;
      const source = noise ? c.createBufferSource() : c.createOscillator(),
        amp = c.createGain();
      if (noise) {
        source.buffer = this.noise;
        source.playbackRate.value = 0.8 + this.random() * 0.4;
      } else {
        source.type = type;
        source.frequency.setValueAtTime(frequency * pitch, t);
        source.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency * pitch), end);
      }
      const filter = c.createBiquadFilter();
      filter.type = noise ? 'bandpass' : 'lowpass';
      filter.Q.value = noise ? 0.65 : 0.5;
      filter.frequency.setValueAtTime(noise ? frequency : Math.max(800, frequency * 3), t);
      if (noise) filter.frequency.exponentialRampToValueAtTime(endFrequency, end);
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.linearRampToValueAtTime(volume, t + 0.005);
      amp.gain.exponentialRampToValueAtTime(0.0001, end);
      source.connect(filter);
      filter.connect(amp);
      amp.connect(root);
      voice.sources.push(source);
      voice.nodes.push(source, filter, amp);
      remaining++;
      source.onended = () => {
        remaining--;
        if (!remaining) voice.clean();
      };
      source.start(t);
      source.stop(end + 0.015);
    };
    const tone = (f, end, dur, gain, delay = 0, type = 'sine') =>
      layer(false, f, end, dur, gain, delay, type);
    const noise = (f, end, dur, gain, delay = 0) => layer(true, f, end, dur, gain, delay);
    const chime = (frequencies, gap = 0.12, gain = 0.15, duration = 0.45) =>
      frequencies.forEach((f, i) => {
        tone(f, f, duration, gain, i * gap, 'triangle');
        tone(f * 2, f * 2, duration * 0.4, gain * 0.18, i * gap);
      });
    switch (kind) {
      case 'fork':
        tone(680, 270, 0.09, 0.13);
        tone(170, 110, 0.07, 0.2);
        noise(2100, 900, 0.055, 0.16);
        break;
      case 'hose':
        noise(2600, 1100, 0.16, 0.3);
        tone(920, 420, 0.09, 0.07);
        break;
      case 'tiller':
        tone(72, 95, 0.19, 0.11, 0, 'sawtooth');
        noise(500, 240, 0.14, 0.25);
        break;
      case 'cata':
        tone(130, 45, 0.25, 0.25, 0, 'triangle');
        noise(450, 180, 0.18, 0.38);
        break;
      case 'splash':
        noise(2300, 600, 0.22, 0.35);
        tone(1200, 470, 0.12, 0.075, 0.02);
        break;
      case 'soil':
        noise(700, 180, 0.18, 0.4);
        tone(105, 42, 0.17, 0.2);
        break;
      case 'buzz':
        tone(182, 170, 0.22, 0.055, 0, 'sawtooth');
        tone(190, 176, 0.19, 0.04, 0.025, 'sawtooth');
        break;
      case 'destroy':
        noise(900, 150, 0.6, 0.65);
        tone(80, 32, 0.4, 0.3);
        noise(2100, 500, 0.18, 0.2, 0.12);
        break;
      case 'place':
        tone(170, 95, 0.13, 0.22);
        tone(240, 120, 0.1, 0.16, 0.07);
        noise(650, 300, 0.18, 0.25);
        break;
      case 'ready':
        chime([523.25, 659.25], 0.11, 0.12, 0.35);
        break;
      case 'harvest':
        chime([660, 880], 0.075, 0.085, 0.19);
        break;
      case 'capture':
        chime([293.66, 369.99, 440, 587.33], 0.12, 0.13, 0.6);
        break;
      case 'warn':
        tone(440, 390, 0.16, 0.12, 0, 'triangle');
        tone(330, 300, 0.2, 0.12, 0.22, 'triangle');
        break;
      case 'win':
        chime([293.66, 369.99, 440, 587.33, 739.99], 0.15, 0.16, 0.9);
        break;
      case 'lose':
        chime([329.63, 293.66, 246.94], 0.3, 0.13, 0.9);
        break;
      case 'order':
        tone(310, 200, 0.065, 0.075, 0, 'triangle');
        break;
      case 'bird':
        tone(1600, 2600, 0.12, 0.05);
        tone(2400, 1750, 0.14, 0.035, 0.17);
        tone(1850, 2200, 0.1, 0.025, 0.37);
        break;
      case 'cricket':
        for (let i = 0; i < 3; i++) noise(4600, 4200, 0.045, 0.1, i * 0.075);
        break;
      case 'music':
        chime(notes, 0, 0.08, 1.2);
        break;
      default:
        noise(2200, 1000, 0.035, 0.1);
        break;
    }
    if (!remaining) voice.clean();
  }
  update() {
    if (!this.ctx) return;
    const active = this.playing();
    if (active !== this.active) this.apply();
    if (!active || this.settings.muted || this.settings.master === 0 || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    if (this.settings.ambience && t >= this.nextNature && this.voices.size < 12) {
      this.nextNature = t + 4 + this.random() * 7;
      const night = S && S.daylight ? S.daylight.night : 0;
      this.play(night > 0.6 ? 'cricket' : 'bird', 'ambience', 0.7, (this.random() - 0.5) * 1.2);
    }
    if (this.settings.music && t >= this.nextMusic && this.voices.size < 12) {
      // A sparse, original D-pentatonic plucked motif, with room for battle cues.
      const melody = [
        62,
        66,
        69,
        null,
        71,
        69,
        66,
        null,
        64,
        66,
        69,
        74,
        null,
        71,
        69,
        null,
        66,
        64,
        62,
        null,
        57,
        62,
        66,
        null,
        64,
        69,
        66,
        null,
        64,
        62,
        null,
        null,
      ];
      const n = melody[this.musicStep++ % melody.length];
      this.nextMusic = t + 0.72;
      if (n != null) this.play('music', 'music', 0.6, 0, [440 * 2 ** ((n - 69) / 12)]);
    }
  }
  refreshControls() {
    const button = $('#sound-toggle');
    if (!button) return;
    const off = this.settings.muted || this.settings.master === 0;
    button.textContent = this.supported ? (off ? 'Sound off' : 'Sound on') : 'No audio';
    button.setAttribute('aria-pressed', String(off));
    button.setAttribute(
      'aria-label',
      this.supported
        ? off
          ? 'Unmute game sound'
          : 'Mute game sound'
        : 'Audio is unavailable in this browser'
    );
    button.disabled = !this.supported;
    for (const key of ['master', 'effects', 'ambience', 'music']) {
      const input = $('#audio-' + key),
        output = $('#audio-' + key + '-value');
      input.value = this.settings[key];
      output.textContent = this.settings[key] + '%';
      input.disabled = !this.supported;
    }
  }
}
const GameAudio = new GardenAudio();
(function initAudioControls() {
  const controls = $('#sound-controls'),
    panel = $('#sound-panel'),
    settings = $('#sound-settings');
  const close = () => {
    panel.hidden = true;
    settings.setAttribute('aria-expanded', 'false');
  };
  $('#sound-toggle').addEventListener('click', () => {
    if (GameAudio.settings.master === 0) {
      GameAudio.settings.muted = false;
      GameAudio.set('master', 55);
    } else GameAudio.set('muted', !GameAudio.settings.muted);
    void GameAudio.unlock();
  });
  settings.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    settings.setAttribute('aria-expanded', String(!panel.hidden));
  });
  for (const key of ['master', 'effects', 'ambience', 'music'])
    $('#audio-' + key).addEventListener('input', ev => {
      GameAudio.set(key, Number(ev.target.value));
      void GameAudio.unlock();
    });
  controls.addEventListener('keydown', ev => {
    ev.stopPropagation();
    if (ev.key === 'Escape') {
      close();
      settings.focus();
    }
  });
  document.addEventListener(
    'pointerdown',
    ev => {
      if (!controls.contains(ev.target)) close();
      if (ev.isTrusted) void GameAudio.unlock();
    },
    { capture: true }
  );
  document.addEventListener(
    'keydown',
    ev => {
      if (ev.isTrusted) void GameAudio.unlock();
    },
    { capture: true }
  );
  document.addEventListener('click', ev => {
    // Safari may grant audio activation on the completed tap rather than its down event.
    if (ev.isTrusted) void GameAudio.unlock();
    if (ev.target.closest('button') && !controls.contains(ev.target)) GameAudio.sound('ui', 0, 0, true);
  });
  document.addEventListener('visibilitychange', () => {
    if (!GameAudio.ctx) return;
    GameAudio.apply();
    if (document.hidden) {
      GameAudio.stopVoices();
      void GameAudio.ctx.suspend().catch(() => {});
    } else void GameAudio.unlock();
  });
  window.addEventListener('pagehide', () => {
    if (GameAudio.ctx) {
      GameAudio.stopVoices();
      void GameAudio.ctx.suspend().catch(() => {});
    }
  });
  window.addEventListener('pageshow', () => {
    if (GameAudio.ctx && !document.hidden) void GameAudio.unlock();
  });
  GameAudio.refreshControls();
})();
