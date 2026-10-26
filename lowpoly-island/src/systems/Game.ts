/**
 * The game orchestrator: owns the renderer, the scene, all systems and the
 * main loop.
 */

import * as THREE from 'three';
import { CAMERA, INTERACTION, INVENTORY, PLAYER, SAVE, WORLD, WORLD_LAYOUT } from '../config';
import { World } from '../world/WorldBuilder';
import { Player } from '../entities/Player';
import { CameraController, type CameraObstacle } from './CameraController';
import { InputSystem } from './InputSystem';
import { Inventory } from './InventorySystem';
import { CraftingSystem } from './CraftingSystem';
import { BuildingSystem } from './BuildingSystem';
import { DecorationSystem } from './DecorationSystem';
import { FishingSystem } from './FishingSystem';
import { InteriorSystem } from './InteriorSystem';
import { MarketSystem } from './MarketSystem';
import { StaminaSystem, STAMINA, staminaCeiling } from './StaminaSystem';
import { SatietySystem, SATIETY, type SatietyState } from './SatietySystem';
import { StorageSystem } from './StorageSystem';
import { TimeSystem, PHASE_LABELS, WEATHER_LABELS, type DayPhase, type Weather } from './TimeSystem';
import { TrustSystem, TRUST_MAX, type NpcId } from './TrustSystem';
import { WardrobeSystem } from './WardrobeSystem';
import {
  QuestSystem,
  QUESTS,
  countFor,
  type QuestId,
  type QuestStatus,
} from './QuestSystem';
import { SaveSystem, createBrowserStorage, type SaveData } from './SaveSystem';
import {
  findInteractionTarget,
  type Interactable,
} from './InteractionSystem';
import { GameUI, type ToolCard } from '../ui/GameUI';
import { audio, type MusicMood } from '../audio/AudioSystem';
import { getItem } from '../data/items';
import { FISH, getFish } from '../data/fish';
import { HINTS } from '../data/dialogue';
import {
  BUYERS,
  shopFor,
  getShopEntry,
  isToolId,
  TOOL_LEVELS,
  shellPrice,
  SURPLUS_PRICES,
  trustDiscount,
  trustRewardFor,
} from '../data/shop';
import {
  EXPANSIONS,
  getExpansion,
  getFurniture,
  type ExpansionId,
  type FurnitureSlot,
} from '../data/interior';
import {
  DECORATIONS,
  DECORATION_SLOTS,
  SLOT_ICONS,
  getDecoration,
  getSlot,
  MAX_COZINESS,
} from '../data/decorations';
import {
  buildChatter,
  buildDialogue,
  getNpc,
  NPCS,
  type DialogueChoice,
  type DialogueContext,
  type DialogueNode,
  type NpcDef,
} from '../data/npcs';
import type { ResourceNode } from '../world/ResourceField';
import { heightAt } from '../world/terrain';
import { createPost, type PostProcess } from '../world/PostProcess';
import { FOG } from '../world/palette';

/** What it costs to be fished out of the lake by Nell. */
const RESCUE_FEE = 10;

const DIALOGUE_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  /** The grade-and-grain pass every frame goes through. */
  private readonly post: PostProcess;
  private readonly input: InputSystem;
  private readonly cameraController: CameraController;
  private readonly inventory = new Inventory();
  private readonly crafting = new CraftingSystem();
  private readonly building = new BuildingSystem();
  private readonly decorations = new DecorationSystem();
  private readonly fishing = new FishingSystem(WORLD.seed + 31);
  private readonly interior = new InteriorSystem();
  private readonly market = new MarketSystem();
  /** The sound system — exposed so the state can be inspected. */
  readonly audioSystem = audio;
  /** The chest at home. */
  private readonly storage = new StorageSystem();
  private readonly wardrobe = new WardrobeSystem();
  private readonly trust = new TrustSystem();
  private readonly time = new TimeSystem();
  private readonly stamina = new StaminaSystem();
  /** How well fed the traveller is. */
  private readonly satiety = new SatietySystem();
  /** Nights spent awake in a row. Each one lowers the stamina ceiling. */
  private sleepDebt = 0;
  /** The last hunger state, so the change can be spotted. */
  private lastHungerState: SatietyState = 'full';
  /** Whether the player has been warned about sleeping in the daytime. */
  private restWarned = false;
  /** How long the traveller has been in the water with nothing left. */
  private drowningTimer = 0;
  /** Whether the "you are running out of strength" warning has been shown. */
  private exhaustedWarned = false;
  /** The lines of the rescue scene, shown one at a time. */
  private rescueLines: string[] = [];
  /** Which line of the rescue scene is showing. */
  private rescueIndex = 0;
  private readonly quests = new QuestSystem();
  private readonly saveSystem: SaveSystem;
  private readonly ui: GameUI;

  private world!: World;
  private player!: Player;
  private resourceNodes: ResourceNode[] = [];

  private flags: Record<string, boolean> = {};
  private booted = false;
  private running = false;
  private rafId = 0;
  private lastTime = 0;
  private elapsed = 0;
  private playTime = 0;
  private autosaveTimer = 0;
  private currentTarget: Interactable | null = null;
  private dialogueNpc: NpcDef | null = null;
  private dialogueQuest: QuestId | null = null;
  private currentDialogue: DialogueNode | null = null;
  private resetArmedAt = 0;
  private readonly cameraObstacles: CameraObstacle[] = [];
  /** Line ids already used today, per villager. */
  private readonly usedLines = new Map<NpcId, Set<string>>();
  /** The day each villager was last talked to, so "first today" works. */
  private readonly lastTalkDay = new Map<NpcId, number>();
  /** Which villager's shop tab is open. */
  /** The villager currently being talked to. */
  private activeShopNpc: NpcId | null = null;
  /** True while the player is swimming. */
  private swimming = false;
  /** True while the player is under water. */

  constructor(canvas: HTMLCanvasElement, ui: GameUI) {
    this.ui = ui;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // The soft look wants filmic highlights instead of clipped white.
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(
      CAMERA.fov,
      window.innerWidth / window.innerHeight,
      CAMERA.near,
      CAMERA.far,
    );
    this.camera.position.set(0, 8, 12);

    this.post = createPost(
      this.renderer,
      window.innerWidth,
      window.innerHeight,
      this.renderer.getPixelRatio(),
    );

    this.input = new InputSystem(canvas);
    this.cameraController = new CameraController(this.camera);
    this.saveSystem = new SaveSystem(createBrowserStorage());

    this.wireUI();
    this.wireWindow();
  }

  // ------------------------------------------------------------------ setup

  /** Builds the world and shows the title screen. */
  async boot(): Promise<void> {
    this.ui.setLoadingText('正在抬起岛屿……');
    await nextFrame();

    this.world = new World(this.scene);
    this.resourceNodes = [...this.world.resources.nodes.values()];

    this.ui.setLoadingText('正在叫醒岛上的居民……');
    await nextFrame();

    this.player = new Player(WORLD_LAYOUT.spawn.x, WORLD_LAYOUT.spawn.z);
    this.scene.add(this.player.avatar.root);
    this.cameraController.snap(this.cameraFocus());

    this.ui.hideLoading();
    this.ui.showTitle(this.saveSystem.hasAnySave());
    this.updateObjective();
    this.updateStats();

    this.booted = true;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  private wireUI(): void {
    this.ui.onContinue = () => {
      if (!this.booted) return;
      const data = this.saveSystem.loadMostRecent();
      if (data) {
        this.applySave(data);
        this.ui.toast('欢迎回到岛上。', 'good');
      }
      this.beginPlay();
    };

    this.ui.onNewGame = () => {
      if (!this.booted) return;
      this.saveSystem.clear();
      this.resetState();
      this.ui.toast('一座崭新的岛在等你。', 'quest');
      this.beginPlay();
    };

    this.ui.onDialogueChoice = (choice) => this.handleDialogueChoice(choice);
    this.ui.onDialogueClose = () => {
      this.dialogueNpc = null;
      this.dialogueQuest = null;
      this.currentDialogue = null;
      this.input.setEnabled(true);
      this.input.clearActions();
      if (!this.ui.isPanelOpen) this.input.requestLock();
    };

    this.ui.onCraft = (recipeId) => this.craft(recipeId);
    this.ui.onBuild = () => this.buildStructure();
    this.ui.onRest = () => this.restAt();
    this.ui.onOpenInventory = () => {
      this.ui.closePanel();
      this.refreshInventory();
    };
    this.ui.onSellTool = (toolId) => this.sellTool(toolId);
    this.ui.onToggleSound = () => {
      audio.ensureStarted();
      this.ui.setSoundIcon(audio.toggleMute());
    };
    // Every button makes a small click.
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('button')) audio.play('click');
    });
    this.ui.onSellShell = (itemId) => this.sellShell(itemId);
    this.ui.onSellSurplus = (itemId) => this.sellSurplus(itemId);
    this.ui.onOpenStorage = () => this.openStorage();
    this.ui.onStore = (itemId) => this.storeItem(itemId);
    this.ui.onTake = (itemId) => this.takeItem(itemId);
    this.ui.onEat = (itemId) => this.eat(itemId);
    this.ui.onOpenPanel = (panel) => this.openPanelByName(panel);
    this.ui.onPanelClosed = () => {
      this.fishing.cancel();
      this.input.setEnabled(true);
      this.input.clearActions();
      this.input.requestLock();
    };
    this.ui.onCraftAtHome = () => {
      this.ui.closePanel();
      this.openCrafting();
    };
    this.ui.onDecorate = () => {
      this.ui.closePanel();
      this.openDecor();
    };
    this.ui.onBuy = (entryId) => this.buyEntry(entryId);
    this.ui.onSell = (fishId) => this.sellFish(fishId);
    this.ui.onPlaceFurniture = (id) => this.buyFurniture(id);
    this.ui.onRemoveFurniture = (slot) => this.removeFurniture(slot as FurnitureSlot);
    this.ui.onExpand = (id) => this.expandHut(id);
    this.ui.onCast = () => this.startFishing('sea');
    this.ui.onReel = () => this.reelIn();
    this.ui.onEndFishing = () => {
      this.fishing.cancel();
      this.closePanel();
    };
  }


  private wireWindow(): void {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('beforeunload', () => this.save());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save();
    });
  }

  private beginPlay(): void {
    // The browser only lets us start audio after a click.
    audio.ensureStarted();
    this.ui.hideTitle();
    this.input.setEnabled(true);
    this.input.requestLock();
  }

  private resetState(): void {
    this.inventory.clear();
    this.building.load({ built: [] });
    this.decorations.load(null);
    this.interior.load(null);
    this.wardrobe.load(null);
    this.market.reset();
    this.trust.load(null);
    this.time.load(null);
    this.stamina.load(null);
    this.world.clearInterior();
    this.applyBonuses();
    this.quests.load({ completed: [] });
    this.flags = {};
    this.playTime = 0;
    this.world.setHutBuilt(false);
    this.world.clearDecorations();
    for (const node of this.resourceNodes) {
      this.world.resources.restore(node);
    }
    this.player.setPosition(
      WORLD_LAYOUT.spawn.x,
      heightAt(WORLD_LAYOUT.spawn.x, WORLD_LAYOUT.spawn.z),
      WORLD_LAYOUT.spawn.z,
    );
    this.cameraController.yaw = 0;
    this.cameraController.pitch = 0.3;
    this.cameraController.snap(this.cameraFocus());
    this.updateObjective();
    this.updateStats();
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.post.resize(width, height, this.renderer.getPixelRatio());
  }

  // -------------------------------------------------------------- main loop

  private frame = (time: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.05, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    this.elapsed += dt;

    this.update(dt);
    this.post.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.frame);
  };

  private update(dt: number): void {
    const titleVisible = this.ui.isTitleVisible;
    const dialogueOpen = this.ui.isDialogueOpen;
    const panelOpen = this.ui.isPanelOpen;
    const interactive = !titleVisible && !dialogueOpen && !panelOpen;

    // --- Global hotkeys ---------------------------------------------------
    if (this.input.consume('toggleHelp')) this.ui.toggleHelp();
    if (this.input.consume('toggleInventory')) {
      if (this.ui.isPanelOpen) {
        this.closePanel();
      } else {
        this.refreshInventory();
        this.input.setEnabled(false);
        this.input.exitLock();
        this.input.clearActions();
      }
    }
    if (this.input.consume('closePanel')) {
      // Esc only closes a panel once the mouse is free. The first Esc just
      // releases the pointer, so the player can still click what is on
      // screen instead of having the panel yanked away from them.
      if (dialogueOpen) {
        if (this.input.isLocked) this.input.exitLock();
        else this.ui.hideDialogue();
      } else if (panelOpen) {
        if (this.input.isLocked) this.input.exitLock();
        else this.closePanel();
      }
    }
    if (this.input.consume('resetSave')) this.handleResetSave();
    if (this.input.consume('openSaves')) {
      if (this.ui.isPanelOpen) this.closePanel();
      else this.openSaves();
    }
    if (this.input.consume('openJournal')) {
      if (this.ui.isPanelOpen) this.closePanel();
      else this.openJournal();
    }

    // --- Mouse look -------------------------------------------------------
    const mouse = this.input.takeMouseDelta();
    if (interactive) this.cameraController.applyMouseDelta(mouse.x, mouse.y);

    // --- Movement ---------------------------------------------------------
    // The swimsuit has to be known before the player moves, so the water
    // rules can be applied.
    this.player.canSwim = this.wardrobe.canSwim;
    if (interactive) {
      const forwardInput = this.input.axis('KeyS', 'KeyW');
      const strafeInput = this.input.axis('KeyA', 'KeyD');
      const move = {
        x: this.cameraController.forwardX * forwardInput + this.cameraController.rightX * strafeInput,
        z: this.cameraController.forwardZ * forwardInput + this.cameraController.rightZ * strafeInput,
      };
      const sprint = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');
      const jump = this.input.consumeKey('Space');
      this.player.update(dt, move, sprint, jump, this.world.colliderHash);
    }

    // --- Mouse click ------------------------------------------------------
    const click = this.input.consumeClick();
    if (click) this.handleClick(click);

    // --- Dialogue keyboard shortcuts --------------------------------------
    if (dialogueOpen) this.handleDialogueKeys();

    // --- Camera -----------------------------------------------------------
    this.updateCameraObstacles();
    this.cameraController.update(dt, this.cameraFocus(), this.cameraObstacles);

    // --- Interaction ------------------------------------------------------
    if (interactive) {
      this.updateInteraction();
      if (this.input.consume('interact') && this.currentTarget) {
        this.interactWith(this.currentTarget);
      }
    } else {
      this.currentTarget = null;
      this.ui.setPrompt(null);
    }

    // --- Time, weather and stamina ----------------------------------------
    if (interactive) {
      const phase = this.time.update(dt);
      if (phase) {
        this.applyLighting();
        if (phase === 'morning') {
          // A new day: the villagers can greet you again.
          this.usedLines.clear();
          this.lastTalkDay.clear();
          // You were awake the whole night — that costs you the morning.
          this.sleepDebt += 1;
          this.recomputeStaminaMax();
          this.ui.toast(
            `熬了一整夜，体力上限少了 ${STAMINA.sleepPenalty} 点。回小屋睡一觉才补得回来。`,
            'bad',
            4200,
          );
        }
        this.ui.toast(`第 ${this.time.day} 天 · ${this.time.phaseLabel} · ${this.time.weatherLabel}`, 'info', 2600);
        audio.play('phase');
      }

      // Swimming: the water is too deep to wade but the swimsuit works.
      this.swimming = this.player.swimming;
      if (this.swimming) {
        // The clothes really do matter here: the swimming clothes make the
        // water cheaper, and the diving ones make the deep cheaper still.
        const bonus = this.wardrobe.bonuses();
        const underwater = this.player.isUnderwater;
        const base = underwater ? STAMINA.diveDrain : STAMINA.swimDrain;
        const reduce = underwater ? (bonus.diveDrain ?? 0) : (bonus.swimDrain ?? 0);
        const factor = Math.max(0.2, 1 - reduce / 100);
        const rainPenalty =
          this.time.weather === 'rain' && bonus.rainImmune !== true ? 1.6 : 1;
        this.stamina.drain(base * factor * rainPenalty * dt);
        if (this.stamina.isExhausted) {
          if (!this.exhaustedWarned) {
            this.exhaustedWarned = true;
            this.ui.toast('你快没力气了，得回岸上！', 'bad', 2600);
          }
          // Nobody lets you drown on this island.
          this.drowningTimer += dt;
          if (this.drowningTimer >= STAMINA.drownLimit) {
            this.triggerRescue();
          }
        } else {
          this.exhaustedWarned = false;
          this.drowningTimer = 0;
        }
      }
    }

    // --- Fishing ----------------------------------------------------------
    if (this.fishing.isActive) {
      const wasWaiting = this.fishing.stage === 'waiting';
      this.fishing.update(dt);
      if (wasWaiting && this.fishing.stage === 'bite') audio.play('bite');
      this.ui.showFishing({
      status: this.fishing.lastResult,
      hint: this.fishing.hint,
      marker: this.fishing.marker,
      target: this.fishing.target,
      bandWidth: this.fishing.bandWidth,
      active: true,
      bite: this.fishing.stage === 'bite',
    });
      if (this.input.consume('interact')) this.reelIn();
    }

    // --- Stamina and satiety ----------------------------------------------
    {
      const hunger = this.satiety.effect;
      const sprinting =
        interactive &&
        hunger.canSprint &&
        (this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight')) &&
        this.player.isMoving &&
        this.stamina.canSprint &&
        !this.swimming;

      if (sprinting) {
        this.stamina.drain(STAMINA.sprintDrain * dt);
      } else if (!this.swimming && (interactive || this.fishing.isActive)) {
        // Sitting on the bank with a rod counts as resting too.
        const bonus = this.wardrobe.bonuses();
        const moving = interactive && this.player.isMoving;
        this.stamina.regen(dt, moving, hunger.regen);
        if (bonus.staminaRegen) {
          this.stamina.restore(bonus.staminaRegen * dt * hunger.regen);
        }
      }

      // The market forgets yesterday's sales when a new day starts.
      this.market.setDay(this.time.day);

      // Hunger keeps running down even while a panel is open — time passes.
      if (!titleVisible) {
        this.satiety.update(dt, { sprinting, swimming: this.swimming });
      }

      // Hunger makes you slower, and a weak traveller cannot work at all.
      this.player.speedScale = hunger.speed;

      const state = this.satiety.state;
      if (state !== this.lastHungerState) {
        const previous = this.lastHungerState;
        this.lastHungerState = state;
        this.recomputeStaminaMax();
        if (state === 'weak') {
          this.ui.toast('饿得站不住了。先找点吃的吧 —— 背包里的，或者野外的浆果。', 'bad', 4200);
        } else if (previous === 'weak') {
          this.ui.toast('吃了点东西，好些了。', 'good', 3200);
        } else if (state === 'hungry') {
          this.ui.toast('肚子很空了，腿有点发软。', 'bad', 3400);
        } else if (state === 'peckish') {
          this.ui.toast('肚子有点空了。背包里有吃的吗？', 'info', 3000);
        }
      }
    }

    // --- World / HUD ------------------------------------------------------
    this.world.update(dt, this.elapsed, this.player.position);
    this.updateNpcMarkers();
    this.updateObjective();
    this.updateStats();
    this.updateStatus();

    // Tell the player how to get the mouse back.
    this.ui.setResumeHint(
      !titleVisible && !dialogueOpen && !panelOpen && !this.input.isLocked,
    );

    // Hide the roof while the player is inside the hut.
    const inHut =
      this.world.isHutBuilt &&
      this.world.isInsideHut(this.player.position.x, this.player.position.z);
    if (this.world.isHutBuilt) {
      this.world.setRoofVisible(!inHut);
    }

    // The music follows the time of day and whether you are indoors.
    const mood: MusicMood = inHut
      ? 'indoor'
      : this.time.phase === 'night' || this.time.phase === 'evening'
        ? 'night'
        : 'day';
    audio.setMood(mood);


    if (!titleVisible) {
      this.playTime += dt;
      this.autosaveTimer += dt;
      if (this.autosaveTimer >= SAVE.autosaveIntervalMs / 1000) {
        this.autosaveTimer = 0;
        this.save();
      }
    }
  }

  private cameraFocus(): THREE.Vector3 {
    return new THREE.Vector3(
      this.player.position.x,
      this.player.position.y + PLAYER.eyeHeight * 0.85,
      this.player.position.z,
    );
  }

  /** Collects the trees near the player so the camera can avoid them. */
  private updateCameraObstacles(): void {
    this.cameraObstacles.length = 0;
    const px = this.player.position.x;
    const pz = this.player.position.z;


    for (const node of this.resourceNodes) {
      if (node.kind !== 'wood' || node.amount <= 0) continue;
      const dx = node.x - px;
      const dz = node.z - pz;
      if (dx * dx + dz * dz > 144) continue;
      this.cameraObstacles.push({
        x: node.x,
        z: node.z,
        baseY: node.y,
        radius: 1.15 * node.scale,
        height: 4.4 * node.scale,
      });
    }
  }

  // ------------------------------------------------------------ interaction

  private buildCandidates(): Interactable[] {
    const candidates: Interactable[] = [];

    // --- Fishing spots ---------------------------------------------------
    for (const spot of this.world.fishingSpots) {
      candidates.push({
        id: `fishing:${spot.x.toFixed(1)}:${spot.z.toFixed(1)}`,
        kind: 'fishing',
        x: spot.x,
        y: spot.y + 0.6,
        z: spot.z,
        radius: 1.5,
        label: '在这里钓鱼',
        available: true,
      });
    }


    for (const npc of NPCS) {
      const avatar = this.world.npcs.get(npc.id);
      if (!avatar) continue;
      const position = avatar.root.position;
      candidates.push({
        id: `npc:${npc.id}`,
        kind: 'npc',
        x: position.x,
        y: position.y + 1.1,
        z: position.z,
        radius: 0.9,
        label: `跟 ${npc.name} 说话`,
        available: !this.ui.isDialogueOpen,
      });
    }

    // --- The build site ----------------------------------------------------
    const buildSite = this.world.buildSitePosition;
    candidates.push({
      id: 'build:hut',
      kind: 'build',
      x: buildSite.x,
      y: buildSite.y + 0.8,
      z: buildSite.z,
      radius: 1.6,
      label: this.building.isBuilt('hut') ? '看看你的小屋' : '在这里盖点东西',
      available: true,
    });

    // --- The crafting bench ------------------------------------------------
    const bench = this.world.workbenchPosition;
    candidates.push({
      id: 'workbench:bench',
      kind: 'workbench',
      x: bench.x,
      y: bench.y + 1.0,
      z: bench.z,
      radius: 1.2,
      label: '使用工作台',
      available: true,
    });

    const px = this.player.position.x;
    const pz = this.player.position.z;
    for (const node of this.resourceNodes) {
      if (node.amount <= 0) continue;
      const dx = node.x - px;
      const dz = node.z - pz;
      if (dx * dx + dz * dz > 36) continue; // 6 unit cull
      candidates.push({
        id: `resource:${node.id}`,
        kind: 'resource',
        x: node.x,
        // Deep shells lie on the bottom, so they are reached from the surface.
        y: node.kind === 'deepshell' ? WORLD.waterLevel : node.y + 0.7,
        z: node.z,
        radius: node.kind === 'deepshell' ? 1.4 : 0.8,
        label: node.label,
        available: true,
        ignoreFacing: node.kind === 'deepshell',
      });
    }

    return candidates;
  }

  private updateInteraction(): void {
    const look = this.cameraController.lookDirection;
    const target = findInteractionTarget(this.buildCandidates(), {
      playerX: this.player.position.x,
      playerY: this.player.position.y + PLAYER.eyeHeight * 0.8,
      playerZ: this.player.position.z,
      forwardX: look.x,
      forwardY: look.y,
      forwardZ: look.z,
      range: INTERACTION.range,
      facingDot: INTERACTION.facingDot,
    });

    this.currentTarget = target;
    this.ui.setPrompt(target ? target.label : null);
  }

  private interactWith(target: Interactable): void {
    if (target.kind === 'npc') {
      const npcId = target.id.replace('npc:', '');
      const npc = getNpc(npcId);
      if (npc) this.openDialogue(npc);
      return;
    }

    if (target.kind === 'resource') {
      const nodeId = target.id.replace('resource:', '');
      const node = this.world.resources.nodes.get(nodeId);
      if (node) this.harvest(node);
      return;
    }

    if (target.kind === 'build') {
      this.openBuilding();
      return;
    }

    if (target.kind === 'fishing') {
      const spot = this.world.fishingSpots.find(
        (candidate) =>
          `fishing:${candidate.x.toFixed(1)}:${candidate.z.toFixed(1)}` === target.id,
      );
      if (spot) this.startFishing(spot.habitat);
      return;
    }

    if (target.kind === 'workbench') {
      this.openCrafting();
      return;
    }


    if (target.kind === 'home') {
      this.openHome();
    }
  }

  /**
   * The stamina one swing at this node costs.
   *
   * Bare hands are expensive; a tool turns the same breath into much more
   * material. That is what makes a tool worth its materials.
   */
  /**
   * True when the traveller is too weak to work. You can still walk around
   * and pick berries — you just cannot cut, mine or fish.
   */
  private get tooWeakToWork(): boolean {
    return !this.satiety.effect.canWork;
  }

  private harvestCost(kind: string): number {
    if (kind === 'wood') {
      return this.market.toolSwingCost('axe', STAMINA.chopCost);
    }
    if (kind === 'stone') {
      return this.market.toolSwingCost('pickaxe', STAMINA.mineCost);
    }
    if (kind === 'deepshell') {
      return STAMINA.shellCost;
    }
    return STAMINA.forageCost;
  }

  private harvest(node: ResourceNode): void {
    if (node.amount <= 0) {
      this.ui.toast('这里已经采完了。', 'bad');
      return;
    }

    const itemId = node.kind;
    if (this.inventory.count(itemId) >= INVENTORY.maxStack) {
      this.ui.toast(`背包里放不下更多${getItem(itemId).name}了。`, 'bad');
      return;
    }

    // Every swing costs breath — this is what makes the stamina bar matter.
    // A tool makes the swing both cheaper and more productive.
    const cost = this.harvestCost(node.kind);
    if (this.tooWeakToWork) {
      this.ui.toast('饿得没力气干活了。先吃点东西。', 'bad');
      audio.play('deny');
      return;
    }
    if (this.stamina.current < cost) {
      this.ui.toast(
        node.kind === 'deepshell' ? '你没有力气潜下去了。' : '你没力气了，先歇一会儿。',
        'bad',
      );
      audio.play('deny');
      return;
    }
    this.stamina.drain(cost);
    this.satiety.drain(SATIETY.workDrain);
    audio.play(
      node.kind === 'wood' ? 'chop' : node.kind === 'stone' ? 'mine' : 'pickup',
    );

    const result = this.world.resources.harvest(node);
    if (!result) return;

    // A better tool yields more per swing — and wears out.
    let qty = result.qty;
    if (result.item === 'wood' && this.market.toolLevel('axe') > 0) {
      qty += this.market.toolBonus('axe');
      this.wearTool('axe');
    }
    if (result.item === 'stone' && this.market.toolLevel('pickaxe') > 0) {
      qty += this.market.toolBonus('pickaxe');
      this.wearTool('pickaxe');
    }

    const taken = this.inventory.add(result.item, qty);
    if (taken <= 0) {
      this.ui.toast('背包满了。', 'bad');
      return;
    }

    this.ui.toast(`+${taken} ${getItem(result.item).name}`, 'good');
    this.updateStats();
    this.save();
  }

  // ------------------------------------------------------- building & crafting

  /** Opens the blueprint panel at the build site. */
  private openBuilding(): void {
    const blueprint = this.building.getBlueprint('hut');
    if (!blueprint) return;

    if (this.building.isBuilt('hut')) {
      this.openHome();
      return;
    }

    const progress = this.building.progress(blueprint, this.inventory);
    this.ui.showBuilding(
      blueprint.name,
      blueprint.description,
      progress,
      this.building.canBuild(blueprint, this.inventory),
    );
    this.input.setEnabled(false);
    this.input.exitLock();
    this.input.clearActions();
  }

  /** Opens the crafting panel. */
  private openCrafting(): void {
    this.refreshCraftingPanel();
    this.input.setEnabled(false);
    this.input.exitLock();
    this.input.clearActions();
  }

  /** Opens the panel for the player's own hut. */
  private openHome(): void {
    const blueprint = this.building.getBlueprint('hut');
    // The tools live on your belt, not in the backpack.
    const tools = this.toolCards()
      .map((tool) => `${tool.name}（还能用 ${tool.remaining} 次）`)
      .join('、');

    const rest = this.time.phase === 'night'
      ? '夜里睡觉会跳到明天清晨。'
      : '现在睡觉会跳过整个白天。';

    this.ui.showHome(
      blueprint?.completeText ?? '属于你自己的地方。',
      [
        tools ? `你带着：${tools}。` : '你还没有工具。',
        '在火炉边也可以制作东西。回家会保存进度。',
        rest,
      ].join(''),
    );
    this.input.setEnabled(false);
    this.input.exitLock();
    this.input.clearActions();
  }

  /** Closes the open panel and hands control back to the player. */
  private closePanel(): void {
    // Closing the fishing panel puts the line back in the basket.
    this.fishing.cancel();
    this.ui.closePanel();
    this.input.setEnabled(true);
    this.input.clearActions();
    this.input.requestLock();
  }

  /** Re-renders the crafting panel with the current inventory. */
  private refreshCraftingPanel(): void {
    this.ui.showCrafting(this.crafting.recipes, (recipe) =>
      this.crafting.progress(recipe, this.inventory),
    );
  }

  /** Crafts a recipe. */
  private craft(recipeId: string): void {
    const recipe = this.crafting.getRecipe(recipeId);
    if (!recipe) return;

    // One axe at a time. Otherwise a second one would be a free repair.
    const ownedTool =
      isToolId(recipe.output.item) && this.market.toolLevel(recipe.output.item) > 0;

    const result = this.crafting.craft(recipe, this.inventory, ownedTool);
    if (!result.ok) {
      this.ui.toast(
        result.reason === 'inventory-full'
          ? '你的背包放不下了。'
          : result.reason === 'already-owned'
            ? `你已经有一把${getItem(recipe.output.item).name}了。`
            : '材料还不够。',
        'bad',
      );
      return;
    }

    const made = result.produced[0];
    // Crafting a tool is how you get your first one. A tool is not carried in
    // the backpack — it hangs on your belt, where its wear is visible.
    if (made && (made.item === 'axe' || made.item === 'pickaxe' || made.item === 'rod')) {
      this.inventory.remove(made.item);
      this.market.upgradeTool(made.item, 1);
    }
    this.ui.toast(
      `制作了 ${made ? getItem(made.item).name : ''}${made ? ` ×${made.qty}` : ''}`,
      'good',
    );
    audio.play('craft');
    this.refreshCraftingPanel();
    this.updateStats();
    this.save();
  }

  /** Raises the hut. */
  private buildStructure(): void {
    const blueprint = this.building.getBlueprint('hut');
    if (!blueprint) return;

    const result = this.building.build(blueprint, this.inventory);
    if (!result.ok) {
      this.ui.toast('材料还不够。', 'bad');
      return;
    }

    this.world.setHutBuilt(true);
    this.flags['hut:built'] = true;
    this.closePanel();
    this.ui.toast(blueprint.completeText, 'quest', 5200);
    this.ui.toast('回去告诉 Tallis 你的进展。', 'info', 4200);
    this.updateStats();
    this.updateObjective();
    this.save();
  }

  /** Rests at home and saves. */
  /** Opens one of the panels by name (used by the HUD buttons). */
  private openPanelByName(panel: string): void {
    switch (panel) {
      case 'saves':
        this.openSaves();
        break;
      case 'inventory':
        this.refreshInventory();
        this.input.setEnabled(false);
        this.input.exitLock();
        this.input.clearActions();
        break;
      case 'journal':
        this.openJournal();
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------- saves

  /** Opens the save-slot panel. */
  private openSaves(): void {
    const slots = this.saveSystem.listSlots().map((slot) => ({
      ...slot,
      phase: slot.phase ? PHASE_LABELS[slot.phase as DayPhase] ?? slot.phase : undefined,
      weather: slot.weather ? WEATHER_LABELS[slot.weather as Weather] ?? slot.weather : undefined,
    }));

    this.ui.showSaves({
      slots,
      currentSlot: this.saveSystem.currentSlot,
      onSelect: (slot) => {
        this.saveSystem.currentSlot = slot;
        this.openSaves();
        this.ui.toast(`自动存档现在写到存档 ${slot}。`, 'info');
      },
      onLoad: (slot) => {
        const data = this.saveSystem.loadFrom(slot);
        if (!data) {
          this.ui.toast('这个存档位是空的。', 'bad');
          return;
        }
        this.applySave(data);
        this.saveSystem.currentSlot = slot;
        this.closePanel();
        this.ui.toast(`读取了存档 ${slot}。`, 'good');
      },
      onSave: (slot) => {
        const ok = this.saveSystem.saveTo(slot, this.buildSaveData());
        this.ui.toast(ok ? `已保存到存档 ${slot}。` : '保存失败。', ok ? 'good' : 'bad');
        this.openSaves();
      },
      onDelete: (slot) => {
        this.saveSystem.deleteSlot(slot);
        this.ui.toast(`删除了存档 ${slot}。`, 'info');
        this.openSaves();
      },
    });
    this.input.setEnabled(false);
    this.input.exitLock();
    this.input.clearActions();
  }

  // ----------------------------------------------------------- decorations

  /** Opens the decoration panel for the hut. */
  private openDecor(): void {
    if (!this.building.isBuilt('hut')) {
      this.ui.toast('先把小屋盖起来吧。', 'bad');
      return;
    }

    const owned = DECORATIONS.map((decoration) => {
      const count = this.inventory.count(decoration.itemId);
      const target = count > 0 ? this.decorations.findSlotFor(decoration.id) : null;
      return {
        type: decoration.id,
        name: decoration.name,
        icon: decoration.icon,
        count,
        description: decoration.description,
        targetSlot: target ? getSlot(target)?.label : undefined,
      };
    }).filter((entry) => entry.count > 0);

    // Every place you can decorate, so it is obvious where things go.
    const slots = DECORATION_SLOTS.map((slot) => {
      const placement = this.decorations.get(slot.id);
      const decoration = placement ? getDecoration(placement.type) : undefined;
      const fits = DECORATIONS.filter(
        (def) =>
          slot.accepts.includes(def.id) && this.inventory.count(def.itemId) > 0,
      ).map((def) => ({
        type: def.id,
        name: def.name,
        icon: def.icon,
        count: this.inventory.count(def.itemId),
      }));
      return {
        id: slot.id,
        label: slot.label,
        icon: SLOT_ICONS[slot.kind] ?? '📍',
        occupied: decoration
          ? { name: decoration.name, icon: decoration.icon }
          : undefined,
        fits,
      };
    });

    this.ui.showDecor({
      coziness: this.decorations.coziness,
      maxCoziness: MAX_COZINESS,
      tierTitle: this.decorations.title,
      owned,
      slots,
      onPlace: (type) => this.placeDecorationAnywhere(type),
      onPlaceIn: (slot, type) => this.placeDecoration(slot, type),
      onRemove: (slot) => this.takeDecorationBack(slot),
    });

    this.input.setEnabled(false);
    this.input.exitLock();
    this.input.clearActions();
  }

  /** Puts a decoration into the first free slot that fits it. */
  private placeDecorationAnywhere(type: string): void {
    const slot = this.decorations.findSlotFor(type);
    if (!slot) {
      this.ui.toast('没有放得下的位置了。', 'bad');
      return;
    }
    this.placeDecoration(slot, type);
  }

  /** Puts a decoration into a chosen slot. */
  private placeDecoration(slot: string, type: string): void {
    if (!this.decorations.place(slot, type, this.inventory)) {
      this.ui.toast('这里放不下，或者背包里没有这件装饰。', 'bad');
      return;
    }

    this.world.placeDecoration(slot, type);
    const decoration = getDecoration(type);
    this.ui.toast(
      `把${decoration?.name ?? ''}放在了${getSlot(slot)?.label ?? ''}。`,
      'good',
    );
    audio.play('place');
    this.claimCozinessTiers();
    this.refreshDecorPanel();
    this.updateStats();
    this.save();
  }

  /** Takes a decoration back into the backpack. */
  private takeDecorationBack(slot: string): void {
    if (!this.decorations.remove(slot, this.inventory)) {
      this.ui.toast('收不回来。', 'bad');
      return;
    }
    this.world.removeDecoration(slot);
    this.refreshDecorPanel();
    this.updateStats();
    this.save();
  }

  /** Re-renders the decoration panel after a change. */
  private refreshDecorPanel(): void {
    if (this.ui.currentPanel !== 'decor') return;
    this.openDecor();
  }

  /** Hands out the island's gift for every newly reached coziness tier. */
  private claimCozinessTiers(): void {
    const claimed = this.decorations.claimNewTiers(this.inventory);
    for (const entry of claimed) {
      this.ui.toast(entry.tier.message, 'quest', 4600);
      const gift = entry.items
        .map((item) => `${item.qty}× ${getItem(item.item).name}`)
        .join('、');
      if (gift) this.ui.toast(`收到：${gift}`, 'good');
    }
    if (claimed.length > 0) {
      this.ui.toast(`温馨度 ${this.decorations.coziness} · ${this.decorations.title}`, 'quest', 4600);
      this.updateStats();
      this.save();
    }
  }

  // --------------------------------------------------------------- dialogue

  /**
   * The quest this NPC currently wants to talk about: the first one of theirs
   * that is not finished yet. `null` when they are all done.
   */
  private activeQuestFor(npc: NpcDef): QuestId | null {
    for (const questId of npc.quests) {
      const status = this.quests.status(questId, this.inventory, this.flags);
      if (status !== 'done') return questId;
    }
    return null;
  }

  /** Builds the context the dialogue builder needs. */
  private dialogueContext(
    npc: NpcDef,
    questId: QuestId,
    questStatus: QuestStatus,
  ): DialogueContext {
    const have: Record<string, number> = {};
    for (const requirement of QUESTS[questId].requirements) {
      have[requirement.item] = countFor(this.inventory, requirement.item);
    }
    const used = this.usedLines.get(npc.id) ?? new Set<string>();
    const last = npc.quests[npc.quests.length - 1];

    return {
      questId,
      questStatus,
      have,
      talkedBefore: this.flags[`talked:${npc.id}`] === true,
      coziness: this.totalCoziness(),
      trust: this.trust.level(npc.id),
      phase: this.time.phase,
      weather: this.time.weather,
      tired: this.stamina.ratio < 0.25,
      // Only when the backpack really cannot take another of something.
      full: this.inventory.hasFullStack,
      hutBuilt: this.building.isBuilt('hut'),
      expansions: this.interior.expandedIds as ExpansionId[],
      hasItem: this.inventory.entries().map((entry) => entry.id),
      fishCount: this.inventory.countCategory(FISH.map((fish) => fish.id)),
      firstToday: this.lastTalkDay.get(npc.id) !== this.time.day,
      storyDone: last ? this.quests.isCompleted(last) : false,
      used: [...used],
    };
  }

  /** Remembers which lines have been used today. */
  private rememberLines(npc: NpcDef, lines: readonly string[]): void {
    let used = this.usedLines.get(npc.id);
    if (!used) {
      used = new Set<string>();
      this.usedLines.set(npc.id, used);
    }
    for (const line of lines) used.add(line);
  }

  /** Total coziness: decorations, furniture, expansions and clothing. */
  private totalCoziness(): number {
    return this.decorations.coziness + this.interior.cozy + this.wardrobe.cozy;
  }

  private openDialogue(npc: NpcDef): void {
    const questId = this.activeQuestFor(npc);
    const have: Record<string, number> = {};

    let node: DialogueNode;
    if (!questId) {
      // Every quest of this NPC is finished — they say goodbye.
      const fallback = npc.quests[0] ?? 'firewood';
      node = buildDialogue(npc, this.dialogueContext(npc, fallback, 'done'));
      this.dialogueQuest = null;
    } else {
      for (const requirement of QUESTS[questId].requirements) {
        have[requirement.item] = this.inventory.count(requirement.item);
      }
      node = buildDialogue(
        npc,
        this.dialogueContext(
          npc,
          questId,
          this.quests.status(questId, this.inventory, this.flags),
        ),
      );
      this.dialogueQuest = questId;
    }

    this.dialogueNpc = npc;
    this.currentDialogue = node;
    this.ui.showDialogue(node);
    this.input.setEnabled(false);
    this.input.exitLock();
    // Drop any queued key presses so they do not leak into the world.
    this.input.clearActions();

    const firstToday = this.lastTalkDay.get(npc.id) !== this.time.day;
    this.flags[`talked:${npc.id}`] = true;
    this.lastTalkDay.set(npc.id, this.time.day);
    // Seeing someone new raises the trust — but only once a day.
    if (firstToday) this.trust.gain(npc.id, 1);
    this.updateObjective();
  }

  private handleDialogueKeys(): void {
    const node = this.currentDialogue;
    if (!node) return;
    for (let i = 0; i < DIALOGUE_KEYS.length && i < node.choices.length; i++) {
      const key = DIALOGUE_KEYS[i];
      if (!key) continue;
      if (this.input.consumeKey(key)) {
        const choice = node.choices[i];
        if (choice) this.handleDialogueChoice(choice);
        return;
      }
    }
  }

  private handleDialogueChoice(choice: DialogueChoice): void {
    // The rescue scene runs on its own little script.
    if (this.rescueLines.length > 0) {
      this.advanceRescueScene();
      return;
    }

    const npc = this.dialogueNpc;
    const questId = this.dialogueQuest;

    switch (choice.action) {
      case 'turnIn': {
        if (!npc || !questId) break;
        const result = this.quests.turnIn(questId, this.inventory, this.flags);
        if (result.ok) {
          const def = QUESTS[questId];
          const rewards = result.granted
            .map((reward) => `${reward.qty}× ${getItem(reward.item).name}`)
            .join(', ');
          this.ui.toast(`任务完成：${def.title}`, 'quest', 4600);
          audio.play('quest');
          if (rewards) this.ui.toast(`获得 ${rewards}`, 'good');
          if (result.dropped.length > 0) {
            this.ui.toast('有些奖励放不进背包了。', 'bad');
          }
          this.flags[`done:${questId}`] = true;
          // A tool reward is a real tool, not a token in the backpack.
          for (const reward of result.granted) {
            if (isToolId(reward.item)) this.market.upgradeTool(reward.item, 1);
          }
          this.updateStats();
          this.updateObjective();
          this.save();
          if (this.quests.isComplete) {
            this.ui.toast('岛屿与你绑定了。你是它的守护者。', 'quest', 7000);
          }
        } else {
          this.ui.toast('你还缺一些东西。', 'bad');
        }
        this.ui.hideDialogue();
        break;
      }

      case 'accept': {
        if (npc && questId) {
          this.flags[`accepted:${questId}`] = true;
          this.ui.toast(`接受任务：${QUESTS[questId].title}`, 'quest');
        }
        this.ui.hideDialogue();
        break;
      }

      case 'shop': {
        if (npc) this.openShop(npc);
        break;
      }

      case 'chatter': {
        if (npc) {
          const questId = this.dialogueQuest ?? npc.quests[0] ?? 'firewood';
          const node = buildChatter(
            npc,
            this.dialogueContext(
              npc,
              questId,
              this.quests.status(questId, this.inventory, this.flags),
            ),
          );
          this.rememberLines(npc, node.usedLines);
          this.currentDialogue = node;
          this.ui.showDialogue(node);
        }
        break;
      }


      case 'close':
      default:
        this.ui.hideDialogue();
        break;
    }
  }

  // -------------------------------------------------------------------- HUD

  private updateObjective(): void {
    const id = this.quests.currentObjective();
    if (!id) {
      this.ui.setObjective(
        '岛屿记住了你。',
        '所有任务都完成了。自由探索吧 —— 王冠是你的了。',
      );
      return;
    }

    const def = QUESTS[id];
    const status = this.quests.status(id, this.inventory, this.flags);

    if (def.kind === 'flag') {
      this.ui.setObjective(
        def.summary,
        status === 'ready' ? '已经做好了 — 回去告诉委托人' : '还没建好，去村口的地基看看',
      );
      return;
    }

    const progress = def.requirements
      .map(
        (requirement) =>
          `${getItem(requirement.item).name} ${Math.min(
            this.inventory.count(requirement.item),
            requirement.qty,
          )}/${requirement.qty}`,
      )
      .join('  ·  ');

    this.ui.setObjective(
      def.summary,
      status === 'ready' ? `可以交付了 — ${progress}` : progress,
    );
  }

  private updateStats(): void {
    this.ui.setStats({
      wood: this.inventory.count('wood'),
      fiber: this.inventory.count('fiber'),
      crystal: this.inventory.count('crystal'),
      total: this.inventory.total,
      coziness: this.decorations.coziness,
      coins: this.market.coins,
      tools: this.toolSummary(),
    });
  }

  /** A short summary of the tools you carry, e.g. "斧 24/30". */
  private toolSummary(): string {
    const parts: string[] = [];
    const names = { axe: '斧', pickaxe: '镐', rod: '竿' };
    for (const tool of ['axe', 'pickaxe', 'rod'] as const) {
      const level = this.market.toolLevel(tool);
      if (level <= 0) continue;
      parts.push(`${names[tool]} ${this.market.toolRemaining(tool)}/${this.market.toolDurability(tool)}`);
    }
    return parts.length > 0 ? parts.join(' ') : '—';
  }

  private updateNpcMarkers(): void {
    for (const npc of NPCS) {
      const avatar = this.world.npcs.get(npc.id);
      if (!avatar) continue;
      let visible = false;
      for (const questId of npc.quests) {
        const status = this.quests.status(questId, this.inventory, this.flags);
        if (status === 'available' || status === 'ready') {
          visible = true;
          break;
        }
      }
      avatar.setMarkerVisible(visible);
    }
  }

  // ------------------------------------------------------------------- save

  private buildSaveData(): SaveData {
    return {
      version: SAVE.version,
      savedAt: Date.now(),
      player: {
        position: [this.player.position.x, this.player.position.y, this.player.position.z],
        yaw: this.cameraController.yaw,
        pitch: this.cameraController.pitch,
      },
      inventory: this.inventory.toJSON(),
      quests: this.quests.toJSON(),
      harvested: this.world.resources.harvestedIds,
      build: this.building.toJSON(),
      decorations: this.decorations.toJSON(),
      interior: this.interior.toJSON(),
      wardrobe: this.wardrobe.toJSON(),
      market: this.market.toJSON(),
      trust: this.trust.toJSON(),
      time: this.time.toJSON(),
      stamina: { ...this.stamina.toJSON(), debt: this.sleepDebt },
      satiety: this.satiety.toJSON(),
      storage: this.storage.toJSON(),
      flags: { ...this.flags },
      playTime: this.playTime,
      seenIntro: true,
    };
  }

  private save(): void {
    if (!this.player || !this.booted) return;
    this.saveSystem.save(this.buildSaveData());
  }

  private applySave(data: SaveData): void {
    this.inventory.load(data.inventory);
    this.quests.load(data.quests);
    this.building.load(data.build);
    this.decorations.load(data.decorations);
    this.interior.load(data.interior);
    this.wardrobe.load(data.wardrobe);
    this.market.load(data.market);
    this.trust.load(data.trust);
    this.time.load(data.time);
    this.stamina.load(data.stamina);
    this.satiety.load(data.satiety);
    this.storage.load(data.storage);
    const debt = (data.stamina as { debt?: unknown } | undefined)?.debt;
    this.sleepDebt = typeof debt === 'number' && Number.isFinite(debt) ? Math.max(0, Math.min(6, Math.floor(debt))) : 0;
    this.recomputeStaminaMax();
    this.applyBonuses();
    this.flags = { ...data.flags };
    this.playTime = data.playTime;

    this.world.setHutBuilt(this.building.isBuilt('hut'));
    if (this.building.isBuilt('hut')) this.flags['hut:built'] = true;

    // Put the decorations and the furniture back in the world.
    this.world.clearDecorations();
    for (const placement of this.decorations.list()) {
      this.world.placeDecoration(placement.slot, placement.type);
    }
    this.world.clearInterior();
    for (const entry of this.interior.list()) {
      this.world.placeFurniture(entry.id, entry.slot);
    }

    const [x, , z] = data.player.position;
    this.player.setPosition(x, heightAt(x, z), z);
    this.cameraController.yaw = data.player.yaw;
    this.cameraController.pitch = data.player.pitch;
    this.cameraController.snap(this.cameraFocus());

    for (const id of data.harvested) {
      const node = this.world.resources.nodes.get(id);
      if (node) this.world.resources.markHarvested(node);
    }

    this.updateObjective();
    this.updateStats();
  }

  private handleResetSave(): void {
    const now = performance.now();
    if (now - this.resetArmedAt > 4000) {
      this.resetArmedAt = now;
      this.ui.toast('再按一次 Delete（4 秒内）可以清除存档。', 'bad', 4000);
      return;
    }
    this.resetArmedAt = 0;
    this.saveSystem.clear();
    this.resetState();
    this.ui.toast('存档已清除，重新开始。', 'quest');
  }

  // ------------------------------------------------------ time and weather

  /** Applies the light of the current phase and weather to the scene. */
  private applyLighting(): void {
    const phase = this.time.phase;
    const night = phase === 'night';
    const evening = phase === 'evening';
    const rain = this.time.weather === 'rain';

    const sun = this.world.sun;
    if (night) {
      sun.intensity = 0.2;
      sun.color.setHex(0xa8bce0);
      this.scene.fog = new THREE.Fog(0x39415a, 70, 220);
    } else if (evening) {
      sun.intensity = 0.62;
      sun.color.setHex(0xffc496);
      this.scene.fog = new THREE.Fog(0xe3c3a6, 100, 280);
    } else {
      sun.intensity = rain ? 0.5 : sun.intensity;
      sun.color.setHex(rain ? 0xd6dde6 : 0xfff3e0);
      this.scene.fog = new THREE.Fog(
        rain ? 0xa9b4bf : FOG.color,
        rain ? 60 : FOG.near,
        rain ? 200 : FOG.far,
      );
    }
  }

  // ------------------------------------------------------------------ rest

  /**
   * Rests: restores the stamina and clears the sleep debt — nothing else.
   *
   * Turning in does not fill the stomach. Sleep is rest, not food: to walk
   * out of the hut in the morning with a working body you still have to eat
   * something first.
   */
  private restAt(): void {
    // Sleeping during the day throws the whole day away — make sure.
    if (this.time.phase !== 'night' && !this.restWarned) {
      this.restWarned = true;
      this.ui.toast('现在睡下会跳过整个白天。再点一次确认。', 'bad', 4200);
      return;
    }
    this.restWarned = false;
    this.stamina.refill();
    this.sleepDebt = 0;
    this.recomputeStaminaMax();
    this.time.rest();
    this.applyLighting();
    // A new day means the villagers can say their greeting again.
    this.usedLines.clear();
    this.lastTalkDay.clear();
    this.save();
    this.closePanel();
    this.ui.toast(
      `你睡了一觉。第 ${this.time.day} 天，${this.time.weatherLabel}。`,
      'good',
      3600,
    );
    // Waking up hungry is normal now, but say it once so it does not read as
    // a bug — the bar sits there empty and the player has to eat first.
    if (this.satiety.isHungry) {
      this.ui.toast('醒来肚子是空的。先吃点东西，再下地干活。', 'info', 4200);
    }
    this.updateStatus();
  }

  /** Uses a tool once. Wears it down; when it breaks you are back to bare hands. */
  private wearTool(tool: 'axe' | 'pickaxe' | 'rod'): void {
    if (this.market.useTool(tool)) return;
    const names = { axe: '石斧', pickaxe: '石镐', rod: '鱼竿' };
    this.ui.toast(`${names[tool]}断了。`, 'bad', 3400);
    this.updateStats();
  }

  // ---------------------------------------------------------------- storage

  /** Opens the chest at home. */
  private openStorage(): void {
    const describe = (id: string, count: number) => ({
      id,
      name: getItem(id).name,
      icon: getItem(id).icon,
      count,
    });

    this.ui.showStorage({
      bag: this.inventory.entries().map((entry) => describe(entry.id, entry.count)),
      chest: this.storage.entries().map((entry) => describe(entry.id, entry.count)),
      usedSlots: this.storage.slotsUsed,
      maxSlots: this.storage.maxSlots,
      onStore: (id) => this.storeItem(id),
      onTake: (id) => this.takeItem(id),
    });
    this.input.setEnabled(false);
    this.input.exitLock();
    this.input.clearActions();
  }

  /** Puts one of your things into the chest. */
  private storeItem(itemId: string): void {
    if (!this.inventory.has(itemId)) return;
    if (!this.storage.canAccept(itemId, 1)) {
      this.ui.toast('箱子放不下了。', 'bad');
      return;
    }
    const taken = this.storage.add(itemId, 1);
    if (taken <= 0) {
      this.ui.toast('箱子放不下了。', 'bad');
      return;
    }
    this.inventory.remove(itemId, taken);
    audio.play('place');
    this.openStorage();
    this.updateStats();
    this.save();
  }

  /** Takes one of your things back out of the chest. */
  private takeItem(itemId: string): void {
    if (!this.storage.has(itemId)) return;
    if (this.inventory.count(itemId) >= this.inventory.maxStack) {
      this.ui.toast('背包里放不下了。', 'bad');
      return;
    }
    const taken = this.storage.remove(itemId, 1);
    if (taken <= 0) return;
    this.inventory.add(itemId, taken);
    audio.play('pickup');
    this.openStorage();
    this.updateStats();
    this.save();
  }

  /** Sells something you made more of than you need. */
  private sellSurplus(itemId: string): void {
    const price = SURPLUS_PRICES[itemId];
    if (!price || !this.inventory.has(itemId)) return;
    this.inventory.remove(itemId);
    this.market.addCoins(price);
    this.ui.toast(`卖掉了 1 个${getItem(itemId).name}，得到 ${price} 币。`, 'good');
    audio.play('coin');
    this.refreshShop();
    this.updateStats();
    this.save();
  }

  /** Sells a shell to the villager you are standing at. */
  private sellShell(itemId: string): void {
    if (itemId !== 'shell' && itemId !== 'deepshell') return;
    const npcId = this.activeShopNpc;
    if (!npcId) return;
    if (!this.inventory.has(itemId)) return;

    // Maren still needs a deep shell for her quest, so the last one stays.
    if (
      itemId === 'deepshell' &&
      this.inventory.count(itemId) <= 1 &&
      !this.flags['done:sister']
    ) {
      this.ui.toast('这个深海螺得留着 —— Maren 还要一个。', 'bad');
      return;
    }

    const price = shellPrice(itemId, BUYERS[npcId]);
    this.inventory.remove(itemId);
    this.market.addCoins(price);
    this.ui.toast(`卖掉了 1 个${getItem(itemId).name}，得到 ${price} 币。`, 'good');
    audio.play('coin');
    this.refreshShop();
    this.updateStats();
    this.save();
  }

  /**
   * Nell fishes the traveller out of the water.
   *
   * Running out of strength under water is not a game over: you wake up the
   * next morning in the village, and you owe her for the trouble.
   */
  private triggerRescue(): void {
    this.drowningTimer = 0;
    this.exhaustedWarned = false;
    this.swimming = false;

    // You wake up the next morning, in the village, with a full bar —
    // Nell saved you and fed you while you were out.
    this.time.rest();
    this.applyLighting();
    this.stamina.refill();
    this.satiety.refill();
    this.recomputeStaminaMax();
    this.usedLines.clear();
    this.lastTalkDay.clear();

    const spawn = WORLD_LAYOUT.spawn;
    this.player.setPosition(spawn.x, heightAt(spawn.x, spawn.z), spawn.z);

    // The rescue fee.
    const paid = Math.min(RESCUE_FEE, this.market.coins);
    this.market.spend(paid);

    const nell = getNpc('nell');
    this.rescueLines = [
      '……你醒了。',
      '你抱着那块贝壳就往下沉。我正好在岸边收网，看见了。',
      '把你拖上来的时候，你已经没有呼吸了。我拍了你好一会儿。',
      paid >= RESCUE_FEE
        ? `十块钱。这不是敲诈 —— 我得给你买药。`
        : `你身上只有 ${paid} 块钱。剩下的，先记你账上。`,
      '……行了。你欠我一条命，别再一个人往深水里钻了。',
    ];
    this.rescueIndex = 0;
    this.showRescueLine(nell);
    this.updateStats();
    this.updateStatus();
    this.save();
  }

  /** Shows one line of the rescue scene. */
  private showRescueLine(nell: NpcDef | undefined): void {
    const text = this.rescueLines[this.rescueIndex];
    if (text === undefined) {
      this.endRescueScene();
      return;
    }
    const node: DialogueNode = {
      id: 'rescue',
      speaker: nell?.name ?? 'Nell',
      role: nell?.role ?? '采集者',
      text,
      choices: [{ label: '继续', action: 'close' }],
      isResolution: false,
      usedLines: [],
    };
    this.currentDialogue = node;
    this.ui.showDialogue(node);
    this.input.setEnabled(false);
    this.input.exitLock();
    this.input.clearActions();
  }

  /** Moves the rescue scene on, or ends it. */
  private advanceRescueScene(): void {
    this.rescueIndex += 1;
    if (this.rescueIndex >= this.rescueLines.length) {
      this.endRescueScene();
      return;
    }
    this.showRescueLine(getNpc('nell'));
  }

  private endRescueScene(): void {
    this.rescueLines = [];
    this.rescueIndex = 0;
    this.ui.hideDialogue();
    this.ui.toast('你在村口的草地上醒过来，身上还是湿的。', 'info', 4200);
    this.updateStats();
    this.updateStatus();
  }

  /** Re-opens the backpack, with the tool belt on it. */
  private refreshInventory(): void {
    this.ui.openInventory(this.inventory.entries(), this.toolCards());
  }

  /** The tools on the traveller's belt. */
  private toolCards(): ToolCard[] {
    return (['axe', 'pickaxe', 'rod'] as const)
      .filter((tool) => this.market.toolLevel(tool) > 0)
      .map((tool) => {
        const level = this.market.toolLevel(tool);
        const definition = TOOL_LEVELS[tool][level - 1];
        return {
          id: tool,
          name: definition?.label ?? tool,
          icon: tool === 'axe' ? '🪓' : tool === 'pickaxe' ? '⛏️' : '🎣',
          level,
          remaining: this.market.toolRemaining(tool),
          max: this.market.toolDurability(tool),
          refund: this.market.toolRefund(tool),
        };
      });
  }

  /** Sells a tool for a fraction of what it was worth. */
  private sellTool(toolId: string): void {
    const tool = toolId as 'axe' | 'pickaxe' | 'rod';
    const refund = this.market.sellTool(tool);
    if (refund <= 0) {
      this.ui.toast('这件工具卖不了。', 'bad');
      return;
    }
    this.ui.toast(`卖掉了工具，得到 ${refund} 币。`, 'good');
    audio.play('coin');
    this.refreshShop();
    this.updateStats();
    this.save();
  }

  /**
   * Handles a mouse click.
   *
   * With the pointer locked the crosshair decides what you hit. With a free
   * cursor the click lands on whatever is under it — and if there is nothing
   * there, the click grabs the mouse for camera control instead.
   */
  private handleClick(click: { x: number; y: number }): void {
    if (this.ui.isTitleVisible || this.ui.isDialogueOpen || this.ui.isPanelOpen) return;

    if (this.input.isLocked) {
      if (this.currentTarget) this.interactWith(this.currentTarget);
      return;
    }

    const target = this.pickTargetAt(click.x, click.y);
    if (target) {
      this.interactWith(target);
      return;
    }
    this.input.requestLock();
  }

  /**
   * Finds the interactable under a screen position.
   * A cheap ray test against the small spheres the interactables are.
   */
  private pickTargetAt(clientX: number, clientY: number): Interactable | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    const origin = this.camera.position.clone();
    const direction = new THREE.Vector3(ndcX, ndcY, 0.5)
      .unproject(this.camera)
      .sub(origin)
      .normalize();

    let best: Interactable | null = null;
    let bestAlong = Infinity;

    for (const candidate of this.buildCandidates()) {
      const dx = candidate.x - origin.x;
      const dy = candidate.y - origin.y;
      const dz = candidate.z - origin.z;
      const along = dx * direction.x + dy * direction.y + dz * direction.z;
      if (along <= 0) continue;

      const closestX = origin.x + direction.x * along;
      const closestY = origin.y + direction.y * along;
      const closestZ = origin.z + direction.z * along;
      const distance = Math.hypot(
        candidate.x - closestX,
        candidate.y - closestY,
        candidate.z - closestZ,
      );
      if (distance > candidate.radius + 0.5) continue;
      if (along < bestAlong) {
        bestAlong = along;
        best = candidate;
      }
    }

    return best;
  }

  // --------------------------------------------------------------- fishing

  /** Starts fishing at the given spot. */
  private startFishing(habitat: 'lake' | 'sea'): void {
    if (this.market.toolLevel('rod') === 0) {
      this.ui.toast('你还没有鱼竿。Tallis 那里可以免费拿一根。', 'bad');
      return;
    }
    if (this.tooWeakToWork) {
      this.ui.toast('饿得没力气握竿了。先吃点东西。', 'bad');
      return;
    }
    if (this.stamina.current < 3) {
      this.ui.toast('太累了，钓不了鱼。', 'bad');
      return;
    }

    const bonus = this.wardrobe.bonuses();
    this.fishing.cast({
      habitat,
      phase: this.time.phase,
      weather: this.time.weather,
      luck: bonus.fishLuck ?? 0,
      rodPower: (bonus.rodPower ?? 0) + this.market.toolLevel('rod') * 0.05,
    });
    this.stamina.drain(this.market.toolSwingCost('rod', STAMINA.fishCost));
    this.satiety.drain(SATIETY.workDrain * 0.5);
    this.wearTool('rod');
    this.ui.showFishing({
      status: this.fishing.lastResult,
      hint: this.fishing.hint,
      marker: this.fishing.marker,
      target: this.fishing.target,
      bandWidth: this.fishing.bandWidth,
      active: true,
      bite: this.fishing.stage === 'bite',
    });
    this.input.setEnabled(false);
    this.input.exitLock();
    this.input.clearActions();
  }

  /** Tries to land the fish. */
  private reelIn(): void {
    const bonus = this.wardrobe.bonuses();
    const result = this.fishing.reel(
      (bonus.rodPower ?? 0) + this.market.toolLevel('rod') * 0.05,
    );
    if (result.ok && result.fish) {
      audio.play('catch');
      const taken = this.inventory.add(result.fish.id, 1);
      this.ui.toast(
        taken > 0 ? `钓到了 ${result.fish.name}！` : '背包满了，鱼又跑掉了。',
        taken > 0 ? 'good' : 'bad',
      );
      this.updateStats();
      this.save();
    }
    this.ui.showFishing({
      status: this.fishing.lastResult,
      hint: this.fishing.hint,
      marker: this.fishing.marker,
      target: this.fishing.target,
      bandWidth: this.fishing.bandWidth,
      active: this.fishing.isActive,
      bite: this.fishing.stage === 'bite',
    });
    if (!this.fishing.isActive) {
      window.setTimeout(() => {
        if (this.ui.currentPanel === 'fishing') this.closePanel();
      }, 900);
    }
  }

  // ------------------------------------------------------------------ shop

  /** Opens a villager's shop. */
  private openShop(npc: NpcDef): void {
    this.activeShopNpc = npc.id;
    this.refreshShop();
    this.input.setEnabled(false);
    this.input.exitLock();
    this.input.clearActions();
  }

  /** Re-renders the shop panel. */
  private refreshShop(): void {
    const npcId = this.activeShopNpc;
    if (!npcId) return;
    const npc = getNpc(npcId);
    if (!npc) return;
    const buyer = BUYERS[npcId];
    const trustLevel = this.trust.level(npc.id);
    const entries = shopFor(npc.id).map((entry) => {
      // People you know well give you a better price.
      const factor = trustDiscount(npc.id, entry.kind, trustLevel);
      const cost = Math.max(1, Math.round(entry.cost * factor));
      return {
        entry,
        affordable: this.market.canBuy(entry, this.inventory) && this.market.coins >= cost,
        owned: this.market.hasBought(entry.id),
        cost,
      };
    });

    // Tallis mends your tools once you know him.
    const repair = trustRewardFor(npc.id, trustLevel);
    const wornTool = this.toolCards().find((tool) => tool.remaining < tool.max);
    if (repair?.kind === 'repair' && wornTool) {
      entries.push({
        entry: {
          id: 'service.repair',
          name: repair.label,
          icon: '🛠️',
          description: repair.description,
          cost: 0,
          kind: 'tool',
          seller: npc.id,
        },
        affordable: true,
        owned: false,
        cost: 0,
      });
    }

    // Things you made more of than you need.
    const surplus = Object.entries(SURPLUS_PRICES)
      .map(([id, price]) => ({
        id,
        name: getItem(id).name,
        icon: getItem(id).icon,
        count: this.inventory.count(id),
        price,
      }))
      .filter((entry) => entry.count > 0);

    const fishLeft = this.market.fishLeftToday(npc.id);
    const fish = FISH.map((definition) => ({
      id: definition.id,
      name: definition.name,
      icon: definition.icon,
      count: this.inventory.count(definition.id),
      price: this.market.priceOf(definition.id, buyer),
      wanted: buyer.wants === definition.id,
      left: fishLeft,
    })).filter((entry) => entry.count > 0);

    const tools = (['axe', 'pickaxe', 'rod'] as const)
      .filter((tool) => this.market.toolLevel(tool) > 0)
      .map((tool) => {
        const level = this.market.toolLevel(tool);
        const definition = TOOL_LEVELS[tool][level - 1];
        return {
          id: tool,
          name: definition?.label ?? tool,
          icon: tool === 'axe' ? '🪓' : tool === 'pickaxe' ? '⛏️' : '🎣',
          remaining: this.market.toolRemaining(tool),
          refund: this.market.toolRefund(tool),
        };
      });

    // Shells the player can sell. Maren still needs one deep shell.
    const shells = (['shell', 'deepshell'] as const)
      .map((itemId) => {
        const count = this.inventory.count(itemId);
        if (count <= 0) return null;
        const needed =
          itemId === 'deepshell' && count <= 1 && !this.flags['done:sister'];
        return {
          id: itemId,
          name: getItem(itemId).name,
          icon: getItem(itemId).icon,
          count,
          price: shellPrice(itemId, buyer),
          needed,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const reward = trustRewardFor(npc.id, trustLevel);
    this.ui.showShop({
      sellerName: npc.name,
      coins: this.market.coins,
      entries,
      fish,
      shells,
      surplus,
      trust: {
        level: trustLevel,
        max: TRUST_MAX,
        reward: reward?.label ?? null,
      },
      wants: buyer.wants ? getFish(buyer.wants)?.name ?? null : null,
      tools,
    });
  }

  /** Buys something from the shop. */
  private buyEntry(entryId: string): void {
    if (entryId === 'service.repair') {
      this.repairTools();
      return;
    }
    const entry = getShopEntry(entryId);
    if (!entry) return;
    // Food needs a free slot in the backpack.
    if (entry.kind === 'food' && entry.item) {
      if (this.inventory.count(entry.item) >= this.inventory.maxStack) {
        this.ui.toast('背包里已经放不下了。', 'bad');
        return;
      }
    }
    const result = this.market.buy(entry, this.inventory);
    if (!result.ok) {
      this.ui.toast(
        result.reason === 'missing-materials'
          ? '材料不够。'
          : result.reason === 'already-owned'
            ? '你已经买过了。'
            : '钱不够。',
        'bad',
      );
      return;
    }

    if (entry.kind === 'clothing') {
      const id = entry.id.replace('clothing.', '');
      this.wardrobe.own(id);
      this.applyBonuses();
      this.ui.toast(`买下了 ${entry.name}。`, 'good');
    } else if (entry.kind === 'tool' && entry.toolId) {
      this.market.upgradeTool(entry.toolId, entry.level ?? 1);
      this.ui.toast(`${entry.name} 升级完成。`, 'good');
    } else if (entry.kind === 'food' && entry.item) {
      this.inventory.add(entry.item);
      this.ui.toast(`买下了${entry.name}，回背包吃。`, 'good');
    } else if (entry.kind === 'hint') {
      this.ui.toast(`${entry.name}：${entry.description}`, 'quest', 7000);
    }

    this.updateStats();
    this.refreshShop();
    this.save();
  }

  /** Eats something out of the backpack. */
  private eat(itemId: string): void {
    const item = getItem(itemId);
    if (!item?.food) return;
    if (!this.inventory.has(itemId)) return;
    this.inventory.remove(itemId);
    this.satiety.restore(item.food.satiety);
    this.stamina.restore(item.food.stamina);
    this.recomputeStaminaMax();
    this.ui.toast(`吃了${item.name}，肚子舒服多了。`, 'good');
    audio.play('eat');
    this.refreshInventory();
    this.updateStats();
    this.updateStatus();
    this.save();
  }

  /** Tallis mends every tool you carry. */
  private repairTools(): void {
    let repaired = 0;
    for (const tool of ['axe', 'pickaxe', 'rod'] as const) {
      if (this.market.toolLevel(tool) <= 0) continue;
      if (this.market.toolRemaining(tool) >= this.market.toolDurability(tool)) continue;
      this.market.repairTool(tool);
      repaired++;
    }
    if (repaired <= 0) {
      this.ui.toast('你的工具都还好好的。', 'info');
      return;
    }
    this.ui.toast(`Tallis 帮你修好了 ${repaired} 件工具。`, 'good');
    audio.play('craft');
    this.refreshShop();
    this.refreshInventory();
    this.updateStats();
    this.save();
  }

  /** Sells a fish to the villager you are standing at. */
  private sellFish(fishId: string): void {
    const npcId = this.activeShopNpc;
    if (!npcId) return;
    const buyer = BUYERS[npcId];
    const result = this.market.sellFish(fishId, 1, this.inventory, buyer);
    if (!result.ok) {
      this.ui.toast('他今天收够了，明天再来吧。', 'bad');
      return;
    }
    this.ui.toast(`卖掉了 1 条鱼，得到 ${result.coins} 币。`, 'good');
    audio.play('coin');
    this.updateStats();
    this.refreshShop();
    this.save();
  }

  // -------------------------------------------------------------- interior

  /** Opens the inside of the hut. */
  private openInterior(): void {
    const placed = this.interior.list().map((entry) => {
      const definition = getFurniture(entry.id);
      return {
        slot: entry.slot,
        slotLabel: entry.slot,
        name: definition?.name ?? entry.id,
        icon: definition?.icon ?? '❔',
      };
    });

    const furniture = this.interior.availableFurniture.map((definition) => ({
      id: definition.id,
      name: definition.name,
      icon: definition.icon,
      cost: definition.cost,
      owned: this.market.hasBought(`furniture.${definition.id}`),
      affordable: this.market.coins >= definition.cost,
    }));

    const expansions = EXPANSIONS.map((definition) => ({
      definition,
      built: this.interior.isExpanded(definition.id),
      affordable:
        this.interior.canExpand(definition, this.inventory, this.market.coins) ||
        this.market.coins >= definition.cost,
      progress: definition.materials
        .map((m) => `${m.item} ${this.inventory.count(m.item)}/${m.qty}`)
        .join(' · '),
    }));

    this.ui.showInterior({
      placed,
      furniture,
      expansions,
      onPlace: (id) => this.buyFurniture(id),
      onRemove: (slot) => this.removeFurniture(slot as FurnitureSlot),
      onExpand: (id) => this.expandHut(id),
    });
    this.input.setEnabled(false);
    this.input.exitLock();
    this.input.clearActions();
  }

  /** Buys a piece of furniture and puts it in the first free slot. */
  private buyFurniture(furnitureId: string): void {
    const definition = getFurniture(furnitureId);
    if (!definition) return;
    const entryId = `furniture.${furnitureId}`;
    if (!this.market.hasBought(entryId)) {
      const result = this.market.buy(
        {
          id: entryId,
          name: definition.name,
          icon: definition.icon,
          description: definition.description,
          cost: definition.cost,
          kind: 'clothing',
          seller: 'nell',
        },
        this.inventory,
      );
      if (!result.ok) {
        this.ui.toast('钱不够。', 'bad');
        return;
      }
    }
    const slot = this.interior.findSlotFor(furnitureId);
    if (!slot) {
      this.ui.toast('屋里没有空位了。', 'bad');
      return;
    }
    this.interior.place(slot, furnitureId);
    this.world.placeFurniture(furnitureId, slot);
    this.ui.toast(`放好了 ${definition.name}。`, 'good');
    this.openInterior();
    this.updateStats();
    this.save();
  }

  /** Takes a piece of furniture back. */
  private removeFurniture(slot: FurnitureSlot): void {
    const id = this.interior.remove(slot);
    if (!id) return;
    this.world.removeFurniture(slot);
    this.ui.toast('收起来了。', 'good');
    this.openInterior();
    this.updateStats();
    this.save();
  }

  /** Expands the hut. */
  private expandHut(id: string): void {
    const definition = getExpansion(id);
    if (!definition) return;
    const result = this.interior.expand(definition, this.inventory, this.market.coins);
    if (!result.ok) {
      this.ui.toast('材料或钱不够。', 'bad');
      return;
    }
    this.ui.toast(`${definition.name} 完成了。`, 'quest');
    this.openInterior();
    this.updateStats();
    this.save();
  }

  // --------------------------------------------------------------- journal

  /** Opens the journal: quests and friendships. */
  private openJournal(): void {
    const ids: QuestId[] = [
      'firewood',
      'homestead',
      'supplies',
      'heart',
      'beacon',
      'raft',
      'sister',
    ];
    const quests = ids.map((id) => {
      const definition = QUESTS[id];
      const status = this.quests.status(id, this.inventory, this.flags);
      const label =
        status === 'done'
          ? '已完成'
          : status === 'ready'
            ? '可以交付'
            : status === 'locked'
              ? '未解锁'
              : '进行中';
      return {
        title: definition.title,
        summary: definition.summary,
        status: label,
        chapter: definition.chapter,
      };
    });

    // Hints the player has paid Maren for.
    const hints = HINTS.filter((hint) => this.market.hasBought(`hint.${hint.id}`)).map(
      (hint) => ({ title: hint.title, text: hint.text }),
    );

    this.ui.showJournal({
      quests,
      hints,
      trust: NPCS.map((npc) => ({
        name: npc.name,
        level: this.trust.label(npc.id),
      })),
    });
    this.input.setEnabled(false);
    this.input.exitLock();
    this.input.clearActions();
  }

  /** Applies the clothing bonuses to the stamina system. */
  private applyBonuses(): void {
    // Show the clothes on the traveller.
    this.player.avatar.setOutfit(this.wardrobe.list());
    this.recomputeStaminaMax();
  }

  /**
   * Works out how much stamina the traveller can hold.
   *
   * The ceiling drops when the stomach is empty and for every night spent
   * awake, so a sleepless night really does cost you the next morning.
   */
  private recomputeStaminaMax(): void {
    const bonus = this.wardrobe.bonuses();
    // An empty stomach halves what the body can hold; every sleepless night
    // then takes a flat bite out of it.
    const factor = this.satiety.effect.maxFactor;
    this.stamina.setMax(
      staminaCeiling(
        STAMINA.baseMax,
        bonus.staminaMax ?? 0,
        this.sleepDebt,
        factor,
      ),
    );
  }

  /** Updates the clock, the weather light and the stamina. */
  private updateStatus(): void {
    this.ui.setStatus({
      day: this.time.day,
      phase: this.time.phaseLabel,
      weather: this.time.weatherLabel,
      stamina: this.stamina.current,
      staminaMax: this.stamina.max,
      satiety: this.satiety.current,
      satietyMax: this.satiety.max,
      sleepDebt: this.sleepDebt,
      hunger: this.satiety.state,
    });
  }

  // ---------------------------------------------------------------- cleanup

  /** Requests pointer lock (camera control). */
  requestPointerLock(): void {
    this.input.requestLock();
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.input.dispose();
    this.world?.dispose();
    this.renderer.dispose();
  }
}

/**
 * Waits for the next animation frame.
 *
 * Falls back to a timer when the browser does not schedule frames (which
 * happens in a background tab), so booting never gets stuck.
 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };
    requestAnimationFrame(finish);
    setTimeout(finish, 120);
  });
}
