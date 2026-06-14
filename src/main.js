import * as THREE from 'three';
import { GameWorld } from './world.js';
import { CartPhysics } from './physics.js';
import { RivalAI } from './ai.js';
import { GameUI } from './ui.js';
import { ParticleSystem } from './particles.js';

class GameManager {
  constructor() {
    this.gameState = 'READY'; // READY, RACING, FINISHED
    this.countdownTimer = 3.5;  // カウントダウン時間
    this.elapsedTime = 0;
    
    this.initThree();
    this.world = new GameWorld(this.scene);
    this.particles = new ParticleSystem(this.scene);
    this.ui = new GameUI(this.world);
    
    // アイテムオブジェクト (罠と弾)
    this.traps = [];
    this.projectiles = [];
    
    this.setupPlayers();
    this.setupLights();
    
    // イベントバインド
    window.addEventListener('resize', () => this.onWindowResize());
    document.getElementById('btn-restart').addEventListener('click', () => this.restartGame());
    
    // ゲームループ開始
    this.clock = new THREE.Clock();
    this.animate();
  }
  
  // Three.js シーン、カメラ、レンダラーの初期化
  initThree() {
    const container = document.body;
    
    this.scene = new THREE.Scene();
    
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
    
    this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // カメラの初期位置
    this.camera.position.set(0, 10, 15);
  }
  
  // ライティングの設定
  setupLights() {
    // 環境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(ambientLight);
    
    // 太陽光（シャドウマップ設定）
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.95);
    dirLight.position.set(100, 150, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    
    const d = 120;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    
    this.scene.add(dirLight);
    
    // 夜明け/夕暮れ感を出すネオン補色ライト
    const hemiLight = new THREE.HemisphereLight(0x00f0ff, 0xff007f, 0.4);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);
  }
  
  // プレイヤーとAIライバルのカートを生成
  setupPlayers() {
    const startPoint = this.world.trackCurve.getPointAt(0);
    const tangent = this.world.trackCurve.getTangentAt(0).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    
    // カートのグリッド配置（マリオカートのスタートグリッドのように前後・左右にずらす）
    // プレイヤー（後列・右）
    const playerPos = startPoint.clone()
      .addScaledVector(tangent, -6)
      .addScaledVector(normal, 2.5);
    
    this.playerPhysics = new CartPhysics(playerPos, true);
    this.playerPhysics.direction = Math.atan2(tangent.x, tangent.z);
    this.playerMesh = this.createCartMesh(0x00f0ff); // 青ネオンのプレイヤーカート
    this.scene.add(this.playerMesh);
    
    // AIライバル (3台)
    this.rivals = [];
    const aiColors = [0x00ff66, 0xffcc00, 0xbd00ff]; // 緑、黄、紫
    const aiGridOffsets = [
      { t: 0, n: -2.5 },    // 前列・左
      { t: -3, n: 2.5 },   // 2列目・右
      { t: -9, n: -2.5 }    // 後列・左
    ];
    
    for (let i = 0; i < 3; i++) {
      const offset = aiGridOffsets[i];
      const aiPos = startPoint.clone()
        .addScaledVector(tangent, offset.t)
        .addScaledVector(normal, offset.n);
      
      const aiPhysics = new CartPhysics(aiPos, false);
      aiPhysics.direction = Math.atan2(tangent.x, tangent.z);
      
      const aiMesh = this.createCartMesh(aiColors[i]);
      this.scene.add(aiMesh);
      
      const aiController = new RivalAI(aiPhysics, i, this.world);
      
      this.rivals.push({
        physics: aiPhysics,
        mesh: aiMesh,
        ai: aiController,
        color: aiColors[i]
      });
    }
  }
  
  // プログラムでかっこいい3Dカートモデルを構築
  createCartMesh(themeColor) {
    const cartGroup = new THREE.Group();
    
    // 1. シャーシ
    const chassisGeo = new THREE.BoxGeometry(1.5, 0.3, 2.6);
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x22222a, metalness: 0.8, roughness: 0.2 });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = 0.25;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    cartGroup.add(chassis);
    
    // 2. メインボディカバー（テーマカラー）
    const bodyGeo = new THREE.BoxGeometry(1.2, 0.45, 1.8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: themeColor, metalness: 0.6, roughness: 0.1 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.5, -0.1);
    body.castShadow = true;
    cartGroup.add(body);
    
    // 3. フロントノーズ
    const noseGeo = new THREE.BoxGeometry(1.3, 0.2, 0.7);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.position.set(0, 0.35, 1.15);
    nose.castShadow = true;
    cartGroup.add(nose);
    
    // 4. ホイール（4個）
    const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.8 });
    const wheelPositions = [
      { x: -0.85, y: 0.3, z: 0.9 },   // 前左
      { x: 0.85, y: 0.3, z: 0.9 },    // 前右
      { x: -0.85, y: 0.3, z: -0.9 },  // 後左
      { x: 0.85, y: 0.3, z: -0.9 }    // 後右
    ];
    
    const wheels = [];
    wheelPositions.forEach((pos, idx) => {
      const wMesh = new THREE.Mesh(wheelGeo, wheelMat);
      wMesh.rotation.z = Math.PI / 2;
      wMesh.position.set(pos.x, pos.y, pos.z);
      wMesh.castShadow = true;
      cartGroup.add(wMesh);
      wheels.push(wMesh);
    });
    cartGroup.userData.wheels = wheels; // 後輪の回転などで利用
    
    // 5. バケットシート（背もたれ）
    const seatGeo = new THREE.BoxGeometry(0.7, 0.8, 0.5);
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x08080f, roughness: 0.6 });
    const seat = new THREE.Mesh(seatGeo, seatMat);
    seat.position.set(0, 0.8, -0.5);
    seat.castShadow = true;
    cartGroup.add(seat);
    
    // 6. リアスポイラー（ウイング）
    const spoilerWingGeo = new THREE.BoxGeometry(1.5, 0.1, 0.5);
    const wing = new THREE.Mesh(spoilerWingGeo, bodyMat);
    wing.position.set(0, 1.5, -1.2);
    wing.castShadow = true;
    cartGroup.add(wing);
    
    const spoilerPostGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9 });
    const leftPost = new THREE.Mesh(spoilerPostGeo, postMat);
    leftPost.position.set(-0.5, 1.15, -1.2);
    leftPost.rotation.x = -0.2;
    cartGroup.add(leftPost);
    
    const rightPost = new THREE.Mesh(spoilerPostGeo, postMat);
    rightPost.position.set(0.5, 1.15, -1.2);
    rightPost.rotation.x = -0.2;
    cartGroup.add(rightPost);
    
    // 7. マフラー（排気管）
    const exhaustGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8);
    const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.9, roughness: 0.1 });
    const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaust.position.set(0, 0.3, -1.2);
    exhaust.rotation.x = Math.PI / 2;
    cartGroup.add(exhaust);
    cartGroup.userData.exhaust = exhaust; // パーティクル噴出座標の計算用
    
    return cartGroup;
  }
  
  // プレイヤーがアイテムボタンを押したときのアクション
  usePlayerItem() {
    if (this.playerPhysics.activeItem === 0 || this.playerPhysics.isRollingItem) return;
    
    const item = this.playerPhysics.activeItem;
    
    if (item === 1) {
      // 1.png（ダッシュ）：マッシュルーム使用
      this.playerPhysics.useMushroom();
      // ブーストエフェクトの初回バースト
      this.particles.spawnBoostFire(this.playerPhysics.position, this.playerPhysics.direction);
    } else if (item === 2) {
      // 2.png（設置罠）：バナナを後方にドロップ
      this.spawnTrap(this.playerPhysics);
    } else if (item === 3) {
      // 3.png（直進弾）：こうらを前方にシュート
      this.spawnProjectile(this.playerPhysics);
    }
    
    // 使用したのでスロットクリア
    this.playerPhysics.activeItem = 0;
  }
  
  // AIがアイテムを使用するときのアクション
  useRivalItem(aiPhysics) {
    const item = aiPhysics.activeItem;
    if (item === 1) {
      aiPhysics.useMushroom();
      this.particles.spawnBoostFire(aiPhysics.position, aiPhysics.direction);
    } else if (item === 2) {
      this.spawnTrap(aiPhysics);
    } else if (item === 3) {
      this.spawnProjectile(aiPhysics);
    }
    aiPhysics.activeItem = 0;
  }
  
  // 設置罠のスポーン
  spawnTrap(cart) {
    // カートの少し後方に設置
    const dir = cart.direction + cart.driftAngle;
    const backVec = new THREE.Vector3(-Math.sin(dir), 0, -Math.cos(dir)).normalize();
    const trapPos = cart.position.clone().addScaledVector(backVec, 2.2);
    trapPos.y = this.world.getTrackProgress(trapPos).point.y + 0.1; // 地面に這わせる
    
    // 罠の3Dモデル（赤いネオンのトゲトゲプレートのようなデザイン）
    const trapGroup = new THREE.Group();
    trapGroup.position.copy(trapPos);
    
    const baseGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.15, 12);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0xff0055,
      emissive: 0xff0055,
      emissiveIntensity: 0.6,
      roughness: 0.2
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    trapGroup.add(base);
    
    // トゲ（飾り）
    const spikeGeo = new THREE.ConeGeometry(0.12, 0.4, 8);
    const spikeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(Math.sin(angle) * 0.45, 0.2, Math.cos(angle) * 0.45);
      spike.rotation.y = angle;
      spike.rotation.x = 0.5;
      trapGroup.add(spike);
    }
    
    this.scene.add(trapGroup);
    
    this.traps.push({
      mesh: trapGroup,
      position: trapPos,
      radius: 0.9,
      active: true
    });
  }
  
  // 直進弾のスポーン
  spawnProjectile(cart) {
    const dir = cart.direction + cart.driftAngle;
    const forward = new THREE.Vector3(Math.sin(dir), 0, Math.cos(dir)).normalize();
    const spawnPos = cart.position.clone().addScaledVector(forward, 2.5);
    spawnPos.y += 0.4;
    
    // 弾の3Dモデル（緑のネオン球体）
    const projGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const projMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00ff88,
      emissiveIntensity: 0.8,
      roughness: 0.1
    });
    const projMesh = new THREE.Mesh(projGeo, projMat);
    projMesh.position.copy(spawnPos);
    projMesh.castShadow = true;
    
    this.scene.add(projMesh);
    
    // 進行方向ベクトル (カートの前方速度 + 弾固有スピード)
    const bulletSpeed = 55.0; // 高速直進
    const velocity = forward.clone().multiplyScalar(bulletSpeed);
    
    this.projectiles.push({
      mesh: projMesh,
      position: spawnPos,
      velocity: velocity,
      radius: 0.8,
      life: 4.5, // 4.5秒で自動消滅
      owner: cart // 自分が発射した弾には当たらないようにする
    });
  }
  
  // 衝突判定と各種インタラクション
  handleCollisions(dt) {
    const playerPhys = this.playerPhysics;
    const allPhysics = [playerPhys, ...this.rivals.map(r => r.physics)];
    
    // A. カートとコインの衝突判定
    this.world.coins.forEach(coin => {
      if (!coin.active) return;
      
      allPhysics.forEach(cart => {
        const dist = cart.position.distanceTo(coin.mesh.position);
        if (dist < coin.radius + 1.2) {
          // コイン獲得！
          coin.active = false;
          coin.mesh.visible = false;
          coin.respawnTimer = 6.0; // 6秒後にリスポーン
          
          cart.coins = Math.min(cart.coins + 1, 10);
          
          if (cart.isPlayer) {
            this.particles.spawnCoinPickup(coin.mesh.position);
          }
        }
      });
    });
    
    // B. カートとアイテムボックスの衝突判定
    this.world.itemBoxes.forEach(box => {
      if (!box.active) return;
      
      allPhysics.forEach(cart => {
        const dist = cart.position.distanceTo(box.mesh.position);
        if (dist < box.radius + 1.2) {
          // ボックス獲得！
          box.active = false;
          box.mesh.visible = false;
          box.respawnTimer = 5.0; // 5秒後にリスポーン
          
          this.particles.spawnBoxPop(box.mesh.position);
          
          // すでにアイテムを持っていなければ抽選開始
          if (cart.activeItem === 0 && !cart.isRollingItem) {
            cart.isRollingItem = true;
            
            if (cart.isPlayer) {
              // プレイヤーはシャッフルUIを開始し、1.2秒後に獲得
              setTimeout(() => {
                if (this.gameState === 'FINISHED') return;
                playerPhys.activeItem = Math.floor(Math.random() * 3) + 1; // 1, 2, 3 のいずれか
                playerPhys.isRollingItem = false;
              }, 1200);
            } else {
              // AIは即座に（あるいは短い遅延で）アイテム獲得
              cart.activeItem = Math.floor(Math.random() * 3) + 1;
              cart.isRollingItem = false;
            }
          }
        }
      });
    });
    
    // C. カートと木々の衝突判定 (簡易押し戻し)
    this.world.trees.forEach(tree => {
      allPhysics.forEach(cart => {
        const dist = cart.position.distanceTo(tree.mesh.position);
        const limit = tree.boundingRadius + 1.2;
        if (dist < limit) {
          // 押し戻しベクトル
          const pushVec = cart.position.clone().sub(tree.mesh.position);
          pushVec.y = 0;
          pushVec.normalize();
          
          // 押し出す
          cart.position.addScaledVector(pushVec, limit - dist);
          
          // 衝突ペナルティ（速度減衰）
          cart.speed *= 0.4;
          if (cart.isPlayer && Math.abs(cart.speed) > 5.0) {
            // スピンまではいかないが、火花を散らす
            this.particles.spawnSpinSparks(cart.position);
          }
        }
      });
    });
    
    // D. 設置罠とカートの衝突判定
    this.traps.forEach(trap => {
      if (!trap.active) return;
      
      allPhysics.forEach(cart => {
        const dist = cart.position.distanceTo(trap.position);
        if (dist < trap.radius + 1.0) {
          // 罠に被弾！スピンアウト
          trap.active = false;
          this.scene.remove(trap.mesh);
          
          cart.spinOut();
          this.particles.spawnSpinSparks(cart.position);
        }
      });
    });
    // 非アクティブな罠のクリーンアップ
    this.traps = this.traps.filter(t => t.active);
    
    // E. 直進弾の移動更新 & コース境界判定 & カート衝突
    this.projectiles.forEach(proj => {
      if (proj.life <= 0) return;
      
      proj.life -= dt;
      proj.position.addScaledVector(proj.velocity, dt);
      proj.mesh.position.copy(proj.position);
      
      // コース外壁衝突判定 (コースから離れすぎたら消滅)
      const prog = this.world.getTrackProgress(proj.position);
      if (prog.distanceToCenter > this.world.trackWidth * 0.9) {
        proj.life = 0; // 壁衝突で消滅
        this.particles.spawnBoxPop(proj.position); // 火花ポップで消滅表現
        this.scene.remove(proj.mesh);
        return;
      }
      
      // カート衝突
      allPhysics.forEach(cart => {
        // 発射主自身には当たらない（数秒の猶予を持たせるなどでも可だが、シンプルに完全除外）
        if (cart === proj.owner) return;
        
        const dist = cart.position.distanceTo(proj.position);
        if (dist < proj.radius + 1.1) {
          // 直撃！スピン
          proj.life = 0;
          this.scene.remove(proj.mesh);
          
          cart.spinOut();
          this.particles.spawnSpinSparks(cart.position);
        }
      });
    });
    
    // 消滅した弾のクリーンアップ
    this.projectiles.forEach(proj => {
      if (proj.life <= 0) {
        this.scene.remove(proj.mesh);
      }
    });
    this.projectiles = this.projectiles.filter(p => p.life > 0);
    
    // F. カート同士の衝突押し出し
    for (let i = 0; i < allPhysics.length; i++) {
      for (let j = i + 1; j < allPhysics.length; j++) {
        const c1 = allPhysics[i];
        const c2 = allPhysics[j];
        const dist = c1.position.distanceTo(c2.position);
        const limit = 2.0; // 衝突半径
        
        if (dist < limit) {
          // お互いに押し戻す
          const pushVec = c1.position.clone().sub(c2.position);
          pushVec.y = 0;
          pushVec.normalize();
          
          const overlap = limit - dist;
          c1.position.addScaledVector(pushVec, overlap * 0.5);
          c2.position.addScaledVector(pushVec, -overlap * 0.5);
          
          // 速度を少し相殺
          const temp = c1.speed;
          c1.speed = c2.speed * 0.85;
          c2.speed = temp * 0.85;
        }
      }
    }
  }
  
  // 追従カメラの更新
  updateCamera(dt) {
    const player = this.playerPhysics;
    
    // カートの後方位置を算出
    // ドリフトやスピンのブレを加味した実際の実向き
    const actualDir = player.direction + player.driftAngle;
    
    // カメラの理想の位置（カートの後方6.2m、上方2.5m）
    const backVec = new THREE.Vector3(-Math.sin(actualDir), 0, -Math.cos(actualDir)).normalize();
    const targetCamPos = player.position.clone()
      .addScaledVector(backVec, 6.2)
      .add(new THREE.Vector3(0, 2.5, 0));
    
    // カメラ位置を滑らかに補間
    const cameraSpeed = 7.5; // カメラ追従速度係数
    this.camera.position.lerp(targetCamPos, dt * cameraSpeed);
    
    // 注視点（カートの少し前方3.5m）
    const forwardVec = new THREE.Vector3(Math.sin(actualDir), 0, Math.cos(actualDir)).normalize();
    const lookTarget = player.position.clone().addScaledVector(forwardVec, 3.5);
    
    this.camera.lookAt(lookTarget);
  }
  
  // 3Dモデルの位置・向きを物理ステートに同期
  updateVisuals() {
    // プレイヤー
    this.playerMesh.position.copy(this.playerPhysics.position);
    this.playerMesh.rotation.y = this.playerPhysics.direction + this.playerPhysics.driftAngle + this.playerPhysics.spinAngle;
    
    // 前輪の操舵角ビジュアル（ステアリングに合わせてタイヤを回転）
    const wheels = this.playerMesh.userData.wheels;
    if (wheels && wheels.length >= 2) {
      let steerAngle = 0;
      if (this.ui.input.left) steerAngle = 0.45;
      if (this.ui.input.right) steerAngle = -0.45;
      
      // ドリフト中は前輪がドリフトと逆を向く（カウンター）
      if (this.playerPhysics.isDrifting) {
        steerAngle = -this.playerPhysics.driftDirection * 0.55;
      }
      
      wheels[0].rotation.y = steerAngle; // 前左
      wheels[1].rotation.y = steerAngle; // 前右
    }
    
    // AIライバルたち
    this.rivals.forEach(rival => {
      rival.mesh.position.copy(rival.physics.position);
      rival.mesh.rotation.y = rival.physics.direction + rival.physics.driftAngle + rival.physics.spinAngle;
      
      // AIの前輪操舵角
      const aiWheels = rival.mesh.userData.wheels;
      if (aiWheels && aiWheels.length >= 2) {
        let steerAngle = 0;
        if (rival.ai.input.left) steerAngle = 0.45;
        if (rival.ai.input.right) steerAngle = -0.45;
        
        if (rival.physics.isDrifting) {
          steerAngle = -rival.physics.driftDirection * 0.55;
        }
        aiWheels[0].rotation.y = steerAngle;
        aiWheels[1].rotation.y = steerAngle;
      }
    });
  }
  
  // カウントダウン処理
  handleCountdown(dt) {
    if (this.gameState !== 'READY') return;
    
    this.countdownTimer -= dt;
    const overlay = document.getElementById('overlay-screen');
    const textEl = document.getElementById('countdown-text');
    
    let newText = '';
    let colorClass = 'color-ready';
    
    if (this.countdownTimer > 3.0) {
      newText = 'READY';
      colorClass = 'color-ready';
    } else if (this.countdownTimer > 2.0) {
      newText = '3';
      colorClass = 'color-3';
    } else if (this.countdownTimer > 1.0) {
      newText = '2';
      colorClass = 'color-2';
    } else if (this.countdownTimer > 0.0) {
      newText = '1';
      colorClass = 'color-1';
    } else {
      newText = 'GO!';
      colorClass = 'color-go';
      this.gameState = 'RACING';
      
      // 1.2秒後にスタートオーバーレイを消す
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 1200);
    }
    
    // 文字が切り替わった瞬間にアニメーションを再トリガー
    if (textEl.innerText !== newText) {
      textEl.innerText = newText;
      textEl.className = ''; // クラスをクリア
      void textEl.offsetWidth; // リフローを強制してCSSアニメーションを再始動
      textEl.classList.add('pop', colorClass);
    }
  }
  
  // ゲームのメインアニメーションループ
  animate() {
    requestAnimationFrame(() => this.animate());
    
    let dt = this.clock.getDelta();
    // 極端なフレーム落ち時の物理貫通を防止 (dt制限)
    if (dt > 0.1) dt = 0.1;
    
    const time = this.clock.getElapsedTime();
    
    // A. カウントダウンの処理
    if (this.gameState === 'READY') {
      this.handleCountdown(dt);
      
      // カウントダウン中も、AIやプレイヤーに「停止入力（擬似）」を与えて物理更新
      const stoppedInput = { gas: false, brake: false, left: false, right: false, drift: false, item: false };
      this.playerPhysics.update(dt, stoppedInput, this.world);
      this.rivals.forEach(r => r.physics.update(dt, stoppedInput, this.world));
    }
    
    // B. レース中 / ゴール後のメイン処理
    if (this.gameState === 'RACING' || this.gameState === 'FINISHED') {
      this.elapsedTime += dt;
      
      // プレイヤーの更新
      const pInput = this.gameState === 'RACING' ? this.ui.input : { gas: false, brake: false, left: false, right: false, drift: false, item: false };
      this.playerPhysics.update(dt, pInput, this.world);
      
      // プレイヤーのアイテム使用判定
      if (this.gameState === 'RACING' && this.ui.input.item) {
        this.usePlayerItem();
        this.ui.input.item = false; // 押しっぱなし防止
      }
      
      // AIライバルの更新
      this.rivals.forEach(rival => {
        // AIはゴール後も自動で走り続ける
        rival.ai.update(dt, this.playerPhysics);
        rival.physics.update(dt, rival.ai.input, this.world);
        
        // AIのアイテム使用処理
        if (rival.ai.input.item) {
          this.useRivalItem(rival.physics);
          rival.ai.input.item = false;
        }
      });
      
      // 衝突判定の更新
      this.handleCollisions(dt);
      
      // パーティクル放出
      this.handleParticles(dt);
      
      // ゴール判定 (プレイヤーが3周完走)
      if (this.gameState === 'RACING' && this.playerPhysics.lap >= 3) {
        this.finishRace();
      }
    }
    
    // C. 共通更新
    this.world.update(dt, time);
    this.particles.update(dt);
    
    // ビジュアルモデルの同期
    this.updateVisuals();
    
    // カメラの追従
    this.updateCamera(dt);
    
    // HUD UIの同期更新
    this.ui.updateHUD(this.playerPhysics, this.rivals.map(r => r.physics), time);
    
    // 描画実行
    this.renderer.render(this.scene, this.camera);
  }
  
  // パーティクル発生制御
  handleParticles(dt) {
    // プレイヤーのドリフト火花
    if (this.playerPhysics.isDrifting && this.playerPhysics.height <= 0.1) {
      // 左右の後輪付近から火花
      const dir = this.playerPhysics.direction;
      const right = new THREE.Vector3(Math.cos(dir), 0, -Math.sin(dir)).normalize();
      
      const leftSparkPos = this.playerPhysics.position.clone().addScaledVector(right, -0.75);
      const rightSparkPos = this.playerPhysics.position.clone().addScaledVector(right, 0.75);
      
      this.particles.spawnDriftSparks(leftSparkPos, dir, this.playerPhysics.driftCharge);
      this.particles.spawnDriftSparks(rightSparkPos, dir, this.playerPhysics.driftCharge);
    }
    
    // AIのドリフト火花
    this.rivals.forEach(r => {
      if (r.physics.isDrifting && r.physics.height <= 0.1) {
        const dir = r.physics.direction;
        const right = new THREE.Vector3(Math.cos(dir), 0, -Math.sin(dir)).normalize();
        const leftSparkPos = r.physics.position.clone().addScaledVector(right, -0.75);
        this.particles.spawnDriftSparks(leftSparkPos, dir, r.physics.driftCharge);
      }
    });
    
    // プレイヤーのマフラーブースト炎
    if (this.playerPhysics.boostTime > 0) {
      const dir = this.playerPhysics.direction + this.playerPhysics.driftAngle;
      const back = new THREE.Vector3(-Math.sin(dir), 0, -Math.cos(dir)).normalize();
      const tailPos = this.playerPhysics.position.clone().addScaledVector(back, 1.25).add(new THREE.Vector3(0, 0.3, 0));
      this.particles.spawnBoostFire(tailPos, dir);
    }
    
    // AIのブースト炎
    this.rivals.forEach(r => {
      if (r.physics.boostTime > 0) {
        const dir = r.physics.direction + r.physics.driftAngle;
        const back = new THREE.Vector3(-Math.sin(dir), 0, -Math.cos(dir)).normalize();
        const tailPos = r.physics.position.clone().addScaledVector(back, 1.25).add(new THREE.Vector3(0, 0.3, 0));
        this.particles.spawnBoostFire(tailPos, dir);
      }
    });
  }
  
  // レース終了処理
  finishRace() {
    this.gameState = 'FINISHED';
    
    // 最終タイム算出
    const minutes = Math.floor(this.elapsedTime / 60);
    const seconds = Math.floor(this.elapsedTime % 60);
    const ms = Math.floor((this.elapsedTime % 1) * 100);
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    
    // 最終順位
    const finalRank = this.ui.updateRankings(this.playerPhysics, this.rivals.map(r => r.physics));
    
    // 結果表示
    document.getElementById('final-rank').innerText = `${finalRank}位`;
    document.getElementById('final-time').innerText = timeStr;
    document.getElementById('result-screen').style.display = 'flex';
  }
  
  // リスタート処理
  restartGame() {
    document.getElementById('result-screen').style.display = 'none';
    document.getElementById('overlay-screen').style.display = 'flex';
    const textEl = document.getElementById('countdown-text');
    textEl.innerText = 'READY';
    textEl.className = 'pop color-ready';
    
    this.gameState = 'READY';
    this.countdownTimer = 3.5;
    this.elapsedTime = 0;
    
    // アイテムオブジェクト初期化
    this.traps.forEach(t => this.scene.remove(t.mesh));
    this.projectiles.forEach(p => this.scene.remove(p.mesh));
    this.traps = [];
    this.projectiles = [];
    this.particles.clear();
    
    // プレイヤー再配置
    const startPoint = this.world.trackCurve.getPointAt(0);
    const tangent = this.world.trackCurve.getTangentAt(0).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    
    const playerPos = startPoint.clone()
      .addScaledVector(tangent, -6)
      .addScaledVector(normal, 2.5);
    
    this.playerPhysics = new CartPhysics(playerPos, true);
    this.playerPhysics.direction = Math.atan2(tangent.x, tangent.z);
    
    // AI再配置
    const aiGridOffsets = [
      { t: 0, n: -2.5 },
      { t: -3, n: 2.5 },
      { t: -9, n: -2.5 }
    ];
    
    this.rivals.forEach((rival, idx) => {
      const offset = aiGridOffsets[idx];
      const aiPos = startPoint.clone()
        .addScaledVector(tangent, offset.t)
        .addScaledVector(normal, offset.n);
      
      rival.physics = new CartPhysics(aiPos, false);
      rival.physics.direction = Math.atan2(tangent.x, tangent.z);
      rival.ai = new RivalAI(rival.physics, idx, this.world);
    });
    
    // コイン・アイテムボックスの活性化
    this.world.coins.forEach(c => {
      c.active = true;
      c.mesh.visible = true;
      c.respawnTimer = 0;
    });
    this.world.itemBoxes.forEach(b => {
      b.active = true;
      b.mesh.visible = true;
      b.respawnTimer = 0;
    });
  }
  
  // ウィンドウリサイズハンドラ
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// 起動
window.addEventListener('DOMContentLoaded', () => {
  new GameManager();
});
