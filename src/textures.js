import * as THREE from 'three';

// プロシージャル・テクスチャ生成ユーティリティ
export const TextureFactory = {
  // 高精細アスファルト路面テクスチャ (コーステーマ対応)
  createAsphaltTexture(theme = 'sunshine') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const isNight = theme === 'neon';
    const isSunset = theme === 'sunset';

    // ベース舗装色
    ctx.fillStyle = isNight ? '#171924' : (isSunset ? '#343038' : '#2e3138');
    ctx.fillRect(0, 0, 512, 512);

    // 細粒アスファルトノイズ
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const grain = (Math.random() - 0.5) * 26;
      data[i] = Math.max(0, Math.min(255, data[i] + grain));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + grain));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + grain));
    }
    ctx.putImageData(imgData, 0, 0);

    // タイヤの走行痕（微妙な暗いライン2本）
    const drawTireTrack = (cx) => {
      const g = ctx.createLinearGradient(cx - 55, 0, cx + 55, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.22)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 55, 0, 110, 512);
    };
    drawTireTrack(145);
    drawTireTrack(367);

    // 両端の白線（ナイトコースはネオンシアン）
    ctx.fillStyle = isNight ? '#00f0ff' : 'rgba(255, 255, 255, 0.92)';
    ctx.fillRect(18, 0, 14, 512);
    ctx.fillRect(480, 0, 14, 512);

    // ナイトコース用の内発光エッジ
    if (isNight) {
      ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
      ctx.fillRect(32, 0, 18, 512);
      ctx.fillRect(462, 0, 18, 512);
    }

    // 中央の破線（センターライン）
    ctx.fillStyle = isNight ? '#ff2a9d' : (isSunset ? '#ffdd88' : 'rgba(255, 255, 255, 0.78)');
    for (let y = 24; y < 512; y += 128) {
      ctx.fillRect(250, y, 12, 72);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  },

  // 芝生／大地テクスチャ
  createTerrainTexture(theme = 'sunshine') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    if (theme === 'sunset') {
      ctx.fillStyle = '#a8653c';
      ctx.fillRect(0, 0, 512, 512);
      // 渓谷の地層ストライプ
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(135, 72, 38, 0.35)' : 'rgba(195, 125, 70, 0.25)';
        ctx.fillRect(0, i * 64, 512, 64);
      }
      for (let i = 0; i < 4500; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(220,160,100,0.22)' : 'rgba(85,42,20,0.22)';
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 3 + Math.random() * 5, 2 + Math.random() * 3);
      }
    } else if (theme === 'neon') {
      ctx.fillStyle = '#0e1326';
      ctx.fillRect(0, 0, 512, 512);
      // サイバーグリッド
      ctx.strokeStyle = 'rgba(0, 220, 255, 0.22)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 512; i += 64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255, 0, 140, 0.12)';
      ctx.lineWidth = 1;
      for (let i = 32; i < 512; i += 64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
      }
    } else {
      // 爽やかな芝生（芝刈りストライプ＋草ディテール）
      ctx.fillStyle = '#3f9648';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(88, 178, 86, 0.35)' : 'rgba(42, 118, 52, 0.28)';
        ctx.fillRect(i * 64, 0, 64, 512);
      }
      for (let i = 0; i < 5000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(130, 215, 95, 0.25)' : 'rgba(28, 90, 38, 0.25)';
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 5 + Math.random() * 4);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(42, 42);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  },

  // スタートラインのチェッカーペイント
  createStartLineTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const sq = 32;
    for (let y = 0; y < 128; y += sq) {
      for (let x = 0; x < 512; x += sq) {
        ctx.fillStyle = ((x / sq + y / sq) % 2 === 0) ? '#ffffff' : '#14161d';
        ctx.fillRect(x, y, sq, sq);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  },

  // スタートゲート看板テクスチャ
  createGateBannerTexture(title = 'SUPER KART GP') {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');

    // チェッカー背景
    const sq = 24;
    for (let y = 0; y < 192; y += sq) {
      for (let x = 0; x < 1024; x += sq) {
        ctx.fillStyle = ((x / sq + y / sq) % 2 === 0) ? '#181a24' : '#2a2d3a';
        ctx.fillRect(x, y, sq, sq);
      }
    }

    // 上下のアクセントライン
    const grad = ctx.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, '#00f0ff');
    grad.addColorStop(0.5, '#ff007f');
    grad.addColorStop(1, '#ffcc00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 16);
    ctx.fillRect(0, 176, 1024, 16);

    // テキスト
    ctx.font = '900 italic 76px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#090b12';
    ctx.strokeText(title, 512, 98);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, 512, 98);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  },

  // ダッシュパネル（ブーストパッド）アニメーション用テクスチャ
  createBoostPadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#071324';
    ctx.fillRect(0, 0, 256, 512);

    // サイドネオン枠
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(0, 0, 16, 512);
    ctx.fillRect(240, 0, 16, 512);

    // 光るシェブロン矢印 (進行方向 = 上向き)
    const colors = ['#00f0ff', '#00ff88', '#ffee00', '#ff6600'];
    for (let i = 0; i < 4; i++) {
      const y = 70 + i * 120;
      ctx.save();
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = 26;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = colors[i % colors.length];
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(48, y + 48);
      ctx.lineTo(128, y - 22);
      ctx.lineTo(208, y + 48);
      ctx.stroke();
      ctx.restore();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  },

  // ジャンプ台テクスチャ
  createRampTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1b1d28';
    ctx.fillRect(0, 0, 256, 256);

    // 鮮やかな黄＆オレンジの警告ストライプ＋矢印
    const grad = ctx.createLinearGradient(0, 256, 0, 0);
    grad.addColorStop(0, '#ff8800');
    grad.addColorStop(0.5, '#ffdd00');
    grad.addColorStop(1, '#ffffff');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 22;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let y = 210; y >= 70; y -= 70) {
      ctx.beginPath();
      ctx.moveTo(46, y + 25);
      ctx.lineTo(128, y - 30);
      ctx.lineTo(210, y + 25);
      ctx.stroke();
    }

    // 縁のゼブラ
    for (let y = 0; y < 256; y += 32) {
      ctx.fillStyle = (y / 32) % 2 === 0 ? '#ffcc00' : '#111111';
      ctx.fillRect(0, y, 22, 32);
      ctx.fillRect(234, y, 22, 32);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  },

  // コーナー案内シェブロン標識テクスチャ
  createChevronSignTexture(turnDir = 1) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffcf00';
    ctx.fillRect(0, 0, 256, 128);

    ctx.strokeStyle = '#141418';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 246, 118);

    ctx.fillStyle = '#141418';
    // シェブロン矢印を2つ
    for (let i = 0; i < 2; i++) {
      const ox = 55 + i * 105;
      ctx.beginPath();
      if (turnDir > 0) {
        // 左向き矢印
        ctx.moveTo(ox + 45, 20);
        ctx.lineTo(ox + 10, 20);
        ctx.lineTo(ox - 25, 64);
        ctx.lineTo(ox + 10, 108);
        ctx.lineTo(ox + 45, 108);
        ctx.lineTo(ox + 10, 64);
      } else {
        // 右向き矢印
        ctx.moveTo(ox - 10, 20);
        ctx.lineTo(ox + 25, 20);
        ctx.lineTo(ox + 60, 64);
        ctx.lineTo(ox + 25, 108);
        ctx.lineTo(ox - 10, 108);
        ctx.lineTo(ox + 25, 64);
      }
      ctx.closePath();
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  },

  // スポンサー広告ボードテクスチャ
  createSponsorTexture(text, bgColor, accentColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 512, 128);

    ctx.fillStyle = accentColor;
    ctx.fillRect(0, 0, 24, 128);
    ctx.fillRect(488, 0, 24, 128);
    ctx.fillRect(0, 114, 512, 14);

    ctx.font = '900 italic 52px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 256, 62);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  },

  // スカイボックス用プロシージャル空テクスチャ
  createSkyTexture(theme = 'sunshine') {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (theme === 'sunset') {
      grad.addColorStop(0.0, '#141840');
      grad.addColorStop(0.28, '#4a2b6b');
      grad.addColorStop(0.45, '#c84b52');
      grad.addColorStop(0.54, '#ff8e3c');
      grad.addColorStop(0.60, '#ffd478');
      grad.addColorStop(0.75, '#7c4c48');
      grad.addColorStop(1.0, '#2c1e26');
    } else if (theme === 'neon') {
      grad.addColorStop(0.0, '#040614');
      grad.addColorStop(0.35, '#09102d');
      grad.addColorStop(0.50, '#1a1244');
      grad.addColorStop(0.56, '#3b1558');
      grad.addColorStop(0.65, '#121228');
      grad.addColorStop(1.0, '#05060f');
    } else {
      // 抜けるような快晴の青空
      grad.addColorStop(0.0, '#0d47c4');
      grad.addColorStop(0.26, '#2678f0');
      grad.addColorStop(0.45, '#6cb9ff');
      grad.addColorStop(0.54, '#cbeeff');
      grad.addColorStop(0.58, '#eef9ff');
      grad.addColorStop(0.72, '#88c690');
      grad.addColorStop(1.0, '#3a7a4a');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (theme === 'neon') {
      // 満天の星とオーロラ帯
      for (let i = 0; i < 900; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * (canvas.height * 0.48);
        const r = 0.6 + Math.random() * 1.8;
        ctx.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.65})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // 月の輝き
      const moonGrad = ctx.createRadialGradient(1450, 260, 12, 1450, 260, 140);
      moonGrad.addColorStop(0, 'rgba(240, 250, 255, 1)');
      moonGrad.addColorStop(0.18, 'rgba(180, 225, 255, 0.7)');
      moonGrad.addColorStop(1, 'rgba(100, 160, 255, 0)');
      ctx.fillStyle = moonGrad;
      ctx.beginPath();
      ctx.arc(1450, 260, 140, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 太陽とハロー
      const sunX = theme === 'sunset' ? 520 : 620;
      const sunY = theme === 'sunset' ? 495 : 290;
      const sunGrad = ctx.createRadialGradient(sunX, sunY, 16, sunX, sunY, 240);
      if (theme === 'sunset') {
        sunGrad.addColorStop(0, 'rgba(255, 255, 235, 1)');
        sunGrad.addColorStop(0.16, 'rgba(255, 220, 120, 0.95)');
        sunGrad.addColorStop(0.42, 'rgba(255, 130, 50, 0.45)');
        sunGrad.addColorStop(1, 'rgba(255, 80, 30, 0)');
      } else {
        sunGrad.addColorStop(0, 'rgba(255, 255, 240, 1)');
        sunGrad.addColorStop(0.14, 'rgba(255, 250, 200, 0.85)');
        sunGrad.addColorStop(0.45, 'rgba(255, 245, 210, 0.25)');
        sunGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      }
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 240, 0, Math.PI * 2);
      ctx.fill();

      // 遠景の薄い雲帯
      const drawSoftCloud = (cx, cy, sx, sy, alpha) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(sx, sy);
        const cg = ctx.createRadialGradient(0, 0, 10, 0, 0, 90);
        const col = theme === 'sunset' ? `rgba(255, 195, 140, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
        cg.addColorStop(0, col);
        cg.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(0, 0, 90, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      for (let i = 0; i < 24; i++) {
        drawSoftCloud(
          Math.random() * canvas.width,
          240 + Math.random() * 210,
          1.2 + Math.random() * 2.2,
          0.35 + Math.random() * 0.4,
          0.25 + Math.random() * 0.35
        );
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  },

  // スターアイテム用のアイコンSVGデータURL
  getStarIconDataUrl() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fff8a6"/>
          <stop offset="50%" stop-color="#ffd000"/>
          <stop offset="100%" stop-color="#ff6b00"/>
        </linearGradient>
      </defs>
      <polygon points="50,6 63,35 95,38 71,59 78,91 50,74 22,91 29,59 5,38 37,35"
        fill="url(#g)" stroke="#ffffff" stroke-width="5" stroke-linejoin="round"/>
      <circle cx="42" cy="48" r="4" fill="#181822"/>
      <circle cx="58" cy="48" r="4" fill="#181822"/>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
};
