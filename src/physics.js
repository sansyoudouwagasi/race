import * as THREE from 'three';

export class CartPhysics {
  constructor(position, isPlayer = false) {
    this.position = position.clone();
    this.velocity = new THREE.Vector3();
    this.speed = 0;
    this.direction = 0; // Y軸回転角（ラジアン）
    
    // カート状態フラグ
    this.isPlayer = isPlayer;
    this.onGrass = false;
    this.coins = 0;
    this.lap = 0;
    this.progress = 0; // 周回内の進行度u
    this.totalProgress = 0; // lap + progress (順位計算用)
    
    // 物理パラメータ
    this.maxSpeed = 32.0;       // 通常時の最高速度
    this.maxSpeedGrass = 10.0;  // 草地での最高速度
    this.acceleration = 12.0;   // 加速力
    this.accelerationGrass = 4.0;
    this.friction = 0.985;       // 通常の減速摩擦（毎フレーム乗算）
    this.frictionGrass = 0.91;   // 草地での強い減衰
    this.steerSensitivity = 2.4; // ステアリング感度
    
    // ドリフト関連
    this.isDrifting = false;
    this.driftDirection = 0; // -1: 左, 1: 右
    this.driftAngle = 0;     // カートモデルの傾き角（ドリフト時の横向き表現）
    this.driftTime = 0;
    this.driftCharge = 0;    // 0: なし, 1: 青火花(ミニターボ), 2: 黄火花(スーパーミニターボ)
    
    // ブースト（ダッシュ）関連
    this.boostTime = 0;
    this.boostSpeedMultiplier = 1.0;
    
    // ジャンプ（ホップ）関連
    this.height = 0;
    this.verticalVelocity = 0;
    this.gravity = 9.8;
    
    // スピン状態（被弾時）
    this.spinTime = 0;
    this.spinAngle = 0; // スピン時のモデル回転用
    
    // アイテムスロット
    this.activeItem = 0; // 0: なし, 1: ダッシュ, 2: 罠, 3: 直進弾
    this.isRollingItem = false;
  }
  
  // 入力を元に物理状態を更新
  update(dt, input, world) {
    // 1. スピン状態の更新
    if (this.spinTime > 0) {
      this.spinTime -= dt;
      this.spinAngle += 15.0 * dt; // 高速回転
      this.speed = Math.max(0, this.speed - 40.0 * dt); // スピン中は急減速
      this.isDrifting = false;
      this.driftTime = 0;
      this.driftAngle = 0;
      this.driftCharge = 0;
      
      // スピン終了時
      if (this.spinTime <= 0) {
        this.spinAngle = 0;
      }
    }
    
    // 2. ブーストタイマーの更新
    if (this.boostTime > 0) {
      this.boostTime -= dt;
      if (this.boostTime <= 0) {
        this.boostSpeedMultiplier = 1.0;
        this.boostTime = 0;
      }
    }
    
    // 3. ジャンプ（ホップ）の物理
    if (this.height > 0 || this.verticalVelocity > 0) {
      this.verticalVelocity -= this.gravity * dt * 2.0;
      this.height += this.verticalVelocity * dt;
      if (this.height <= 0) {
        this.height = 0;
        this.verticalVelocity = 0;
      }
    }
    
    // スピン中でなければ、入力を処理
    if (this.spinTime <= 0) {
      this.processControls(dt, input, world);
    }
    
    // 4. 位置の更新と移動ベクトルの計算
    let actualDirection = this.direction + this.driftAngle + this.spinAngle;
    
    // ドリフト中は進行方向が車体向きより少し遅れて追従する（慣性スライド）
    const forward = new THREE.Vector3(Math.sin(actualDirection), 0, Math.cos(actualDirection));
    
    if (this.isDrifting) {
      // ドリフト中は遠心力で外側に滑るベクトルを加える
      // ドリフト方向の逆（外側）に向かう横滑り速度
      const slideDir = new THREE.Vector3(Math.sin(this.direction), 0, Math.cos(this.direction));
      
      // 前方への速度ベクトルと、外側へ滑るベクトルをブレンド
      const driftBlend = 0.72; // ドリフト中のトラクションの強さ
      const targetVel = forward.clone().multiplyScalar(this.speed * driftBlend)
                        .add(slideDir.clone().multiplyScalar(this.speed * (1.0 - driftBlend)));
      
      this.velocity.lerp(targetVel, dt * 6.0); // 慣性滑り
    } else {
      // 通常時は車体の向きに直接進む
      this.velocity.copy(forward).multiplyScalar(this.speed);
    }
    
    // 位置の更新
    this.position.addScaledVector(this.velocity, dt);
    
    // 高さを適用（描画時に利用）
    // Y座標はコースの起伏に合わせつつ、ジャンプの高さを足す
    const progressData = world.getTrackProgress(this.position);
    this.onGrass = progressData.onGrass;
    
    // 地面の高さ（Y座標）を取得
    const groundY = progressData.point ? progressData.point.y : 0;
    this.position.y = groundY + this.height;
    
    // 順位計算のための進捗度を更新
    this.progress = progressData.u;
    
    // チェックポイントと周回判定（Lapシステム）
    this.updateLap(world);
  }
  
  processControls(dt, input, world) {
    // コイン数による速度ボーナス（最大10枚、1枚につき +0.5% 最高速度）
    const coinBonus = 1.0 + (Math.min(this.coins, 10) * 0.005);
    
    // 最高速度と加速力を計算（草地ペナルティとブーストを考慮）
    let currentMaxSpeed = this.onGrass ? this.maxSpeedGrass : this.maxSpeed;
    let currentAccel = this.onGrass ? this.accelerationGrass : this.acceleration;
    
    // ブースト効果の適用
    if (this.boostTime > 0) {
      // ブースト中は草地ペナルティを無効化（ダッシュキノコ相当）
      currentMaxSpeed = this.maxSpeed * this.boostSpeedMultiplier;
      currentAccel = this.acceleration * 2.0;
    } else {
      currentMaxSpeed *= coinBonus;
    }
    
    // A. 加速と減速 (アクセル / ブレーキ)
    if (input.gas) {
      if (this.speed < currentMaxSpeed) {
        this.speed += currentAccel * dt;
      } else if (this.speed > currentMaxSpeed && this.boostTime <= 0) {
        // ブーストが切れたら最高速度まで自然減速
        this.speed -= currentAccel * dt;
      }
    } else if (input.brake) {
      // ブレーキ / バック
      if (this.speed > 0) {
        this.speed -= this.acceleration * 2.5 * dt; // 強いブレーキ
      } else {
        this.speed -= this.acceleration * 0.5 * dt; // バック（最大速度制限）
        this.speed = Math.max(-this.maxSpeed * 0.3, this.speed);
      }
    } else {
      // アクセルもブレーキも押されていない時は自然摩擦で減衰
      const currentFriction = this.onGrass && this.boostTime <= 0 ? this.frictionGrass : this.friction;
      this.speed *= Math.pow(currentFriction, dt * 60); // フレームレート依存を防ぐ
      if (Math.abs(this.speed) < 0.1) this.speed = 0;
    }
    
    // B. ステアリング (左右)
    let steerDir = 0;
    if (input.left) steerDir = -1;
    if (input.right) steerDir = 1;
    
    // 速度に基づいた旋回性能の調整（静止時は曲がれず、速度が出るほど旋回角が変わる）
    let steerFactor = steerDir * this.steerSensitivity * dt;
    if (Math.abs(this.speed) > 1.0) {
      // 高速になるほど少し旋回が難しくなる（ドリフトの動機づけ）
      const speedRatio = Math.abs(this.speed) / this.maxSpeed;
      steerFactor *= (1.2 - speedRatio * 0.4);
    } else {
      steerFactor *= (Math.abs(this.speed) / 1.0); // 静止時は曲がらない
    }
    
    // 通常時の旋回
    if (!this.isDrifting) {
      this.direction += steerFactor;
      this.driftAngle = 0;
    }
    
    // C. ドリフト挙動
    // ドリフト開始判定: 走行中にステアリングを切りながら、ドリフトボタンを押した瞬間
    if (input.drift && !this.isDrifting && Math.abs(steerDir) > 0 && this.speed > this.maxSpeed * 0.3) {
      this.isDrifting = true;
      this.driftDirection = steerDir;
      this.driftTime = 0;
      this.driftCharge = 0;
      
      // カートのホップ（ジャンプ）
      this.verticalVelocity = 3.2; 
      this.height = 0.1;
    }
    
    // ドリフト中の処理
    if (this.isDrifting) {
      this.driftTime += dt;
      
      // チャージレベルの判定
      if (this.driftTime >= 2.5) {
        this.driftCharge = 2; // スーパーミニターボ (黄火花)
      } else if (this.driftTime >= 1.0) {
        this.driftCharge = 1; // ミニターボ (青火花)
      } else {
        this.driftCharge = 0;
      }
      
      // ドリフト中の旋回ロジック:
      // ステアリングを切ると、ドリフトの「絞り込み（イン突き）」が可能
      // ドリフト方向（イン）に入力すると強く曲がり、逆（アウト）に入力すると緩やかに曲がる
      let driftSteer = this.driftDirection * 0.9; // ドリフトベースの旋回
      if (steerDir === this.driftDirection) {
        driftSteer += this.driftDirection * 0.5; // イン絞り
      } else if (steerDir !== 0) {
        driftSteer -= this.driftDirection * 0.4; // カウンターステア（アウト膨らみ）
      }
      
      this.direction += driftSteer * this.steerSensitivity * 0.6 * dt;
      
      // カートモデルを傾ける（ビジュアル的なドリフト角の表現）
      // 滑っている方向とは逆側にモデルを傾ける
      const targetDriftAngle = -this.driftDirection * 0.45;
      this.driftAngle = THREE.MathUtils.lerp(this.driftAngle, targetDriftAngle, dt * 8.0);
      
      // ドリフト終了判定: ドリフトキーを離した、または極端に減速したとき
      if (!input.drift || this.speed < this.maxSpeed * 0.2) {
        this.releaseDrift();
      }
    }
  }
  
  releaseDrift() {
    this.isDrifting = false;
    
    // ミニターボの発動
    if (this.driftCharge === 2) {
      // スーパーミニターボ (黄)
      this.boostTime = 1.6;
      this.boostSpeedMultiplier = 1.35;
      this.speed = Math.max(this.speed, this.maxSpeed * 1.2);
    } else if (this.driftCharge === 1) {
      // ミニターボ (青)
      this.boostTime = 0.8;
      this.boostSpeedMultiplier = 1.20;
      this.speed = Math.max(this.speed, this.maxSpeed * 1.1);
    }
    
    // ドリフト角度のリセットとマージ
    // カートの進行方向とモデルの向きのズレを解消
    this.direction += this.driftAngle;
    this.driftAngle = 0;
    this.driftTime = 0;
    this.driftCharge = 0;
  }
  
  // 被弾時のスピン効果をトリガー
  spinOut() {
    if (this.spinTime <= 0) {
      this.spinTime = 1.2; // 1.2秒間操作不能スピン
    }
  }
  
  // ダッシュキノコアイテムの使用
  useMushroom() {
    this.boostTime = 2.0;
    this.boostSpeedMultiplier = 1.4;
    this.speed = Math.max(this.speed, this.maxSpeed * 1.3);
  }
  
  // 不正なLapカウントを防ぐチェックポイント監視型の周回計算
  updateLap(world) {
    if (!this.lastU) {
      this.lastU = this.progress;
      this.passedCheckpoints = new Set();
      return;
    }
    
    const currU = this.progress;
    const prevU = this.lastU;
    
    // 各チェックポイントの通過を検知
    world.checkpoints.forEach((cp, idx) => {
      // cp付近（閾値0.08内）を通過したか判定
      if (prevU < cp && currU >= cp && Math.abs(currU - prevU) < 0.2) {
        this.passedCheckpoints.add(idx);
      }
      // ループを跨ぐ通過（u=0.98付近から0.02付近へのジャンプ）のチェックポイント
      if (cp > 0.9 && (prevU > 0.9 && currU < 0.1)) {
        this.passedCheckpoints.add(idx);
      }
    });
    
    // スタート/ゴールラインを前方に通過したか判定 (u=0付近を跨いだか)
    if (prevU > 0.85 && currU < 0.15) {
      // 全てのチェックポイント（最初の3つ）を通過している場合のみ周回カウント
      const checkpointsRequired = world.checkpoints.length - 1; // 最後のゲート直前以外
      let passedAll = true;
      for (let i = 0; i < checkpointsRequired; i++) {
        if (!this.passedCheckpoints.has(i)) {
          passedAll = false;
        }
      }
      
      if (passedAll) {
        this.lap += 1;
        this.passedCheckpoints.clear();
      }
    }
    
    // 逆走などの監視
    this.lastU = currU;
    
    // 順位判定のための総合進捗値
    this.totalProgress = this.lap + currU;
  }
}
