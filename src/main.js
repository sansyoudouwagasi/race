import * as THREE from 'three';
import { GameWorld, COURSE_PRESETS } from './world.js';
import { CartPhysics } from './physics.js';
import { RivalAI, RIVAL_PROFILES } from './ai.js';
import { GameUI } from './ui.js';
import { ParticleSystem } from './particles.js';
import { SoundManager } from './sound.js';
import { createCartMesh, updateCartVisual } from './cart.js';

class GameManager {
  constructor() {
    this.gameState = 'MENU'; // MENU, READY, RACING, FINISHED
    this.currentCourseId = 'sunshine';
    this.countdownTimer = 3.6;
    this.elapsedTime = 0;
    this.rocketChargeTime = 0;
    this.cameraMode = 0; // 0: 標準, 1: ダイナミック近接, 2: ワイド俯瞰
    this.cameraShake = 0;
    this.overlayHideTimer = null;
    this.itemRollTimer = null;

    this.initThree();
    this.sound = new SoundManager();
    this.particles = new ParticleSystem(this.scene);

    this.traps = [];
    this.projectiles = [];
    this.rivals = [];
    this.playerMesh = null;
    this.playerPhysics = null;

    // ライティング参照
    this.ambientLight = null;
    this.dirLight = null;
    this.hemiLight = null;
    this.setupLights();

    // 初期ワールド構築
    this.world = new GameWorld(this.scene, this.currentCourseId);
    this.applyCourseLighting(this.world.preset);

    this.ui = new GameUI(this.world, this.sound, {
      onToggleCamera: () => this.toggleCameraMode(),
      onReturnMenu: () => this.returnToMenu()
    });
    this.ui.setHUDVisible(false);

    this.setupPlayers();
    this.setupMenuBindings();

    // 画面回転・リサイズ時に確実にカメラとキャンバスを追従させる
    window.addEventListener('resize', () => this.onWindowResize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.onWindowResize(), 120);
    });
    document.getElementById('btn-restart').addEventListener('click', () => this.startRace(this.currentCourseId));
    const btnResultMenu = document.getElementById('btn-result-menu');
    if (btnResultMenu) {
      btnResultMenu.addEventListener('click', () => this.returnToMenu());
    }

    this.clock = new THREE.Clock();
    this.animate();
  }

  initThree() {
    this.isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      ('ontouchstart' in window && navigator.maxTouchPoints > 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.2, 2400);

    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('game-canvas'),
      antialias: !this.isMobile,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  setupLights() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xfff8e6, 1.45);
    this.dirLight.position.set(140, 210, 90);
    this.dirLight.castShadow = true;
    const shadowSize = this.isMobile ? 1024 : 2048;
    this.dirLight.shadow.mapSize.width = shadowSize;
    this.dirLight.shadow.mapSize.height = shadowSize;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 520;
    this.dirLight.shadow.bias = -0.0005;

    const d = 95;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;

    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    this.hemiLight = new THREE.HemisphereLight(0x87ceff, 0x4c8c42, 0.55);
    this.scene.add(this.hemiLight);
  }

  applyCourseLighting(preset) {
    this.ambientLight.color.setHex(preset.ambientColor);
    this.ambientLight.intensity = preset.ambientIntensity;
    this.dirLight.color.setHex(preset.sunColor);
    this.dirLight.intensity = preset.sunIntensity;
    this.hemiLight.color.setHex(preset.hemiSky);
    this.hemiLight.groundColor.setHex(preset.hemiGround);
    this.hemiLight.intensity = preset.hemiIntensity;
    this.sunOffset = preset.sunPos.clone().normalize().multiplyScalar(170);
  }

  setupMenuBindings() {
    const cards = document.querySelectorAll('.course-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const cid = card.dataset.course;
        if (!COURSE_PRESETS[cid]) return;
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        if (cid !== this.currentCourseId) {
          this.loadCourse(cid);
        }
      });
    });

    const startBtn = document.getElementById('btn-start-race');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.sound.init();
        this.startRace(this.currentCourseId);
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' && this.gameState === 'MENU') {
        this.sound.init();
        this.startRace(this.currentCourseId);
      }
    });
  }

  loadCourse(courseId) {
    this.currentCourseId = courseId;
    this.clearDynamicEntities();
    if (this.world) {
      this.world.dispose();
    }
    this.world = new GameWorld(this.scene, courseId);
    this.applyCourseLighting(this.world.preset);
    this.ui.setWorld(this.world);
    this.setupPlayers();
  }

  clearDynamicEntities() {
    if (this.itemRollTimer) { clearTimeout(this.itemRollTimer); this.itemRollTimer = null; }
    if (this.overlayHideTimer) { clearTimeout(this.overlayHideTimer); this.overlayHideTimer = null; }

    this.traps.forEach(t => this.scene.remove(t.mesh));
    this.projectiles.forEach(p => this.scene.remove(p.mesh));
    this.traps = [];
    this.projectiles = [];
    this.particles.clear();

    if (this.playerMesh) {
      this.scene.remove(this.playerMesh);
      this.playerMesh = null;
    }
    this.rivals.forEach(r => this.scene.remove(r.mesh));
    this.rivals = [];
  }

  setupPlayers() {
    if (this.playerMesh) this.scene.remove(this.playerMesh);
    this.rivals.forEach(r => this.scene.remove(r.mesh));
    this.rivals = [];

    const startPoint = this.world.trackCurve.getPointAt(0);
    const tangent = this.world.trackCurve.getTangentAt(0).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const startDir = Math.atan2(tangent.x, tangent.z);

    // 6台スタートグリッド（プレイヤーは4番手から追い上げスタートで燃える配置！）
    const gridSlots = [
      { t: -3.5, n: -3.0 },  // Rival 0
      { t: -6.5, n: 3.0 },   // Rival 1
      { t: -9.5, n: -3.0 },  // Rival 2
      { t: -12.5, n: 3.0 },  // Player (4番グリッド)
      { t: -15.5, n: -3.0 }, // Rival 3
      { t: -18.5, n: 3.0 }   // Rival 4
    ];

    const pSlot = gridSlots[3];
    const playerPos = startPoint.clone()
      .addScaledVector(tangent, pSlot.t)
      .addScaledVector(normal, pSlot.n);
    this.playerPhysics = new CartPhysics(playerPos, true, 'YOU', 36.0);
    this.playerPhysics.direction = startDir;
    this.playerMesh = createCartMesh(0x00f0ff, 1, true);
    this.scene.add(this.playerMesh);

    const rivalSlotIndices = [0, 1, 2, 4, 5];
    RIVAL_PROFILES.forEach((profile, i) => {
      const slot = gridSlots[rivalSlotIndices[i]];
      const aiPos = startPoint.clone()
        .addScaledVector(tangent, slot.t)
        .addScaledVector(normal, slot.n);
      const aiPhys = new CartPhysics(aiPos, false, profile.name, 35.0);
      aiPhys.direction = startDir;
      const aiMesh = createCartMesh(profile.color, i + 2, false);
      this.scene.add(aiMesh);
      const aiCtrl = new RivalAI(aiPhys, i, this.world, profile);

      this.rivals.push({
        physics: aiPhys,
        mesh: aiMesh,
        ai: aiCtrl,
        color: profile.color,
        name: profile.name
      });
    });
  }

  startRace(courseId = this.currentCourseId) {
    this.sound.init();
    this.sound.stopBGM();
    this.sound.setFinalLapMode(false);

    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('result-screen').style.display = 'none';
    this.ui.setHUDVisible(true);

    if (courseId !== this.currentCourseId) {
      this.loadCourse(courseId);
    } else {
      this.clearDynamicEntities();
      this.setupPlayers();
      this.world.coins.forEach(c => { c.active = true; c.mesh.visible = true; c.respawnTimer = 0; });
      this.world.itemBoxes.forEach(b => { b.active = true; b.mesh.visible = true; b.respawnTimer = 0; });
    }

    const overlay = document.getElementById('overlay-screen');
    const textEl = document.getElementById('countdown-text');
    overlay.style.display = 'flex';
    textEl.textContent = 'READY';
    textEl.className = 'pop color-ready';

    this.gameState = 'READY';
    this.countdownTimer = 3.6;
    this.elapsedTime = 0;
    this.rocketChargeTime = 0;
    this.world.setStartLights(0);
  }

  returnToMenu() {
    this.sound.stopBGM();
    if (this.itemRollTimer) { clearTimeout(this.itemRollTimer); this.itemRollTimer = null; }
    if (this.overlayHideTimer) { clearTimeout(this.overlayHideTimer); this.overlayHideTimer = null; }

    this.gameState = 'MENU';
    document.getElementById('result-screen').style.display = 'none';
    document.getElementById('overlay-screen').style.display = 'none';
    document.getElementById('menu-screen').style.display = 'flex';
    this.ui.setHUDVisible(false);
    this.setupPlayers();
  }

  toggleCameraMode() {
    this.cameraMode = (this.cameraMode + 1) % 3;
    const names = ['CAMERA: STANDARD', 'CAMERA: DYNAMIC CLOSE', 'CAMERA: WIDE VIEW'];
    this.ui.showBanner(names[this.cameraMode], '#00f0ff', 1000);
  }

  addCameraShake(amount) {
    this.cameraShake = Math.max(this.cameraShake, amount);
  }

  // 順位に応じたアイテム抽選テーブル（下位ほど強力なアイテムが出やすい！）
  rollItemByRank(rank) {
    const r = Math.random();
    if (rank === 1) {
      if (r < 0.55) return 2; // トラップ多め
      if (r < 0.88) return 3; // ショット
      return 1;               // ブースト
    } else if (rank <= 3) {
      if (r < 0.38) return 1;
      if (r < 0.68) return 3;
      if (r < 0.90) return 2;
      return 4;               // スター（10%）
    } else {
      if (r < 0.45) return 1; // ダッシュ
      if (r < 0.72) return 4; // 下位はスター高確率（27%）
      if (r < 0.92) return 3; // ショット
      return 2;
    }
  }

  usePlayerItem() {
    if (this.playerPhysics.activeItem === 0 || this.playerPhysics.isRollingItem) return;
    const item = this.playerPhysics.activeItem;

    if (item === 1) {
      this.playerPhysics.useMushroom();
      this.sound.playBoost();
      this.addCameraShake(0.32);
      this.ui.showBanner('MATCHA BOOST!!', '#00ff88', 1100);
      this.particles.spawnBoostFire(this.playerPhysics.position, this.playerPhysics.direction);
    } else if (item === 2) {
      this.spawnTrap(this.playerPhysics);
      this.sound.playDrop();
    } else if (item === 3) {
      this.spawnProjectile(this.playerPhysics);
      this.sound.playThrow();
    } else if (item === 4) {
      this.playerPhysics.useStar();
      this.sound.playStar();
      this.addCameraShake(0.35);
      this.ui.showBanner('★ RAINBOW STAR! ★', '#ffea00', 1500);
    }
    this.playerPhysics.activeItem = 0;
  }

  useRivalItem(aiPhysics) {
    const item = aiPhysics.activeItem;
    if (item === 1) {
      aiPhysics.useMushroom();
      this.particles.spawnBoostFire(aiPhysics.position, aiPhysics.direction);
    } else if (item === 2) {
      this.spawnTrap(aiPhysics);
    } else if (item === 3) {
      this.spawnProjectile(aiPhysics);
    } else if (item === 4) {
      aiPhysics.useStar();
    }
    aiPhysics.activeItem = 0;
  }

  spawnTrap(cart) {
    const dir = cart.direction;
    const backVec = new THREE.Vector3(-Math.sin(dir), 0, -Math.cos(dir)).normalize();
    const trapPos = cart.position.clone().addScaledVector(backVec, 2.5);
    const prog = this.world.getTrackProgress(trapPos);
    trapPos.y = prog.point.y + 0.12;

    const trapGroup = new THREE.Group();
    trapGroup.position.copy(trapPos);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.85, 0.2, 14),
      new THREE.MeshStandardMaterial({
        color: 0xff0055,
        emissive: 0xff0044,
        emissiveIntensity: 0.75,
        roughness: 0.2
      })
    );
    trapGroup.add(base);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.08, 6, 18),
      new THREE.MeshBasicMaterial({ color: 0xffcc00 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    trapGroup.add(ring);

    const spikeGeo = new THREE.ConeGeometry(0.14, 0.5, 6);
    const spikeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(Math.sin(a) * 0.48, 0.26, Math.cos(a) * 0.48);
      spike.rotation.y = a;
      spike.rotation.x = 0.45;
      trapGroup.add(spike);
    }

    this.scene.add(trapGroup);
    this.traps.push({
      mesh: trapGroup,
      position: trapPos,
      radius: 1.0,
      owner: cart,
      graceTimer: 1.0, // 設置直後の自爆防止
      active: true
    });
  }

  spawnProjectile(cart) {
    const dir = cart.direction + cart.driftAngle * 0.35;
    const forward = new THREE.Vector3(Math.sin(dir), 0, Math.cos(dir)).normalize();
    const spawnPos = cart.position.clone().addScaledVector(forward, 2.8);
    spawnPos.y += 0.55;

    const group = new THREE.Group();
    group.position.copy(spawnPos);

    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffaa00,
        emissive: 0xff6600,
        emissiveIntensity: 0.85,
        roughness: 0.15
      })
    );
    shell.scale.set(1.15, 0.82, 1.15);
    shell.castShadow = true;
    group.add(shell);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.08, 8, 18),
      new THREE.MeshBasicMaterial({ color: 0xffee55 })
    );
    halo.rotation.x = Math.PI / 2;
    group.add(halo);

    this.scene.add(group);

    const bulletSpeed = 62.0;
    this.projectiles.push({
      mesh: group,
      position: spawnPos,
      velocity: forward.clone().multiplyScalar(bulletSpeed),
      speed: bulletSpeed,
      radius: 0.9,
      life: 5.5,
      bouncesLeft: 2, // 壁で2回バウンド！
      owner: cart
    });
  }

  handlePhysicsEvents(cart) {
    const events = cart.consumeEvents();
    if (!cart.isPlayer) return;

    events.forEach((ev) => {
      switch (ev.type) {
        case 'hop':
          this.sound.playHop();
          break;
        case 'drift_charge':
          this.sound.playDriftCharge(ev.level);
          break;
        case 'mini_turbo': {
          this.sound.playBoost();
          this.addCameraShake(0.16 + ev.level * 0.08);
          const labels = ['', 'MINI-TURBO!', 'SUPER MINI-TURBO!!', 'ULTRA MINI-TURBO!!!'];
          const cols = ['', '#00f0ff', '#ff9900', '#e040ff'];
          this.ui.showBanner(labels[ev.level], cols[ev.level], 1100);
          break;
        }
        case 'rocket_start':
          this.sound.playBoost();
          this.addCameraShake(0.35);
          this.ui.showBanner('🚀 ROCKET START!!', '#00ff88', 1500);
          break;
        case 'boost_pad':
          this.sound.playBoost();
          this.addCameraShake(0.22);
          break;
        case 'ramp_jump':
          this.sound.playHop();
          this.ui.showBanner('PRESS SPACE FOR TRICK!', '#ffdd00', 900);
          break;
        case 'trick_success':
          this.sound.playTrick();
          this.particles.spawnTrickBurst(cart.position);
          this.ui.showBanner('✨ NICE TRICK! ✨', '#ffea00', 1100);
          break;
        case 'trick_boost':
          this.sound.playBoost();
          this.addCameraShake(0.28);
          break;
        case 'land':
          if (ev.hard) this.addCameraShake(0.22);
          break;
        case 'wall_hit':
          this.sound.playBump();
          this.addCameraShake(0.18);
          this.particles.spawnSpinSparks(cart.position);
          break;
        case 'lap':
          if (ev.lap === 1) {
            this.sound.playLapChime(false);
            this.ui.showBanner('LAP 2 / 3', '#00f0ff', 1600);
          } else if (ev.lap === 2) {
            this.sound.playLapChime(true);
            this.sound.setFinalLapMode(true);
            this.ui.showBanner('🔥 FINAL LAP! 🔥', '#ff3366', 2000);
          }
          break;
      }
    });
  }

  handleInteractions(dt) {
    const playerPhys = this.playerPhysics;
    const allPhysics = [playerPhys, ...this.rivals.map(r => r.physics)];

    // 1. ジャンプ台判定
    this.world.ramps.forEach(ramp => {
      allPhysics.forEach(cart => {
        if (cart.height > 0.8 || cart.speed < 10) return;
        const dx = cart.position.x - ramp.position.x;
        const dz = cart.position.z - ramp.position.z;
        if (dx * dx + dz * dz < ramp.radius * ramp.radius) {
          cart.launchFromRamp();
        }
      });
    });

    // 3. スリップストリーム（前方のライバルのすぐ後ろを追走すると加速！）
    let drafting = false;
    if (playerPhys.speed > playerPhys.maxSpeed * 0.65 && playerPhys.spinTime <= 0) {
      const pFwd = new THREE.Vector3(Math.sin(playerPhys.direction), 0, Math.cos(playerPhys.direction));
      for (const r of this.rivals) {
        const diff = r.physics.position.clone().sub(playerPhys.position);
        diff.y = 0;
        const dist = diff.length();
        if (dist > 3.2 && dist < 15.5) {
          const dot = pFwd.dot(diff.normalize());
          if (dot > 0.93) {
            drafting = true;
            break;
          }
        }
      }
    }
    if (drafting) {
      playerPhys.slipstreamCharge += dt * 0.95;
      playerPhys.isSlipstreaming = true;
      if (Math.random() < 0.6) {
        this.particles.spawnSlipstreamWind(playerPhys.position, playerPhys.direction);
      }
      if (playerPhys.slipstreamCharge >= 1.0) {
        playerPhys.slipstreamCharge = 0;
        playerPhys.triggerBoost(1.2, 1.32);
        this.sound.playBoost();
        this.addCameraShake(0.2);
        this.ui.showBanner('💨 SLIPSTREAM BOOST!', '#7ce8ff', 1200);
      }
    } else {
      playerPhys.slipstreamCharge = Math.max(0, playerPhys.slipstreamCharge - dt * 1.4);
      playerPhys.isSlipstreaming = false;
    }

    // 4. コイン獲得
    this.world.coins.forEach(coin => {
      if (!coin.active) return;
      allPhysics.forEach(cart => {
        if (cart.position.distanceTo(coin.mesh.position) < coin.radius + 1.35) {
          coin.active = false;
          coin.mesh.visible = false;
          coin.respawnTimer = 6.5;
          cart.coins = Math.min(cart.coins + 1, 10);
          if (cart.isPlayer) {
            this.particles.spawnCoinPickup(coin.mesh.position);
            this.sound.playCoin();
          }
        }
      });
    });

    // 5. アイテムボックス獲得
    const standings = this.ui.getSortedStandings(playerPhys, this.rivals);
    const getRank = (cart) => {
      const idx = standings.findIndex(s => s.physics === cart);
      return idx >= 0 ? idx + 1 : 3;
    };

    this.world.itemBoxes.forEach(box => {
      if (!box.active) return;
      allPhysics.forEach(cart => {
        if (cart.position.distanceTo(box.mesh.position) < box.radius + 1.3) {
          box.active = false;
          box.mesh.visible = false;
          box.respawnTimer = 4.5;

          this.particles.spawnBoxPop(box.mesh.position);
          if (cart.isPlayer) this.sound.playItemBox();

          if (cart.activeItem === 0 && !cart.isRollingItem) {
            cart.isRollingItem = true;
            const rank = getRank(cart);
            if (cart.isPlayer) {
              if (this.itemRollTimer) clearTimeout(this.itemRollTimer);
              this.itemRollTimer = setTimeout(() => {
                if (this.gameState !== 'RACING') return;
                playerPhys.activeItem = this.rollItemByRank(rank);
                playerPhys.isRollingItem = false;
                this.sound.playItemGet();
              }, 1150);
            } else {
              cart.activeItem = this.rollItemByRank(rank);
              cart.isRollingItem = false;
            }
          }
        }
      });
    });

    // 6. トラップ判定
    this.traps.forEach(trap => {
      if (!trap.active) return;
      if (trap.graceTimer > 0) trap.graceTimer -= dt;
      trap.mesh.rotation.y += 2.2 * dt;

      allPhysics.forEach(cart => {
        if (cart === trap.owner && trap.graceTimer > 0) return;
        if (cart.position.distanceTo(trap.position) < trap.radius + 1.15) {
          trap.active = false;
          this.scene.remove(trap.mesh);
          if (cart.spinOut()) {
            this.particles.spawnSpinSparks(cart.position);
            if (cart.isPlayer) {
              this.sound.playSpin();
              this.addCameraShake(0.42);
              this.ui.showBanner('SLIPPED!!', '#ff3366', 1000);
            } else if (trap.owner === playerPhys) {
              this.sound.playCoin();
              this.ui.showBanner('🎯 TRAP HIT!', '#00ff88', 1100);
            }
          }
        }
      });
    });
    this.traps = this.traps.filter(t => t.active);

    // 7. ショット弾更新（軽誘導アシスト＋壁2回バウンド！）
    this.projectiles.forEach(proj => {
      if (proj.life <= 0) return;
      proj.life -= dt;

      // 緩やかなターゲット追尾アシスト（前方25m以内の最寄りライバルへ少しカーブ）
      let nearest = null;
      let nearestDist = 28;
      const projDir = proj.velocity.clone().setY(0).normalize();
      allPhysics.forEach(c => {
        if (c === proj.owner) return;
        const toC = c.position.clone().sub(proj.position).setY(0);
        const d = toC.length();
        if (d < nearestDist && projDir.dot(toC.normalize()) > 0.65) {
          nearestDist = d;
          nearest = c;
        }
      });
      if (nearest) {
        const desired = nearest.position.clone().sub(proj.position).setY(0).normalize();
        projDir.lerp(desired, Math.min(1, dt * 3.8)).normalize();
        proj.velocity.copy(projDir).multiplyScalar(proj.speed);
      }

      proj.position.addScaledVector(proj.velocity, dt);
      const prog = this.world.getTrackProgress(proj.position);
      proj.position.y = prog.point.y + 0.55;
      proj.mesh.position.copy(proj.position);
      proj.mesh.rotation.y += 12 * dt;

      // コース外壁で跳ね返る！
      if (Math.abs(prog.lateralOffset) > prog.wallLimit) {
        if (proj.bouncesLeft > 0) {
          proj.bouncesLeft--;
          const wallNormal = prog.normal.clone().multiplyScalar(-Math.sign(prog.lateralOffset));
          proj.velocity.reflect(wallNormal).setY(0).normalize().multiplyScalar(proj.speed);
          this.particles.spawnBoxPop(proj.position);
        } else {
          proj.life = 0;
          this.particles.spawnBoxPop(proj.position);
          this.scene.remove(proj.mesh);
          return;
        }
      }

      // カートへの直撃判定
      allPhysics.forEach(cart => {
        if (cart === proj.owner) return;
        if (cart.position.distanceTo(proj.position) < proj.radius + 1.25) {
          proj.life = 0;
          this.scene.remove(proj.mesh);
          if (cart.spinOut()) {
            this.particles.spawnSpinSparks(cart.position);
            if (cart.isPlayer) {
              this.sound.playSpin();
              this.addCameraShake(0.45);
              this.ui.showBanner('💥 HIT!', '#ff3366', 1000);
            } else if (proj.owner === playerPhys) {
              this.sound.playTrick();
              this.ui.showBanner(`🎯 DIRECT HIT! (${cart.name})`, '#ffea00', 1200);
            }
          }
        }
      });
    });

    this.projectiles.forEach(p => { if (p.life <= 0) this.scene.remove(p.mesh); });
    this.projectiles = this.projectiles.filter(p => p.life > 0);

    // 8. カート同士の衝突（スター無敵中は相手を吹き飛ばす！）
    for (let i = 0; i < allPhysics.length; i++) {
      for (let j = i + 1; j < allPhysics.length; j++) {
        const c1 = allPhysics[i];
        const c2 = allPhysics[j];
        const dist = c1.position.distanceTo(c2.position);
        const limit = 2.15;
        if (dist < limit && dist > 0.001) {
          const pushVec = c1.position.clone().sub(c2.position).setY(0).normalize();
          const overlap = limit - dist;
          c1.position.addScaledVector(pushVec, overlap * 0.52);
          c2.position.addScaledVector(pushVec, -overlap * 0.52);

          if (c1.starTime > 0 && c2.starTime <= 0) {
            if (c2.spinOut()) {
              this.particles.spawnSpinSparks(c2.position);
              if (c1.isPlayer) { this.sound.playBump(); this.ui.showBanner('⭐ SMASH!', '#ffea00', 900); }
            }
          } else if (c2.starTime > 0 && c1.starTime <= 0) {
            if (c1.spinOut()) {
              this.particles.spawnSpinSparks(c1.position);
              if (c1.isPlayer) { this.sound.playSpin(); this.addCameraShake(0.4); }
            }
          } else {
            const avg = (c1.speed + c2.speed) * 0.5;
            c1.speed = THREE.MathUtils.lerp(c1.speed, avg, 0.35);
            c2.speed = THREE.MathUtils.lerp(c2.speed, avg, 0.35);
            if (c1.isPlayer || c2.isPlayer) {
              this.sound.playBump();
              this.addCameraShake(0.14);
            }
          }
        }
      }
    }
  }

  handleCountdown(dt) {
    if (this.gameState !== 'READY') return;
    this.countdownTimer -= dt;

    // ロケットスタートのタイミングチャージ（残り 2.0s 〜 0.0s でアクセルを踏む！）
    if (this.countdownTimer <= 2.1 && this.countdownTimer > 0 && this.ui.input.gas) {
      this.rocketChargeTime += dt;
      if (Math.random() < 0.35) {
        this.particles.spawnBoostFire(this.playerPhysics.position, this.playerPhysics.direction);
      }
    }

    const overlay = document.getElementById('overlay-screen');
    const textEl = document.getElementById('countdown-text');

    let newText = '';
    let colorClass = 'color-ready';

    if (this.countdownTimer > 3.0) {
      newText = 'READY';
      colorClass = 'color-ready';
      this.world.setStartLights(0);
    } else if (this.countdownTimer > 2.0) {
      newText = '3';
      colorClass = 'color-3';
      this.world.setStartLights(1);
    } else if (this.countdownTimer > 1.0) {
      newText = '2';
      colorClass = 'color-2';
      this.world.setStartLights(2);
    } else if (this.countdownTimer > 0.0) {
      newText = '1';
      colorClass = 'color-1';
      this.world.setStartLights(3);
    } else {
      newText = 'GO!';
      colorClass = 'color-go';
      this.world.setStartLights(4);
      this.gameState = 'RACING';
      this.sound.startBGM(false);

      // ロケットスタート判定（タイミング良く踏んでいれば大成功！）
      if (this.ui.input.gas && this.rocketChargeTime >= 0.45 && this.rocketChargeTime <= 2.15) {
        this.playerPhysics.triggerRocketStart();
      }

      if (this.overlayHideTimer) clearTimeout(this.overlayHideTimer);
      this.overlayHideTimer = setTimeout(() => {
        overlay.style.display = 'none';
      }, 1050);
    }

    if (textEl.textContent !== newText) {
      textEl.textContent = newText;
      textEl.className = '';
      void textEl.offsetWidth;
      textEl.classList.add('pop', colorClass);

      if (newText === '3' || newText === '2' || newText === '1') {
        this.sound.playCountdownBeep(false);
      } else if (newText === 'GO!') {
        this.sound.playCountdownBeep(true);
      }
    }
  }

  updateCamera(dt, time) {
    const p = this.playerPhysics;

    // 1. タイトル画面：コースを雄大に見渡すシネマティック空撮
    if (this.gameState === 'MENU') {
      const u = (time * 0.022) % 1.0;
      const pt = this.world.trackCurve.getPointAt(u);
      const ahead = this.world.trackCurve.getPointAt((u + 0.04) % 1.0);
      this.camera.position.set(pt.x + Math.cos(time * 0.2) * 24, pt.y + 22, pt.z + Math.sin(time * 0.2) * 24);
      this.camera.lookAt(ahead.x, ahead.y + 3, ahead.z);
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 58, Math.min(1, dt * 4));
      this.camera.updateProjectionMatrix();
      return;
    }

    // 2. カウントダウン中：カートの前方斜めから後方へ回り込むシネマティック演出
    if (this.gameState === 'READY') {
      const progress = 1.0 - THREE.MathUtils.clamp(this.countdownTimer / 3.6, 0, 1);
      const angle = p.direction + Math.PI + (1.0 - progress) * 1.45;
      const dist = THREE.MathUtils.lerp(9.5, 6.8, progress);
      const height = THREE.MathUtils.lerp(3.6, 2.7, progress);
      const targetPos = new THREE.Vector3(
        p.position.x + Math.sin(angle) * dist,
        p.position.y + height,
        p.position.z + Math.cos(angle) * dist
      );
      this.camera.position.lerp(targetPos, Math.min(1, dt * 6));
      this.camera.lookAt(p.position.x, p.position.y + 1.1, p.position.z);
      return;
    }

    // 3. ゴール後：ビクトリー旋回カメラ
    if (this.gameState === 'FINISHED') {
      const orbitA = time * 0.85;
      const targetPos = new THREE.Vector3(
        p.position.x + Math.sin(orbitA) * 7.8,
        p.position.y + 3.2,
        p.position.z + Math.cos(orbitA) * 7.8
      );
      this.camera.position.lerp(targetPos, Math.min(1, dt * 4));
      this.camera.lookAt(p.position.x, p.position.y + 1.0, p.position.z);
      return;
    }

    // 4. レース中カメラ（視点3種＋後方ミラー＋ブーストFOV＋シェイク）
    const presets = [
      { dist: 6.8, height: 2.75, look: 6.5, baseFov: 62 },
      { dist: 5.2, height: 2.05, look: 8.0, baseFov: 68 },
      { dist: 9.8, height: 4.8, look: 7.5, baseFov: 58 }
    ];
    const cfg = presets[this.cameraMode];
    const dir = p.direction + p.driftAngle * 0.25;
    const lookBack = this.ui.input.lookBack;

    const offsetSign = lookBack ? 1 : -1;
    const backVec = new THREE.Vector3(Math.sin(dir) * offsetSign, 0, Math.cos(dir) * offsetSign);

    const speedRatio = THREE.MathUtils.clamp(p.speed / p.maxSpeed, 0, 1.5);
    const dynamicDist = cfg.dist + (p.boostTime > 0 || p.starTime > 0 ? 1.15 : speedRatio * 0.45);

    const targetCamPos = p.position.clone()
      .addScaledVector(backVec, dynamicDist)
      .add(new THREE.Vector3(0, cfg.height + p.height * 0.25, 0));

    // カメラシェイク減衰
    if (this.cameraShake > 0.005) {
      targetCamPos.x += (Math.random() - 0.5) * this.cameraShake * 0.9;
      targetCamPos.y += (Math.random() - 0.5) * this.cameraShake * 0.6;
      this.cameraShake *= Math.pow(0.06, dt);
    } else {
      this.cameraShake = 0;
    }

    this.camera.position.lerp(targetCamPos, Math.min(1, dt * (lookBack ? 18 : 9.5)));

    const lookDir = lookBack ? -1 : 1;
    const forwardVec = new THREE.Vector3(Math.sin(dir) * lookDir, 0, Math.cos(dir) * lookDir);
    const lookTarget = p.position.clone()
      .addScaledVector(forwardVec, cfg.look)
      .add(new THREE.Vector3(0, 1.05, 0));
    this.camera.lookAt(lookTarget);

    // ダイナミックFOV（加速＆ブースト時のスピード感！）
    const boostBonus = (p.boostTime > 0 || p.starTime > 0) ? 13 : speedRatio * 5;
    const targetFov = cfg.baseFov + boostBonus;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1, dt * 6));
    this.camera.updateProjectionMatrix();
  }

  // シャドウカメラをプレイヤー周辺に追従させてコース全域でクッキリ影を描画
  updateShadowFollow() {
    if (!this.playerPhysics || !this.dirLight) return;
    const p = this.playerPhysics.position;
    this.dirLight.position.copy(p).add(this.sunOffset);
    this.dirLight.target.position.copy(p);
    this.dirLight.target.updateMatrixWorld();
  }

  handleParticles() {
    const carts = [this.playerPhysics, ...this.rivals.map(r => r.physics)];
    carts.forEach((c) => {
      const dir = c.direction + c.driftAngle;
      const right = new THREE.Vector3(Math.cos(dir), 0, -Math.sin(dir));
      const back = new THREE.Vector3(-Math.sin(dir), 0, -Math.cos(dir));

      // ドリフト火花
      if (c.isDrifting && c.height <= 0.12) {
        const lPos = c.position.clone().addScaledVector(right, -0.82).addScaledVector(back, 0.75);
        const rPos = c.position.clone().addScaledVector(right, 0.82).addScaledVector(back, 0.75);
        this.particles.spawnDriftSparks(lPos, dir, c.driftCharge);
        if (c.isPlayer) this.particles.spawnDriftSparks(rPos, dir, c.driftCharge);
      }

      // ブースト・スター炎
      if (c.boostTime > 0 || c.starTime > 0) {
        const tailPos = c.position.clone().addScaledVector(back, 1.45).add(new THREE.Vector3(0, 0.35, 0));
        this.particles.spawnBoostFire(tailPos, dir, c.starTime > 0);
      }

      // オフロード走行の草・土煙
      if (c.onGrass && c.speed > 6 && c.height <= 0.1 && Math.random() < (c.isPlayer ? 0.55 : 0.2)) {
        const tailPos = c.position.clone().addScaledVector(back, 1.1);
        this.particles.spawnOffroadDust(tailPos, dir, this.world.theme);
      }
    });

    if (this.gameState === 'FINISHED' && Math.random() < 0.35) {
      this.particles.spawnConfetti(this.playerPhysics.position);
    }
  }

  finishRace() {
    this.gameState = 'FINISHED';
    this.playerPhysics.finished = true;
    this.playerPhysics.finishTime = this.elapsedTime;
    this.sound.stopBGM();

    const standings = this.ui.getSortedStandings(this.playerPhysics, this.rivals);
    const rank = standings.findIndex(s => s.isPlayer) + 1;
    this.sound.playFinishFanfare(rank === 1);

    this.ui.renderResultScreen(this.playerPhysics, this.rivals, this.elapsedTime);
    document.getElementById('result-screen').style.display = 'flex';
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    let dt = this.clock.getDelta();
    if (dt > 0.08) dt = 0.08;
    const time = this.clock.getElapsedTime();

    if (this.gameState === 'READY') {
      this.handleCountdown(dt);
      const stopped = { gas: false, brake: false, left: false, right: false, drift: false, item: false };
      this.playerPhysics.update(dt, stopped, this.world, 0);
      this.rivals.forEach(r => r.physics.update(dt, stopped, this.world, 0));
      this.handlePhysicsEvents(this.playerPhysics);
    }

    if (this.gameState === 'RACING' || this.gameState === 'FINISHED') {
      if (this.gameState === 'RACING') this.elapsedTime += dt;

      const pInput = this.gameState === 'RACING'
        ? this.ui.getRaceInput()
        : { gas: false, brake: false, left: false, right: false, drift: false, item: false };

      this.playerPhysics.update(dt, pInput, this.world, this.elapsedTime);
      this.handlePhysicsEvents(this.playerPhysics);

      if (this.gameState === 'RACING' && this.ui.input.item) {
        this.usePlayerItem();
        this.ui.input.item = false;
      }

      this.rivals.forEach(rival => {
        rival.ai.update(dt, this.playerPhysics, this.traps);
        rival.physics.update(dt, rival.ai.input, this.world, this.elapsedTime);
        rival.physics.consumeEvents();
        if (!rival.physics.finished && rival.physics.lap >= 3) {
          rival.physics.finished = true;
          rival.physics.finishTime = this.elapsedTime;
        }
        if (rival.ai.input.item) {
          this.useRivalItem(rival.physics);
          rival.ai.input.item = false;
        }
      });

      this.handleInteractions(dt);
      this.handleParticles();

      if (this.gameState === 'RACING' && this.playerPhysics.lap >= 3) {
        this.finishRace();
      }
    }

    // ワールド・パーティクル更新
    this.world.update(dt, time);
    this.particles.update(dt);

    // エンジン＆ドリフト音更新
    if (this.sound && this.sound.enabled) {
      const isRevving = this.gameState === 'READY' && this.ui.input.gas;
      const ratio = isRevving
        ? 0.55 + Math.sin(time * 28) * 0.1
        : Math.abs(this.playerPhysics.speed) / this.playerPhysics.maxSpeed;
      const active = this.gameState === 'RACING' || isRevving;
      const boosting = this.playerPhysics.boostTime > 0 || this.playerPhysics.starTime > 0;
      this.sound.updateEngine(
        ratio,
        active,
        boosting,
        this.gameState === 'RACING' && this.playerPhysics.isDrifting && this.playerPhysics.height <= 0.15,
        this.playerPhysics.driftCharge
      );
    }

    // カートビジュアル更新
    const pVisualInput = this.gameState === 'RACING' ? this.ui.input : { left: false, right: false, brake: false };
    updateCartVisual(this.playerMesh, this.playerPhysics, pVisualInput, dt, time);
    this.rivals.forEach(r => updateCartVisual(r.mesh, r.physics, r.ai.input, dt, time));

    this.updateShadowFollow();
    this.updateCamera(dt, time);

    if (this.gameState !== 'MENU') {
      this.ui.updateHUD(this.playerPhysics, this.rivals, time, this.elapsedTime);
    }

    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameManager();
});
