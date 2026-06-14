import * as THREE from 'three';

export class GameUI {
  constructor(world, sound) {
    this.world = world;
    this.sound = sound;
    
    // 入力状態のマッピング
    this.input = {
      gas: false,
      brake: false,
      left: false,
      right: false,
      drift: false,
      item: false
    };
    
    // HTML要素のキャッシュ
    this.rankValue = document.getElementById('rank-value');
    this.lapValue = document.getElementById('lap-value');
    this.speedValue = document.getElementById('speed-value');
    this.itemIcon = document.getElementById('item-icon');
    this.itemSpinner = document.getElementById('item-spinner');
    this.itemSlot = document.getElementById('item-slot');
    
    // ミニマップ用キャンバスの初期化
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas.getContext('2d');
    
    this.lastRouletteFrame = -1;
    
    this.setupMinimapParams();
    this.setupKeyboardInput();
    this.setupTouchInput();
  }
  
  // キーボードイベントの設定
  setupKeyboardInput() {
    const handleKey = (e, isDown) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.input.gas = isDown;
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.input.brake = isDown;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.input.right = isDown; // カメラ視点に合わせるため左右を反転
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.input.left = isDown;  // カメラ視点に合わせるため左右を反転
          break;
        case 'Space':
          this.input.drift = isDown;
          break;
        case 'ShiftLeft':
        case 'KeyE':
          this.input.item = isDown;
          break;
      }
    };
    
    window.addEventListener('keydown', (e) => handleKey(e, true));
    window.addEventListener('keyup', (e) => handleKey(e, false));
  }
  
  // スマホ・タブレット用タッチイベントの設定
  setupTouchInput() {
    // タッチ対応端末か判定
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouch) {
      document.body.classList.add('touch-device');
    }
    
    const bindTouchButton = (btnId, inputKey) => {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      
      const handleStart = (e) => {
        e.preventDefault();
        this.input[inputKey] = true;
      };
      
      const handleEnd = (e) => {
        e.preventDefault();
        this.input[inputKey] = false;
      };
      
      btn.addEventListener('touchstart', handleStart, { passive: false });
      btn.addEventListener('touchend', handleEnd, { passive: false });
      btn.addEventListener('touchcancel', handleEnd, { passive: false });
    };
    
    // モバイルボタンへのバインド (カメラ視点に合わせるため左右を反転)
    bindTouchButton('btn-left', 'right');
    bindTouchButton('btn-right', 'left');
    bindTouchButton('btn-gas', 'gas');
    bindTouchButton('btn-brake', 'brake');
    bindTouchButton('btn-drift', 'drift');
    bindTouchButton('btn-item', 'item');
  }
  
  // ミニマップ描画用スケーリングパラメータの算出
  setupMinimapParams() {
    const points = this.world.cachedPoints;
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    // 全体の境界（バウンディングボックス）を求める
    points.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    });
    
    this.mapBounds = { minX, maxX, minZ, maxZ };
    
    // リサイズ対応など
    this.minimapCanvas.width = 140;
    this.minimapCanvas.height = 140;
  }
  
  // 3D座標からミニマップ2D座標への変換
  worldToMinimap(x, z) {
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    
    const bounds = this.mapBounds;
    const padding = 15; // ミニマップ端の余白
    
    const dx = bounds.maxX - bounds.minX;
    const dz = bounds.maxZ - bounds.minZ;
    
    // アスペクト比を維持しつつスケーリング
    const scale = Math.min((w - padding * 2) / dx, (h - padding * 2) / dz);
    
    const mapX = w / 2 + (x - (bounds.maxX + bounds.minX) / 2) * scale;
    const mapY = h / 2 + (z - (bounds.maxZ + bounds.minZ) / 2) * scale;
    
    return { x: mapX, y: mapY };
  }
  
  // ミニマップの描画更新
  drawMinimap(playerCart, rivals) {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    // 1. コース形状の描画
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const points = this.world.cachedPoints;
    for (let i = 0; i <= points.length; i++) {
      const p = points[i % points.length];
      const pos = this.worldToMinimap(p.x, p.z);
      if (i === 0) {
        ctx.moveTo(pos.x, pos.y);
      } else {
        ctx.lineTo(pos.x, pos.y);
      }
    }
    ctx.stroke();
    
    // 2. スタートラインの目印
    const startPoint = points[0];
    const startPos = this.worldToMinimap(startPoint.x, startPoint.z);
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.arc(startPos.x, startPos.y, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // 3. ライバルカートのプロット (赤点)
    rivals.forEach(ai => {
      const pos = this.worldToMinimap(ai.position.x, ai.position.z);
      ctx.fillStyle = '#ff0050';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3.5, 0, Math.PI * 2);
      ctx.shadowColor = '#ff0050';
      ctx.shadowBlur = 4;
      ctx.fill();
    });
    
    // 4. プレイヤーカートのプロット (青点、少し大きく光らせる)
    const pPos = this.worldToMinimap(playerCart.position.x, playerCart.position.z);
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(pPos.x, pPos.y, 5, 0, Math.PI * 2);
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 6;
    ctx.fill();
    
    // シャドウリセット
    ctx.shadowBlur = 0;
  }
  
  // リアルタイム順位計算
  updateRankings(playerCart, rivals) {
    // 全カートを一つのリストに統合
    const carts = [
      { cart: playerCart, isPlayer: true },
      ...rivals.map(ai => ({ cart: ai, isPlayer: false }))
    ];
    
    // totalProgress（周回数 + 周回進行度）でソート
    carts.sort((a, b) => b.cart.totalProgress - a.cart.totalProgress);
    
    let playerRank = 1;
    carts.forEach((item, index) => {
      if (item.isPlayer) {
        playerRank = index + 1;
      }
    });
    
    // 順位表示の更新 (1st, 2nd, 3rd, 4th)
    const suffix = ['st', 'nd', 'rd', 'th'];
    const rankStr = playerRank + `<span class="sub">/${carts.length}${suffix[playerRank - 1]}</span>`;
    if (this.rankValue.innerHTML !== rankStr) {
      this.rankValue.innerHTML = rankStr;
    }
    
    return playerRank;
  }
  
  // アイテムスロット表示の更新
  updateItemSlot(playerCart, time) {
    if (playerCart.activeItem === 0) {
      // アイテムなし
      this.itemIcon.style.display = 'none';
      this.itemSpinner.style.display = 'block';
      this.itemSpinner.innerText = '?';
      this.itemSlot.style.borderColor = 'rgba(255,255,255,0.2)';
      this.itemSlot.style.boxShadow = 'none';
    } else if (playerCart.isRollingItem) {
      // 抽選中（ルーレットアニメーション）
      this.itemIcon.style.display = 'none';
      this.itemSpinner.style.display = 'block';
      
      // 一定間隔（約110ms）でルーレット音を鳴らす
      const frameIdx = Math.floor(time * 9);
      if (this.lastRouletteFrame !== frameIdx) {
        this.lastRouletteFrame = frameIdx;
        this.sound.playRoulette();
      }
      
      // 高速で「？」を点滅、またはランダムで文字を変更
      const symbols = ['?', '!', '★', '✸'];
      this.itemSpinner.innerText = symbols[Math.floor(time * 15) % symbols.length];
      this.itemSlot.style.borderColor = '#ffcc00';
    } else {
      // 抽選完了（獲得したアイテム画像を表示）
      this.itemSpinner.style.display = 'none';
      this.itemIcon.style.display = 'block';
      this.itemIcon.src = `${playerCart.activeItem}.png`;
      this.itemSlot.style.borderColor = '#00f0ff';
      this.itemSlot.style.boxShadow = '0 0 15px rgba(0, 240, 255, 0.4)';
    }
  }
  
  // HUDの各表示情報を毎フレーム更新
  updateHUD(playerCart, rivals, time) {
    // 1. スピードメーターの更新 (m/s -> km/h 換算)
    const speedKmh = Math.max(0, Math.floor(playerCart.speed * 3.6));
    this.speedValue.innerText = speedKmh;
    
    // 2. LAP表示の更新 (3周でゴール)
    const lapDisplay = Math.min(playerCart.lap + 1, 3);
    this.lapValue.innerHTML = lapDisplay + '<span class="sub">/3</span>';
    
    // 3. アイテム枠の更新
    this.updateItemSlot(playerCart, time);
    
    // 4. ミニマップの描画
    this.drawMinimap(playerCart, rivals);
    
    // 5. 順位の計算と更新
    const rank = this.updateRankings(playerCart, rivals);
    return rank;
  }
}
