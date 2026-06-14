import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    
    // パーティクルのマテリアルプール（最適化のため色ごとに作成）
    this.materials = {
      white: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }),
      blue: new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true }),
      orange: new THREE.MeshBasicMaterial({ color: 0xff7700, transparent: true }),
      yellow: new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true }),
      pink: new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true }),
      green: new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true })
    };
    
    // 共通ジオメトリ
    this.geometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  }
  
  // 汎用パーティクル生成
  spawn(position, velocity, colorName, life, size = 1.0) {
    const mat = this.materials[colorName] || this.materials.white;
    const mesh = new THREE.Mesh(this.geometry, mat.clone());
    mesh.position.copy(position);
    mesh.scale.multiplyScalar(size);
    
    this.scene.add(mesh);
    
    this.particles.push({
      mesh: mesh,
      velocity: velocity.clone(),
      life: life,
      maxLife: life,
      color: colorName,
      initialSize: size
    });
  }
  
  // ドリフト時のタイヤ火花エフェクト
  spawnDriftSparks(pos, carDir, driftCharge) {
    // ドリフトチャージに応じて色を決定
    let color = 'white';
    let size = 1.0;
    if (driftCharge === 1) {
      color = 'blue';
      size = 1.3;
    } else if (driftCharge === 2) {
      color = 'orange';
      size = 1.6;
    }
    
    // 車体の後ろ斜め方向に散らす
    const numSparks = 2;
    for (let i = 0; i < numSparks; i++) {
      const spreadDir = carDir + Math.PI + (Math.random() - 0.5) * 0.8;
      const vel = new THREE.Vector3(
        Math.sin(spreadDir) * (4.0 + Math.random() * 4.0),
        2.0 + Math.random() * 3.0,
        Math.cos(spreadDir) * (4.0 + Math.random() * 4.0)
      );
      
      const offsetPos = pos.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        0.1,
        (Math.random() - 0.5) * 0.5
      ));
      
      this.spawn(offsetPos, vel, color, 0.35 + Math.random() * 0.25, size);
    }
  }
  
  // ブースト時のマフラーの炎
  spawnBoostFire(pos, carDir) {
    // マフラーの後ろに吹き出させる
    const numFire = 3;
    for (let i = 0; i < numFire; i++) {
      const angle = carDir + Math.PI + (Math.random() - 0.5) * 0.25;
      const vel = new THREE.Vector3(
        Math.sin(angle) * (18.0 + Math.random() * 8.0),
        0.5 + (Math.random() - 0.5) * 2.0,
        Math.cos(angle) * (18.0 + Math.random() * 8.0)
      );
      
      // 青とオレンジをブレンド
      const color = Math.random() < 0.65 ? 'blue' : 'orange';
      const offsetPos = pos.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        0.2,
        (Math.random() - 0.5) * 0.3
      ));
      
      this.spawn(offsetPos, vel, color, 0.4 + Math.random() * 0.2, 1.5 + Math.random() * 1.0);
    }
  }
  
  // コイン獲得時のスターバースト
  spawnCoinPickup(pos) {
    const numParticles = 15;
    for (let i = 0; i < numParticles; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 5.0 + Math.random() * 6.0;
      
      const vel = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed + 3.0, // 少し上に跳ね上げる
        Math.sin(phi) * Math.sin(theta) * speed
      );
      
      this.spawn(pos, vel, 'yellow', 0.6 + Math.random() * 0.3, 1.2 + Math.random() * 0.8);
    }
  }
  
  // アイテムボックス獲得時のポップ
  spawnBoxPop(pos) {
    const numParticles = 20;
    const colors = ['blue', 'pink', 'white'];
    
    for (let i = 0; i < numParticles; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 4.0 + Math.random() * 5.0;
      
      const vel = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed + 1.0,
        Math.sin(phi) * Math.sin(theta) * speed
      );
      
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.spawn(pos, vel, color, 0.5 + Math.random() * 0.3, 1.0 + Math.random() * 0.6);
    }
  }
  
  // カートが設置罠に当たったスピン時の火花
  spawnSpinSparks(pos) {
    const numParticles = 12;
    for (let i = 0; i < numParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4.0 + Math.random() * 4.0;
      const vel = new THREE.Vector3(
        Math.sin(angle) * speed,
        3.0 + Math.random() * 4.0,
        Math.cos(angle) * speed
      );
      
      this.spawn(pos, vel, 'pink', 0.5 + Math.random() * 0.3, 1.0 + Math.random() * 0.5);
    }
  }
  
  // 毎フレームの更新（移動、フェードアウト、削除）
  update(dt) {
    const gravity = new THREE.Vector3(0, -9.8, 0);
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      
      if (p.life <= 0) {
        // シーンから削除
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        if (p.mesh.material.dispose) p.mesh.material.dispose();
        
        this.particles.splice(i, 1);
      } else {
        // 重力を受けて落下（少しだけ）
        p.velocity.addScaledVector(gravity, dt * 0.4);
        // 位置の更新
        p.mesh.position.addScaledVector(p.velocity, dt);
        
        // 徐々にフェードアウト、小さくする
        const lifeRatio = p.life / p.maxLife;
        p.mesh.scale.setScalar(p.initialSize * lifeRatio);
        p.mesh.material.opacity = lifeRatio;
      }
    }
  }
  
  // クリーンアップ
  clear() {
    this.particles.forEach(p => {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      if (p.mesh.material.dispose) p.mesh.material.dispose();
    });
    this.particles = [];
  }
}
