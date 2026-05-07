(() => {
  "use strict";

  const CONFIG = {
    durationSeconds: 60,
    maxHeightForMeter: 12,
    collapseTilt: 1.15,
    collapseFallenLimit: 4,
    platformWidthRatio: 0.82,
    alignmentAssistRange: 34,
    alignmentAssistStrength: 0.35,
    maxActiveParcels: 42,
    hudUpdateMs: 100,
    stackUpdateMs: 120,
    cleanupMs: 600,
    leaderboardKey: "parcel-panic-leaderboard",
    highScoreKey: "parcel-panic-high-score",
    ...window.PARCEL_PANIC_CONFIG
  };

  const PARCEL_TYPES = {
    small: {
      label: "Small Box",
      color: 0xd99b55,
      accent: 0xff7a1a,
      width: 74,
      height: 56,
      density: 0.0017,
      friction: 0.98,
      restitution: 0.04,
      points: 10
    },
    medium: {
      label: "Medium Parcel",
      color: 0xc98645,
      accent: 0xffb020,
      width: 98,
      height: 58,
      density: 0.0022,
      friction: 0.92,
      restitution: 0.06,
      points: 12
    },
    heavy: {
      label: "Heavy Cargo",
      color: 0x8f6238,
      accent: 0xff3d2e,
      width: 112,
      height: 68,
      density: 0.0045,
      friction: 0.82,
      restitution: 0.04,
      points: 18
    },
    golden: {
      label: "Golden Bonus",
      color: 0xffd928,
      accent: 0xffffff,
      width: 82,
      height: 58,
      density: 0.002,
      friction: 0.96,
      restitution: 0.08,
      points: 100,
      golden: true
    }
  };

  const UI = {
    hud: document.getElementById("hud"),
    start: document.getElementById("start-screen"),
    gameOver: document.getElementById("game-over-screen"),
    leaderboard: document.getElementById("leaderboard-screen"),
    tapHint: document.getElementById("tap-hint"),
    comboToast: document.getElementById("combo-toast"),
    dangerToast: document.getElementById("danger-toast"),
    dangerMeter: document.getElementById("danger-meter"),
    dangerLabel: document.getElementById("danger-label"),
    dangerSlots: Array.from(document.querySelectorAll("#danger-slots span")),
    heightSideBadge: document.getElementById("height-side-badge"),
    heightSideValue: document.getElementById("height-side-value"),
    timer: document.getElementById("timer-text"),
    score: document.getElementById("score-text"),
    combo: document.getElementById("combo-text"),
    heightFill: document.getElementById("height-fill"),
    heightText: document.getElementById("height-text"),
    finalScore: document.getElementById("final-score"),
    finalHeight: document.getElementById("final-height"),
    finalCombo: document.getElementById("final-combo"),
    finalPerfects: document.getElementById("final-perfects"),
    gameOverTitle: document.getElementById("game-over-title"),
    gameOverKicker: document.getElementById("game-over-kicker"),
    gameOverReason: document.getElementById("game-over-reason"),
    leaderboardList: document.getElementById("leaderboard-list")
  };

  const gameState = {
    scene: null,
    phase: "menu",
    score: 0,
    combo: 0,
    bestCombo: 0,
    perfects: 0,
    fallenParcels: 0,
    currentHeight: 0,
    maxHeight: 0,
    stackTopY: 0,
    timeLeft: CONFIG.durationSeconds,
    soundEnabled: true,
    endedBy: "timer"
  };

  const hudCache = {
    timer: "",
    score: "",
    combo: "",
    height: "",
    heightWidth: "",
    heightTop: "",
    fallen: "",
    warning: false
  };

  function showOnly(screen) {
    [UI.start, UI.gameOver, UI.leaderboard].forEach((element) => element.classList.add("hidden"));
    if (screen) screen.classList.remove("hidden");
  }

  function setHudVisible(visible) {
    UI.hud.classList.toggle("hidden", !visible);
    UI.tapHint.classList.toggle("hidden", !visible);
    if (!visible) UI.heightSideBadge.classList.add("hidden");
  }

  function updateHud() {
    const timer = Math.max(0, Math.ceil(gameState.timeLeft)).toString();
    const score = gameState.score.toLocaleString();
    const combo = `x${getComboMultiplier()}`;
    const height = Math.floor(gameState.currentHeight).toString();
    const heightWidth = `${Math.min(100, (gameState.currentHeight / CONFIG.maxHeightForMeter) * 100)}%`;
    const heightTop = `${Phaser.Math.Clamp(gameState.stackTopY, 150, window.innerHeight - 160)}px`;
    const fallen = `${gameState.fallenParcels}/${CONFIG.collapseFallenLimit}`;
    const warning = gameState.fallenParcels >= CONFIG.collapseFallenLimit - 1;

    if (hudCache.timer !== timer) {
      hudCache.timer = timer;
      UI.timer.textContent = timer;
    }
    if (hudCache.score !== score) {
      hudCache.score = score;
      UI.score.textContent = score;
    }
    if (hudCache.combo !== combo) {
      hudCache.combo = combo;
      UI.combo.textContent = combo;
    }
    if (hudCache.height !== height) {
      hudCache.height = height;
      UI.heightText.textContent = height;
      UI.heightSideValue.textContent = height;
      UI.heightSideBadge.classList.toggle("hidden", gameState.phase !== "playing" || gameState.currentHeight <= 0);
    }
    if (hudCache.heightWidth !== heightWidth) {
      hudCache.heightWidth = heightWidth;
      UI.heightFill.style.width = heightWidth;
    }
    if (hudCache.heightTop !== heightTop) {
      hudCache.heightTop = heightTop;
      UI.heightSideBadge.style.top = heightTop;
    }
    if (hudCache.fallen !== fallen) {
      hudCache.fallen = fallen;
      UI.dangerLabel.textContent = `Dropped Parcels ${fallen}`;
      UI.dangerSlots.forEach((slot, index) => {
        slot.classList.toggle("lost", index < gameState.fallenParcels);
      });
    }
    if (hudCache.warning !== warning) {
      hudCache.warning = warning;
      UI.dangerMeter.classList.toggle("warning", warning);
    }
  }

  function syncDangerSlots() {
    if (UI.dangerSlots.length === CONFIG.collapseFallenLimit) return;
    const slots = [];
    for (let i = 0; i < CONFIG.collapseFallenLimit; i += 1) {
      slots.push("<span></span>");
    }
    document.getElementById("danger-slots").innerHTML = slots.join("");
    document.getElementById("danger-slots").style.setProperty("--danger-slots", CONFIG.collapseFallenLimit);
    UI.dangerSlots = Array.from(document.querySelectorAll("#danger-slots span"));
  }

  function resetHudCache() {
    Object.keys(hudCache).forEach((key) => {
      hudCache[key] = key === "warning" ? null : "";
    });
  }

  function toast(text) {
    UI.comboToast.textContent = text;
    UI.comboToast.classList.remove("hidden");
    UI.comboToast.style.animation = "none";
    UI.comboToast.offsetHeight;
    UI.comboToast.style.animation = "";
    window.setTimeout(() => UI.comboToast.classList.add("hidden"), 760);
  }

  function dangerToast(text) {
    UI.dangerToast.textContent = text;
    UI.dangerToast.classList.remove("hidden");
    UI.dangerToast.style.animation = "none";
    UI.dangerToast.offsetHeight;
    UI.dangerToast.style.animation = "";
    window.setTimeout(() => UI.dangerToast.classList.add("hidden"), 960);
  }

  function getComboMultiplier() {
    if (gameState.combo >= 10) return 7;
    if (gameState.combo >= 7) return 5;
    if (gameState.combo >= 4) return 3;
    if (gameState.combo >= 2) return 2;
    return 1;
  }

  function comboLabel() {
    if (gameState.combo >= 10) return "Parcel Legend!";
    if (gameState.combo >= 7) return "Warehouse Master!";
    if (gameState.combo >= 4) return "Perfect Stack!";
    if (gameState.combo >= 2) return "Smooth Loader!";
    return "";
  }

  function saveScore(result) {
    const previous = readLeaderboard();
    previous.push(result);
    previous.sort((a, b) => b.score - a.score || b.maxHeight - a.maxHeight || b.bestCombo - a.bestCombo);
    const next = previous.slice(0, 10);
    localStorage.setItem(CONFIG.leaderboardKey, JSON.stringify(next));
    const high = Number(localStorage.getItem(CONFIG.highScoreKey) || 0);
    if (result.score > high) localStorage.setItem(CONFIG.highScoreKey, String(result.score));

    if (typeof window.GametizeGame?.submitScore === "function") {
      window.GametizeGame.submitScore(result);
    }
    window.dispatchEvent(new CustomEvent("parcel-panic:score", { detail: result }));
  }

  function renderLeaderboard() {
    const scores = readLeaderboard();
    UI.leaderboardList.innerHTML = "";
    if (!scores.length) {
      const item = document.createElement("li");
      item.textContent = "No shifts logged yet.";
      UI.leaderboardList.appendChild(item);
      return;
    }
    scores.slice(0, 8).forEach((entry, index) => {
      const item = document.createElement("li");
      item.textContent = `${index + 1}. ${entry.score.toLocaleString()} pts - ${entry.maxHeight} high - x${entry.bestCombo}`;
      UI.leaderboardList.appendChild(item);
    });
  }

  function readLeaderboard() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG.leaderboardKey) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  class GameScene extends Phaser.Scene {
    constructor() {
      super("GameScene");
      this.parcels = [];
      this.currentParcel = null;
      this.dropper = null;
      this.platform = null;
      this.safeZone = null;
      this.platformZone = null;
      this.dropperDirection = 1;
      this.dropperSpeed = 190;
      this.nextSpawnAt = 0;
      this.gameTime = 0;
      this.lastGoldenAt = -999;
      this.lastSettledId = null;
      this.collapseWarningAt = 0;
      this.collapseFx = [];
      this.nextHudAt = 0;
      this.nextStackCheckAt = 0;
      this.nextCleanupAt = 0;
      this.frameSkip = 0;
    }

    preload() {}

    create() {
      gameState.scene = this;
      this.matter.world.setBounds(-200, -400, this.scale.width + 400, this.scale.height + 800, 96, true, true, false, false);
      this.matter.world.setGravity(0, 1.15);
      this.createTextures();
      this.createWarehouse();
      this.createPlatform();
      this.createDropper();
      this.input.on("pointerdown", this.handleTap, this);
      this.events.on("resume-gameplay", this.startRun, this);
      this.startMenuBackdrop();
      if (new URLSearchParams(window.location.search).has("autostart")) {
        this.time.delayedCall(250, startGame);
      }
    }

    startMenuBackdrop() {
      this.cleanupRun();
      this.spawnDisplayStack();
    }

    startRun() {
      this.cleanupRun();
      gameState.phase = "playing";
      gameState.score = 0;
      gameState.combo = 0;
      gameState.bestCombo = 0;
      gameState.perfects = 0;
      gameState.fallenParcels = 0;
      gameState.currentHeight = 0;
      gameState.maxHeight = 0;
      gameState.stackTopY = this.platformZone ? this.platformZone.top : this.scale.height - 132;
      gameState.timeLeft = CONFIG.durationSeconds;
      gameState.endedBy = "timer";
      this.gameTime = 0;
      this.lastGoldenAt = -999;
      this.lastSettledId = null;
      this.nextHudAt = 0;
      this.nextStackCheckAt = 0;
      this.nextCleanupAt = 0;
      this.cameras.main.setZoom(1);
      syncDangerSlots();
      resetHudCache();
      updateHud();
      this.spawnParcel();
      if (new URLSearchParams(window.location.search).has("autoplay")) {
        this.time.addEvent({
          delay: 520,
          callback: () => {
            if (gameState.phase === "playing") {
              this.handleTap({ event: { target: document.body } });
            }
          },
          repeat: 7
        });
      }
    }

    cleanupRun() {
      this.tweens.killAll();
      this.parcels.forEach((parcel) => parcel.destroy());
      this.parcels = [];
      this.collapseFx.forEach((effect) => effect.destroy());
      this.collapseFx = [];
      if (this.currentParcel) this.currentParcel.destroy();
      this.currentParcel = null;
      this.lastSettledId = null;
    }

    createTextures() {
      Object.entries(PARCEL_TYPES).forEach(([key, type]) => {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        const w = type.width;
        const h = type.height;
        g.fillStyle(0x0a0f1f, 1);
        g.fillRoundedRect(0, 0, w, h, 9);
        g.fillStyle(type.color, 1);
        g.fillRoundedRect(5, 5, w - 10, h - 10, 7);
        g.fillStyle(type.accent, 1);
        g.fillRect(w * 0.42, 5, Math.max(10, w * 0.15), h - 10);
        g.fillRect(8, h * 0.44, w - 16, Math.max(8, h * 0.12));
        g.fillStyle(0xffffff, type.golden ? 0.45 : 0.18);
        g.fillRoundedRect(12, 10, w * 0.22, h * 0.18, 3);
        g.lineStyle(3, 0x0a0f1f, 1);
        g.strokeRoundedRect(5, 5, w - 10, h - 10, 7);
        if (type.golden) {
          g.lineStyle(2, 0xffffff, 0.9);
          g.strokeCircle(w - 17, 17, 7);
          g.strokeCircle(17, h - 15, 5);
        }
        g.generateTexture(`parcel-${key}`, w, h);
        g.destroy();
      });

      const burst = this.make.graphics({ x: 0, y: 0, add: false });
      burst.fillStyle(0xffd928, 1);
      burst.lineStyle(5, 0x0a0f1f, 1);
      const points = [];
      for (let i = 0; i < 20; i += 1) {
        const radius = i % 2 === 0 ? 70 : 34;
        const angle = (Math.PI * 2 * i) / 20;
        points.push(new Phaser.Geom.Point(78 + Math.cos(angle) * radius, 78 + Math.sin(angle) * radius));
      }
      burst.fillPoints(points, true);
      burst.strokePoints(points, true);
      burst.generateTexture("burst", 156, 156);
      burst.destroy();
    }

    createWarehouse() {
      this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x111827);
      const wall = this.add.graphics();
      wall.fillStyle(0x172033, 1);
      wall.fillRect(0, 0, this.scale.width, this.scale.height);
      wall.fillStyle(0x26324a, 1);
      for (let y = 128; y < this.scale.height - 120; y += 86) {
        wall.fillRect(16, y, this.scale.width - 32, 9);
      }
      for (let x = 28; x < this.scale.width; x += 64) {
        wall.fillStyle(x % 128 === 28 ? 0x22304a : 0x1c2941, 1);
        wall.fillRect(x, 120, 28, this.scale.height - 210);
      }

      const dots = this.add.graphics();
      dots.fillStyle(0xffffff, 0.07);
      for (let y = 18; y < this.scale.height; y += 28) {
        for (let x = (y / 28) % 2 ? 10 : 0; x < this.scale.width; x += 28) {
          dots.fillCircle(x, y, 1.6);
        }
      }

      this.add.rectangle(this.scale.width / 2, this.scale.height - 54, this.scale.width, 108, 0x0a0f1f).setDepth(1);
      const floor = this.add.graphics().setDepth(2);
      floor.fillStyle(0xffd928, 1);
      for (let x = -40; x < this.scale.width + 80; x += 42) {
        floor.fillRect(x, this.scale.height - 112, 24, 16);
      }
      floor.fillStyle(0xff7a1a, 1);
      floor.fillRect(0, this.scale.height - 96, this.scale.width, 14);
    }

    createPlatform() {
      const y = this.scale.height - 132;
      const platformWidth = this.scale.width * CONFIG.platformWidthRatio;
      this.platform = this.matter.add.rectangle(this.scale.width / 2, y, platformWidth, 30, {
        isStatic: true,
        friction: 1,
        restitution: 0.02,
        label: "platform"
      });
      const platformSprite = this.add.rectangle(this.scale.width / 2, y, platformWidth, 30, 0xff7a1a).setDepth(5);
      platformSprite.setStrokeStyle(5, 0x0a0f1f);
      this.add.rectangle(this.scale.width / 2, y + 21, this.scale.width * 0.9, 16, 0x0a0f1f).setDepth(4);
      this.safeZone = {
        left: this.scale.width * 0.1,
        right: this.scale.width * 0.9,
        bottom: this.scale.height + 120
      };
      this.platformZone = {
        left: this.scale.width / 2 - platformWidth / 2,
        right: this.scale.width / 2 + platformWidth / 2,
        top: y - 15,
        bottom: y + 48
      };
    }

    createDropper() {
      this.dropper = this.add.container(this.scale.width / 2, 150).setDepth(18);
      const rail = this.add.rectangle(0, 0, 94, 12, 0x35d5ff);
      rail.setStrokeStyle(3, 0x0a0f1f);
      const hook = this.add.rectangle(0, 22, 10, 34, 0xffd928);
      hook.setStrokeStyle(3, 0x0a0f1f);
      this.dropper.add([rail, hook]);
    }

    spawnDisplayStack() {
      const baseY = this.scale.height - 182;
      const types = ["medium", "small", "heavy", "small", "golden"];
      types.forEach((key, index) => {
        const type = PARCEL_TYPES[key];
        const parcel = this.add.image(this.scale.width / 2 + (index % 2 ? 18 : -16), baseY - index * 48, `parcel-${key}`);
        parcel.setDepth(10).setAngle(index % 2 ? 7 : -5);
        this.tweens.add({
          targets: parcel,
          angle: parcel.angle * -1,
          duration: 850 + index * 120,
          ease: "Sine.inOut",
          yoyo: true,
          repeat: -1
        });
        this.parcels.push(parcel);
      });
    }

    update(time, delta) {
      if (gameState.phase !== "playing") {
        this.animateDropper(delta, 0.45);
        return;
      }

      const dt = delta / 1000;
      this.gameTime += dt;
      gameState.timeLeft -= dt;
      this.animateDropper(delta, 1);
      this.updateDifficulty();
      this.updateCurrentParcel();
      if (time >= this.nextStackCheckAt) {
        this.nextStackCheckAt = time + CONFIG.stackUpdateMs;
        this.updateStackStats();
        this.checkCollapse();
      }
      if (time >= this.nextCleanupAt) {
        this.nextCleanupAt = time + CONFIG.cleanupMs;
        this.pruneParcels();
      }
      if (time >= this.nextHudAt) {
        this.nextHudAt = time + CONFIG.hudUpdateMs;
        updateHud();
      }

      if (gameState.timeLeft <= 0) {
        this.endRun("timer");
      }
    }

    animateDropper(delta, intensity) {
      const margin = 58;
      this.dropper.x += this.dropperDirection * this.dropperSpeed * intensity * (delta / 1000);
      if (this.dropper.x > this.scale.width - margin) {
        this.dropper.x = this.scale.width - margin;
        this.dropperDirection = -1;
      } else if (this.dropper.x < margin) {
        this.dropper.x = margin;
        this.dropperDirection = 1;
      }
      this.dropper.y = 144 + Math.sin(this.time.now / 180) * 3;
    }

    updateDifficulty() {
      const progress = 1 - gameState.timeLeft / CONFIG.durationSeconds;
      const heightPressure = Math.min(1, gameState.maxHeight / 18);
      this.dropperSpeed = 125 + progress * 155 + heightPressure * 55;
    }

    updateCurrentParcel() {
      if (!this.currentParcel || this.currentParcel.dropped) return;
      this.currentParcel.setPosition(this.dropper.x, this.dropper.y + 56);
      this.currentParcel.rotation = Math.sin(this.time.now / 210) * 0.05;
    }

    chooseParcelType() {
      const progress = 1 - gameState.timeLeft / CONFIG.durationSeconds;
      const table = [
        ["small", 0.52 - progress * 0.12],
        ["medium", 0.37 - progress * 0.06],
        ["heavy", 0.05 + progress * 0.2],
        ["golden", this.gameTime - this.lastGoldenAt > 9 ? 0.06 : 0]
      ];
      const total = table.reduce((sum, item) => sum + Math.max(0, item[1]), 0);
      let roll = Math.random() * total;
      for (const [key, weight] of table) {
        roll -= Math.max(0, weight);
        if (roll <= 0) return key;
      }
      return "medium";
    }

    spawnParcel() {
      if (gameState.phase !== "playing") return;
      const key = this.chooseParcelType();
      if (key === "golden") this.lastGoldenAt = this.gameTime;
      const type = PARCEL_TYPES[key];
      const body = this.matter.add.image(this.dropper.x, this.dropper.y + 56, `parcel-${key}`, null, {
        isStatic: false,
        isSensor: true,
        label: `parcel-${key}`,
        chamfer: { radius: 6 },
        friction: type.friction,
        frictionAir: 0.026,
        restitution: type.restitution,
        density: type.density,
        sleepThreshold: 45
      });
      body.setDepth(type.golden ? 16 : 15);
      body.setData("typeKey", key);
      body.setData("settled", false);
      body.setData("scored", false);
      body.setData("lost", false);
      body.setData("id", Phaser.Math.RND.uuid());
      body.setIgnoreGravity(true);
      body.setVelocity(0, 0);
      body.setAngularVelocity(0);
      if (type.golden) {
        body.setTint(0xfff2a8);
        body.setData("glowTween", this.tweens.add({
          targets: body,
          alpha: 0.72,
          duration: 180,
          yoyo: true,
          repeat: -1
        }));
      }
      this.currentParcel = body;
    }

    handleTap(pointer) {
      if (pointer.event?.target?.tagName === "BUTTON") return;
      if (gameState.phase !== "playing" || !this.currentParcel || this.currentParcel.dropped) return;

      const parcel = this.currentParcel;
      const type = PARCEL_TYPES[parcel.getData("typeKey")];
      const glowTween = parcel.getData("glowTween");
      if (glowTween) {
        glowTween.stop();
        parcel.setAlpha(1);
        parcel.setData("glowTween", null);
      }
      this.applyAlignmentAssist(parcel);
      parcel.dropped = true;
      parcel.setIgnoreGravity(false);
      parcel.setSensor(false);
      Phaser.Physics.Matter.Matter.Sleeping.set(parcel.body, false);
      parcel.setVelocity(this.dropperDirection * Phaser.Math.FloatBetween(0.08, 0.36), 2.55);
      parcel.setAngularVelocity(Phaser.Math.FloatBetween(-0.009, 0.009));
      this.parcels.push(parcel);
      this.currentParcel = null;
      this.playTone(type.golden ? 720 : 420, 0.055, "square", 0.05);
      this.time.delayedCall(820, () => this.evaluateDrop(parcel));
      this.time.delayedCall(250, () => this.spawnParcel());
    }

    pruneParcels() {
      const removable = [];
      this.parcels.forEach((parcel) => {
        if (!parcel.body) {
          removable.push(parcel);
          return;
        }
        const farOffscreen = parcel.y > this.safeZone.bottom + 220 || parcel.x < -220 || parcel.x > this.scale.width + 220;
        if (parcel.getData("lost") || farOffscreen) removable.push(parcel);
      });

      while (this.parcels.length - removable.length > CONFIG.maxActiveParcels) {
        const candidate = this.parcels.find((parcel) => (
          parcel.body &&
          parcel.dropped &&
          parcel.y > this.platformZone.top - 20 &&
          !removable.includes(parcel)
        ));
        if (!candidate) break;
        removable.push(candidate);
      }

      removable.forEach((parcel) => {
        const tween = parcel.getData && parcel.getData("glowTween");
        if (tween) tween.stop();
        parcel.destroy();
      });
      if (removable.length) {
        this.parcels = this.parcels.filter((parcel) => parcel.active);
      }
    }

    applyAlignmentAssist(parcel) {
      const targetX = this.getStackTargetX();
      const distance = Math.abs(parcel.x - targetX);
      if (distance > CONFIG.alignmentAssistRange) return;
      const assistedX = Phaser.Math.Linear(parcel.x, targetX, CONFIG.alignmentAssistStrength);
      parcel.setPosition(assistedX, parcel.y);
    }

    getStackTargetX() {
      const activeParcels = this.parcels.filter((parcel) => parcel.body && parcel.y < this.scale.height - 120);
      if (!activeParcels.length) return this.scale.width / 2;
      const highestParcel = activeParcels.reduce((highest, parcel) => (
        parcel.y < highest.y ? parcel : highest
      ), activeParcels[0]);
      return Phaser.Math.Clamp(highestParcel.x, this.scale.width * 0.18, this.scale.width * 0.82);
    }

    evaluateDrop(parcel) {
      if (gameState.phase !== "playing" || !parcel.active || parcel.getData("scored")) return;
      const key = parcel.getData("typeKey");
      const type = PARCEL_TYPES[key];
      const platformCenter = this.scale.width / 2;
      const offset = Math.abs(parcel.x - platformCenter);
      const normalized = offset / (this.scale.width * 0.32);
      const tilt = Math.abs(Phaser.Math.Angle.Wrap(parcel.rotation));
      const speed = Math.hypot(parcel.body.velocity.x, parcel.body.velocity.y);
      const stable = speed < 3.8 && tilt < 0.86 && parcel.y < this.safeZone.bottom;

      let quality = "drop";
      let earned = type.points;
      if (normalized < 0.11 && stable) {
        quality = "perfect";
        earned += 25;
        gameState.perfects += 1;
      } else if (normalized < 0.24 && stable) {
        quality = "good";
        earned += 15;
      } else if (stable) {
        quality = "stable";
        earned += 8;
      }

      if (stable) {
        gameState.combo += 1;
        gameState.bestCombo = Math.max(gameState.bestCombo, gameState.combo);
        earned *= getComboMultiplier();
      } else {
        gameState.combo = 0;
      }

      gameState.score += earned;
      parcel.setData("scored", true);
      this.showScorePopup(parcel.x, parcel.y - 36, `+${earned}`, quality);

      if (quality === "perfect") {
        this.showBurst(parcel.x, parcel.y, "PERFECT!");
        this.playTone(880, 0.08, "triangle", 0.07);
        this.cameras.main.flash(90, 255, 218, 40, false);
      } else if (stable) {
        this.playTone(520, 0.055, "triangle", 0.045);
      } else {
        this.warnWobble();
      }

      const label = comboLabel();
      if (label && [2, 4, 7, 10].includes(gameState.combo)) {
        toast(label);
      }
    }

    showScorePopup(x, y, text, quality) {
      const color = quality === "perfect" ? "#ffd928" : quality === "drop" ? "#ffffff" : "#58f188";
      const label = this.add.text(x, y, text, {
        fontFamily: "Impact, Arial Black, sans-serif",
        fontSize: "30px",
        color,
        stroke: "#0a0f1f",
        strokeThickness: 6
      }).setOrigin(0.5).setDepth(40);
      this.tweens.add({
        targets: label,
        y: y - 62,
        scale: 1.15,
        alpha: 0,
        duration: 720,
        ease: "Cubic.out",
        onComplete: () => label.destroy()
      });
    }

    showBurst(x, y, text) {
      const burst = this.add.image(x, y, "burst").setDepth(35).setScale(0.35).setAlpha(0.95);
      const label = this.add.text(x, y, text, {
        fontFamily: "Impact, Arial Black, sans-serif",
        fontSize: "24px",
        color: "#ffffff",
        stroke: "#0a0f1f",
        strokeThickness: 5
      }).setOrigin(0.5).setDepth(36);
      this.tweens.add({
        targets: [burst, label],
        scale: 1.05,
        alpha: 0,
        angle: 12,
        duration: 520,
        ease: "Back.out",
        onComplete: () => {
          burst.destroy();
          label.destroy();
        }
      });
    }

    updateStackStats() {
      const stackParcels = this.getStackParcels();
      const baseY = this.platformZone.top;

      if (!stackParcels.length) {
        gameState.currentHeight = 0;
        gameState.stackTopY = baseY;
        return;
      }

      const highestY = Math.min(...stackParcels.map((parcel) => parcel.y - parcel.displayHeight / 2));
      const pixelHeight = Math.max(0, baseY - highestY);
      const height = Math.max(1, Math.ceil(pixelHeight / 54));
      gameState.currentHeight = height;
      gameState.stackTopY = highestY;

      if (height > gameState.maxHeight) {
        gameState.maxHeight = height;
        if (height > 0 && height % 5 === 0) {
          gameState.score += 50;
          toast(`${height} High!`);
        }
      }
    }

    getStackParcels() {
      if (!this.platformZone) return [];
      return this.parcels.filter((parcel) => {
        if (!parcel.body || parcel.getData("lost") || !parcel.dropped) return false;
        const halfWidth = parcel.displayWidth * 0.5;
        const halfHeight = parcel.displayHeight * 0.5;
        const overlapsPlatform =
          parcel.x + halfWidth > this.platformZone.left &&
          parcel.x - halfWidth < this.platformZone.right;
        const notBelowDock = parcel.y - halfHeight < this.platformZone.bottom;
        const speed = Math.hypot(parcel.body.velocity.x, parcel.body.velocity.y);
        const settledEnough = speed < 2.6 || parcel.y + halfHeight > this.platformZone.top;
        return overlapsPlatform && notBelowDock && settledEnough;
      });
    }

    checkCollapse() {
      this.parcels.forEach((parcel) => {
        if (!parcel.body || parcel.getData("lost")) return;
        const isLost = this.isParcelLost(parcel);
        if (!isLost) return;
        parcel.setData("lost", true);
        this.registerLostParcel(parcel);
      });

      const fallen = gameState.fallenParcels;

      const violent = this.parcels.some((parcel) => (
        parcel.body &&
        parcel.y < this.scale.height - 120 &&
        Math.abs(Phaser.Math.Angle.Wrap(parcel.rotation)) > CONFIG.collapseTilt &&
        Math.hypot(parcel.body.velocity.x, parcel.body.velocity.y) > 3.2
      ));

      if (violent && this.time.now - this.collapseWarningAt > 900) {
        this.warnWobble();
      }

      if (fallen >= CONFIG.collapseFallenLimit) {
        this.endRun("collapse");
      }
    }

    isParcelLost(parcel) {
      const halfWidth = parcel.displayWidth * 0.5;
      const halfHeight = parcel.displayHeight * 0.5;
      const clearlyBelowPlatform = parcel.y - halfHeight > this.platformZone.bottom;
      const missedPlatformSide =
        parcel.x + halfWidth < this.platformZone.left ||
        parcel.x - halfWidth > this.platformZone.right;

      return (
        parcel.y > this.safeZone.bottom ||
        parcel.x < -80 ||
        parcel.x > this.scale.width + 80 ||
        (clearlyBelowPlatform && missedPlatformSide)
      );
    }

    registerLostParcel(parcel) {
      gameState.fallenParcels = Math.min(CONFIG.collapseFallenLimit, gameState.fallenParcels + 1);
      const remaining = Math.max(0, CONFIG.collapseFallenLimit - gameState.fallenParcels);
      gameState.combo = 0;
      updateHud();
      this.showLostParcelFx(parcel.x, Phaser.Math.Clamp(parcel.y, this.scale.height * 0.62, this.scale.height - 84), remaining);
      this.playTone(120, 0.14, "sawtooth", 0.06);

      if (remaining <= 0) {
        dangerToast("Last parcel lost!");
      } else if (remaining === 1) {
        dangerToast("Danger! 1 left");
      } else {
        dangerToast(`Parcel lost! ${remaining} left`);
      }
    }

    showLostParcelFx(x, y, remaining) {
      this.cameras.main.shake(170, 0.012);
      this.cameras.main.flash(90, 255, 61, 46, false);

      const marker = this.add.text(
        Phaser.Math.Clamp(x, 74, this.scale.width - 74),
        y,
        remaining > 0 ? `LOST! ${remaining} LEFT` : "COLLAPSE!",
        {
          fontFamily: "Impact, Arial Black, sans-serif",
          fontSize: remaining <= 1 ? "32px" : "26px",
          color: remaining <= 1 ? "#ff3d2e" : "#ffd928",
          stroke: "#0a0f1f",
          strokeThickness: 7,
          align: "center"
        }
      ).setOrigin(0.5).setDepth(65).setAngle(Phaser.Math.FloatBetween(-5, 5));

      const arrow = this.add.triangle(marker.x, marker.y + 44, 0, 0, 26, 0, 13, 28, 0xff3d2e, 1)
        .setDepth(64)
        .setStrokeStyle(4, 0x0a0f1f);

      this.tweens.add({
        targets: [marker, arrow],
        y: "-=44",
        alpha: 0,
        scale: 1.12,
        duration: 980,
        ease: "Cubic.out",
        onComplete: () => {
          marker.destroy();
          arrow.destroy();
        }
      });
    }

    warnWobble() {
      this.collapseWarningAt = this.time.now;
      gameState.combo = 0;
      this.cameras.main.shake(140, 0.01);
      toast("Wobble Warning!");
      this.playTone(150, 0.12, "sawtooth", 0.045);
    }

    endRun(reason) {
      if (gameState.phase !== "playing") return;
      gameState.phase = "ended";
      gameState.endedBy = reason;
      if (this.currentParcel) {
        this.currentParcel.destroy();
        this.currentParcel = null;
      }
      this.cameras.main.shake(reason === "collapse" ? 420 : 110, reason === "collapse" ? 0.018 : 0.006);
      if (reason === "collapse") {
        this.showCollapseSequence();
        this.playTone(88, 0.28, "sawtooth", 0.08);
      }
      this.time.delayedCall(reason === "collapse" ? 1550 : 260, () => {
        this.matter.world.engine.timing.timeScale = 1;
        finishGame(reason);
      });
    }

    showCollapseSequence() {
      this.matter.world.engine.timing.timeScale = 0.55;
      this.cameras.main.flash(180, 255, 35, 25, false);
      this.cameras.main.shake(700, 0.028);

      this.parcels.forEach((parcel, index) => {
        if (!parcel.body) return;
        Phaser.Physics.Matter.Matter.Sleeping.set(parcel.body, false);
        parcel.setTint(index % 2 ? 0xffdf5c : 0xff6b47);
        parcel.setVelocity(
          Phaser.Math.FloatBetween(-5.5, 5.5),
          Phaser.Math.FloatBetween(-7.5, -2.2)
        );
        parcel.setAngularVelocity(Phaser.Math.FloatBetween(-0.18, 0.18));
      });

      const redWash = this.add.rectangle(
        this.scale.width / 2,
        this.scale.height / 2,
        this.scale.width,
        this.scale.height,
        0xff1f2d,
        0.34
      ).setDepth(80);

      const dangerBand = this.add.rectangle(
        this.scale.width / 2,
        this.scale.height * 0.42,
        this.scale.width + 40,
        132,
        0xffd928,
        0.96
      ).setDepth(81).setAngle(-4);
      dangerBand.setStrokeStyle(8, 0x0a0f1f);

      const boom = this.add.text(this.scale.width / 2, this.scale.height * 0.36, "BOOM!", {
        fontFamily: "Impact, Arial Black, sans-serif",
        fontSize: `${Math.min(94, Math.max(64, this.scale.width * 0.19))}px`,
        color: "#ffffff",
        stroke: "#0a0f1f",
        strokeThickness: 10
      }).setOrigin(0.5).setDepth(82).setAngle(-6);

      const collapseText = this.add.text(this.scale.width / 2, this.scale.height * 0.47, "TOWER COLLAPSE", {
        fontFamily: "Impact, Arial Black, sans-serif",
        fontSize: `${Math.min(42, Math.max(30, this.scale.width * 0.085))}px`,
        color: "#ff3d2e",
        stroke: "#0a0f1f",
        strokeThickness: 7
      }).setOrigin(0.5).setDepth(82).setAngle(-4);

      const reasonText = this.add.text(this.scale.width / 2, this.scale.height * 0.54, "Too many parcels fell out!", {
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#0a0f1f",
        align: "center"
      }).setOrigin(0.5).setDepth(82).setAngle(-4);

      this.collapseFx = [redWash, dangerBand, boom, collapseText, reasonText];

      this.tweens.add({
        targets: [dangerBand, boom, collapseText, reasonText],
        scale: { from: 0.78, to: 1 },
        duration: 210,
        ease: "Back.out"
      });

      this.tweens.add({
        targets: redWash,
        alpha: 0,
        delay: 980,
        duration: 420,
        onComplete: () => redWash.destroy()
      });
    }

    playTone(frequency, duration, type, gain) {
      if (!gameState.soundEnabled || !window.AudioContext && !window.webkitAudioContext) return;
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!this.audioContext) this.audioContext = new AudioCtor();
      const ctx = this.audioContext;
      const osc = ctx.createOscillator();
      const volume = ctx.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      volume.gain.setValueAtTime(gain, ctx.currentTime);
      volume.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(volume);
      volume.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    }
  }

  function finishGame(reason) {
    setHudVisible(false);
    const result = {
      gameId: "parcel-panic",
      campaignId: CONFIG.campaignId || "default",
      playerId: CONFIG.playerId || "guest",
      score: gameState.score,
      maxHeight: Math.floor(gameState.maxHeight),
      bestCombo: gameState.bestCombo,
      perfectDrops: gameState.perfects,
      duration: CONFIG.durationSeconds,
      endedBy: reason,
      timestamp: new Date().toISOString()
    };
    saveScore(result);
    UI.finalScore.textContent = result.score.toLocaleString();
    UI.finalHeight.textContent = result.maxHeight.toString();
    UI.finalCombo.textContent = `x${result.bestCombo}`;
    UI.finalPerfects.textContent = result.perfectDrops.toString();
    UI.gameOver.classList.toggle("collapse", reason === "collapse");
    UI.gameOverKicker.textContent = reason === "collapse" ? "Drop Limit Reached" : "Shift Complete";
    UI.gameOverTitle.textContent = reason === "collapse" ? "Loading Failed!" : "Nice Loading!";
    UI.gameOverReason.textContent = reason === "collapse"
      ? "Too many parcels fell out of the safe zone. Watch the dropped-parcels meter."
      : "Shift complete. Nice stacking.";
    showOnly(UI.gameOver);
  }

  function startGame() {
    if (!gameState.scene) return;
    showOnly(null);
    setHudVisible(true);
    gameState.scene.events.emit("resume-gameplay");
  }

  function openLeaderboard() {
    renderLeaderboard();
    showOnly(UI.leaderboard);
    setHudVisible(false);
  }

  function shareScore() {
    const text = `I scored ${gameState.score.toLocaleString()} in Parcel Panic with a x${gameState.bestCombo} combo.`;
    if (navigator.share) {
      navigator.share({ title: "Parcel Panic", text }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast("Score Copied!"));
    } else {
      toast(text);
    }
  }

  function boot() {
    if (!window.Phaser) {
      document.body.innerHTML = "<p style='color:white;padding:24px;font-family:Arial'>Phaser failed to load. Please check the deployment network or bundle Phaser locally.</p>";
      return;
    }

    const phaserConfig = {
      type: Phaser.AUTO,
      parent: "game-container",
      backgroundColor: "#111827",
      resolution: 1,
      scale: {
        mode: Phaser.Scale.RESIZE,
        parent: "game-container",
        width: window.innerWidth,
        height: window.innerHeight
      },
      physics: {
        default: "matter",
        matter: {
          debug: false,
          enableSleeping: true,
          positionIterations: 4,
          velocityIterations: 3,
          constraintIterations: 2
        }
      },
      render: {
        antialias: false,
        pixelArt: false,
        roundPixels: false
      },
      scene: [GameScene]
    };

    new Phaser.Game(phaserConfig);

    document.getElementById("start-button").addEventListener("click", startGame);
    document.getElementById("replay-button").addEventListener("click", startGame);
    document.getElementById("leaderboard-button").addEventListener("click", openLeaderboard);
    document.getElementById("close-leaderboard-button").addEventListener("click", () => showOnly(UI.start));
    document.getElementById("share-button").addEventListener("click", shareScore);
    document.getElementById("sound-button").addEventListener("click", (event) => {
      gameState.soundEnabled = !gameState.soundEnabled;
      event.currentTarget.textContent = gameState.soundEnabled ? "SFX" : "OFF";
    });
  }

  window.addEventListener("load", boot);
})();
