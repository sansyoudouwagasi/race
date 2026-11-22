import * as THREE from 'three';

// 共有ジオメトリを安全に使う高速・軽量パーティクルシステム
export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.maxParticles = 320;

    // 共通ジオメトリ（絶対に個別破棄しない！）
    this.boxGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    this.sparkGeo = new THREE.OctahedronGeometry(0.14, 0);

    // 色ごとのベースカラーマップ
    this.colorHex = {
      white: 0xffffff,
      blue: 0x00f0ff,
      orange: 0xff8800,
      yellow: 0xffd700,
      pink: 0xff2a9d,
      purple: 0xd040ff,
      green: 0x00ff88,
      grass: 0x62b84f,
      dust: 0xd8c3a5
    };
  }

  spawn(position, velocity, colorName, life, size = 1.0, shape = 'box', gravityScale = 0.4) {
    // パーティクル上限を超えたら最も古いものを再利用・削除
    if (this.particles.length >= this.maxParticles) {
      const oldest = this.particles.shift();
      this.scene.remove(oldest.mesh);
      oldest.mesh.material.dispose();
    }

    const hex = this.colorHex[colorName] ?? 0xffffff;
    const mat = new THREE.MeshBasicMaterial({
      color: hex,
      transparent: true,
      opacity: 1.0
    });
    const geo = shape === 'spark' ? this.sparkGeo : this.boxGeo;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.scale.setScalar(size);
    mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);

    this.scene.add(mesh);

    this.particles.push({
      mesh,
      velocity: velocity.clone(),
      life,
      maxLife: life,
      initialSize: size,
      gravityScale,
      spin: (Math.random() - 0.5) * 10
    });
  }

  // ドリフト時のタイヤ火花（3段階チャージ色対応：白→青→橙→紫/虹）
  spawnDriftSparks(pos, carDir, driftCharge) {
    let color = 'white';
    let size = 0.85;
    let count = 1;

    if (driftCharge === 1) {
      color = 'blue';
      size = 1.25;
      count = 2;
    } else if (driftCharge === 2) {
      color = 'orange';
      size = 1.55;
      count = 2;
    } else if (driftCharge >= 3) {
      color = Math.random() < 0.55 ? 'purple' : 'pink';
      size = 1.85;
      count = 3;
    }

    for (let i = 0; i < count; i++) {
      const spreadDir = carDir + Math.PI + (Math.random() - 0.5) * 0.9;
      const spd = 4.5 + Math.random() * 5.0;
      const vel = new THREE.Vector3(
        Math.sin(spreadDir) * spd,
        2.2 + Math.random() * 3.5,
        Math.cos(spreadDir) * spd
      );
      const offsetPos = pos.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        0.15,
        (Math.random() - 0.5) * 0.4
      ));
      this.spawn(offsetPos, vel, color, 0.28 + Math.random() * 0.2, size, 'spark', 0.65);
    }
  }

  // ブースト炎
  spawnBoostFire(pos, carDir, isStar = false) {
    const numFire = 2;
    for (let i = 0; i < numFire; i++) {
      const angle = carDir + Math.PI + (Math.random() - 0.5) * 0.28;
      const spd = 16.0 + Math.random() * 9.0;
      const vel = new THREE.Vector3(
        Math.sin(angle) * spd,
        0.4 + (Math.random() - 0.5) * 1.8,
        Math.cos(angle) * spd
      );
      let color = Math.random() < 0.6 ? 'blue' : 'orange';
      if (isStar) {
        const rainbow = ['yellow', 'pink', 'blue', 'green', 'purple'];
        color = rainbow[Math.floor(Math.random() * rainbow.length)];
      }
      const offsetPos = pos.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.35,
        0.22,
        (Math.random() - 0.5) * 0.35
      ));
      this.spawn(offsetPos, vel, color, 0.3 + Math.random() * 0.18, 1.45 + Math.random() * 0.8, 'spark', 0.1);
    }
  }

  // 芝生／オフロードの土煙・草片
  spawnOffroadDust(pos, carDir, theme = 'sunshine') {
    const angle = carDir + Math.PI + (Math.random() - 0.5) * 0.7;
    const vel = new THREE.Vector3(
      Math.sin(angle) * (3 + Math.random() * 3),
      1.8 + Math.random() * 2.2,
      Math.cos(angle) * (3 + Math.random() * 3)
    );
    const color = theme === 'sunset' ? 'dust' : (theme === 'neon' ? 'blue' : 'grass');
    this.spawn(pos.clone().add(new THREE.Vector3(0, 0.15, 0)), vel, color, 0.4 + Math.random() * 0.2, 1.1, 'box', 0.55);
  }

  // ジャンプトリック成功のスターバースト
  spawnTrickBurst(pos) {
    const cols = ['yellow', 'blue', 'pink', 'white'];
    for (let i = 0; i < 18; i++) {
      const theta = (i / 18) * Math.PI * 2;
      const vel = new THREE.Vector3(
        Math.cos(theta) * (6 + Math.random() * 4),
        4.5 + Math.random() * 4,
        Math.sin(theta) * (6 + Math.random() * 4)
      );
      this.spawn(pos.clone().add(new THREE.Vector3(0, 0.9, 0)), vel, cols[i % cols.length], 0.55, 1.6, 'spark', 0.45);
    }
  }

  // スリップストリームの風エフェクト
  spawnSlipstreamWind(pos, carDir) {
    const right = new THREE.Vector3(Math.cos(carDir), 0, -Math.sin(carDir));
    const side = (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.6);
    const spawnPos = pos.clone()
      .addScaledVector(right, side)
      .add(new THREE.Vector3(0, 0.5 + Math.random() * 0.8, 0));
    const vel = new THREE.Vector3(-Math.sin(carDir) * 14, 0.2, -Math.cos(carDir) * 14);
    this.spawn(spawnPos, vel, 'white', 0.22, 0.75, 'box', 0.0);
  }

  // コイン獲得バースト
  spawnCoinPickup(pos) {
    for (let i = 0; i < 14; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 5.0 + Math.random() * 5.5;
      const vel = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.abs(Math.cos(phi)) * speed + 3.0,
        Math.sin(phi) * Math.sin(theta) * speed
      );
      this.spawn(pos, vel, 'yellow', 0.55 + Math.random() * 0.25, 1.3, 'spark', 0.5);
    }
  }

  // アイテムボックス破壊ポップ
  spawnBoxPop(pos) {
    const colors = ['blue', 'pink', 'yellow', 'white'];
    for (let i = 0; i < 18; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 4.5 + Math.random() * 5.5;
      const vel = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed + 2.0,
        Math.sin(phi) * Math.sin(theta) * speed
      );
      this.spawn(pos, vel, colors[i % colors.length], 0.45 + Math.random() * 0.25, 1.35, 'spark', 0.35);
    }
  }

  // 被弾・衝突火花
  spawnSpinSparks(pos) {
    const colors = ['pink', 'orange', 'yellow'];
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5.0 + Math.random() * 5.5;
      const vel = new THREE.Vector3(
        Math.sin(angle) * speed,
        3.5 + Math.random() * 4.5,
        Math.cos(angle) * speed
      );
      this.spawn(pos.clone().add(new THREE.Vector3(0, 0.5, 0)), vel, colors[i % colors.length], 0.5 + Math.random() * 0.25, 1.35, 'spark', 0.6);
    }
  }

  // ゴール紙吹雪
  spawnConfetti(pos) {
    const colors = ['yellow', 'pink', 'blue', 'green', 'orange', 'white'];
    for (let i = 0; i < 6; i++) {
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 14,
        8 + Math.random() * 8,
        (Math.random() - 0.5) * 14
      );
      this.spawn(pos.clone().add(new THREE.Vector3(0, 2.2, 0)), vel, colors[Math.floor(Math.random() * colors.length)], 1.4, 1.4, 'box', 0.35);
    }
  }

  update(dt) {
    const gravity = -12.0;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        // ジオメトリは共有しているため破棄せず、マテリアルのみ解放する
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      } else {
        p.velocity.y += gravity * p.gravityScale * dt;
        p.mesh.position.addScaledVector(p.velocity, dt);
        p.mesh.rotation.x += p.spin * dt;
        p.mesh.rotation.y += p.spin * dt;

        const lifeRatio = Math.max(0, p.life / p.maxLife);
        p.mesh.scale.setScalar(Math.max(0.01, p.initialSize * lifeRatio));
        p.mesh.material.opacity = lifeRatio;
      }
    }
  }

  clear() {
    this.particles.forEach(p => {
      this.scene.remove(p.mesh);
      p.mesh.material.dispose();
    });
    this.particles = [];
  }
}
