import * as THREE from 'three';

export class RivalAI {
  constructor(cartPhysics, aiId, world) {
    this.cart = cartPhysics;
    this.id = aiId;
    this.world = world;
    
    // AIごとの走行ラインの左右オフセット (-3m 〜 +3m)
    // AI同士で重ならずにばらけて走るようにする
    const offsets = [-2.5, 0.0, 2.5];
    this.lateralOffset = offsets[aiId % offsets.length];
    
    // 先読みするパスの量（速度に応じて変化させる）
    this.lookAheadBase = 0.025;
    
    // アイテム使用のクールダウン
    this.itemUseTimer = 1.0 + Math.random() * 2.0;
    
    // 仮想入力の状態
    this.input = {
      gas: false,
      brake: false,
      left: false,
      right: false,
      drift: false,
      item: false
    };
  }
  
  // 毎フレームのAI制御判断
  update(dt, playerCart) {
    this.resetInput();
    
    // スピン状態なら操作しない
    if (this.cart.spinTime > 0) return;
    
    const u = this.cart.progress;
    
    // 1. 先読み目標ポイントの計算
    // カートの現在の速度比率に応じて先読み量を変える（速いほど先を見る）
    const speedRatio = Math.max(0.2, this.cart.speed / this.cart.maxSpeed);
    const lookAhead = this.lookAheadBase * speedRatio;
    const targetU = (u + lookAhead) % 1.0;
    
    const targetCenter = this.world.trackCurve.getPointAt(targetU);
    const tangent = this.world.trackCurve.getTangentAt(targetU).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    
    // ラインオフセットを加えた目標位置
    const targetPos = targetCenter.clone().addScaledVector(normal, this.lateralOffset);
    
    // 2. 目標位置への角度差の計算
    // 現在の進行方向と、目標位置へのベクトルの角度差を計算
    const toTarget = targetPos.clone().sub(this.cart.position);
    toTarget.y = 0; // 高さは無視
    const distToTarget = toTarget.length();
    toTarget.normalize();
    
    // カートの前方ベクトル
    const actualDirection = this.cart.direction + this.cart.driftAngle;
    const forwardVec = new THREE.Vector3(Math.sin(actualDirection), 0, Math.cos(actualDirection));
    
    // 角度差 (ラジアン) を計算
    // 符号付き角度を求めるために外積を使用
    const cross = new THREE.Vector3().crossVectors(forwardVec, toTarget);
    let angleDiff = forwardVec.angleTo(toTarget);
    if (cross.y < 0) angleDiff = -angleDiff; // 左回りなら負、右回りなら正
    
    // 3. ステアリング操作
    const steerThreshold = 0.05; // 遊び
    if (angleDiff < -steerThreshold) {
      this.input.left = true;
    } else if (angleDiff > steerThreshold) {
      this.input.right = true;
    }
    
    // 4. 加速・ブレーキ・ドリフト操作
    // 常に基本的にアクセルオン
    this.input.gas = true;
    
    const absAngle = Math.abs(angleDiff);
    
    // カーブのきつさに応じた減速・ドリフト制御
    if (absAngle > 0.35 && this.cart.speed > this.cart.maxSpeed * 0.4) {
      // 急カーブならドリフトを試みる
      this.input.drift = true;
      
      // ドリフト中はアクセルを少し緩めてコントロールしやすくする
      if (Math.random() < 0.2) this.input.gas = false;
    } else if (absAngle > 0.6) {
      // 超急カーブで速度が速すぎる場合はブレーキを踏む
      this.input.brake = true;
      this.input.gas = false;
    }
    
    // ドリフトを長く続けすぎたら解除する（AI用の補助）
    if (this.cart.isDrifting && this.cart.driftTime > 2.8) {
      this.input.drift = false;
    }
    
    // 5. ゴムバンド（キャッチアップ）システム
    // プレイヤーとの相対位置によりAIのパラメータを微妙に調整してレースを熱くする
    if (playerCart) {
      const playerProg = playerCart.totalProgress;
      const aiProg = this.cart.totalProgress;
      const progDiff = aiProg - playerProg; // 正ならAIが先行、負ならプレイヤーが先行
      
      if (progDiff > 0.15) {
        // AIがプレイヤーを引き離しすぎている場合は、手加減する
        this.cart.maxSpeed = this.cart.maxSpeed * 0.92;
      } else if (progDiff < -0.15) {
        // AIがプレイヤーに遅れを取っている場合は、ブーストする
        this.cart.maxSpeed = this.cart.maxSpeed * 1.08;
      } else {
        // 通常
        this.cart.maxSpeed = 32.0;
      }
    }
    
    // 6. アイテム使用の判断
    if (this.cart.activeItem > 0 && !this.cart.isRollingItem) {
      this.itemUseTimer -= dt;
      if (this.itemUseTimer <= 0) {
        this.decideAndUseItem(playerCart);
        this.itemUseTimer = 2.0 + Math.random() * 3.0; // 次の使用判断までの時間
      }
    }
  }
  
  decideAndUseItem(playerCart) {
    const item = this.cart.activeItem;
    
    // アイテムごとの使用トリガー
    if (item === 1) {
      // 1.png（ダッシュ）：即座に使用
      this.input.item = true;
    } else if (item === 2) {
      // 2.png（設置罠）：後ろに誰かがいるか、またはある程度の確率で設置
      // AIの後ろに誰かがいる場合
      const myProg = this.cart.totalProgress;
      
      let anyoneBehind = false;
      if (playerCart && playerCart.totalProgress < myProg && playerCart.totalProgress > myProg - 0.1) {
        anyoneBehind = true;
      }
      
      if (anyoneBehind || Math.random() < 0.4) {
        this.input.item = true;
      }
    } else if (item === 3) {
      // 3.png（直進弾）：前方に誰かがいる場合
      const myProg = this.cart.totalProgress;
      
      let targetInFront = false;
      if (playerCart && playerCart.totalProgress > myProg && playerCart.totalProgress < myProg + 0.12) {
        // 角度的にも前方にいるか
        const toPlayer = playerCart.position.clone().sub(this.cart.position).normalize();
        const actualDirection = this.cart.direction + this.cart.driftAngle;
        const forward = new THREE.Vector3(Math.sin(actualDirection), 0, Math.cos(actualDirection));
        const angle = forward.angleTo(toPlayer);
        
        if (angle < 0.4) { // 前方約23度以内
          targetInFront = true;
        }
      }
      
      if (targetInFront || Math.random() < 0.3) {
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
