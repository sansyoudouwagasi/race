import * as THREE from 'three';

export class GameWorld {
  constructor(scene) {
    this.scene = scene;
    
    // コース幅と境界設定
    this.trackWidth = 12;
    this.curbWidth = 1.0;
    
    // コースパスの頂点定義 (X, Y, Z) - アップダウンのあるループコース
    this.pathPoints = [
      new THREE.Vector3(0, 0, 0),          // スタート地点
      new THREE.Vector3(80, 0, 30),
      new THREE.Vector3(160, 5, 80),
      new THREE.Vector3(220, 15, 60),
      new THREE.Vector3(260, 10, -20),
      new THREE.Vector3(200, 2, -100),
      new THREE.Vector3(120, 0, -60),
      new THREE.Vector3(60, -3, -130),
      new THREE.Vector3(-40, 2, -180),
      new THREE.Vector3(-140, 8, -140),
      new THREE.Vector3(-200, 12, -60),
      new THREE.Vector3(-220, 5, 40),
      new THREE.Vector3(-160, 0, 100),
      new THREE.Vector3(-80, 0, 50),
    ];
    
    // スプライン曲線の生成
    this.trackCurve = new THREE.CatmullRomCurve3(this.pathPoints, true);
    
    // コース外周の草地、アイテムボックス、コイン、木々の管理配列
    this.coins = [];
    this.itemBoxes = [];
    this.trees = [];
    
    // コース上のチェックポイント（周回管理用）
    this.checkpoints = [0.25, 0.5, 0.75, 0.98]; // パス進行度u (0〜1)
    
    // 草地判定用の高速サンプリング点 (200分割)
    this.numSamples = 300;
    this.cachedPoints = this.trackCurve.getSpacedPoints(this.numSamples);
    
    this.init();
  }
  
  init() {
    this.createSkybox();
    this.createGround();
    this.createTrack();
    this.createStartGate();
    this.spawnTrees();
    this.spawnCoins();
    this.spawnItemBoxes();
  }
  
  // 晴れ渡った青空と白い雲を CanvasTexture で動的に生成
  createSkybox() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // 背景の青空グラデーション (上は澄み切った青、下は地平線の明るい水色)
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#1d6ef2'); // 上空の鮮やかな青
    grad.addColorStop(0.55, '#5ca4f5'); // 中間の明るい青
    grad.addColorStop(0.85, '#99ccff'); // 下方の薄い水色
    grad.addColorStop(1.0, '#e6f3ff'); // 地平線の白っぽい空色
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 雲を描くヘルパー関数 (もこもこした重なりとぼかし効果)
    function drawCloud(cx, cy, scale) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      
      // 雲のふんわり感を出すためのぼかしと半透明白
      ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
      ctx.shadowBlur = 20;
      
      ctx.beginPath();
      ctx.arc(0, 0, 35, 0, Math.PI * 2);
      ctx.arc(-30, 5, 25, 0, Math.PI * 2);
      ctx.arc(30, 5, 25, 0, Math.PI * 2);
      ctx.arc(-55, 12, 18, 0, Math.PI * 2);
      ctx.arc(55, 12, 18, 0, Math.PI * 2);
      ctx.arc(-80, 18, 12, 0, Math.PI * 2);
      ctx.arc(80, 18, 12, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    }
    
    // 空全体にバランスよく雲を配置
    // テクスチャのY方向中央よりやや上（地平線〜上空の間）に描画
    const cloudPositions = [
      { x: 120, y: 160, s: 1.1 },
      { x: 320, y: 210, s: 0.75 },
      { x: 520, y: 150, s: 1.4 },
      { x: 740, y: 180, s: 0.95 },
      { x: 910, y: 140, s: 1.2 },
      { x: 230, y: 130, s: 0.65 },
      { x: 640, y: 200, s: 0.85 },
      { x: 40, y: 220, s: 0.5 }
    ];
    
    cloudPositions.forEach(p => {
      drawCloud(p.x, p.y, p.s);
    });
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    
    const skyGeo = new THREE.SphereGeometry(1000, 32, 15);
    const skyMat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide
    });
    
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);
  }
  
  // コース以外の背景地面（明るい芝生）
  createGround() {
    const groundGeo = new THREE.PlaneGeometry(2000, 2000);
    // 明るい爽やかなグリーンの芝生地面
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x3d8c4c, // 鮮やかな緑
      roughness: 0.85,
      metalness: 0.05,
    });
    
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -5;
    ground.receiveShadow = true;
    this.scene.add(ground);
    
    // グリッドヘルパーを爽やかなトーンで追加
    const grid = new THREE.GridHelper(2000, 100, 0x8be5a3, 0x3d7a4a);
    grid.position.y = -4.9;
    grid.material.opacity = 0.22;
    grid.material.transparent = true;
    this.scene.add(grid);
  }
  
  // コースアスファルトと紅白縁石をチューブ・押し出し風にカスタム生成
  createTrack() {
    const segments = 400;
    const vertices = [];
    const colors = [];
    const indices = [];
    
    const curbLeftVertices = [];
    const curbRightVertices = [];
    
    // コースに沿ってメッシュの頂点を生成
    const points = this.trackCurve.getSpacedPoints(segments);
    
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const point = points[i % segments];
      const tangent = this.trackCurve.getTangentAt(u).normalize();
      
      // 法線（横方向のベクトル）を計算
      const up = new THREE.Vector3(0, 1, 0);
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
      
      // アスファルトの左右の端点
      const pLeft = point.clone().addScaledVector(normal, -this.trackWidth / 2);
      const pRight = point.clone().addScaledVector(normal, this.trackWidth / 2);
      
      // アスファルトの頂点
      vertices.push(pLeft.x, pLeft.y, pLeft.z);
      vertices.push(pRight.x, pRight.y, pRight.z);
      
      // アスファルトの色（サイバー調のダークグレー）
      colors.push(0.12, 0.12, 0.16);
      colors.push(0.12, 0.12, 0.16);
      
      // 縁石用の座標もついでに保存
      const pCurbLeftInner = pLeft.clone();
      const pCurbLeftOuter = pLeft.clone().addScaledVector(normal, -this.curbWidth);
      const pCurbRightInner = pRight.clone();
      const pCurbRightOuter = pRight.clone().addScaledVector(normal, this.curbWidth);
      
      curbLeftVertices.push(pCurbLeftInner, pCurbLeftOuter);
      curbRightVertices.push(pCurbRightInner, pCurbRightOuter);
      
      if (i < segments) {
        const curr = i * 2;
        const next = (i + 1) * 2;
        
        // 1つ目の三角形
        indices.push(curr, curr + 1, next);
        // 2つ目の三角形
        indices.push(curr + 1, next + 1, next);
      }
    }
    
    // アスファルトのジオメトリ作成
    const trackGeo = new THREE.BufferGeometry();
    trackGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    trackGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    trackGeo.setIndex(indices);
    trackGeo.computeVertexNormals();
    
    const trackMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.2,
    });
    
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.receiveShadow = true;
    this.scene.add(trackMesh);
    
    // 紅白の縁石（Curb）の生成
    this.createCurbs(curbLeftVertices, segments);
    this.createCurbs(curbRightVertices, segments);
  }
  
  createCurbs(curbVertices, segments) {
    const vertices = [];
    const colors = [];
    const indices = [];
    
    for (let i = 0; i <= segments; i++) {
      const pInner = curbVertices[i * 2];
      const pOuter = curbVertices[i * 2 + 1];
      
      vertices.push(pInner.x, pInner.y + 0.05, pInner.z); // 少し路面より高く
      vertices.push(pOuter.x, pOuter.y + 0.05, pOuter.z);
      
      // 紅白を一定間隔（例えば5セグメントごと）に切り替える
      const isRed = Math.floor(i / 3) % 2 === 0;
      const r = isRed ? 0.95 : 0.95;
      const g = isRed ? 0.05 : 0.95;
      const b = isRed ? 0.15 : 0.95;
      
      colors.push(r, g, b);
      colors.push(r, g, b);
      
      if (i < segments) {
        const curr = i * 2;
        const next = (i + 1) * 2;
        indices.push(curr, curr + 1, next);
        indices.push(curr + 1, next + 1, next);
      }
    }
    
    const curbGeo = new THREE.BufferGeometry();
    curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    curbGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    curbGeo.setIndex(indices);
    curbGeo.computeVertexNormals();
    
    const curbMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.7,
      metalness: 0.1
    });
    
    const curbMesh = new THREE.Mesh(curbGeo, curbMat);
    curbMesh.receiveShadow = true;
    this.scene.add(curbMesh);
  }
  
  // スタート・ゴールゲートの生成
  createStartGate() {
    const startPoint = this.trackCurve.getPointAt(0);
    const tangent = this.trackCurve.getTangentAt(0).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    
    const gateGroup = new THREE.Group();
    gateGroup.position.copy(startPoint);
    
    // 進行方向に向ける
    const lookTarget = startPoint.clone().add(tangent);
    gateGroup.lookAt(lookTarget);
    
    // 左右の柱 (Cylinder)
    const postGeo = new THREE.CylinderGeometry(0.4, 0.4, 8, 16);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x33333b, metalness: 0.8, roughness: 0.2 });
    
    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(-this.trackWidth / 2 - 1, 4, 0);
    leftPost.castShadow = true;
    leftPost.receiveShadow = true;
    gateGroup.add(leftPost);
    
    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(this.trackWidth / 2 + 1, 4, 0);
    rightPost.castShadow = true;
    rightPost.receiveShadow = true;
    gateGroup.add(rightPost);
    
    // 上部のアーチ梁 (Box)
    const archWidth = this.trackWidth + 3.2;
    const archGeo = new THREE.BoxGeometry(archWidth, 1.2, 1.2);
    const archMat = new THREE.MeshStandardMaterial({ color: 0xff0055, metalness: 0.6, roughness: 0.3 });
    const arch = new THREE.Mesh(archGeo, archMat);
    arch.position.set(0, 8, 0);
    arch.castShadow = true;
    gateGroup.add(arch);
    
    // START/FINISH サインボード (チェッカー柄の板)
    const boardGeo = new THREE.BoxGeometry(archWidth - 4, 0.8, 0.1);
    
    // チェッカーフラッグの簡易キャンバステクスチャを作成
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#ffffff';
    const sq = 16;
    for (let y = 0; y < 64; y += sq) {
      for (let x = 0; x < 256; x += sq) {
        if ((Math.floor(x / sq) + Math.floor(y / sq)) % 2 === 0) {
          ctx.fillRect(x, y, sq, sq);
        }
      }
    }
    // 文字の描画
    ctx.fillStyle = '#ff007f';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 4;
    ctx.font = 'bold 28px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText('START / FINISH', 128, 32);
    ctx.fillText('START / FINISH', 128, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    const boardMat = new THREE.MeshBasicMaterial({ map: texture });
    
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(0, 8, 0.65);
    gateGroup.add(board);
    
    this.scene.add(gateGroup);
  }
  
  // コース沿いに木を配置
  spawnTrees() {
    const numTrees = 120;
    
    // 木のモデルのパーツ（インスタンス・ジオメトリを共有して最適化）
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2.5, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    
    const foliageGeo = new THREE.ConeGeometry(1.2, 3.5, 8);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x008844, roughness: 0.8, metalness: 0.1 });
    
    for (let i = 0; i < numTrees; i++) {
      const u = i / numTrees;
      const point = this.trackCurve.getPointAt(u);
      const tangent = this.trackCurve.getTangentAt(u).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
      
      // コース外に左右ランダムに配置
      const side = Math.random() < 0.5 ? -1 : 1;
      const offset = (this.trackWidth / 2 + 3 + Math.random() * 8) * side;
      const treePos = point.clone().addScaledVector(normal, offset);
      treePos.y += 0.5; // 地形に少し埋める
      
      // 木のグループ
      const tree = new THREE.Group();
      tree.position.copy(treePos);
      
      // 幹
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.25;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      tree.add(trunk);
      
      // 葉
      const foliage = new THREE.Mesh(foliageGeo, foliageMat);
      foliage.position.y = 3.25;
      foliage.castShadow = true;
      tree.add(foliage);
      
      // 少しランダムにスケーリング
      const scale = 0.8 + Math.random() * 0.5;
      tree.scale.set(scale, scale, scale);
      
      this.scene.add(tree);
      this.trees.push({ mesh: tree, boundingRadius: 1.0 * scale });
    }
  }
  
  // コインのスポーン
  spawnCoins() {
    const numCoinGroups = 18;
    const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.12, 16);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.9,
      roughness: 0.1,
      emissive: 0xffaa00,
      emissiveIntensity: 0.2
    });
    
    for (let i = 0; i < numCoinGroups; i++) {
      // コースに沿って特定のu位置に3枚ずつ配置
      const u = (i / numCoinGroups) + 0.05;
      const point = this.trackCurve.getPointAt(u % 1.0);
      const tangent = this.trackCurve.getTangentAt(u % 1.0).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
      
      // コース内の横オフセット（左、中央、右など）
      const offsets = [-2, 0, 2];
      
      offsets.forEach(offset => {
        const coinPos = point.clone().addScaledVector(normal, offset);
        coinPos.y += 0.8; // 地面から浮かせる
        
        const coinMesh = new THREE.Mesh(coinGeo, coinMat);
        coinMesh.position.copy(coinPos);
        coinMesh.rotation.x = Math.PI / 2; // コインを立てる
        coinMesh.castShadow = true;
        
        this.scene.add(coinMesh);
        
        this.coins.push({
          mesh: coinMesh,
          active: true,
          respawnTimer: 0,
          originalY: coinPos.y,
          radius: 0.6
        });
      });
    }
  }
  
  // アイテムボックスのスポーン
  spawnItemBoxes() {
    const numGroups = 5;
    // 虹色半透明マテリアル
    const boxGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.6,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.5
    });
    
    // アイテムボックス用の中身「？」
    const questionGeo = new THREE.BoxGeometry(0.3, 0.7, 0.3);
    const questionMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    for (let i = 0; i < numGroups; i++) {
      const u = (i / numGroups) + 0.12; // スタートから少し離れた位置から
      const point = this.trackCurve.getPointAt(u % 1.0);
      const tangent = this.trackCurve.getTangentAt(u % 1.0).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
      
      // コースを横断するように3つ配置
      const offsets = [-3.5, 0, 3.5];
      
      offsets.forEach(offset => {
        const boxPos = point.clone().addScaledVector(normal, offset);
        boxPos.y += 1.0;
        
        const boxGroup = new THREE.Group();
        boxGroup.position.copy(boxPos);
        
        const outerBox = new THREE.Mesh(boxGeo, boxMat);
        boxGroup.add(outerBox);
        
        const innerQ = new THREE.Mesh(questionGeo, questionMat);
        boxGroup.add(innerQ);
        
        this.scene.add(boxGroup);
        
        this.itemBoxes.push({
          mesh: boxGroup,
          active: true,
          respawnTimer: 0,
          originalY: boxPos.y,
          radius: 1.0
        });
      });
    }
  }
  
  // 毎フレームのアニメーション（コイン・アイテムボックスの回転と浮遊）
  update(dt, time) {
    // コインの回転・浮遊
    this.coins.forEach(coin => {
      if (coin.active) {
        coin.mesh.rotation.z += 2.0 * dt; // 立ててあるのでZ軸で回転
        coin.mesh.position.y = coin.originalY + Math.sin(time * 3 + coin.mesh.position.x) * 0.15;
      } else {
        coin.respawnTimer -= dt;
        if (coin.respawnTimer <= 0) {
          coin.active = true;
          coin.mesh.visible = true;
          coin.mesh.position.y = coin.originalY;
        }
      }
    });
    
    // アイテムボックスの回転・浮遊
    this.itemBoxes.forEach(box => {
      if (box.active) {
        box.mesh.rotation.y += 1.5 * dt;
        box.mesh.rotation.x += 0.5 * dt;
        box.mesh.position.y = box.originalY + Math.sin(time * 2 + box.mesh.position.x) * 0.2;
      } else {
        box.respawnTimer -= dt;
        if (box.respawnTimer <= 0) {
          box.active = true;
          box.mesh.visible = true;
          box.mesh.position.y = box.originalY;
        }
      }
    });
  }
  
  // カートの位置からコース曲線への最短距離を計算してオンコースか草地かを判定
  // ついでに、コースパス上の一番近い点のパラメータ u (0〜1) も返す
  getTrackProgress(cartPos) {
    let minDistanceSq = Infinity;
    let closestIndex = 0;
    
    // 1. キャッシュした200点の中から最も近い点を探す
    for (let i = 0; i < this.numSamples; i++) {
      const p = this.cachedPoints[i];
      const distSq = cartPos.distanceToSquared(p);
      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        closestIndex = i;
      }
    }
    
    // 2. 最も近いインデックスの周辺で細かく探索し、より正確な最短距離とu位置を得る
    const step = 1 / this.numSamples;
    let bestU = closestIndex * step;
    let minDistance = Math.sqrt(minDistanceSq);
    
    // 周辺のパラメータ範囲で細分化して再探索 (ローカルサーチ)
    const searchRange = 2; // 周辺2ステップ
    const divisions = 10;
    for (let i = -searchRange; i <= searchRange; i++) {
      const baseIndex = (closestIndex + i + this.numSamples) % this.numSamples;
      const baseU = baseIndex * step;
      
      for (let j = 0; j < divisions; j++) {
        const testU = (baseU + (j / divisions) * step) % 1.0;
        const testPoint = this.trackCurve.getPointAt(testU);
        const dist = cartPos.distanceTo(testPoint);
        if (dist < minDistance) {
          minDistance = dist;
          bestU = testU;
        }
      }
    }
    
    // パス中心からの距離が、(コース幅/2) より大きい場合は草地
    const onGrass = minDistance > (this.trackWidth / 2);
    
    return {
      u: bestU,
      distanceToCenter: minDistance,
      onGrass: onGrass,
      point: this.trackCurve.getPointAt(bestU)
    };
  }
}
