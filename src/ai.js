import * as THREE from 'three';

export const RIVAL_PROFILES = [
  { name: 'BLAZE', color: 0xff3b5c, speedBias: 1.03, driftSkill: 0.9, aggression: 0.7 },
  { name: 'EMERALD', color: 0x00e676, speedBias: 1.00, driftSkill: 1.0, aggression: 0.5 },
  { name: 'SOLAR', color: 0xffc400, speedBias: 0.98, driftSkill: 0.85, aggression: 0.6 },
  { name: 'NOVA', color: 0xb84dff, speedBias: 1.01, driftSkill: 0.95, aggression: 0.8 },
  { name: 'TITAN', color: 0xff7b29, speedBias: 0.96, driftSkill: 0.8, aggression: 0.65 },
];

export class RivalAI {
  constructor(cartPhysics, aiId, world, profile) {
    this.cart = cartPhysics;
    this.id = aiId;
    this.world = world;
    this.profile = profile || RIVAL_PROFILES[aiId % RIVAL_PROFILES.length];

    const lanePresets = [-3.2, -1.6, 0.0, 1.6, 3.2];
    this.baseOffset = lanePresets[aiId % lanePresets.length];
    this.lateralOffset = this.baseOffset;
    this.laneChangeTimer = 1.5 + Math.random() * 2.5;

    this.lookAheadBase = 0.028;
    this.itemUseTimer = 1.2 + Math.random() * 2.0;

    this.input = {
      gas: false,
      brake: false,
      left: false,
      right: false,
      drift: false,
      item: false
    };
  }

  update(dt, playerCart, traps = []) {
    this.resetInput();
    if (this.cart.spinTime > 0) return;

    const u = this.cart.progress;

    // 時々走行ラインを揺らして自然なレース展開を作る
    this.laneChangeTimer -= dt;
    if (this.laneChangeTimer <= 0) {
      this.laneChangeTimer = 2.0 + Math.random() * 3.0;
      const maxLane = this.world.trackWidth * 0.34;
      this.lateralOffset = THREE.MathUtils.clamp(
        this.baseOffset + (Math.random() - 0.5) * 3.8,
        -maxLane,
        maxLane
      );
    }

    // 近くの前方ブーストパッドがあれば狙いにいく
    let desiredOffset = this.lateralOffset;
    for (let i = 0; i < this.world.boostPads.length; i++) {
      const pad = this.world.boostPads[i];
      let du = pad.u - u;
      if (du < -0.5) du += 1.0;
      if (du > 0.005 && du < 0.045) {
        desiredOffset = pad.offset;
        break;
      }
    }

    // 近くの罠を避ける
    for (let i = 0; i < traps.length; i++) {
      const trap = traps[i];
      if (!trap.active) continue;
      const dist = this.cart.position.distanceTo(trap.position);
      if (dist < 14) {
        desiredOffset = desiredOffset > 0 ? -3.4 : 3.4;
        break;
      }
    }

    // 1. 先読み目標ポイント
    const speedRatio = Math.max(0.35, this.cart.speed / this.cart.baseMaxSpeed);
    const lookAhead = this.lookAheadBase * speedRatio;
    const targetU = (u + lookAhead) % 1.0;

    const targetCenter = this.world.trackCurve.getPointAt(targetU);
    const tangent = this.world.trackCurve.getTangentAt(targetU).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const targetPos = targetCenter.clone().addScaledVector(normal, desiredOffset);

    // 2. 角度差の計算（+なら左、-なら右）
    const toTarget = targetPos.clone().sub(this.cart.position);
    toTarget.y = 0;
    if (toTarget.lengthSq() > 0.0001) toTarget.normalize();

    const actualDirection = this.cart.direction + this.cart.driftAngle * 0.4;
    const forwardVec = new THREE.Vector3(Math.sin(actualDirection), 0, Math.cos(actualDirection));

    // forwardVec x toTarget のY成分: 正なら目標が左(+Y回転方向)、負なら右
    const crossY = forwardVec.z * toTarget.x - forwardVec.x * toTarget.z;
    const dot = THREE.MathUtils.clamp(forwardVec.dot(toTarget), -1, 1);
    const angleDiff = Math.atan2(crossY, dot);

    // 3. ステアリング
    const steerThreshold = 0.05;
    if (angleDiff > steerThreshold) {
      this.input.left = true;
    } else if (angleDiff < -steerThreshold) {
      this.input.right = true;
    }

    // 4. アクセル＆ドリフト＆空中トリック
    this.input.gas = true;
    const absAngle = Math.abs(angleDiff);

    if (this.cart.canTrick && !this.cart.didTrick && this.cart.height > 1.2) {
      // ジャンプ台でAIもたまにカッコよくトリックを決める
      if (Math.random() < 0.08 * this.profile.driftSkill) {
        this.input.drift = true;
      }
    } else if (absAngle > 0.34 && this.cart.speed > this.cart.baseMaxSpeed * 0.52) {
      this.input.drift = true;
    } else if (absAngle > 0.85 && this.cart.speed > this.cart.baseMaxSpeed * 0.7) {
      this.input.brake = true;
      this.input.gas = false;
    }

    if (this.cart.isDrifting && (this.cart.driftTime > 2.2 || absAngle < 0.12)) {
      this.input.drift = false;
    }

    // 5. 安定したゴムバンド（元のバグだった毎フレーム乗算を修正し、基準値に対する倍率で計算）
    let rubberMult = this.profile.speedBias;
    if (playerCart) {
      const progDiff = this.cart.totalProgress - playerCart.totalProgress;
      if (progDiff > 0.12) {
        rubberMult *= THREE.MathUtils.clamp(1.0 - (progDiff - 0.12) * 0.45, 0.86, 1.0);
      } else if (progDiff < -0.10) {
        rubberMult *= THREE.MathUtils.clamp(1.0 + (-progDiff - 0.10) * 0.48, 1.0, 1.13);
      }
    }
    this.cart.maxSpeed = this.cart.baseMaxSpeed * rubberMult;

    // 6. アイテム使用判断
    if (this.cart.activeItem > 0 && !this.cart.isRollingItem) {
      this.itemUseTimer -= dt;
      if (this.itemUseTimer <= 0) {
        this.decideAndUseItem(playerCart);
        this.itemUseTimer = 1.8 + Math.random() * 2.5;
      }
    }
  }

  decideAndUseItem(playerCart) {
    const item = this.cart.activeItem;
    if (item === 1 || item === 4) {
      this.input.item = true;
    } else if (item === 2) {
      const myProg = this.cart.totalProgress;
      const playerBehind = playerCart && playerCart.totalProgress < myProg && playerCart.totalProgress > myProg - 0.12;
      if (playerBehind || Math.random() < 0.45) {
        this.input.item = true;
      }
    } else if (item === 3) {
      let targetInFront = false;
      if (playerCart) {
        const dist = this.cart.position.distanceTo(playerCart.position);
        if (dist < 42) {
          const toPlayer = playerCart.position.clone().sub(this.cart.position).setY(0).normalize();
          const fwd = new THREE.Vector3(Math.sin(this.cart.direction), 0, Math.cos(this.cart.direction));
          if (fwd.angleTo(toPlayer) < 0.35) targetInFront = true;
        }
      }
      if (targetInFront || Math.random() < 0.35 * this.profile.aggression) {
        this.input.item = true;
      }
    }
  }

  resetInput() {
    this.input.gas = false;
    this.input.brake = false;
    this.input.left = false;
    this.input.right = false;
    this.input.drift = false;
    this.input.item = false;
  }
}
