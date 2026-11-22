import * as THREE from 'three';

// ディテール豊かなレーシングカート＆ドライバーモデルを生成・制御
export function createCartMesh(themeColor, racerNumber = 1, isPlayer = false) {
  const root = new THREE.Group();
  // 車体の傾き（ピッチ・ロール・ホップ揺れ・トリック回転）をまとめる内部グループ
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const primaryMat = new THREE.MeshStandardMaterial({
    color: themeColor,
    metalness: 0.45,
    roughness: 0.22,
    emissive: new THREE.Color(themeColor),
    emissiveIntensity: 0.08
  });

  const darkCarbonMat = new THREE.MeshStandardMaterial({
    color: 0x1b1d26,
    metalness: 0.6,
    roughness: 0.35
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xdbe4f0,
    metalness: 0.92,
    roughness: 0.12
  });

  const whiteAccentMat = new THREE.MeshStandardMaterial({
    color: 0xf4f7fb,
    metalness: 0.2,
    roughness: 0.3
  });

  // 1. ロワーシャーシ（底板）
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.22, 2.75), darkCarbonMat);
  chassis.position.set(0, 0.26, 0);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  bodyPivot.add(chassis);

  // 2. サイドポッド（左右のエアロカウル）
  const sidePodGeo = new THREE.BoxGeometry(0.42, 0.34, 1.45);
  const leftPod = new THREE.Mesh(sidePodGeo, primaryMat);
  leftPod.position.set(-0.68, 0.42, -0.05);
  leftPod.castShadow = true;
  bodyPivot.add(leftPod);

  const rightPod = new THREE.Mesh(sidePodGeo, primaryMat);
  rightPod.position.set(0.68, 0.42, -0.05);
  rightPod.castShadow = true;
  bodyPivot.add(rightPod);

  // サイドの白いレーシングストライプ
  const stripeGeo = new THREE.BoxGeometry(0.44, 0.08, 1.3);
  const leftStripe = new THREE.Mesh(stripeGeo, whiteAccentMat);
  leftStripe.position.set(-0.68, 0.56, -0.05);
  bodyPivot.add(leftStripe);
  const rightStripe = new THREE.Mesh(stripeGeo, whiteAccentMat);
  rightStripe.position.set(0.68, 0.56, -0.05);
  bodyPivot.add(rightStripe);

  // 3. メインカウル＆流線型ノーズ
  const cowl = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.38, 1.55), primaryMat);
  cowl.position.set(0, 0.50, 0.15);
  cowl.castShadow = true;
  bodyPivot.add(cowl);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.24, 0.85), primaryMat);
  nose.position.set(0, 0.38, 1.18);
  nose.rotation.x = 0.16;
  nose.castShadow = true;
  bodyPivot.add(nose);

  // フロントウイング（スポイラー）
  const frontWing = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.08, 0.34), whiteAccentMat);
  frontWing.position.set(0, 0.24, 1.46);
  frontWing.castShadow = true;
  bodyPivot.add(frontWing);

  // ゼッケンプレート（フロントノーズ上）
  const numCanvas = document.createElement('canvas');
  numCanvas.width = 64;
  numCanvas.height = 64;
  const nctx = numCanvas.getContext('2d');
  nctx.fillStyle = '#ffffff';
  nctx.fillRect(0, 0, 64, 64);
  nctx.strokeStyle = '#111118';
  nctx.lineWidth = 6;
  nctx.strokeRect(3, 3, 58, 58);
  nctx.fillStyle = '#111118';
  nctx.font = '900 40px "Outfit", sans-serif';
  nctx.textAlign = 'center';
  nctx.textBaseline = 'middle';
  nctx.fillText(String(racerNumber), 32, 34);
  const numTex = new THREE.CanvasTexture(numCanvas);
  numTex.colorSpace = THREE.SRGBColorSpace;
  const numPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.46),
    new THREE.MeshBasicMaterial({ map: numTex })
  );
  numPlate.rotation.x = -Math.PI / 2 + 0.16;
  numPlate.position.set(0, 0.53, 1.12);
  bodyPivot.add(numPlate);

  // 4. ヘッドライト＆テール／ブレーキランプ
  const headLightMat = new THREE.MeshBasicMaterial({ color: 0xfff8cc });
  const headGeo = new THREE.BoxGeometry(0.22, 0.11, 0.08);
  const headL = new THREE.Mesh(headGeo, headLightMat);
  headL.position.set(-0.42, 0.42, 1.46);
  bodyPivot.add(headL);
  const headR = new THREE.Mesh(headGeo, headLightMat);
  headR.position.set(0.42, 0.42, 1.46);
  bodyPivot.add(headR);

  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0x660011,
    emissive: 0xff0022,
    emissiveIntensity: 0.4,
    roughness: 0.2
  });
  const tailGeo = new THREE.BoxGeometry(0.28, 0.12, 0.08);
  const tailL = new THREE.Mesh(tailGeo, brakeLightMat);
  tailL.position.set(-0.48, 0.46, -1.38);
  bodyPivot.add(tailL);
  const tailR = new THREE.Mesh(tailGeo, brakeLightMat);
  tailR.position.set(0.48, 0.46, -1.38);
  bodyPivot.add(tailR);

  // 5. ステアリング＆バケットシート
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.72, 0.46), darkCarbonMat);
  seat.position.set(0, 0.72, -0.45);
  seat.rotation.x = -0.15;
  seat.castShadow = true;
  bodyPivot.add(seat);

  const steeringWheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.035, 8, 16),
    darkCarbonMat
  );
  steeringWheel.position.set(0, 0.85, 0.48);
  steeringWheel.rotation.x = 0.45;
  bodyPivot.add(steeringWheel);

  // 6. ドライバー（レーシングスーツ＋ヘルメット＋バイザー）
  const driverGroup = new THREE.Group();
  driverGroup.position.set(0, 0.72, -0.15);

  const suitMat = new THREE.MeshStandardMaterial({
    color: isPlayer ? 0xffffff : themeColor,
    roughness: 0.55
  });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.30, 0.52, 12), suitMat);
  torso.position.set(0, 0.24, 0);
  torso.castShadow = true;
  driverGroup.add(torso);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.66, 0.04);

  const helmetMat = new THREE.MeshStandardMaterial({
    color: themeColor,
    metalness: 0.5,
    roughness: 0.15
  });
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 14), helmetMat);
  helmet.castShadow = true;
  headGroup.add(helmet);

  // ヘルメットのセンターストライプ
  const hStripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.44), whiteAccentMat);
  hStripe.position.set(0, 0.09, -0.02);
  headGroup.add(hStripe);

  // 光沢バイザー
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x0a0d1a,
    metalness: 0.95,
    roughness: 0.08
  });
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.275, 16, 10, -Math.PI * 0.35, Math.PI * 0.7, Math.PI * 0.32, Math.PI * 0.28),
    visorMat
  );
  visor.position.set(0, 0.01, 0.03);
  headGroup.add(visor);

  driverGroup.add(headGroup);
  bodyPivot.add(driverGroup);

  // 7. リアエンジンブロック＆リアスポイラー
  const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.42, 0.65), chromeMat);
  engineBlock.position.set(0, 0.56, -0.98);
  engineBlock.castShadow = true;
  bodyPivot.add(engineBlock);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.10, 0.42), primaryMat);
  wing.position.set(0, 1.38, -1.25);
  wing.rotation.x = 0.12;
  wing.castShadow = true;
  bodyPivot.add(wing);

  // ウイング翼端板
  const endPlateGeo = new THREE.BoxGeometry(0.06, 0.34, 0.48);
  const endPlateL = new THREE.Mesh(endPlateGeo, whiteAccentMat);
  endPlateL.position.set(-0.83, 1.36, -1.25);
  bodyPivot.add(endPlateL);
  const endPlateR = new THREE.Mesh(endPlateGeo, whiteAccentMat);
  endPlateR.position.set(0.83, 1.36, -1.25);
  bodyPivot.add(endPlateR);

  const postGeo = new THREE.BoxGeometry(0.08, 0.68, 0.22);
  const postL = new THREE.Mesh(postGeo, darkCarbonMat);
  postL.position.set(-0.46, 1.02, -1.22);
  postL.rotation.x = -0.15;
  bodyPivot.add(postL);
  const postR = new THREE.Mesh(postGeo, darkCarbonMat);
  postR.position.set(0.46, 1.02, -1.22);
  postR.rotation.x = -0.15;
  bodyPivot.add(postR);

  // 8. ツインマフラー＆アフターバーナー炎
  const exhaustGeo = new THREE.CylinderGeometry(0.10, 0.13, 0.55, 10);
  const exhaustL = new THREE.Mesh(exhaustGeo, chromeMat);
  exhaustL.rotation.x = Math.PI / 2 - 0.15;
  exhaustL.position.set(-0.28, 0.52, -1.36);
  bodyPivot.add(exhaustL);

  const exhaustR = new THREE.Mesh(exhaustGeo, chromeMat);
  exhaustR.rotation.x = Math.PI / 2 - 0.15;
  exhaustR.position.set(0.28, 0.52, -1.36);
  bodyPivot.add(exhaustR);

  const flameGeo = new THREE.ConeGeometry(0.16, 1.15, 10);
  flameGeo.rotateX(-Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.88
  });
  const flameL = new THREE.Mesh(flameGeo, flameMat);
  flameL.position.set(-0.28, 0.55, -2.05);
  flameL.visible = false;
  bodyPivot.add(flameL);

  const flameR = new THREE.Mesh(flameGeo, flameMat);
  flameR.position.set(0.28, 0.55, -2.05);
  flameR.visible = false;
  bodyPivot.add(flameR);

  // 9. ホイール（リム＋タイヤ＋回転用内部グループ）
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x131419, roughness: 0.85, metalness: 0.05 });
  const wheelSpecs = [
    { x: -0.92, y: 0.36, z: 0.92, r: 0.36, w: 0.32, isFront: true },
    { x: 0.92, y: 0.36, z: 0.92, r: 0.36, w: 0.32, isFront: true },
    { x: -0.96, y: 0.42, z: -0.92, r: 0.42, w: 0.40, isFront: false },
    { x: 0.96, y: 0.42, z: -0.92, r: 0.42, w: 0.40, isFront: false }
  ];

  const wheelPivots = [];
  const wheelSpinners = [];

  wheelSpecs.forEach((spec) => {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(spec.x, spec.y, spec.z);

    const spinner = new THREE.Group();

    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.r, spec.r, spec.w, 18),
      tireMat
    );
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    spinner.add(tire);

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.r * 0.58, spec.r * 0.58, spec.w + 0.03, 12),
      chromeMat
    );
    rim.rotation.z = Math.PI / 2;
    spinner.add(rim);

    // スポーク（回転が視覚的にわかる十字バー）
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(spec.w + 0.05, spec.r * 0.95, 0.07),
      primaryMat
    );
    spinner.add(spoke);

    steerPivot.add(spinner);
    bodyPivot.add(steerPivot);
    wheelPivots.push(steerPivot);
    wheelSpinners.push(spinner);
  });

  // プレイヤーには頭上や車体下の微かなアンダーグロウ（視認性向上）
  if (isPlayer) {
    const glowMat = new THREE.MeshBasicMaterial({
      color: themeColor,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide
    });
    const underGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.7), glowMat);
    underGlow.rotation.x = -Math.PI / 2;
    underGlow.position.set(0, 0.05, 0);
    bodyPivot.add(underGlow);
  }

  root.userData = {
    bodyPivot,
    wheelPivots,
    wheelSpinners,
    driverGroup,
    headGroup,
    steeringWheel,
    brakeLightMat,
    primaryMat,
    baseColor: new THREE.Color(themeColor),
    flames: [flameL, flameR],
    flameMat
  };

  return root;
}

// カートビジュアルを毎フレーム更新（タイヤ回転、ステア、傾斜、トリック、炎、スター無敵）
export function updateCartVisual(mesh, physics, input, dt, time) {
  const ud = mesh.userData;
  mesh.position.copy(physics.position);
  mesh.rotation.y = physics.direction + physics.driftAngle + physics.spinAngle;

  // 路面の坂道ピッチ＆コーナリングロール＆トリック回転
  const targetRoll = physics.isDrifting
    ? physics.driftDirection * 0.14
    : (input.left ? 0.08 : (input.right ? -0.08 : 0));

  ud.bodyPivot.rotation.x = THREE.MathUtils.lerp(
    ud.bodyPivot.rotation.x,
    physics.pitchAngle + physics.trickPitch,
    Math.min(1, dt * 10)
  );
  ud.bodyPivot.rotation.z = THREE.MathUtils.lerp(
    ud.bodyPivot.rotation.z,
    targetRoll,
    Math.min(1, dt * 10)
  );
  ud.bodyPivot.rotation.y = physics.trickSpin;

  // エンジン微振動
  const rumble = physics.speed > 1 ? Math.sin(time * 45) * 0.012 : Math.sin(time * 18) * 0.008;
  ud.bodyPivot.position.y = rumble;

  // 前輪ステアリング角（+Y回転で左向き）
  let steerVisual = 0;
  if (input.left) steerVisual = 0.45;
  if (input.right) steerVisual = -0.45;
  if (physics.isDrifting) {
    steerVisual = -physics.driftDirection * 0.42;
  }
  ud.wheelPivots[0].rotation.y = THREE.MathUtils.lerp(ud.wheelPivots[0].rotation.y, steerVisual, Math.min(1, dt * 14));
  ud.wheelPivots[1].rotation.y = THREE.MathUtils.lerp(ud.wheelPivots[1].rotation.y, steerVisual, Math.min(1, dt * 14));

  // タイヤの回転（速度連動）
  const wheelSpinDelta = physics.speed * dt * 2.4;
  ud.wheelSpinners.forEach((sp) => {
    sp.rotation.x += wheelSpinDelta;
  });

  // ドライバーとハンドルの連動アニメーション
  const leanTarget = physics.isDrifting
    ? physics.driftDirection * 0.25
    : (input.left ? 0.18 : (input.right ? -0.18 : 0));
  ud.driverGroup.rotation.z = THREE.MathUtils.lerp(ud.driverGroup.rotation.z, leanTarget, Math.min(1, dt * 10));
  ud.headGroup.rotation.y = THREE.MathUtils.lerp(ud.headGroup.rotation.y, steerVisual * 0.5, Math.min(1, dt * 10));
  ud.steeringWheel.rotation.z = steerVisual * 1.4;

  // ブレーキランプ点灯
  const isBraking = input.brake || physics.isDrifting;
  ud.brakeLightMat.emissiveIntensity = isBraking ? 2.4 : 0.35;

  // ブースト時のアフターバーナー炎
  const boosting = physics.boostTime > 0 || physics.starTime > 0;
  ud.flames.forEach((flame) => {
    flame.visible = boosting;
    if (boosting) {
      const pulse = 0.85 + Math.sin(time * 55) * 0.32;
      flame.scale.set(1, 1, pulse * (physics.starTime > 0 ? 1.35 : 1.0));
    }
  });
  if (boosting) {
    ud.flameMat.color.setHex(
      physics.starTime > 0
        ? (Math.floor(time * 20) % 2 === 0 ? 0xffea00 : 0xff00aa)
        : (Math.floor(time * 25) % 2 === 0 ? 0x00f0ff : 0xffaa00)
    );
  }

  // スター無敵時のレインボーカラー演出
  if (physics.starTime > 0) {
    const hue = (time * 2.2) % 1.0;
    ud.primaryMat.color.setHSL(hue, 1.0, 0.55);
    ud.primaryMat.emissive.setHSL(hue, 1.0, 0.45);
    ud.primaryMat.emissiveIntensity = 0.9;
  } else {
    ud.primaryMat.color.copy(ud.baseColor);
    ud.primaryMat.emissive.copy(ud.baseColor);
    ud.primaryMat.emissiveIntensity = 0.08;
  }
}
