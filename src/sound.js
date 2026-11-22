// Web Audio API によるシンセサウンド＆レーシングBGMマネージャー
export class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this.enabled = false;
    this.muted = false;

    // エンジン音ノード
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;

    // ドリフトスキール音ノード
    this.driftSource = null;
    this.driftFilter = null;
    this.driftGain = null;

    this.noiseBuffer = null;

    // プロシージャルBGMシーケンサー
    this.bgmTimer = null;
    this.bgmPlaying = false;
    this.bgmStep = 0;
    this.isFinalLap = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.34;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 1.0;
      this.sfxGain.connect(this.masterGain);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.24;
      this.bgmGain.connect(this.masterGain);

      this.noiseBuffer = this.createNoiseBuffer();
      this.setupEngineSound();
      this.setupDriftSound();

      this.enabled = true;
    } catch (e) {
      console.warn('Web Audio API is not supported in this browser.', e);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.34, this.ctx.currentTime, 0.04);
    }
    return this.muted;
  }

  createNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 2.0;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2.0 - 1.0;
    }
    return buffer;
  }

  setupEngineSound() {
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc2.type = 'triangle';
    this.engineOsc1.detune.value = -9;
    this.engineOsc2.detune.value = 9;
    this.engineOsc1.frequency.value = 60;
    this.engineOsc2.frequency.value = 90;

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 240;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);

    this.engineOsc1.start(0);
    this.engineOsc2.start(0);
  }

  setupDriftSound() {
    this.driftSource = this.ctx.createBufferSource();
    this.driftSource.buffer = this.noiseBuffer;
    this.driftSource.loop = true;

    this.driftFilter = this.ctx.createBiquadFilter();
    this.driftFilter.type = 'bandpass';
    this.driftFilter.frequency.value = 1400;
    this.driftFilter.Q.value = 4.5;

    this.driftGain = this.ctx.createGain();
    this.driftGain.gain.value = 0.0;

    this.driftSource.connect(this.driftFilter);
    this.driftFilter.connect(this.driftGain);
    this.driftGain.connect(this.sfxGain);
    this.driftSource.start(0);
  }

  // エンジン音＆ドリフトスキール音の更新
  updateEngine(speedRatio, isActive, isBoosting = false, isDrifting = false, driftCharge = 0) {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;

    if (!isActive) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.12);
      this.driftGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    const boostAdd = isBoosting ? 55.0 : 0;
    const targetFreq = 58.0 + speedRatio * 185.0 + boostAdd;
    const targetGain = 0.11 + Math.min(1.2, speedRatio) * 0.16 + (isBoosting ? 0.06 : 0);
    const filterFreq = 240.0 + speedRatio * 420.0 + (isBoosting ? 350 : 0);

    this.engineOsc1.frequency.setTargetAtTime(targetFreq, now, 0.06);
    this.engineOsc2.frequency.setTargetAtTime(targetFreq * 1.5, now, 0.06);
    this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.06);
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.05);

    // ドリフトのタイヤ擦れ音
    const targetDriftGain = isDrifting ? 0.09 + driftCharge * 0.025 : 0;
    const targetDriftFreq = 1250 + driftCharge * 260;
    this.driftGain.gain.setTargetAtTime(targetDriftGain, now, 0.05);
    this.driftFilter.frequency.setTargetAtTime(targetDriftFreq, now, 0.06);
  }

  // アップテンポなプロシージャル・アーケードレーシングBGM
  startBGM(finalLap = false) {
    if (!this.enabled) return;
    this.isFinalLap = finalLap;
    if (this.bgmPlaying) return;
    this.bgmPlaying = true;
    this.bgmStep = 0;

    const melodyNotes = [
      523.25, 0, 659.25, 783.99, 1046.5, 0, 987.77, 783.99,
      698.46, 0, 880.0, 1046.5, 987.77, 783.99, 659.25, 0,
      587.33, 0, 739.99, 880.0, 1174.66, 0, 1046.5, 880.0,
      987.77, 880.0, 783.99, 659.25, 783.99, 0, 880.0, 987.77
    ];
    const bassNotes = [
      130.81, 130.81, 196.0, 130.81, 174.61, 174.61, 220.0, 174.61,
      146.83, 146.83, 220.0, 146.83, 196.0, 196.0, 246.94, 196.0
    ];

    const scheduleStep = () => {
      if (!this.bgmPlaying || !this.enabled) return;
      const now = this.ctx.currentTime;
      const pitchMult = this.isFinalLap ? 1.06 : 1.0; // ファイナルラップは半音アップ
      const stepMs = this.isFinalLap ? 128 : 148;

      // リードメロディ
      const melFreq = melodyNotes[this.bgmStep % melodyNotes.length];
      if (melFreq > 0) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(melFreq * pitchMult, now);
        g.gain.setValueAtTime(0.16, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + (stepMs / 1000) * 0.9);
        osc.connect(g);
        g.connect(this.bgmGain);
        osc.start(now);
        osc.stop(now + (stepMs / 1000));
      }

      // パワフルなベースライン
      const bassFreq = bassNotes[Math.floor(this.bgmStep / 2) % bassNotes.length];
      const bOsc = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      bOsc.type = 'sawtooth';
      bOsc.frequency.setValueAtTime(bassFreq * pitchMult, now);
      const bFilter = this.ctx.createBiquadFilter();
      bFilter.type = 'lowpass';
      bFilter.frequency.value = 420;
      bGain.gain.setValueAtTime(this.bgmStep % 2 === 0 ? 0.22 : 0.11, now);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + (stepMs / 1000) * 0.85);
      bOsc.connect(bFilter);
      bFilter.connect(bGain);
      bGain.connect(this.bgmGain);
      bOsc.start(now);
      bOsc.stop(now + (stepMs / 1000));

      // リズムパーカッション（キック＆ハイハット）
      if (this.bgmStep % 4 === 0) {
        const kick = this.ctx.createOscillator();
        const kGain = this.ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(145, now);
        kick.frequency.exponentialRampToValueAtTime(42, now + 0.09);
        kGain.gain.setValueAtTime(0.32, now);
        kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        kick.connect(kGain);
        kGain.connect(this.bgmGain);
        kick.start(now);
        kick.stop(now + 0.12);
      } else if (this.bgmStep % 2 === 1) {
        const hat = this.ctx.createBufferSource();
        hat.buffer = this.noiseBuffer;
        const hFilter = this.ctx.createBiquadFilter();
        hFilter.type = 'highpass';
        hFilter.frequency.value = 6500;
        const hGain = this.ctx.createGain();
        hGain.gain.setValueAtTime(0.07, now);
        hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        hat.connect(hFilter);
        hFilter.connect(hGain);
        hGain.connect(this.bgmGain);
        hat.start(now);
        hat.stop(now + 0.05);
      }

      this.bgmStep++;
      this.bgmTimer = setTimeout(scheduleStep, stepMs);
    };

    scheduleStep();
  }

  setFinalLapMode(enabled) {
    this.isFinalLap = enabled;
  }

  stopBGM() {
    this.bgmPlaying = false;
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  // カウントダウン音
  playCountdownBeep(isGo) {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.sfxGain);

    if (isGo) {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1046.5, now + 0.08);
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc.start(now);
      osc.stop(now + 0.68);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.22);
    }
  }

  // ホップ音
  playHop() {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(460, now + 0.09);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // ドリフトチャージ段階アップ音
  playDriftCharge(level) {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    const freqs = [0, 660, 880, 1174.66];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freqs[level] || 700, now);
    osc.frequency.exponentialRampToValueAtTime((freqs[level] || 700) * 1.25, now + 0.12);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // ジャンプ＆トリック成功音
  playTrick() {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    [587.33, 880, 1174.66, 1567.98].forEach((f, idx) => {
      const t = now + idx * 0.045;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  // コイン獲得音
  playCoin() {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    const gain2 = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(987.77, now);
    osc1.frequency.setValueAtTime(1318.51, now + 0.07);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, now);
    osc2.frequency.setValueAtTime(1975.53, now + 0.07);

    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    gain2.gain.setValueAtTime(0.12, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc1.connect(gain1); gain1.connect(this.sfxGain);
    osc2.connect(gain2); gain2.connect(this.sfxGain);
    osc1.start(now); osc2.start(now);
    osc1.stop(now + 0.42); osc2.stop(now + 0.42);
  }

  // アイテムボックス破壊音
  playItemBox() {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(350, now + 0.22);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    source.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
    source.start(now); source.stop(now + 0.26);

    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(2800, now + 0.14);
    og.gain.setValueAtTime(0.12, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(og); og.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.2);
  }

  // ルーレット回転音
  playRoulette() {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620 + Math.random() * 80, now);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.06);
  }

  // アイテム確定ファンファーレ
  playItemGet() {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const t = now + idx * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.17, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain); gain.connect(this.sfxGain);
      osc.start(t); osc.stop(t + 0.28);
    });
  }

  // ブースト / ダッシュパネル音
  playBoost() {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(240, now);
    filter.frequency.exponentialRampToValueAtTime(1600, now + 0.35);
    filter.Q.value = 2.8;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
    source.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
    source.start(now); source.stop(now + 1.0);

    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.45);
    og.gain.setValueAtTime(0.22, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc.connect(og); og.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.7);
  }

  // スター発動ジングル
  playStar() {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => {
      const t = now + i * 0.06;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(g); g.connect(this.sfxGain);
      osc.start(t); osc.stop(t + 0.28);
    });
  }

  // 弾発射音
  playThrow() {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.18);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.22);
  }

  // 罠設置音
  playDrop() {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.14);
    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.18);
  }

  // 軽い接触・壁バンプ音
  playBump() {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.12);
    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.15);
  }

  // スピン被弾音
  playSpin() {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(760, now);
    osc1.frequency.linearRampToValueAtTime(480, now + 0.75);
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(772, now);
    osc2.frequency.linearRampToValueAtTime(492, now + 0.75);

    for (let i = 0; i < 8; i++) {
      const t = now + i * 0.09;
      osc1.detune.setValueAtTime(i % 2 === 0 ? 55 : -55, t);
      osc2.detune.setValueAtTime(i % 2 === 0 ? -55 : 55, t);
    }

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc1.connect(gain); osc2.connect(gain); gain.connect(this.sfxGain);
    osc1.start(now); osc2.start(now);
    osc1.stop(now + 0.85); osc2.stop(now + 0.85);
  }

  // ラップ通過ジングル
  playLapChime(isFinalLap) {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    const notes = isFinalLap
      ? [523.25, 659.25, 783.99, 1046.5, 1318.51]
      : [523.25, 659.25, 1046.5];
    notes.forEach((f, idx) => {
      const t = now + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.24, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(g); g.connect(this.sfxGain);
      osc.start(t); osc.stop(t + 0.35);
    });
  }

  // ゴールファンファーレ
  playFinishFanfare(isWinner) {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    const notes = isWinner
      ? [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51]
      : [440, 523.25, 659.25, 783.99];
    const times = isWinner
      ? [0, 0.1, 0.2, 0.32, 0.5, 0.62, 0.78]
      : [0, 0.14, 0.28, 0.45];

    notes.forEach((f, i) => {
      const t = now + times[i];
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (i === notes.length - 1 ? 0.9 : 0.25));
      osc.connect(g); g.connect(this.sfxGain);
      osc.start(t); osc.stop(t + (i === notes.length - 1 ? 0.95 : 0.28));
    });
  }
}
