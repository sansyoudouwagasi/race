import * as THREE from 'three';

export class CartPhysics {
  constructor(position, isPlayer = false, name = 'RACER', baseMaxSpeed = 35.0) {
    this.position = position.clone();
    this.velocity = new THREE.Vector3();
    this.speed = 0;
    this.direction = 0; // Y軸回転角（+Z前方、+で左旋回、-で右旋回）

    this.isPlayer = isPlayer;
    this.name = name;
    this.onGrass = false;
    this.coins = 0;
    this.lap = 0;
    this.progress = 0;
    this.totalProgress = 0;
    this.finished = false;
    this.finishTime = null;
    this.lapStartTime = 0;
    this.bestLapTime = Infinity;
    this.isWrongWay = false;

    // 物理パラメータ
    this.baseMaxSpeed = baseMaxSpeed;
    this.maxSpeed = baseMaxSpeed;
    this.maxSpeedGrass = 14.0;
    this.acceleration = 18.5;
    this.accelerationGrass = 6.5;
    this.friction = 0.986;
    this.frictionGrass = 0.92;
    this.steerSensitivity = 2.35;

    // ドリフト関連（3段階チャージ）
    this.isDrifting = false;
    this.driftDirection = 0; // +1: 左ドリフト, -1: 右ドリフト
    this.driftAngle = 0;
    this.driftTime = 0;
    this.driftCharge = 0; // 0: なし, 1: 青, 2: 橙, 3: 紫(ウルトラ)
    this.prevDriftInput = false;

    // ブースト & スター無敵
    this.boostTime = 0;
    this.boostSpeedMultiplier = 1.0;
    this.starTime = 0;

    // ジャンプ & トリックアクション
    this.height = 0;
    this.verticalVelocity = 0;
    this.gravity = 26.0;
    this.canTrick = false;
    this.didTrick = false;
    this.trickSpin = 0;
    this.trickPitch = 0;
    this.rampCooldown = 0;
    this.padCooldown = 0;

    // 路面ピッチ角
    this.pitchAngle = 0;

    // スリップストリーム
    this.slipstreamCharge = 0; // 0..1
    this.isSlipstreaming = false;

    // スピン状態（被弾時）
    this.spinTime = 0;
    this.spinAngle = 0;
    this.invincibleTimer = 0; // 被弾直後の連続被弾防止

    // アイテムスロット (0:なし, 1:抹茶ブースト, 2:あずきトラップ, 3:甘夏ショット, 4:スター)
    this.activeItem = 0;
    this.isRollingItem = false;

    // チェックポイント管理
    this.lastU = undefined;
    this.passedCheckpoints = new Set();

    // 1フレーム分の通知イベントキュー
    this.events = [];
  }

  consumeEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  update(dt, input, world, elapsedTime = 0) {
    if (this.rampCooldown > 0) this.rampCooldown -= dt;
    if (this.padCooldown > 0) this.padCooldown -= dt;
    if (this.invincibleTimer > 0) this.invincibleTimer -= dt;

    // 1. スピン状態
    if (this.spinTime > 0) {
      this.spinTime -= dt;
      this.spinAngle += 16.0 * dt;
      this.speed = Math.max(0, this.speed - 36.0 * dt);
      this.isDrifting = false;
      this.driftTime = 0;
      this.driftCharge = 0;
      this.driftAngle = THREE.MathUtils.lerp(this.driftAngle, 0, dt * 10);
      if (this.spinTime <= 0) {
        this.spinAngle = 0;
        this.spinTime = 0;
      }
    }

    // 2. ブースト＆スタータイマー
    if (this.boostTime > 0) {
      this.boostTime -= dt;
      if (this.boostTime <= 0) {
        this.boostTime = 0;
        this.boostSpeedMultiplier = 1.0;
      }
    }
    if (this.starTime > 0) {
      this.starTime -= dt;
      if (this.starTime <= 0) {
        this.starTime = 0;
      }
    }

    // 3. ジャンプ＆滞空トリックの物理
    const wasAirborne = this.height > 0.05;
    if (this.height > 0 || this.verticalVelocity > 0) {
      this.verticalVelocity -= this.gravity * dt;
      this.height += this.verticalVelocity * dt;

      // 滞空中のトリック入力判定
      const driftJustPressed = input.drift && !this.prevDriftInput;
      if (this.canTrick && !this.didTrick && driftJustPressed && this.height > 0.5) {
        this.didTrick = true;
        this.events.push({ type: 'trick_success' });
      }

      if (this.didTrick) {
        this.trickSpin += Math.PI * 4.5 * dt;
        this.trickPitch = -0.25;
      }

      if (this.height <= 0) {
        this.height = 0;
        this.verticalVelocity = 0;
        if (wasAirborne) {
          this.events.push({ type: 'land', hard: this.canTrick });
          if (this.didTrick) {
            this.triggerBoost(1.35, 1.38);
            this.events.push({ type: 'trick_boost' });
          }
        }
        this.canTrick = false;
        this.didTrick = false;
        this.trickSpin = 0;
        this.trickPitch = 0;
      }
    } else {
      this.trickSpin = THREE.MathUtils.lerp(this.trickSpin, 0, Math.min(1, dt * 12));
      this.trickPitch = THREE.MathUtils.lerp(this.trickPitch, 0, Math.min(1, dt * 12));
    }

    // 4. 操作入力処理
    if (this.spinTime <= 0) {
      this.processControls(dt, input);
    }
    this.prevDriftInput = !!input.drift;

    // 5. 移動ベクトル計算
    const moveDir = this.direction;
    const forward = new THREE.Vector3(Math.sin(moveDir), 0, Math.cos(moveDir));

    if (this.isDrifting) {
      const noseDir = this.direction + this.driftAngle * 0.55;
      const noseVec = new THREE.Vector3(Math.sin(noseDir), 0, Math.cos(noseDir));
      const targetVel = noseVec.multiplyScalar(this.speed * 0.78).addScaledVector(forward, this.speed * 0.22);
      this.velocity.lerp(targetVel, Math.min(1, dt * 8.5));
    } else {
      this.velocity.copy(forward).multiplyScalar(this.speed);
    }

    this.position.addScaledVector(this.velocity, dt);

    // 6. コース進捗・路面高さ・壁（ガードレール）反発判定
    const prog = world.getTrackProgress(this.position);
    this.onGrass = prog.onGrass;

    // ガードレール境界チェック（コースアウト迷子を完全防止）
    if (Math.abs(prog.lateralOffset) > prog.wallLimit) {
      const sign = Math.sign(prog.lateralOffset) || 1;
      const clampedOffset = sign * prog.wallLimit;
      this.position.x = prog.point.x + prog.normal.x * clampedOffset;
      this.position.z = prog.point.z + prog.normal.z * clampedOffset;

      if (Math.abs(this.speed) > 10) {
        this.speed *= 0.82;
        this.events.push({ type: 'wall_hit' });
      }
      // 壁に擦ったときに進行方向を少しコース接線方向へ補正して引っかかりを防ぐ
      const trackDir = Math.atan2(prog.tangent.x, prog.tangent.z);
      const diff = normalizeAngle(trackDir - this.direction);
      this.direction += diff * Math.min(1, dt * 5.0);
    }

    // 路面の高さと傾斜ピッチ角
    const groundY = prog.point ? prog.point.y : 0;
    this.position.y = groundY + this.height;

    const cartForward = new THREE.Vector3(Math.sin(this.direction), 0, Math.cos(this.direction));
    const dirDot = cartForward.dot(new THREE.Vector3(prog.tangent.x, 0, prog.tangent.z).normalize());
    this.isWrongWay = dirDot < -0.35 && this.speed > 4.0;

    // 坂道ピッチ（上り坂でノーズアップ）
    const slopePitch = -Math.asin(THREE.MathUtils.clamp(prog.tangent.y, -0.5, 0.5)) * Math.sign(dirDot || 1);
    const jumpPitch = this.height > 0.1 ? THREE.MathUtils.clamp(-this.verticalVelocity * 0.035, -0.38, 0.35) : 0;
    this.pitchAngle = THREE.MathUtils.lerp(this.pitchAngle, this.height > 0.1 ? jumpPitch : slopePitch, Math.min(1, dt * 10));

    // 7. 進捗とラップ更新
    this.progress = prog.u;
    this.updateLap(world, elapsedTime);
  }

  processControls(dt, input) {
    // コインボーナス（最大10枚で最高速 +10%）
    const coinBonus = 1.0 + Math.min(this.coins, 10) * 0.01;
    const isOffroad = this.onGrass && this.boostTime <= 0 && this.starTime <= 0;

    let currentMaxSpeed = isOffroad ? this.maxSpeedGrass : this.maxSpeed * coinBonus;
    let currentAccel = isOffroad ? this.accelerationGrass : this.acceleration;

    if (this.starTime > 0) {
      currentMaxSpeed = this.maxSpeed * 1.42;
      currentAccel = this.acceleration * 2.4;
    } else if (this.boostTime > 0) {
      currentMaxSpeed = Math.max(currentMaxSpeed, this.maxSpeed * this.boostSpeedMultiplier);
      currentAccel = this.acceleration * 2.4;
    }

    // アクセル / ブレーキ
    if (input.gas) {
      if (this.speed < currentMaxSpeed) {
        this.speed = Math.min(currentMaxSpeed, this.speed + currentAccel * dt);
      } else if (this.speed > currentMaxSpeed) {
        this.speed = Math.max(currentMaxSpeed, this.speed - this.acceleration * 0.85 * dt);
      }
    } else if (input.brake) {
      if (this.speed > 0.5) {
        this.speed = Math.max(0, this.speed - this.acceleration * 2.6 * dt);
      } else {
        this.speed = Math.max(-this.maxSpeed * 0.32, this.speed - this.acceleration * 0.65 * dt);
      }
    } else {
      const f = isOffroad ? this.frictionGrass : this.friction;
      this.speed *= Math.pow(f, dt * 60);
      if (Math.abs(this.speed) < 0.15) this.speed = 0;
    }

    // ステアリング（+1 = 左旋回, -1 = 右旋回）
    let steerDir = 0;
    if (input.left) steerDir += 1;
    if (input.right) steerDir -= 1;

    const reverseSign = this.speed < -0.5 ? -1 : 1;
    let steerFactor = steerDir * reverseSign * this.steerSensitivity * dt;
    const absSpd = Math.abs(this.speed);
    if (absSpd > 1.2) {
      const speedRatio = Math.min(1.2, absSpd / this.maxSpeed);
      steerFactor *= (1.18 - speedRatio * 0.34);
    } else {
      steerFactor *= (absSpd / 1.2);
    }

    if (!this.isDrifting) {
      this.direction += steerFactor;
      this.driftAngle = THREE.MathUtils.lerp(this.driftAngle, 0, Math.min(1, dt * 12));
    }

    // ドリフト開始判定（地上＆十分加速中＆左右入力あり＆ドリフトボタン押下）
    const driftJustPressed = input.drift && !this.prevDriftInput;
    if (
      input.drift &&
      !this.isDrifting &&
      this.height <= 0.05 &&
      Math.abs(steerDir) > 0 &&
      this.speed > this.maxSpeed * 0.38
    ) {
      this.isDrifting = true;
      this.driftDirection = steerDir;
      this.driftTime = 0;
      this.driftCharge = 0;
      this.verticalVelocity = 5.2;
      this.height = 0.06;
      this.events.push({ type: 'hop' });
    } else if (driftJustPressed && !this.isDrifting && this.height <= 0.05 && this.speed > 5) {
      // まっすぐ走っている時に押したら軽快なミニホップ
      this.verticalVelocity = 4.6;
      this.height = 0.06;
      this.events.push({ type: 'hop' });
    }

    // ドリフト中の更新
    if (this.isDrifting) {
      // イン側に強く切るとチャージが早く溜まる！
      const chargeRate = steerDir === this.driftDirection ? 1.35 : 0.95;
      this.driftTime += dt * chargeRate;

      const prevCharge = this.driftCharge;
      if (this.driftTime >= 2.7) {
        this.driftCharge = 3;
      } else if (this.driftTime >= 1.55) {
        this.driftCharge = 2;
      } else if (this.driftTime >= 0.7) {
        this.driftCharge = 1;
      } else {
        this.driftCharge = 0;
      }

      if (this.driftCharge > prevCharge) {
        this.events.push({ type: 'drift_charge', level: this.driftCharge });
      }

      // ドリフト旋回（イン絞り／アウト膨らみの繊細な調整）
      let driftSteer = this.driftDirection * 0.92;
      if (steerDir === this.driftDirection) {
        driftSteer += this.driftDirection * 0.58;
      } else if (steerDir === -this.driftDirection) {
        driftSteer -= this.driftDirection * 0.55;
      }
      this.direction += driftSteer * this.steerSensitivity * 0.65 * dt;

      // 車体をイン側に向けるドリフト角
      const targetAngle = this.driftDirection * 0.36;
      this.driftAngle = THREE.MathUtils.lerp(this.driftAngle, targetAngle, Math.min(1, dt * 9.0));

      if (!input.drift || this.speed < this.maxSpeed * 0.25) {
        this.releaseDrift();
      }
    }
  }

  releaseDrift() {
    this.isDrifting = false;
    const charge = this.driftCharge;

    if (charge === 3) {
      this.triggerBoost(2.2, 1.48);
      this.events.push({ type: 'mini_turbo', level: 3 });
    } else if (charge === 2) {
      this.triggerBoost(1.45, 1.34);
      this.events.push({ type: 'mini_turbo', level: 2 });
    } else if (charge === 1) {
      this.triggerBoost(0.85, 1.22);
      this.events.push({ type: 'mini_turbo', level: 1 });
    }

    // 進行方向がガクッと飛ばないよう控えめに統合
    this.direction += this.driftAngle * 0.3;
    this.driftAngle = 0;
    this.driftTime = 0;
    this.driftCharge = 0;
  }

  triggerBoost(duration, multiplier) {
    this.boostTime = Math.max(this.boostTime, duration);
    this.boostSpeedMultiplier = Math.max(this.boostSpeedMultiplier, multiplier);
    this.speed = Math.max(this.speed, this.maxSpeed * Math.min(multiplier, 1.38));
  }

  triggerRocketStart() {
    this.triggerBoost(1.8, 1.42);
    this.speed = this.maxSpeed * 1.32;
    this.events.push({ type: 'rocket_start' });
  }

  triggerBoostPad() {
    if (this.padCooldown > 0) return false;
    this.padCooldown = 0.6;
    this.triggerBoost(1.25, 1.42);
    this.events.push({ type: 'boost_pad' });
    return true;
  }

  launchFromRamp() {
    if (this.rampCooldown > 0 || this.height > 0.8) return false;
    this.rampCooldown = 1.0;
    this.isDrifting = false;
    this.driftAngle = 0;
    this.driftCharge = 0;
    this.height = 0.4;
    this.verticalVelocity = 13.8 + Math.min(4.0, this.speed * 0.08);
    this.canTrick = true;
    this.didTrick = false;
    this.speed = Math.max(this.speed, this.maxSpeed * 1.08);
    this.events.push({ type: 'ramp_jump' });
    return true;
  }

  useMushroom() {
    this.triggerBoost(2.1, 1.45);
  }

  useStar() {
    this.starTime = 5.5;
    this.spinTime = 0;
    this.spinAngle = 0;
    this.speed = Math.max(this.speed, this.maxSpeed * 1.35);
  }

  spinOut() {
    if (this.starTime > 0 || this.invincibleTimer > 0) return false;
    if (this.spinTime <= 0) {
      this.spinTime = 1.15;
      this.invincibleTimer = 2.0;
      this.boostTime = 0;
      this.boostSpeedMultiplier = 1.0;
      this.coins = Math.max(0, this.coins - 2);
      return true;
    }
    return false;
  }

  updateLap(world, elapsedTime) {
    if (this.lastU === undefined) {
      this.lastU = this.progress;
      this.passedCheckpoints = new Set();
      this.totalProgress = this.lap + (this.progress > 0.85 ? this.progress - 1.0 : this.progress);
      return;
    }

    const currU = this.progress;
    const prevU = this.lastU;

    world.checkpoints.forEach((cp, idx) => {
      if (prevU < cp && currU >= cp && Math.abs(currU - prevU) < 0.22) {
        this.passedCheckpoints.add(idx);
      }
      if (cp > 0.9 && prevU > 0.88 && currU < 0.12) {
        this.passedCheckpoints.add(idx);
      }
    });

    // スタート/ゴールラインを順方向に跨いだ判定
    if (prevU > 0.85 && currU < 0.15) {
      const checkpointsRequired = world.checkpoints.length - 1;
      let passedAll = true;
      for (let i = 0; i < checkpointsRequired; i++) {
        if (!this.passedCheckpoints.has(i)) passedAll = false;
      }
      if (passedAll) {
        const lapDuration = elapsedTime - this.lapStartTime;
        if (lapDuration > 5 && lapDuration < this.bestLapTime) {
          this.bestLapTime = lapDuration;
        }
        this.lapStartTime = elapsedTime;
        this.lap += 1;
        this.passedCheckpoints.clear();
        this.events.push({ type: 'lap', lap: this.lap });
      }
    }

    this.lastU = currU;

    // スタート直後（グリッドがu=0.98付近にある）の順位逆転バグを防止
    let adjustedU = currU;
    if (this.lap === 0 && currU > 0.8 && this.passedCheckpoints.size === 0) {
      adjustedU = currU - 1.0;
    }
    this.totalProgress = this.lap + adjustedU;
  }
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
