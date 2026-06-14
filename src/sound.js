export class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.enabled = false;
    
    // エンジン音用ノード
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    
    // ホワイトノイズ用バッファのキャッシュ
    this.noiseBuffer = null;
  }
  
  // ユーザーの最初の操作で呼び出して初期化
  init() {
    if (this.ctx) return;
    
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      
      // マスターボリューム
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.28; // 全体音量をやや控えめに設定
      this.masterGain.connect(this.ctx.destination);
      
      // ノイズバッファの作成
      this.noiseBuffer = this.createNoiseBuffer();
      
      // エンジン音のセットアップ
      this.setupEngineSound();
      
      this.enabled = true;
      console.log('Web Audio API initialized successfully.');
    } catch (e) {
      console.warn('Web Audio API is not supported in this browser.', e);
    }
  }
  
  // ホワイトノイズの生成
  createNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 1.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2.0 - 1.0;
    }
    return buffer;
  }
  
  // エンジン持続音の合成設定
  setupEngineSound() {
    // 2つのオシレーターを少しデチューン（ピッチをずらす）して重ねることで、うねりのあるエンジン感を出す
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc2 = this.ctx.createOscillator();
    
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc2.type = 'triangle'; // 三角波を混ぜて少し丸みを持たせる
    
    // デチューン
    this.engineOsc1.detune.value = -8;
    this.engineOsc2.detune.value = 8;
    
    // 初期周波数 (低回転)
    this.engineOsc1.frequency.value = 65;
    this.engineOsc2.frequency.value = 65;
    
    // ローパスフィルター (高音の不快なバリバリ音を削る)
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 240;
    
    // エンジン音専用ゲイン
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0; // 初期は無音
    
    // 接続
    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);
    
    // 再生開始 (ゲイン0なのでまだ聞こえない)
    this.engineOsc1.start(0);
    this.engineOsc2.start(0);
  }
  
  // エンジン音のリアルタイム更新 (speedRatio: 0.0〜1.0)
  updateEngine(speedRatio, isRacing) {
    if (!this.enabled) return;
    
    if (!isRacing) {
      // レース中以外は徐々にエンジン音を下げる
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
      return;
    }
    
    // 速度比率に基づいて周波数と音量を変化させる
    // 速度比率が上がるほどピッチが高くなり、音量もやや増す
    const targetFreq = 55.0 + speedRatio * 180.0; // 55Hz(低音) 〜 235Hz(高音)
    const targetGain = 0.12 + speedRatio * 0.18;   // 速度に合わせて音量増
    const filterFreq = 220.0 + speedRatio * 380.0; // フィルターを開いて高音を通す
    
    const now = this.ctx.currentTime;
    
    // 音が滑らかに変化するように設定
    this.engineOsc1.frequency.setTargetAtTime(targetFreq, now, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(targetFreq * 1.5, now, 0.08); // 1.5倍音を追加して唸り声を表現
    this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.08);
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.05);
  }
  
  // カウントダウン音 (ピッ、ピッ、ピッ、ポーン！)
  playCountdownBeep(isGo) {
    if (!this.enabled) return;
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(masterGainConnector(this));
    
    if (isGo) {
      // GO! の音: 高音で長い音
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now); // A5
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    } else {
      // 3, 2, 1 の音: 低音で短い音
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now); // A4
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    }
  }
  
  // コイン獲得音 (チャリン♪)
  playCoin() {
    if (!this.enabled) return;
    
    const now = this.ctx.currentTime;
    
    // 2つのオシレーターを少しずらして鳴らすことで「きらびやかな二重奏」を合成
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    const gain2 = this.ctx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(987.77, now); // B5
    osc1.frequency.setValueAtTime(1318.51, now + 0.08); // E6 へアルペジオ
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, now); // E6
    osc2.frequency.setValueAtTime(1975.53, now + 0.08); // B6 へアルペジオ
    
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    
    gain2.gain.setValueAtTime(0.12, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    
    osc1.connect(gain1);
    osc2.connect(gain2);
    
    const dest = masterGainConnector(this);
    gain1.connect(dest);
    gain2.connect(dest);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.5);
    osc2.stop(now + 0.5);
  }
  
  // アイテムボックス獲得音
  playItemBox() {
    if (!this.enabled) return;
    
    const now = this.ctx.currentTime;
    
    // 割れるようなノイズとサイン波の合成
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.25);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGainConnector(this));
    
    source.start(now);
    source.stop(now + 0.3);
    
    // 高周波のキラキラ音を同時に被せる
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, now);
    osc.frequency.exponentialRampToValueAtTime(3000, now + 0.15);
    
    oscGain.gain.setValueAtTime(0.1, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    osc.connect(oscGain);
    oscGain.connect(masterGainConnector(this));
    
    osc.start(now);
    osc.stop(now + 0.2);
  }
  
  // ルーレット回転音 (ピピピピ)
  playRoulette() {
    if (!this.enabled) return;
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(580, now);
    
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    
    osc.connect(gain);
    gain.connect(masterGainConnector(this));
    
    osc.start(now);
    osc.stop(now + 0.06);
  }
  
  // アイテム獲得確定ファンファーレ (ピキーン！)
  playItemGet() {
    if (!this.enabled) return;
    
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 のアルペジオ
    
    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
      
      osc.connect(gain);
      gain.connect(masterGainConnector(this));
      
      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  }
  
  // ダッシュキノコ使用音 (シュゴォォー！)
  playBoost() {
    if (!this.enabled) return;
    
    const now = this.ctx.currentTime;
    
    // 風切りノイズ
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(1400, now + 0.4);
    filter.Q.value = 3.0;
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGainConnector(this));
    
    source.start(now);
    source.stop(now + 1.2);
    
    // 低音のロケットブースト音
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(45, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.6);
    
    oscGain.gain.setValueAtTime(0.22, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    
    osc.connect(oscGain);
    oscGain.connect(masterGainConnector(this));
    
    osc.start(now);
    osc.stop(now + 0.8);
  }
  
  // 直進弾発射音 (シュッ！)
  playThrow() {
    if (!this.enabled) return;
    
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1500, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.2);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGainConnector(this));
    
    source.start(now);
    source.stop(now + 0.28);
  }
  
  // 罠設置音 (ポンッ)
  playDrop() {
    if (!this.enabled) return;
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.14);
    
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    
    osc.connect(gain);
    gain.connect(masterGainConnector(this));
    
    osc.start(now);
    osc.stop(now + 0.18);
  }
  
  // スピン被弾音 (キキィーッ！)
  playSpin() {
    if (!this.enabled) return;
    
    const now = this.ctx.currentTime;
    
    // スリップ用の金属的なうねる不協和音
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(780, now);
    osc1.frequency.linearRampToValueAtTime(620, now + 0.8);
    
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(785, now); // 少し周波数をずらして激しいうねりを出す
    osc2.frequency.linearRampToValueAtTime(625, now + 0.8);
    
    // 激しいピッチの揺れ（スリップ感）
    osc1.detune.setValueAtTime(0, now);
    osc2.detune.setValueAtTime(0, now);
    for (let i = 0; i < 8; i++) {
      const t = now + i * 0.1;
      osc1.detune.setValueAtTime(i % 2 === 0 ? 50 : -50, t);
      osc2.detune.setValueAtTime(i % 2 === 0 ? -50 : 50, t);
    }
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(masterGainConnector(this));
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.9);
    osc2.stop(now + 0.9);
  }
}

// マスターゲインへのコネクタヘルパー
function masterGainConnector(soundManager) {
  return soundManager.masterGain;
}
