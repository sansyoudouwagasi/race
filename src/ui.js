import { TextureFactory } from './textures.js';

const ITEM_META = {
  1: { name: 'DASH', src: '1.png', color: '#00ff88' },
  2: { name: 'TRAP', src: '2.png', color: '#ff3366' },
  3: { name: 'SHOT', src: '3.png', color: '#ffaa00' },
  4: { name: 'STAR', src: null, color: '#ffea00' }
};

export class GameUI {
  constructor(world, sound, callbacks = {}) {
    this.world = world;
    this.sound = sound;
    this.callbacks = callbacks;
    this.starIconUrl = TextureFactory.getStarIconDataUrl();

    this.input = {
      gas: false,
      brake: false,
      left: false,
      right: false,
      drift: false,
      item: false,
      lookBack: false
    };

    // スマホ向けオートアクセル（タッチ端末ではデフォルトON、いつでも切替可能）
    this.isTouchDevice = false;
    this.autoGas = false;
    this.manualGas = false;

    // DOMキャッシュ
    this.hudEl = document.getElementById('hud');
    this.rankValue = document.getElementById('rank-value');
    this.lapValue = document.getElementById('lap-value');
    this.timerValue = document.getElementById('timer-value');
    this.coinValue = document.getElementById('coin-value');
    this.speedValue = document.getElementById('speed-value');
    this.speedBarFill = document.getElementById('speed-bar-fill');
    this.driftBarFill = document.getElementById('drift-bar-fill');
    this.driftLabel = document.getElementById('drift-label');
    this.itemIcon = document.getElementById('item-icon');
    this.itemSpinner = document.getElementById('item-spinner');
    this.itemSlot = document.getElementById('item-slot');
    this.itemBadge = document.getElementById('item-badge');
    this.speedLines = document.getElementById('speed-lines');
    this.actionBanner = document.getElementById('action-banner');
    this.wrongWayEl = document.getElementById('wrong-way');
    this.btnMute = document.getElementById('btn-mute');
    this.btnCamera = document.getElementById('btn-camera');
    this.btnBackMenu = document.getElementById('btn-back-menu');

    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas.getContext('2d');

    this.lastRouletteFrame = -1;
    this.bannerTimer = null;

    this.setupMinimapParams();
    this.setupKeyboardInput();
    this.setupTouchInput();
    this.setupTopButtons();
  }

  setWorld(world) {
    this.world = world;
    this.setupMinimapParams();
  }

  setupTopButtons() {
    if (this.btnMute) {
      this.btnMute.addEventListener('click', () => {
        this.sound.init();
        const muted = this.sound.toggleMute();
        this.btnMute.textContent = muted ? '🔇' : '🔊';
        this.btnMute.classList.toggle('muted', muted);
      });
    }
    if (this.btnCamera) {
      this.btnCamera.addEventListener('click', () => {
        if (this.callbacks.onToggleCamera) this.callbacks.onToggleCamera();
      });
    }
    if (this.btnBackMenu) {
      this.btnBackMenu.addEventListener('click', () => {
        if (this.callbacks.onReturnMenu) this.callbacks.onReturnMenu();
      });
    }
  }

  setupKeyboardInput() {
    const handleKey = (e, isDown) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
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
          this.input.left = isDown;
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.input.right = isDown;
          break;
        case 'Space':
          this.input.drift = isDown;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyE':
        case 'KeyX':
          this.input.item = isDown;
          break;
        case 'KeyB':
          this.input.lookBack = isDown;
          break;
        case 'KeyC':
          if (isDown && !e.repeat && this.callbacks.onToggleCamera) {
            this.callbacks.onToggleCamera();
          }
          break;
        case 'KeyM':
          if (isDown && !e.repeat && this.btnMute) {
            this.btnMute.click();
          }
          break;
      }
    };

    window.addEventListener('keydown', (e) => handleKey(e, true));
    window.addEventListener('keyup', (e) => handleKey(e, false));
  }

  setupTouchInput() {
    const detectTouch = () => {
      return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
      );
    };

    const enableTouchMode = () => {
      if (this.isTouchDevice) return;
      this.isTouchDevice = true;
      this.autoGas = true;
      document.body.classList.add('touch-device');
      const autoBtn = document.getElementById('btn-auto-gas');
      if (autoBtn) autoBtn.classList.add('active');
    };

    if (detectTouch()) {
      enableTouchMode();
    } else {
      // デスクトップ判定でも実際にタッチされたら即タッチUIを有効化
      window.addEventListener('touchstart', () => enableTouchMode(), { once: true, passive: true });
    }

    // 1. スライド対応ステアリングパッド（◀と▶の間を指を離さず滑らせても切り替わる！）
    const steerPad = document.getElementById('steer-pad');
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');

    const updateSteerFromTouches = (touches) => {
      if (!steerPad) return;
      const rect = steerPad.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      let leftActive = false;
      let rightActive = false;

      for (let i = 0; i < touches.length; i++) {
        const t = touches[i];
        // ステアリングパッド付近にある指だけを対象にする（右手のタッチを無視）
        if (
          t.clientX >= rect.left - 45 &&
          t.clientX <= rect.right + 45 &&
          t.clientY >= rect.top - 55 &&
          t.clientY <= rect.bottom + 55
        ) {
          if (t.clientX < midX) leftActive = true;
          else rightActive = true;
        }
      }

      this.input.left = leftActive;
      this.input.right = rightActive;
      if (btnLeft) btnLeft.classList.toggle('pressed', leftActive);
      if (btnRight) btnRight.classList.toggle('pressed', rightActive);
    };

    if (steerPad) {
      const handleSteerTouch = (e) => {
        e.preventDefault();
        enableTouchMode();
        this.sound.init();
        updateSteerFromTouches(e.touches);
      };
      steerPad.addEventListener('touchstart', handleSteerTouch, { passive: false });
      steerPad.addEventListener('touchmove', handleSteerTouch, { passive: false });
      steerPad.addEventListener('touchend', handleSteerTouch, { passive: false });
      steerPad.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        this.input.left = false;
        this.input.right = false;
        if (btnLeft) btnLeft.classList.remove('pressed');
        if (btnRight) btnRight.classList.remove('pressed');
      }, { passive: false });
    }

    // 2. 右側アクションボタン（マルチタッチ安全対応）
    const bindHoldButton = (btnId, onChange) => {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      const start = (e) => {
        e.preventDefault();
        enableTouchMode();
        this.sound.init();
        btn.classList.add('pressed');
        onChange(true);
      };
      const end = (e) => {
        e.preventDefault();
        btn.classList.remove('pressed');
        onChange(false);
      };
      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', end, { passive: false });
      btn.addEventListener('touchcancel', end, { passive: false });
    };

    bindHoldButton('btn-gas', (down) => {
      this.manualGas = down;
      this.input.gas = down;
    });
    bindHoldButton('btn-brake', (down) => {
      this.input.brake = down;
    });
    bindHoldButton('btn-drift', (down) => {
      this.input.drift = down;
    });
    bindHoldButton('btn-item', (down) => {
      if (down) this.input.item = true;
    });

    // アイテムスロット自体をタップしてもアイテム発動できるようにする
    if (this.itemSlot) {
      this.itemSlot.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.sound.init();
        this.input.item = true;
      }, { passive: false });
      this.itemSlot.addEventListener('click', () => {
        this.sound.init();
        this.input.item = true;
      });
    }

    // オートアクセル切替ボタン
    const autoBtn = document.getElementById('btn-auto-gas');
    if (autoBtn) {
      const toggleAuto = (e) => {
        e.preventDefault();
        this.autoGas = !this.autoGas;
        autoBtn.classList.toggle('active', this.autoGas);
        this.showBanner(this.autoGas ? 'AUTO ACCEL: ON' : 'AUTO ACCEL: OFF', this.autoGas ? '#00ff88' : '#ffcc00', 900);
      };
      autoBtn.addEventListener('touchstart', toggleAuto, { passive: false });
      autoBtn.addEventListener('click', toggleAuto);
    }
  }

  // レース中に入力状態（オートアクセル反映済み）を取得
  getRaceInput() {
    return {
      gas: this.input.gas || (this.isTouchDevice && this.autoGas && !this.input.brake),
      brake: this.input.brake,
      left: this.input.left,
      right: this.input.right,
      drift: this.input.drift,
      item: this.input.item,
      lookBack: this.input.lookBack
    };
  }

  setHUDVisible(visible) {
    if (this.hudEl) {
      this.hudEl.style.display = visible ? 'grid' : 'none';
    }
  }

  showBanner(text, color = '#00f0ff', duration = 1400) {
    if (!this.actionBanner) return;
    if (this.bannerTimer) clearTimeout(this.bannerTimer);

    this.actionBanner.textContent = text;
    this.actionBanner.style.color = color;
    this.actionBanner.style.textShadow = `0 0 18px ${color}, 0 4px 14px rgba(0,0,0,0.8)`;
    this.actionBanner.classList.remove('show');
    void this.actionBanner.offsetWidth;
    this.actionBanner.classList.add('show');

    this.bannerTimer = setTimeout(() => {
      this.actionBanner.classList.remove('show');
    }, duration);
  }

  setupMinimapParams() {
    const points = this.world.cachedPoints;
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    points.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    });

    this.mapBounds = { minX, maxX, minZ, maxZ };
    this.minimapCanvas.width = 160;
    this.minimapCanvas.height = 160;
  }

  worldToMinimap(x, z) {
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const bounds = this.mapBounds;
    const padding = 18;
    const dx = bounds.maxX - bounds.minX || 1;
    const dz = bounds.maxZ - bounds.minZ || 1;
    const scale = Math.min((w - padding * 2) / dx, (h - padding * 2) / dz);
    return {
      x: w / 2 + (x - (bounds.maxX + bounds.minX) / 2) * scale,
      y: h / 2 + (z - (bounds.maxZ + bounds.minZ) / 2) * scale
    };
  }

  drawMinimap(playerCart, rivals) {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    ctx.clearRect(0, 0, w, h);

    // コース輪郭（黒縁＋白線）
    const points = this.world.cachedPoints;
    const tracePath = () => {
      ctx.beginPath();
      for (let i = 0; i <= points.length; i++) {
        const p = points[i % points.length];
        const pos = this.worldToMinimap(p.x, p.z);
        if (i === 0) ctx.moveTo(pos.x, pos.y);
        else ctx.lineTo(pos.x, pos.y);
      }
      ctx.closePath();
    };

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    tracePath();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = 8;
    ctx.stroke();

    tracePath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // スタート地点マーク
    const sp = this.worldToMinimap(points[0].x, points[0].z);
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // ライバルのプロット（各固有カラー）
    rivals.forEach(r => {
      const pos = this.worldToMinimap(r.physics.position.x, r.physics.position.z);
      const hex = '#' + r.color.toString(16).padStart(6, '0');
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // プレイヤー（大きく光る白縁シアン）
    const pPos = this.worldToMinimap(playerCart.position.x, playerCart.position.z);
    ctx.fillStyle = '#00f0ff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(pPos.x, pPos.y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  getSortedStandings(playerCart, rivals) {
    const list = [
      { physics: playerCart, isPlayer: true, name: 'YOU', color: 0x00f0ff },
      ...rivals.map(r => ({ physics: r.physics, isPlayer: false, name: r.name, color: r.color }))
    ];
    list.sort((a, b) => {
      if (a.physics.finished && b.physics.finished) {
        return (a.physics.finishTime || 0) - (b.physics.finishTime || 0);
      }
      if (a.physics.finished) return -1;
      if (b.physics.finished) return 1;
      return b.physics.totalProgress - a.physics.totalProgress;
    });
    return list;
  }

  updateRankings(playerCart, rivals) {
    const standings = this.getSortedStandings(playerCart, rivals);
    let playerRank = 1;
    standings.forEach((item, idx) => {
      if (item.isPlayer) playerRank = idx + 1;
    });

    const suffixes = ['st', 'nd', 'rd', 'th', 'th', 'th'];
    const colors = ['#ffd700', '#e2e8f0', '#f59e0b', '#94a3b8', '#94a3b8', '#94a3b8'];
    const rankStr = `<span style="color:${colors[playerRank - 1]}">${playerRank}</span><span class="sub">${suffixes[playerRank - 1]} / ${standings.length}</span>`;
    if (this.rankValue.innerHTML !== rankStr) {
      this.rankValue.innerHTML = rankStr;
    }
    return playerRank;
  }

  // バグ修正済み: isRollingItem を最優先でチェック！
  updateItemSlot(playerCart, time) {
    if (playerCart.isRollingItem) {
      // ルーレット抽選アニメーション（絵柄を高速切替！）
      this.itemSpinner.style.display = 'none';
      this.itemIcon.style.display = 'block';

      const frameIdx = Math.floor(time * 11);
      if (this.lastRouletteFrame !== frameIdx) {
        this.lastRouletteFrame = frameIdx;
        this.sound.playRoulette();
      }
      const previewId = (frameIdx % 4) + 1;
      const meta = ITEM_META[previewId];
      this.itemIcon.src = previewId === 4 ? this.starIconUrl : meta.src;
      this.itemSlot.style.borderColor = '#ffcc00';
      this.itemSlot.style.boxShadow = '0 0 24px rgba(255, 204, 0, 0.75)';
      if (this.itemBadge) {
        this.itemBadge.textContent = 'ROLLING...';
        this.itemBadge.style.color = '#ffcc00';
      }
    } else if (playerCart.activeItem === 0) {
      this.itemIcon.style.display = 'none';
      this.itemSpinner.style.display = 'block';
      this.itemSpinner.textContent = '?';
      this.itemSlot.style.borderColor = 'rgba(255,255,255,0.22)';
      this.itemSlot.style.boxShadow = 'none';
      if (this.itemBadge) {
        this.itemBadge.textContent = 'EMPTY';
        this.itemBadge.style.color = 'rgba(255,255,255,0.45)';
      }
    } else {
      const meta = ITEM_META[playerCart.activeItem] || ITEM_META[1];
      this.itemSpinner.style.display = 'none';
      this.itemIcon.style.display = 'block';
      this.itemIcon.src = playerCart.activeItem === 4 ? this.starIconUrl : meta.src;
      this.itemSlot.style.borderColor = meta.color;
      this.itemSlot.style.boxShadow = `0 0 22px ${meta.color}99`;
      if (this.itemBadge) {
        this.itemBadge.textContent = meta.name;
        this.itemBadge.style.color = meta.color;
      }
    }
  }

  formatTime(sec) {
    const safe = Math.max(0, sec);
    const m = Math.floor(safe / 60);
    const s = Math.floor(safe % 60);
    const cs = Math.floor((safe % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  updateHUD(playerCart, rivals, time, elapsedTime = 0) {
    // スピードメーター (km/h 換算＆プログレスバー)
    const speedKmh = Math.max(0, Math.floor(playerCart.speed * 4.2));
    this.speedValue.textContent = speedKmh;
    const maxDisplaySpeed = 210;
    const speedPct = Math.min(100, (speedKmh / maxDisplaySpeed) * 100);
    if (this.speedBarFill) {
      this.speedBarFill.style.width = `${speedPct}%`;
      const boosting = playerCart.boostTime > 0 || playerCart.starTime > 0;
      this.speedBarFill.style.background = boosting
        ? 'linear-gradient(90deg, #ffea00, #ff007f)'
        : 'linear-gradient(90deg, #00f0ff, #00ff88)';
    }

    // スピードライン（ブースト中または超高速時に表示）
    if (this.speedLines) {
      const intense = playerCart.boostTime > 0 || playerCart.starTime > 0 || speedKmh > 158;
      this.speedLines.classList.toggle('active', intense);
    }

    // ドリフトチャージバー
    if (this.driftBarFill && this.driftLabel) {
      if (playerCart.isDrifting) {
        const pct = Math.min(100, (playerCart.driftTime / 2.7) * 100);
        this.driftBarFill.style.width = `${pct}%`;
        const cols = ['#ffffff', '#00f0ff', '#ff9900', '#e040ff'];
        const labels = ['DRIFT', 'MINI-TURBO', 'SUPER TURBO!', 'ULTRA TURBO!!'];
        this.driftBarFill.style.background = cols[playerCart.driftCharge];
        this.driftLabel.textContent = labels[playerCart.driftCharge];
        this.driftLabel.style.color = cols[playerCart.driftCharge];
      } else if (playerCart.slipstreamCharge > 0.08) {
        this.driftBarFill.style.width = `${Math.min(100, playerCart.slipstreamCharge * 100)}%`;
        this.driftBarFill.style.background = '#7ce8ff';
        this.driftLabel.textContent = 'SLIPSTREAM';
        this.driftLabel.style.color = '#7ce8ff';
      } else {
        this.driftBarFill.style.width = '0%';
        this.driftLabel.textContent = 'TURBO';
        this.driftLabel.style.color = 'rgba(255,255,255,0.45)';
      }
    }

    // コイン数
    if (this.coinValue) {
      this.coinValue.textContent = `${playerCart.coins}/10`;
    }

    // LAP & タイマー
    const lapDisplay = Math.min(playerCart.lap + 1, 3);
    this.lapValue.innerHTML = `${lapDisplay}<span class="sub">/3</span>`;
    if (this.timerValue) {
      this.timerValue.textContent = this.formatTime(elapsedTime);
    }

    // 逆走警告
    if (this.wrongWayEl) {
      this.wrongWayEl.style.display = playerCart.isWrongWay ? 'block' : 'none';
    }

    // アイテム枠
    this.updateItemSlot(playerCart, time);

    // ミニマップ
    this.drawMinimap(playerCart, rivals);

    // 順位
    return this.updateRankings(playerCart, rivals);
  }

  // 全6台リザルト表の描画
  renderResultScreen(playerCart, rivals, totalTime) {
    const standings = this.getSortedStandings(playerCart, rivals);
    let playerRank = 1;
    standings.forEach((s, i) => { if (s.isPlayer) playerRank = i + 1; });

    const titleEl = document.getElementById('result-title');
    if (titleEl) {
      titleEl.textContent = playerRank === 1 ? '🏆 VICTORY!' : 'FINISH!';
    }
    document.getElementById('final-rank').textContent = `${playerRank}位`;
    document.getElementById('final-time').textContent = this.formatTime(totalTime);

    const bestLapEl = document.getElementById('final-best-lap');
    if (bestLapEl) {
      bestLapEl.textContent = Number.isFinite(playerCart.bestLapTime)
        ? this.formatTime(playerCart.bestLapTime)
        : '--:--.--';
    }

    const listEl = document.getElementById('standings-list');
    if (listEl) {
      listEl.innerHTML = standings.map((entry, idx) => {
        const hex = '#' + entry.color.toString(16).padStart(6, '0');
        const tStr = entry.physics.finished
          ? this.formatTime(entry.physics.finishTime)
          : (entry.isPlayer ? this.formatTime(totalTime) : 'RACING');
        return `<div class="standing-row ${entry.isPlayer ? 'is-player' : ''}">
          <span class="st-pos">${idx + 1}</span>
          <span class="st-dot" style="background:${hex}"></span>
          <span class="st-name">${entry.name}</span>
          <span class="st-time">${tStr}</span>
        </div>`;
      }).join('');
    }
  }
}
