import * as THREE from 'three';
import { TextureFactory } from './textures.js';

export const COURSE_PRESETS = {
  sunshine: {
    id: 'sunshine',
    name: 'SUNSHINE CIRCUIT',
    subtitle: '爽快な海辺と緑の王道サーキット',
    theme: 'sunshine',
    difficulty: '★★☆',
    trackWidth: 14,
    fogColor: 0xbce3ff,
    fogDensity: 0.00115,
    ambientColor: 0xffffff,
    ambientIntensity: 0.65,
    sunColor: 0xfff8e6,
    sunIntensity: 1.45,
    sunPos: new THREE.Vector3(140, 210, 90),
    hemiSky: 0x87ceff,
    hemiGround: 0x4c8c42,
    hemiIntensity: 0.55,
    waterColor: 0x1597d4,
    pathPoints: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(85, 0, 25),
      new THREE.Vector3(175, 6, 85),
      new THREE.Vector3(245, 16, 55),
      new THREE.Vector3(280, 12, -30),
      new THREE.Vector3(210, 3, -115),
      new THREE.Vector3(120, 1, -70),
      new THREE.Vector3(55, -2, -145),
      new THREE.Vector3(-45, 3, -200),
      new THREE.Vector3(-155, 10, -155),
      new THREE.Vector3(-225, 14, -65),
      new THREE.Vector3(-240, 6, 45),
      new THREE.Vector3(-165, 1, 110),
      new THREE.Vector3(-85, 0, 48),
    ],
    ramps: [
      { u: 0.23, offset: 0 },
      { u: 0.56, offset: 0 },
      { u: 0.84, offset: 0 },
    ]
  },
  sunset: {
    id: 'sunset',
    name: 'SUNSET CANYON',
    subtitle: '茜色の渓谷とダイナミックな高低差',
    theme: 'sunset',
    difficulty: '★★★',
    trackWidth: 13.5,
    fogColor: 0xe68a5c,
    fogDensity: 0.00135,
    ambientColor: 0xffd2b0,
    ambientIntensity: 0.58,
    sunColor: 0xffaa55,
    sunIntensity: 1.65,
    sunPos: new THREE.Vector3(-180, 95, -120),
    hemiSky: 0xff9e66,
    hemiGround: 0x5c3628,
    hemiIntensity: 0.55,
    waterColor: 0xc96b45,
    pathPoints: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(95, 2, 10),
      new THREE.Vector3(185, 14, 70),
      new THREE.Vector3(250, 24, 15),
      new THREE.Vector3(215, 18, -75),
      new THREE.Vector3(130, 8, -50),
      new THREE.Vector3(95, 0, -155),
      new THREE.Vector3(0, -3, -215),
      new THREE.Vector3(-115, 6, -180),
      new THREE.Vector3(-160, 18, -90),
      new THREE.Vector3(-255, 22, -20),
      new THREE.Vector3(-215, 10, 95),
      new THREE.Vector3(-110, 3, 95),
      new THREE.Vector3(-60, 0, 30),
    ],
    ramps: [
      { u: 0.14, offset: 0 },
      { u: 0.44, offset: 0 },
      { u: 0.70, offset: 0 },
      { u: 0.87, offset: 0 },
    ]
  },
  neon: {
    id: 'neon',
    name: 'NEON METROPOLIS',
    subtitle: '光り輝く夜景と高速ネオンハイウェイ',
    theme: 'neon',
    difficulty: '★★★',
    trackWidth: 13.8,
    fogColor: 0x0d1028,
    fogDensity: 0.00145,
    ambientColor: 0x7a9cff,
    ambientIntensity: 0.58,
    sunColor: 0x8ad8ff,
    sunIntensity: 1.05,
    sunPos: new THREE.Vector3(110, 180, -100),
    hemiSky: 0x3b48a8,
    hemiGround: 0x1a0d2e,
    hemiIntensity: 0.65,
    waterColor: 0x0a1c3a,
    pathPoints: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(105, 0, 0),
      new THREE.Vector3(210, 8, 45),
      new THREE.Vector3(265, 18, -35),
      new THREE.Vector3(205, 14, -135),
      new THREE.Vector3(100, 4, -120),
      new THREE.Vector3(20, 12, -195),
      new THREE.Vector3(-95, 20, -185),
      new THREE.Vector3(-195, 12, -110),
      new THREE.Vector3(-145, 4, -20),
      new THREE.Vector3(-230, 10, 75),
      new THREE.Vector3(-140, 4, 130),
      new THREE.Vector3(-75, 0, 55),
    ],
    ramps: [
      { u: 0.21, offset: 0 },
      { u: 0.52, offset: 0 },
      { u: 0.79, offset: 0 },
    ]
  }
};

export class GameWorld {
  constructor(scene, courseId = 'sunshine') {
    this.scene = scene;
    this.courseId = courseId;
    this.preset = COURSE_PRESETS[courseId] || COURSE_PRESETS.sunshine;
    this.theme = this.preset.theme;

    this.trackWidth = this.preset.trackWidth;
    this.curbWidth = 1.15;
    this.offroadMargin = 5.5; // コース端からガードレールまでの芝生幅

    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);

    this.pathPoints = this.preset.pathPoints.map(p => p.clone());
    this.trackCurve = new THREE.CatmullRomCurve3(this.pathPoints, true, 'catmullrom', 0.5);
    this.trackLength = this.trackCurve.getLength();

    // 動的オブジェクト・判定用配列
    this.coins = [];
    this.itemBoxes = [];
    this.trees = [];
    this.ramps = [];
    this.animatedProps = [];
    this.clouds = [];
    this.balloons = [];
    this.flags = [];
    this.signalLights = [];
    this.waterMesh = null;

    // 周回管理チェックポイント
    this.checkpoints = [0.25, 0.5, 0.75, 0.96];

    // 高速サンプリング点
    this.numSamples = 360;
    this.cachedPoints = this.trackCurve.getSpacedPoints(this.numSamples);
    this.cachedTangents = [];
    for (let i = 0; i <= this.numSamples; i++) {
      this.cachedTangents.push(this.trackCurve.getTangentAt(i / this.numSamples).normalize());
    }

    this.init();
  }

  init() {
    this.scene.fog = new THREE.FogExp2(this.preset.fogColor, this.preset.fogDensity);
    this.createSkybox();
    this.createTerrainAndWater();
    this.createTrackAndStructures();
    this.createStartComplex();
    this.createCheckpointArches();
    this.createDistantScenery();
    this.createLandmarksAndSkyProps();
    this.spawnEnvironmentProps();
    this.spawnRamps();
    this.spawnCoins();
    this.spawnItemBoxes();
  }

  // 地形高さ関数（コースから離れると丘陵になる、コース近辺は干渉しないよう下げる）
  getTerrainHeight(x, z, distToTrack = null, trackY = 0) {
    const baseWave =
      Math.sin(x * 0.011) * Math.cos(z * 0.012) * 10 +
      Math.sin((x + z) * 0.022) * 4.5 +
      Math.cos(x * 0.005 - z * 0.007) * 8;

    let d = distToTrack;
    let ty = trackY;
    if (d === null) {
      let minSq = Infinity;
      for (let i = 0; i < this.numSamples; i += 2) {
        const p = this.cachedPoints[i];
        const dx = x - p.x;
        const dz = z - p.z;
        const sq = dx * dx + dz * dz;
        if (sq < minSq) {
          minSq = sq;
          ty = p.y;
        }
      }
      d = Math.sqrt(minSq);
    }

    // コース中心から近い場所は路面の下に滑らかに沈ませる（高架部分は地面を低く保つ）
    const safeGroundNearTrack = Math.min(ty - 0.55, -2.2);
    const blend = THREE.MathUtils.smoothstep(d, this.trackWidth * 0.75, this.trackWidth * 2.6 + 18);
    let h = THREE.MathUtils.lerp(safeGroundNearTrack, baseWave - 4.5, blend);

    // 外周の山岳地帯へなだらかに盛り上げる
    const radial = Math.hypot(x, z);
    if (radial > 320) {
      const rim = THREE.MathUtils.smoothstep(radial, 320, 620);
      h += rim * (this.theme === 'neon' ? 12 : 48) * (0.6 + 0.4 * Math.sin(Math.atan2(z, x) * 7));
    }
    return h;
  }

  createSkybox() {
    const skyTex = TextureFactory.createSkyTexture(this.theme);
    const skyGeo = new THREE.SphereGeometry(1100, 40, 24);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      fog: false
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.worldGroup.add(sky);
  }

  createTerrainAndWater() {
    // 起伏あるプロシージャル地形メッシュ（スマホでは分割数を抑えて軽量化）
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const size = 1400;
    const segs = isMobile ? 72 : 120;
    const terrainGeo = new THREE.PlaneGeometry(size, size, segs, segs);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.getTerrainHeight(x, z);
      pos.setY(i, y);
    }
    terrainGeo.computeVertexNormals();

    const terrainTex = TextureFactory.createTerrainTexture(this.theme);
    const terrainMat = new THREE.MeshStandardMaterial({
      map: terrainTex,
      roughness: this.theme === 'neon' ? 0.55 : 0.92,
      metalness: this.theme === 'neon' ? 0.35 : 0.04
    });

    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    this.worldGroup.add(terrain);

    // 美しく反射する湖・水面（低い谷の部分に広がる）
    const waterGeo = new THREE.PlaneGeometry(1400, 1400, 32, 32);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: this.preset.waterColor,
      roughness: 0.14,
      metalness: 0.72,
      transparent: true,
      opacity: 0.86
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.position.y = -7.2;
    this.waterMesh.receiveShadow = true;
    this.worldGroup.add(this.waterMesh);
  }

  // 厚みのあるコース・縁石・高架橋脚・ガードレール・コーナー標識を一括生成
  createTrackAndStructures() {
    const segments = 420;
    const points = this.trackCurve.getSpacedPoints(segments);
    const halfW = this.trackWidth / 2;
    const deckThickness = 0.85;

    const trackPositions = [];
    const trackUVs = [];
    const trackIndices = [];

    const sidePositions = [];
    const sideIndices = [];

    const curbLeftPts = [];
    const curbRightPts = [];
    const railLeftPts = [];
    const railRightPts = [];

    const uvRepeatLength = this.trackLength / 14;
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const p = points[i % segments];
      const tangent = this.trackCurve.getTangentAt(u % 1.0).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const pLeft = p.clone().addScaledVector(normal, -halfW);
      const pRight = p.clone().addScaledVector(normal, halfW);

      trackPositions.push(pLeft.x, pLeft.y, pLeft.z);
      trackPositions.push(pRight.x, pRight.y, pRight.z);
      trackUVs.push(0, u * uvRepeatLength);
      trackUVs.push(1, u * uvRepeatLength);

      // 道路デッキ側面（厚み表現）
      const pLeftOuter = p.clone().addScaledVector(normal, -(halfW + this.curbWidth));
      const pRightOuter = p.clone().addScaledVector(normal, halfW + this.curbWidth);
      sidePositions.push(pLeftOuter.x, pLeftOuter.y + 0.05, pLeftOuter.z);
      sidePositions.push(pLeftOuter.x, pLeftOuter.y - deckThickness, pLeftOuter.z);
      sidePositions.push(pRightOuter.x, pRightOuter.y + 0.05, pRightOuter.z);
      sidePositions.push(pRightOuter.x, pRightOuter.y - deckThickness, pRightOuter.z);

      curbLeftPts.push(pLeft, pLeftOuter);
      curbRightPts.push(pRight, pRightOuter);

      // 外周ガードレール位置（コース端＋芝生マージン、高架区間は道路すぐ脇）
      const isBridge = p.y > 4.0;
      const railDist = isBridge ? halfW + this.curbWidth + 0.35 : halfW + this.offroadMargin;
      railLeftPts.push({
        pos: p.clone().addScaledVector(normal, -railDist),
        normal: normal.clone(),
        tangent: tangent.clone(),
        isBridge
      });
      railRightPts.push({
        pos: p.clone().addScaledVector(normal, railDist),
        normal: normal.clone(),
        tangent: tangent.clone(),
        isBridge
      });

      if (i < segments) {
        const c = i * 2;
        const n = (i + 1) * 2;
        trackIndices.push(c, c + 1, n, c + 1, n + 1, n);

        const sc = i * 4;
        const sn = (i + 1) * 4;
        // 左側面
        sideIndices.push(sc, sn, sc + 1, sc + 1, sn, sn + 1);
        // 右側面
        sideIndices.push(sc + 2, sc + 3, sn + 2, sc + 3, sn + 3, sn + 2);
      }
    }

    // 1. アスファルト路面メッシュ
    const trackGeo = new THREE.BufferGeometry();
    trackGeo.setAttribute('position', new THREE.Float32BufferAttribute(trackPositions, 3));
    trackGeo.setAttribute('uv', new THREE.Float32BufferAttribute(trackUVs, 2));
    trackGeo.setIndex(trackIndices);
    trackGeo.computeVertexNormals();

    const asphaltTex = TextureFactory.createAsphaltTexture(this.theme);
    const trackMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: this.theme === 'neon' ? 0.42 : 0.78,
      metalness: this.theme === 'neon' ? 0.32 : 0.1
    });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.receiveShadow = true;
    this.worldGroup.add(trackMesh);

    // 2. 道路側面コンクリートデッキ
    const sideGeo = new THREE.BufferGeometry();
    sideGeo.setAttribute('position', new THREE.Float32BufferAttribute(sidePositions, 3));
    sideGeo.setIndex(sideIndices);
    sideGeo.computeVertexNormals();
    const sideMat = new THREE.MeshStandardMaterial({
      color: this.theme === 'neon' ? 0x1b213d : 0x8e939e,
      roughness: 0.75,
      metalness: 0.2,
      side: THREE.DoubleSide
    });
    const sideMesh = new THREE.Mesh(sideGeo, sideMat);
    sideMesh.castShadow = true;
    sideMesh.receiveShadow = true;
    this.worldGroup.add(sideMesh);

    // 3. 紅白／ネオン縁石（左右ともに法線が上向きになるように生成）
    this.createCurbs(curbLeftPts, segments, true);
    this.createCurbs(curbRightPts, segments, false);

    // 4. 高架橋脚（ピラー）＆高架サイドバリア
    this.createBridgePillarsAndRails(points, segments, railLeftPts, railRightPts);

    // 5. 急カーブ自動検出 → シェブロン標識＆タイヤバリア
    this.createCornerSignsAndBarriers(segments);
  }

  createCurbs(curbVertices, segments, flipWinding = false) {
    const vertices = [];
    const colors = [];
    const indices = [];
    const isNight = this.theme === 'neon';

    for (let i = 0; i <= segments; i++) {
      const pInner = curbVertices[i * 2];
      const pOuter = curbVertices[i * 2 + 1];

      if (flipWinding) {
        vertices.push(pOuter.x, pOuter.y + 0.08, pOuter.z);
        vertices.push(pInner.x, pInner.y + 0.06, pInner.z);
      } else {
        vertices.push(pInner.x, pInner.y + 0.06, pInner.z);
        vertices.push(pOuter.x, pOuter.y + 0.08, pOuter.z);
      }

      const stripe = Math.floor(i / 3) % 2 === 0;
      if (isNight) {
        if (stripe) {
          colors.push(0.0, 0.95, 1.0, 0.0, 0.95, 1.0);
        } else {
          colors.push(1.0, 0.08, 0.55, 1.0, 0.08, 0.55);
        }
      } else {
        if (stripe) {
          colors.push(0.92, 0.12, 0.15, 0.92, 0.12, 0.15);
        } else {
          colors.push(0.96, 0.96, 0.96, 0.96, 0.96, 0.96);
        }
      }

      if (i < segments) {
        const c = i * 2;
        const n = (i + 1) * 2;
        indices.push(c, c + 1, n, c + 1, n + 1, n);
      }
    }

    const curbGeo = new THREE.BufferGeometry();
    curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    curbGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    curbGeo.setIndex(indices);
    curbGeo.computeVertexNormals();

    const curbMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: isNight ? 0.3 : 0.65,
      metalness: isNight ? 0.4 : 0.08,
      emissive: isNight ? new THREE.Color(0x222238) : new THREE.Color(0x000000),
      side: THREE.DoubleSide
    });

    const curbMesh = new THREE.Mesh(curbGeo, curbMat);
    curbMesh.receiveShadow = true;
    this.worldGroup.add(curbMesh);
  }

  createBridgePillarsAndRails(points, segments, railLeftPts, railRightPts) {
    const pillarMat = new THREE.MeshStandardMaterial({
      color: this.theme === 'neon' ? 0x222944 : 0xb4b8c2,
      roughness: 0.75,
      metalness: 0.2
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: this.theme === 'neon' ? 0x00f0ff : 0x7b808c,
      roughness: 0.5,
      metalness: 0.4,
      emissive: this.theme === 'neon' ? 0x005577 : 0x000000
    });

    const up = new THREE.Vector3(0, 1, 0);

    // 橋脚を一定間隔で設置（路面が地面より高い区間）
    for (let i = 0; i < segments; i += 10) {
      const p = points[i];
      if (p.y > 2.2) {
        const u = i / segments;
        const tangent = this.trackCurve.getTangentAt(u).normalize();
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

        const pillarH = p.y + 14;
        const pillarGeo = new THREE.CylinderGeometry(0.95, 1.25, pillarH, 10);

        [-this.trackWidth * 0.34, this.trackWidth * 0.34].forEach((sideOffset) => {
          const pos = p.clone().addScaledVector(normal, sideOffset);
          const pillar = new THREE.Mesh(pillarGeo, pillarMat);
          pillar.position.set(pos.x, p.y - 0.85 - pillarH / 2, pos.z);
          pillar.castShadow = true;
          pillar.receiveShadow = true;
          this.worldGroup.add(pillar);
        });

        // 横梁（クロスビーム）
        const beam = new THREE.Mesh(
          new THREE.BoxGeometry(this.trackWidth * 0.9, 1.1, 1.6),
          capMat
        );
        beam.position.set(p.x, p.y - 1.35, p.z);
        beam.lookAt(p.clone().add(tangent).setY(p.y - 1.35));
        this.worldGroup.add(beam);
      }
    }

    // 連続ガードレールリボン（高架区間＋全コース外周に視認性の高いバリア）
    const buildRailRibbon = (pts, colorHex) => {
      const verts = [];
      const idx = [];
      const railH = 0.85;
      const railBase = 0.35;
      for (let i = 0; i <= segments; i++) {
        const item = pts[i];
        verts.push(item.pos.x, item.pos.y + railBase, item.pos.z);
        verts.push(item.pos.x, item.pos.y + railBase + railH, item.pos.z);
        if (i < segments) {
          const c = i * 2;
          const n = (i + 1) * 2;
          idx.push(c, c + 1, n, c + 1, n + 1, n);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.4,
        metalness: 0.55,
        emissive: this.theme === 'neon' ? colorHex : 0x000000,
        emissiveIntensity: this.theme === 'neon' ? 0.35 : 0,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      this.worldGroup.add(mesh);

      // 支柱（8セグメントごと）
      const postGeo = new THREE.CylinderGeometry(0.11, 0.11, 1.3, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x555b66, metalness: 0.7, roughness: 0.3 });
      for (let i = 0; i < segments; i += 6) {
        const item = pts[i];
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(item.pos.x, item.pos.y + 0.55, item.pos.z);
        this.worldGroup.add(post);
      }
    };

    const leftColor = this.theme === 'neon' ? 0x00d9ff : 0xdde3ec;
    const rightColor = this.theme === 'neon' ? 0xff2a9d : 0xdde3ec;
    buildRailRibbon(railLeftPts, leftColor);
    buildRailRibbon(railRightPts, rightColor);
  }

  // 急カーブの外側にシェブロン看板＆タイヤバリアを自動設置
  createCornerSignsAndBarriers(segments) {
    const up = new THREE.Vector3(0, 1, 0);
    const chevronLeftTex = TextureFactory.createChevronSignTexture(1);
    const chevronRightTex = TextureFactory.createChevronSignTexture(-1);
    const signGeo = new THREE.BoxGeometry(3.2, 1.6, 0.18);
    const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.2, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x333640, metalness: 0.7 });
    const tireGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.85, 10);
    const tireMatRed = new THREE.MeshStandardMaterial({ color: 0xd92626, roughness: 0.8 });
    const tireMatWhite = new THREE.MeshStandardMaterial({ color: 0xf0f2f5, roughness: 0.8 });

    let signIndex = 0;
    for (let i = 0; i < segments; i += 5) {
      const uPrev = ((i - 4 + segments) % segments) / segments;
      const uCurr = i / segments;
      const uNext = ((i + 4) % segments) / segments;

      const tPrev = this.trackCurve.getTangentAt(uPrev).setY(0).normalize();
      const tNext = this.trackCurve.getTangentAt(uNext).setY(0).normalize();
      const crossY = tPrev.x * tNext.z - tPrev.z * tNext.x;
      const turnStrength = Math.abs(crossY);

      if (turnStrength > 0.14) {
        const p = this.trackCurve.getPointAt(uCurr);
        const tangent = this.trackCurve.getTangentAt(uCurr).normalize();
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

        // コーナー外側の方向
        const outerSide = crossY > 0 ? -1 : 1;
        const dist = this.trackWidth / 2 + this.curbWidth + 2.2;
        const pos = p.clone().addScaledVector(normal, outerSide * dist);

        // 看板を進行方向に向ける
        const signGroup = new THREE.Group();
        signGroup.position.set(pos.x, pos.y + 1.8, pos.z);
        signGroup.lookAt(p.clone().addScaledVector(tangent, -12).setY(pos.y + 1.8));

        const mat = new THREE.MeshStandardMaterial({
          map: crossY > 0 ? chevronRightTex : chevronLeftTex,
          roughness: 0.35,
          emissive: this.theme === 'neon' ? 0x443300 : 0x000000
        });
        const sign = new THREE.Mesh(signGeo, mat);
        sign.castShadow = true;
        signGroup.add(sign);

        const pL = new THREE.Mesh(postGeo, postMat);
        pL.position.set(-1.1, -1.1, 0);
        signGroup.add(pL);
        const pR = new THREE.Mesh(postGeo, postMat);
        pR.position.set(1.1, -1.1, 0);
        signGroup.add(pR);

        this.worldGroup.add(signGroup);

        // 足元に紅白タイヤバリア
        const tire = new THREE.Mesh(tireGeo, signIndex % 2 === 0 ? tireMatRed : tireMatWhite);
        const tirePos = p.clone().addScaledVector(normal, outerSide * (this.trackWidth / 2 + this.curbWidth + 0.9));
        tire.position.set(tirePos.x, tirePos.y + 0.42, tirePos.z);
        tire.castShadow = true;
        this.worldGroup.add(tire);
        signIndex++;
      }
    }
  }

  // スタート＆フィニッシュ複合施設（ゲート・LED信号・グランドスタンド・フラッグ）
  createStartComplex() {
    const startPoint = this.trackCurve.getPointAt(0);
    const tangent = this.trackCurve.getTangentAt(0).normalize();
    const gateGroup = new THREE.Group();
    gateGroup.position.copy(startPoint);
    gateGroup.lookAt(startPoint.clone().add(tangent));

    // 路面チェッカースタートライン
    const lineTex = TextureFactory.createStartLineTexture();
    const startLine = new THREE.Mesh(
      new THREE.PlaneGeometry(this.trackWidth - 0.8, 3.2),
      new THREE.MeshStandardMaterial({ map: lineTex, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 })
    );
    startLine.rotation.x = -Math.PI / 2;
    startLine.position.set(0, 0.04, 0);
    gateGroup.add(startLine);

    // スタートグリッドのペイント枠（6台分）
    const gridMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
    const gridOffsets = [
      { z: -3.5, x: -3.0 }, { z: -6.5, x: 3.0 },
      { z: -9.5, x: -3.0 }, { z: -12.5, x: 3.0 },
      { z: -15.5, x: -3.0 }, { z: -18.5, x: 3.0 }
    ];
    gridOffsets.forEach((g) => {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.3), gridMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(g.x, 0.04, g.z + 1.4);
      gateGroup.add(bar);
    });

    // 左右のトラスゲート柱
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x262a36, metalness: 0.75, roughness: 0.25 });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xff0066,
      emissive: 0xff0055,
      emissiveIntensity: this.theme === 'neon' ? 0.85 : 0.25,
      roughness: 0.3
    });

    const halfSpan = this.trackWidth / 2 + 2.2;
    [-halfSpan, halfSpan].forEach((xPos) => {
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 2.0), pillarMat);
      base.position.set(xPos, 0.7, 0);
      base.castShadow = true;
      gateGroup.add(base);

      const post = new THREE.Mesh(new THREE.BoxGeometry(0.95, 9.5, 1.2), pillarMat);
      post.position.set(xPos, 5.2, 0);
      post.castShadow = true;
      gateGroup.add(post);

      const strip = new THREE.Mesh(new THREE.BoxGeometry(1.02, 8.2, 0.22), accentMat);
      strip.position.set(xPos, 5.2, 0.55);
      gateGroup.add(strip);
    });

    // 上部トラスビーム＆大型バナー
    const archW = halfSpan * 2 + 1.4;
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(archW, 2.2, 1.6), pillarMat);
    topBeam.position.set(0, 9.6, 0);
    topBeam.castShadow = true;
    gateGroup.add(topBeam);

    const bannerTex = TextureFactory.createGateBannerTexture(this.preset.name);
    const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex });
    const bannerFront = new THREE.Mesh(new THREE.PlaneGeometry(archW - 2.4, 1.75), bannerMat);
    bannerFront.position.set(0, 9.6, 0.83);
    gateGroup.add(bannerFront);
    const bannerBack = new THREE.Mesh(new THREE.PlaneGeometry(archW - 2.4, 1.75), bannerMat);
    bannerBack.position.set(0, 9.6, -0.83);
    bannerBack.rotation.y = Math.PI;
    gateGroup.add(bannerBack);

    // カウントダウン連動LEDシグナルライト（3灯）
    const signalBox = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.25, 0.8), pillarMat);
    signalBox.position.set(0, 7.6, -0.5);
    gateGroup.add(signalBox);

    this.signalLights = [];
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        emissive: 0x111111,
        emissiveIntensity: 0.2,
        roughness: 0.2
      });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), mat);
      lamp.position.set((i - 1) * 1.65, 7.6, -0.92);
      gateGroup.add(lamp);
      this.signalLights.push(mat);
    }

    // グランドスタンド（コース右脇に観客席）
    this.buildGrandstand(gateGroup, halfSpan + 10.5, -14, -Math.PI / 2);
    this.buildGrandstand(gateGroup, -(halfSpan + 10.5), -14, Math.PI / 2);

    // 風になびくサーキットフラッグ群
    const flagColors = [0xff0055, 0x00f0ff, 0xffcc00, 0x00ff77];
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const zOff = -28 + Math.floor(i / 2) * 16;
      const flagPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 6.5, 8),
        new THREE.MeshStandardMaterial({ color: 0xd8dee9, metalness: 0.8, roughness: 0.2 })
      );
      flagPole.position.set(side * (halfSpan + 2.5), 3.25, zOff);
      gateGroup.add(flagPole);

      const clothGeo = new THREE.PlaneGeometry(2.2, 1.1, 6, 1);
      const clothMat = new THREE.MeshStandardMaterial({
        color: flagColors[i % flagColors.length],
        side: THREE.DoubleSide,
        roughness: 0.6
      });
      const cloth = new THREE.Mesh(clothGeo, clothMat);
      cloth.position.set(side * (halfSpan + 2.5) + 1.1, 5.8, zOff);
      gateGroup.add(cloth);
      this.flags.push({ mesh: cloth, phase: i * 1.1 });
    }

    this.worldGroup.add(gateGroup);
  }

  buildGrandstand(parent, x, z, rotY) {
    const stand = new THREE.Group();
    stand.position.set(x, -0.5, z);
    stand.rotation.y = rotY;

    const concreteMat = new THREE.MeshStandardMaterial({ color: 0xcfd5df, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({
      color: this.theme === 'neon' ? 0x1e2545 : 0x1d4ed8,
      metalness: 0.35,
      roughness: 0.4
    });

    // 4段のスタンド座席
    const crowdColors = [0xff3b5c, 0x00d9ff, 0xffcc00, 0x38ef7d, 0xffffff, 0xff7733, 0xb85cff];
    for (let row = 0; row < 4; row++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(26, 1.1, 1.8), concreteMat);
      step.position.set(0, 0.55 + row * 1.1, -row * 1.6);
      step.castShadow = true;
      step.receiveShadow = true;
      stand.add(step);

      // カラフルな観客のドットシルエット
      for (let s = -11; s <= 11; s += 1.45) {
        if (Math.random() < 0.2) continue;
        const person = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.24, 0.45, 4, 6),
          new THREE.MeshStandardMaterial({
            color: crowdColors[Math.floor(Math.random() * crowdColors.length)],
            roughness: 0.7
          })
        );
        person.position.set(s + (Math.random() - 0.5) * 0.3, 1.45 + row * 1.1, -row * 1.6);
        stand.add(person);
      }
    }

    // 屋根と支柱
    const roof = new THREE.Mesh(new THREE.BoxGeometry(27.5, 0.35, 8.2), roofMat);
    roof.position.set(0, 7.6, -2.5);
    roof.rotation.x = 0.14;
    roof.castShadow = true;
    stand.add(roof);

    [-12, 0, 12].forEach((px) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 7.6, 8), concreteMat);
      pillar.position.set(px, 3.8, -5.8);
      stand.add(pillar);
    });

    parent.add(stand);
  }

  // カウントダウンに連動してスタートゲートのLEDを光らせる
  setStartLights(stage) {
    // stage: 0=消灯, 1=赤1, 2=赤2, 3=赤3, 4=全緑(GO!)
    this.signalLights.forEach((mat, i) => {
      if (stage === 4) {
        mat.color.setHex(0x00ff66);
        mat.emissive.setHex(0x00ff66);
        mat.emissiveIntensity = 2.6;
      } else if (stage > i) {
        mat.color.setHex(0xff1133);
        mat.emissive.setHex(0xff0022);
        mat.emissiveIntensity = 2.4;
      } else {
        mat.color.setHex(0x222228);
        mat.emissive.setHex(0x111114);
        mat.emissiveIntensity = 0.1;
      }
    });
  }

  // コース途中のスポンサー＆ネオンアーチ（スピード感と場所の目印）
  createCheckpointArches() {
    const sponsors = [
      { u: 0.25, label: 'TURBO GP', bg: '#0f172a', accent: '#00f0ff' },
      { u: 0.50, label: 'DRIFT ZONE', bg: '#270e2e', accent: '#ff007f' },
      { u: 0.75, label: 'SUPER BOOST', bg: '#1e293b', accent: '#ffcc00' },
    ];

    const halfSpan = this.trackWidth / 2 + 2.0;
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333846, metalness: 0.75, roughness: 0.3 });

    sponsors.forEach((sp) => {
      const p = this.trackCurve.getPointAt(sp.u);
      const t = this.trackCurve.getTangentAt(sp.u).normalize();
      const group = new THREE.Group();
      group.position.copy(p);
      group.lookAt(p.clone().add(t));

      const leftPole = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 7.6, 10), poleMat);
      leftPole.position.set(-halfSpan, 3.8, 0);
      leftPole.castShadow = true;
      group.add(leftPole);

      const rightPole = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 7.6, 10), poleMat);
      rightPole.position.set(halfSpan, 3.8, 0);
      rightPole.castShadow = true;
      group.add(rightPole);

      const tex = TextureFactory.createSponsorTexture(sp.label, sp.bg, sp.accent);
      const boardMat = new THREE.MeshStandardMaterial({
        map: tex,
        emissive: this.theme === 'neon' ? new THREE.Color(sp.accent) : new THREE.Color(0x000000),
        emissiveIntensity: this.theme === 'neon' ? 0.25 : 0,
        roughness: 0.4
      });
      const board = new THREE.Mesh(new THREE.BoxGeometry(halfSpan * 2 + 1.2, 1.85, 0.55), boardMat);
      board.position.set(0, 7.4, 0);
      board.castShadow = true;
      group.add(board);

      this.worldGroup.add(group);
    });

    // ナイトコース限定：コース沿いに等間隔のネオンライトリングを追加
    if (this.theme === 'neon') {
      const archGeo = new THREE.TorusGeometry(this.trackWidth * 0.58, 0.16, 8, 24, Math.PI);
      for (let i = 0; i < 16; i++) {
        const u = (i / 16 + 0.03) % 1.0;
        const p = this.trackCurve.getPointAt(u);
        const t = this.trackCurve.getTangentAt(u).normalize();
        const col = i % 2 === 0 ? 0x00f0ff : 0xff00aa;
        const arch = new THREE.Mesh(
          archGeo,
          new THREE.MeshBasicMaterial({ color: col })
        );
        arch.position.copy(p);
        arch.lookAt(p.clone().add(t));
        this.worldGroup.add(arch);
      }
    }
  }

  // 遠景の山脈／メサ／夜景ビル群
  createDistantScenery() {
    if (this.theme === 'neon') {
      // 遠景のネオン摩天楼群
      const buildingColors = [0x121830, 0x192042, 0x1d163a];
      const windowColors = [0x00f0ff, 0xff00aa, 0xffcc00, 0x77ff99];
      for (let i = 0; i < 65; i++) {
        const angle = (i / 65) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
        const radius = 330 + Math.random() * 210;
        const bx = Math.cos(angle) * radius;
        const bz = Math.sin(angle) * radius;
        const w = 18 + Math.random() * 26;
        const d = 18 + Math.random() * 26;
        const h = 45 + Math.random() * 140;

        const bldg = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          new THREE.MeshStandardMaterial({
            color: buildingColors[i % buildingColors.length],
            roughness: 0.4,
            metalness: 0.6
          })
        );
        bldg.position.set(bx, h / 2 - 12, bz);
        this.worldGroup.add(bldg);

        // 屋上のネオン縁取り
        const neonCol = windowColors[i % windowColors.length];
        const roofTrim = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 1.8, d + 0.6),
          new THREE.MeshBasicMaterial({ color: neonCol })
        );
        roofTrim.position.set(bx, h - 12, bz);
        this.worldGroup.add(roofTrim);
      }
      return;
    }

    // 雄大な連山（雪冠付き／夕焼け渓谷メサ）
    const numPeaks = 34;
    const mountainColor = this.theme === 'sunset' ? 0x8b4432 : 0x4f6d82;
    const capColor = this.theme === 'sunset' ? 0xc46b42 : 0xf4f8ff;

    for (let i = 0; i < numPeaks; i++) {
      const angle = (i / numPeaks) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
      const dist = 420 + Math.random() * 190;
      const mx = Math.cos(angle) * dist;
      const mz = Math.sin(angle) * dist;
      const height = 85 + Math.random() * 115;
      const radius = 58 + Math.random() * 55;

      const mGroup = new THREE.Group();
      mGroup.position.set(mx, -15, mz);

      if (this.theme === 'sunset') {
        // 渓谷のメサ（頂上が平らな岩山）
        const mesa = new THREE.Mesh(
          new THREE.CylinderGeometry(radius * 0.45, radius, height, 7),
          new THREE.MeshStandardMaterial({ color: mountainColor, roughness: 0.95, flatShading: true })
        );
        mesa.position.y = height / 2;
        mGroup.add(mesa);
      } else {
        // 雪化粧のアルプス連山
        const base = new THREE.Mesh(
          new THREE.ConeGeometry(radius, height, 7),
          new THREE.MeshStandardMaterial({ color: mountainColor, roughness: 0.92, flatShading: true })
        );
        base.position.y = height / 2;
        mGroup.add(base);

        const snowH = height * 0.34;
        const snow = new THREE.Mesh(
          new THREE.ConeGeometry(radius * 0.35, snowH, 7),
          new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.7, flatShading: true })
        );
        snow.position.y = height - snowH / 2 + 0.5;
        mGroup.add(snow);
      }
      this.worldGroup.add(mGroup);
    }
  }

  // 風車、観覧車、熱気球、3D立体雲などの動くランドマーク
  createLandmarksAndSkyProps() {
    // 1. 立体3Dクラウド群（ナイトコース以外）
    if (this.theme !== 'neon') {
      const cloudMat = new THREE.MeshStandardMaterial({
        color: this.theme === 'sunset' ? 0xffcba4 : 0xffffff,
        roughness: 0.95,
        metalness: 0.0
      });
      const puffGeo = new THREE.SphereGeometry(1, 10, 8);
      for (let i = 0; i < 24; i++) {
        const cloud = new THREE.Group();
        const puffs = 3 + Math.floor(Math.random() * 3);
        for (let j = 0; j < puffs; j++) {
          const puff = new THREE.Mesh(puffGeo, cloudMat);
          const s = 9 + Math.random() * 9;
          puff.scale.set(s * 1.4, s * 0.75, s);
          puff.position.set((j - puffs / 2) * 10, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6);
          cloud.add(puff);
        }
        const angle = Math.random() * Math.PI * 2;
        const r = 120 + Math.random() * 380;
        cloud.position.set(Math.cos(angle) * r, 95 + Math.random() * 55, Math.sin(angle) * r);
        this.worldGroup.add(cloud);
        this.clouds.push({ mesh: cloud, speed: 1.5 + Math.random() * 2.5 });
      }
    }

    // 2. 空を漂うカラフルな熱気球（5機）
    const balloonColors = [0xff3366, 0x00d4ff, 0xffbb00, 0x33ee88, 0xb84dff];
    for (let i = 0; i < 5; i++) {
      const bGroup = new THREE.Group();
      const env = new THREE.Mesh(
        new THREE.SphereGeometry(8.5, 16, 14),
        new THREE.MeshStandardMaterial({
          color: balloonColors[i],
          roughness: 0.55,
          emissive: this.theme === 'neon' ? balloonColors[i] : 0x000000,
          emissiveIntensity: this.theme === 'neon' ? 0.35 : 0
        })
      );
      env.scale.set(1, 1.25, 1);
      bGroup.add(env);

      const stripe = new THREE.Mesh(
        new THREE.TorusGeometry(8.3, 0.65, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
      );
      stripe.rotation.x = Math.PI / 2;
      bGroup.add(stripe);

      const basket = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 2.2, 2.6),
        new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 })
      );
      basket.position.y = -13.5;
      bGroup.add(basket);

      const angle = (i / 5) * Math.PI * 2 + 0.5;
      const dist = 160 + (i % 2) * 80;
      const baseY = 58 + i * 9;
      bGroup.position.set(Math.cos(angle) * dist, baseY, Math.sin(angle) * dist);
      this.worldGroup.add(bGroup);
      this.balloons.push({ mesh: bGroup, baseY, phase: i * 1.4 });
    }

    // 3. 回転する巨大観覧車（コース中央エリアのランドマーク）
    const ferrisPos = new THREE.Vector3(25, -4, -35);
    const ferris = new THREE.Group();
    ferris.position.copy(ferrisPos);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.25 });

    // A字フレーム支柱
    [-6, 6].forEach((zOff) => {
      const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 36, 8), metalMat);
      legL.position.set(-7, 17, zOff * 0.3);
      legL.rotation.z = -0.25;
      ferris.add(legL);

      const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 36, 8), metalMat);
      legR.position.set(7, 17, zOff * 0.3);
      legR.rotation.z = 0.25;
      ferris.add(legR);
    });

    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(0, 32, 0);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(20, 0.55, 10, 32),
      new THREE.MeshStandardMaterial({
        color: this.theme === 'neon' ? 0x00f0ff : 0xff2266,
        emissive: this.theme === 'neon' ? 0x00f0ff : 0x550022,
        emissiveIntensity: this.theme === 'neon' ? 0.9 : 0.25
      })
    );
    wheelGroup.add(rim);

    // スポーク＆ゴンドラ
    const gondolaCols = [0xff3366, 0x00e5ff, 0xffcc00, 0x33ff88];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.28, 40, 0.28), metalMat);
      spoke.rotation.z = a;
      wheelGroup.add(spoke);

      const gondola = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 2.2, 2.2),
        new THREE.MeshStandardMaterial({
          color: gondolaCols[i % gondolaCols.length],
          emissive: this.theme === 'neon' ? gondolaCols[i % gondolaCols.length] : 0x000000,
          emissiveIntensity: this.theme === 'neon' ? 0.5 : 0
        })
      );
      gondola.position.set(Math.cos(a) * 20, Math.sin(a) * 20, 0);
      wheelGroup.add(gondola);
    }
    ferris.add(wheelGroup);
    this.worldGroup.add(ferris);
    this.animatedProps.push({ type: 'spinZ', mesh: wheelGroup, speed: 0.25 });

    // 4. 回転する風車（2基）
    const windmillCoords = [
      new THREE.Vector3(-90, 0, -60),
      new THREE.Vector3(145, 0, 25)
    ];
    windmillCoords.forEach((coord, idx) => {
      const ty = this.getTerrainHeight(coord.x, coord.z);
      const wm = new THREE.Group();
      wm.position.set(coord.x, ty - 1, coord.z);
      wm.rotation.y = idx * 1.6 + 0.4;

      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 2.8, 22, 10),
        new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.8 })
      );
      tower.position.y = 11;
      tower.castShadow = true;
      wm.add(tower);

      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 3.2, 10),
        new THREE.MeshStandardMaterial({ color: 0xd63638, roughness: 0.6 })
      );
      cap.position.y = 23.4;
      wm.add(cap);

      const blades = new THREE.Group();
      blades.position.set(0, 20.5, 1.8);
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0xfff8eb, roughness: 0.5 });
      for (let b = 0; b < 4; b++) {
        const bHolder = new THREE.Group();
        bHolder.rotation.z = (b * Math.PI) / 2;
        const blade = new THREE.Mesh(new THREE.BoxGeometry(1.2, 10.5, 0.16), bladeMat);
        blade.position.y = 5.4;
        blade.castShadow = true;
        bHolder.add(blade);
        blades.add(bHolder);
      }
      wm.add(blades);
      this.worldGroup.add(wm);
      this.animatedProps.push({ type: 'spinZ', mesh: blades, speed: 0.9 + idx * 0.25 });
    });
  }

  // 木々・岩・街灯を地形にきちんと接地させて配置
  spawnEnvironmentProps() {
    const numProps = 150;
    const up = new THREE.Vector3(0, 1, 0);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
    const pineMat1 = new THREE.MeshStandardMaterial({
      color: this.theme === 'sunset' ? 0x5c6b2e : (this.theme === 'neon' ? 0x0c4a55 : 0x1b7a3d),
      roughness: 0.85
    });
    const pineMat2 = new THREE.MeshStandardMaterial({
      color: this.theme === 'sunset' ? 0x7c8032 : (this.theme === 'neon' ? 0x156e7a : 0x2ca04c),
      roughness: 0.85
    });
    const oakMat = new THREE.MeshStandardMaterial({
      color: this.theme === 'sunset' ? 0xd97228 : (this.theme === 'neon' ? 0x243b85 : 0x3eb449),
      roughness: 0.8
    });
    const rockMat = new THREE.MeshStandardMaterial({
      color: this.theme === 'sunset' ? 0x9c553b : 0x7a808a,
      roughness: 0.95,
      flatShading: true
    });

    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 2.8, 7);
    const coneLowerGeo = new THREE.ConeGeometry(2.0, 3.6, 7);
    const coneUpperGeo = new THREE.ConeGeometry(1.4, 3.0, 7);
    const oakCrownGeo = new THREE.DodecahedronGeometry(2.1, 0);
    const rockGeo = new THREE.DodecahedronGeometry(1.6, 0);

    for (let i = 0; i < numProps; i++) {
      const u = (i / numProps + 0.02) % 1.0;
      const point = this.trackCurve.getPointAt(u);
      // 高架区間付近やスタートスタンド付近はスキップ
      if (point.y > 6.0) continue;
      if (u < 0.05 || u > 0.94) continue;

      const tangent = this.trackCurve.getTangentAt(u).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const side = i % 2 === 0 ? -1 : 1;
      // ガードレールの外側にしっかり配置して走行を不自然に塞がない
      const dist = this.trackWidth / 2 + this.offroadMargin + 2.8 + Math.random() * 24;
      const pos = point.clone().addScaledVector(normal, side * dist);

      // 他のコース部分に近すぎないかチェック
      const prog = this.getTrackProgress(pos);
      if (prog.distanceToCenter < this.trackWidth / 2 + this.offroadMargin + 1.8) continue;

      const groundY = this.getTerrainHeight(pos.x, pos.z, prog.distanceToCenter, prog.point.y);
      if (groundY < -6.8) continue; // 水没防止

      const scale = 0.85 + Math.random() * 0.75;
      const kind = i % 5;

      if (kind === 0) {
        // 岩
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set(pos.x, groundY + 0.6 * scale, pos.z);
        rock.scale.set(scale * 1.2, scale * 0.85, scale);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.castShadow = true;
        rock.receiveShadow = true;
        this.worldGroup.add(rock);
        this.trees.push({ mesh: rock, boundingRadius: 1.4 * scale });
      } else if (kind === 1 || kind === 2) {
        // 2段針葉樹
        const tree = new THREE.Group();
        tree.position.set(pos.x, groundY, pos.z);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.4;
        trunk.castShadow = true;
        tree.add(trunk);

        const c1 = new THREE.Mesh(coneLowerGeo, pineMat1);
        c1.position.y = 3.6;
        c1.castShadow = true;
        tree.add(c1);

        const c2 = new THREE.Mesh(coneUpperGeo, pineMat2);
        c2.position.y = 5.4;
        c2.castShadow = true;
        tree.add(c2);

        tree.scale.setScalar(scale);
        this.worldGroup.add(tree);
        this.trees.push({ mesh: tree, boundingRadius: 1.1 * scale });
      } else {
        // 広葉樹（丸冠木）
        const tree = new THREE.Group();
        tree.position.set(pos.x, groundY, pos.z);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.4;
        trunk.castShadow = true;
        tree.add(trunk);

        const crown = new THREE.Mesh(oakCrownGeo, oakMat);
        crown.position.y = 4.0;
        crown.scale.set(1.1, 0.95, 1.1);
        crown.castShadow = true;
        tree.add(crown);

        tree.scale.setScalar(scale);
        this.worldGroup.add(tree);
        this.trees.push({ mesh: tree, boundingRadius: 1.1 * scale });
      }
    }
  }

  // ジャンプ台（ランプ）の配置
  spawnRamps() {
    const rampTex = TextureFactory.createRampTexture();
    const rampMat = new THREE.MeshStandardMaterial({
      map: rampTex,
      roughness: 0.4,
      metalness: 0.25,
      emissive: 0x331800,
      emissiveIntensity: 0.25
    });
    const sideMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.5 });

    // クサビ型ジオメトリを手作り
    const w = 4.8;
    const l = 7.2;
    const h = 1.65;
    const up = new THREE.Vector3(0, 1, 0);

    this.preset.ramps.forEach((cfg) => {
      const p = this.trackCurve.getPointAt(cfg.u);
      const t = this.trackCurve.getTangentAt(cfg.u).normalize();
      const n = new THREE.Vector3().crossVectors(t, up).normalize();
      const pos = p.clone().addScaledVector(n, cfg.offset);

      const rampGroup = new THREE.Group();
      rampGroup.position.set(pos.x, pos.y, pos.z);
      rampGroup.lookAt(pos.clone().add(t).setY(pos.y));

      // 傾斜板
      const slopeLen = Math.hypot(l, h);
      const slopeAngle = Math.atan2(h, l);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, slopeLen), rampMat);
      deck.position.set(0, h * 0.5, 0);
      deck.rotation.x = -slopeAngle;
      deck.castShadow = true;
      deck.receiveShadow = true;
      rampGroup.add(deck);

      // 背面サポート
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.35), sideMat);
      back.position.set(0, h / 2, l / 2 - 0.2);
      back.castShadow = true;
      rampGroup.add(back);

      this.worldGroup.add(rampGroup);
      this.ramps.push({
        position: pos,
        u: cfg.u,
        radius: 3.3
      });
    });
  }

  // コイン配置（カーブのインラインや直線に沿って気持ちよく連続回収できるように配置）
  spawnCoins() {
    const numGroups = 16;
    const coinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.14, 18);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.85,
      roughness: 0.15,
      emissive: 0xffaa00,
      emissiveIntensity: 0.35
    });
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < numGroups; i++) {
      const baseU = (i / numGroups + 0.07) % 1.0;
      const laneOffset = ((i % 3) - 1) * 2.8;

      // 縦に3枚並べて連続チャリン♪の気持ちよさを演出
      for (let k = 0; k < 3; k++) {
        const u = (baseU + k * 0.008) % 1.0;
        const point = this.trackCurve.getPointAt(u);
        const tangent = this.trackCurve.getTangentAt(u).normalize();
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
        const coinPos = point.clone().addScaledVector(normal, laneOffset);
        coinPos.y += 0.9;

        const coinMesh = new THREE.Mesh(coinGeo, coinMat);
        coinMesh.position.copy(coinPos);
        coinMesh.rotation.x = Math.PI / 2;
        coinMesh.castShadow = true;
        this.worldGroup.add(coinMesh);

        this.coins.push({
          mesh: coinMesh,
          active: true,
          respawnTimer: 0,
          originalY: coinPos.y,
          radius: 0.75
        });
      }
    }
  }

  // アイテムボックス配置（虹色に輝くクリスタル風ボックス）
  spawnItemBoxes() {
    const numGroups = 6;
    const boxGeo = new THREE.BoxGeometry(1.55, 1.55, 1.55);
    const innerGeo = new THREE.OctahedronGeometry(0.55, 0);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < numGroups; i++) {
      const u = (i / numGroups + 0.11) % 1.0;
      const point = this.trackCurve.getPointAt(u);
      const tangent = this.trackCurve.getTangentAt(u).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const offsets = [-3.8, 0, 3.8];
      offsets.forEach((offset, oi) => {
        const boxPos = point.clone().addScaledVector(normal, offset);
        boxPos.y += 1.2;

        const boxMat = new THREE.MeshStandardMaterial({
          color: 0x00f0ff,
          roughness: 0.08,
          metalness: 0.25,
          transparent: true,
          opacity: 0.72,
          emissive: 0x00f0ff,
          emissiveIntensity: 0.65
        });

        const boxGroup = new THREE.Group();
        boxGroup.position.copy(boxPos);

        const outerBox = new THREE.Mesh(boxGeo, boxMat);
        boxGroup.add(outerBox);

        const inner = new THREE.Mesh(innerGeo, innerMat);
        boxGroup.add(inner);

        this.worldGroup.add(boxGroup);

        this.itemBoxes.push({
          mesh: boxGroup,
          material: boxMat,
          active: true,
          respawnTimer: 0,
          originalY: boxPos.y,
          phase: i * 1.1 + oi * 0.7,
          radius: 1.15
        });
      });
    }
  }

  // 毎フレームのワールドアニメーション
  update(dt, time) {
    // コインの回転・浮遊
    for (let i = 0; i < this.coins.length; i++) {
      const coin = this.coins[i];
      if (coin.active) {
        coin.mesh.rotation.z += 2.6 * dt;
        coin.mesh.position.y = coin.originalY + Math.sin(time * 3.5 + i) * 0.16;
      } else {
        coin.respawnTimer -= dt;
        if (coin.respawnTimer <= 0) {
          coin.active = true;
          coin.mesh.visible = true;
          coin.mesh.position.y = coin.originalY;
        }
      }
    }

    // アイテムボックスの回転・虹色変化
    for (let i = 0; i < this.itemBoxes.length; i++) {
      const box = this.itemBoxes[i];
      if (box.active) {
        box.mesh.rotation.y += 1.8 * dt;
        box.mesh.rotation.x += 0.7 * dt;
        box.mesh.position.y = box.originalY + Math.sin(time * 2.5 + box.phase) * 0.22;
        const hue = (time * 0.35 + box.phase * 0.2) % 1.0;
        box.material.color.setHSL(hue, 0.95, 0.58);
        box.material.emissive.setHSL(hue, 0.95, 0.45);
      } else {
        box.respawnTimer -= dt;
        if (box.respawnTimer <= 0) {
          box.active = true;
          box.mesh.visible = true;
          box.mesh.position.y = box.originalY;
        }
      }
    }

    // 観覧車・風車の回転
    for (let i = 0; i < this.animatedProps.length; i++) {
      const prop = this.animatedProps[i];
      if (prop.type === 'spinZ') {
        prop.mesh.rotation.z += prop.speed * dt;
      }
    }

    // 熱気球の上下ゆらぎ
    for (let i = 0; i < this.balloons.length; i++) {
      const b = this.balloons[i];
      b.mesh.position.y = b.baseY + Math.sin(time * 0.7 + b.phase) * 3.5;
      b.mesh.rotation.y += 0.12 * dt;
    }

    // 雲のゆっくり移動
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.mesh.position.x += c.speed * dt;
      if (c.mesh.position.x > 520) c.mesh.position.x = -520;
    }

    // フラッグのはためき
    for (let i = 0; i < this.flags.length; i++) {
      const f = this.flags[i];
      f.mesh.rotation.y = Math.sin(time * 5.2 + f.phase) * 0.22;
    }

    // 水面の微細な揺れ
    if (this.waterMesh) {
      this.waterMesh.position.y = -7.2 + Math.sin(time * 1.1) * 0.14;
    }
  }

  // カートの位置からコース曲線への最短距離・進行度u・接線・路面情報を返す
  getTrackProgress(cartPos) {
    let minDistanceSq = Infinity;
    let closestIndex = 0;

    // XZ平面重視で近傍サンプリング（ジャンプ中の高さで別セグメントに誤判定されないように）
    for (let i = 0; i < this.numSamples; i++) {
      const p = this.cachedPoints[i];
      const dx = cartPos.x - p.x;
      const dz = cartPos.z - p.z;
      const dy = (cartPos.y - p.y) * 0.25;
      const distSq = dx * dx + dz * dz + dy * dy;
      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        closestIndex = i;
      }
    }

    const step = 1 / this.numSamples;
    let bestU = closestIndex * step;
    let minXZDistSq = Infinity;
    let bestPoint = this.cachedPoints[closestIndex];

    const searchRange = 2;
    const divisions = 8;
    for (let i = -searchRange; i <= searchRange; i++) {
      const baseIndex = (closestIndex + i + this.numSamples) % this.numSamples;
      const baseU = baseIndex * step;
      for (let j = 0; j < divisions; j++) {
        const testU = (baseU + (j / divisions) * step) % 1.0;
        const testPoint = this.trackCurve.getPointAt(testU);
        const dx = cartPos.x - testPoint.x;
        const dz = cartPos.z - testPoint.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < minXZDistSq) {
          minXZDistSq = distSq;
          bestU = testU;
          bestPoint = testPoint;
        }
      }
    }

    const horizontalDist = Math.sqrt(minXZDistSq);
    const tangent = this.trackCurve.getTangentAt(bestU).normalize();
    const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
    const toCart = new THREE.Vector3(cartPos.x - bestPoint.x, 0, cartPos.z - bestPoint.z);
    const lateralOffset = toCart.dot(normal);

    const isBridge = bestPoint.y > 4.0;
    const wallLimit = isBridge
      ? this.trackWidth / 2 + this.curbWidth - 0.4
      : this.trackWidth / 2 + this.offroadMargin - 0.6;

    return {
      u: bestU,
      distanceToCenter: horizontalDist,
      lateralOffset,
      onGrass: horizontalDist > (this.trackWidth / 2 + this.curbWidth * 0.5),
      wallLimit,
      isBridge,
      point: bestPoint,
      tangent,
      normal
    };
  }

  // コース切替時の安全な解放
  dispose() {
    this.scene.remove(this.worldGroup);
    this.worldGroup.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}
