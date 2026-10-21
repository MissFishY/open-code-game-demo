/**
 * All DOM/UI handling.
 *
 * The UI layer is intentionally decoupled from the game logic: the game calls
 * setters, the UI renders. Nothing here touches Three.js.
 */

import { getItem } from '../data/items';
import type { DialogueChoice, DialogueNode } from '../data/npcs';
import type { InventoryEntry } from '../systems/InventorySystem';
import type { Recipe } from '../data/recipes';
import type { RequirementProgress } from '../systems/CraftingSystem';
import type { BuildProgress } from '../systems/BuildingSystem';
import type { ShopEntry } from '../data/shop';
import type { ExpansionDef } from '../data/interior';

export type ToastKind = 'info' | 'good' | 'bad' | 'quest';

export type PanelId =
  | 'none'
  | 'inventory'
  | 'crafting'
  | 'building'
  | 'home'
  | 'decor'
  | 'shop'
  | 'fishing'
  | 'interior'
  | 'journal'
  | 'saves';

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing UI element #${id}`);
  return element as T;
}

export class GameUI {
  private readonly objectiveText = requireElement<HTMLParagraphElement>('objective-text');
  private readonly objectiveProgress = requireElement<HTMLParagraphElement>('objective-progress');
  private readonly statWood = requireElement<HTMLSpanElement>('stat-wood');
  private readonly statFiber = requireElement<HTMLSpanElement>('stat-fiber');
  private readonly statCrystal = requireElement<HTMLSpanElement>('stat-crystal');
  private readonly statTotal = requireElement<HTMLSpanElement>('stat-total');
  private readonly statCosy = requireElement<HTMLSpanElement>('stat-cozy');
  private readonly statCoins = requireElement<HTMLSpanElement>('stat-coins');
  private readonly statTime = requireElement<HTMLSpanElement>('stat-time');
  private readonly statWeather = requireElement<HTMLSpanElement>('stat-weather');
  private readonly statTools = requireElement<HTMLSpanElement>('stat-tools');
  private readonly staminaFill = requireElement<HTMLElement>('stamina-fill');
  private readonly staminaLabel = requireElement<HTMLElement>('stamina-label');
  private readonly prompt = requireElement<HTMLDivElement>('prompt');
  private readonly promptText = requireElement<HTMLSpanElement>('prompt-text');
  private readonly toasts = requireElement<HTMLDivElement>('toasts');
  private readonly dialogue = requireElement<HTMLElement>('dialogue');
  private readonly dialogueSpeaker = requireElement<HTMLElement>('dialogue-speaker');
  private readonly dialogueRole = requireElement<HTMLElement>('dialogue-role');
  private readonly dialogueText = requireElement<HTMLParagraphElement>('dialogue-text');
  private readonly dialogueChoices = requireElement<HTMLDivElement>('dialogue-choices');
  private readonly inventory = requireElement<HTMLElement>('inventory');
  private readonly inventoryList = requireElement<HTMLUListElement>('inventory-list');
  private readonly crafting = requireElement<HTMLElement>('crafting');
  private readonly craftingList = requireElement<HTMLUListElement>('crafting-list');
  private readonly building = requireElement<HTMLElement>('building');
  private readonly buildingName = requireElement<HTMLElement>('building-name');
  private readonly buildingDesc = requireElement<HTMLElement>('building-desc');
  private readonly buildingList = requireElement<HTMLUListElement>('building-list');
  private readonly buildButton = requireElement<HTMLButtonElement>('btn-build');
  private readonly home = requireElement<HTMLElement>('home');
  private readonly homeText = requireElement<HTMLElement>('home-text');
  private readonly homeDetail = requireElement<HTMLElement>('home-detail');
  private readonly decor = requireElement<HTMLElement>('decor');
  private readonly decorPlaced = requireElement<HTMLUListElement>('decor-placed');
  private readonly decorOwned = requireElement<HTMLUListElement>('decor-owned');
  private readonly cozyFill = requireElement<HTMLElement>('cozy-fill');
  private readonly cozyValue = requireElement<HTMLElement>('cozy-value');
  private readonly cozyTitle = requireElement<HTMLElement>('cozy-title');
  private readonly shop = requireElement<HTMLElement>('shop');
  private readonly shopTitle = requireElement<HTMLElement>('shop-title');
  private readonly shopList = requireElement<HTMLUListElement>('shop-list');
  private readonly shopSell = requireElement<HTMLUListElement>('shop-sell');
  private readonly shopTools = requireElement<HTMLUListElement>('shop-tools');
  private readonly shopHint = requireElement<HTMLElement>('shop-hint');
  private readonly fishing = requireElement<HTMLElement>('fishing');
  private readonly fishingStatus = requireElement<HTMLElement>('fishing-status');
  private readonly fishingHint = requireElement<HTMLElement>('fishing-hint');
  private readonly fishingMarker = requireElement<HTMLElement>('fishing-marker');
  private readonly fishingTarget = requireElement<HTMLElement>('fishing-target');
  private readonly interior = requireElement<HTMLElement>('interior');
  private readonly interiorFurniture = requireElement<HTMLUListElement>('interior-furniture');
  private readonly interiorExpansions = requireElement<HTMLUListElement>('interior-expansions');
  private readonly journal = requireElement<HTMLElement>('journal');
  private readonly journalList = requireElement<HTMLUListElement>('journal-list');
  private readonly journalTrust = requireElement<HTMLElement>('journal-trust');
  private readonly restButton = requireElement<HTMLButtonElement>('btn-rest');
  private readonly homeDecorButton = requireElement<HTMLButtonElement>('btn-home-decor');
  private readonly homeCraftButton = requireElement<HTMLButtonElement>('btn-home-craft');
  private readonly homeInventoryButton = requireElement<HTMLButtonElement>('btn-home-inv');
  private readonly titleScreen = requireElement<HTMLElement>('title-screen');
  private readonly loadingScreen = requireElement<HTMLElement>('loading-screen');
  private readonly loadingText = requireElement<HTMLElement>('loading-text');
  private readonly titleStatus = requireElement<HTMLElement>('title-status');
  private readonly continueButton = requireElement<HTMLButtonElement>('btn-continue');
  private readonly saves = requireElement<HTMLElement>('saves');
  private readonly saveList = requireElement<HTMLUListElement>('save-list');
  private readonly helpPanel = requireElement<HTMLElement>('help-panel');
  private readonly resumeHint = requireElement<HTMLElement>('resume-hint');

  private dialogueOpen = false;
  private openPanel: PanelId = 'none';

  /** Called when the player picks a dialogue option. */
  onDialogueChoice: ((choice: DialogueChoice) => void) | null = null;
  /** Called when the dialogue is dismissed. */
  onDialogueClose: (() => void) | null = null;
  onContinue: (() => void) | null = null;
  onNewGame: (() => void) | null = null;
  onCraft: ((recipeId: string) => void) | null = null;
  onBuild: (() => void) | null = null;
  onRest: (() => void) | null = null;
  onOpenInventory: (() => void) | null = null;
  onCraftAtHome: (() => void) | null = null;
  onDecorate: (() => void) | null = null;
  /** Called when a panel is closed with the ✕ button. */
  onPanelClosed: (() => void) | null = null;
  /** Called when the player sells a tool. */
  onSellTool: ((toolId: string) => void) | null = null;
  /** Called when a HUD button is pressed. */
  onOpenPanel: ((panel: string) => void) | null = null;
  /** Called when the player buys something from a shop. */
  onBuy: ((entryId: string) => void) | null = null;
  /** Called when the player sells a fish. */
  onSell: ((fishId: string) => void) | null = null;
  /** Called when the player places a piece of furniture. */
  onPlaceFurniture: ((furnitureId: string) => void) | null = null;
  /** Called when the player takes furniture back. */
  onRemoveFurniture: ((slot: string) => void) | null = null;
  /** Called when the player expands the hut. */
  onExpand: ((expansionId: string) => void) | null = null;
  /** Called when the player starts or stops fishing. */
  onCast: (() => void) | null = null;
  onReel: (() => void) | null = null;
  onEndFishing: (() => void) | null = null;

  constructor() {
    this.continueButton.addEventListener('click', () => this.onContinue?.());
    document.getElementById('btn-new')?.addEventListener('click', () => this.onNewGame?.());
    this.buildButton.addEventListener('click', () => this.onBuild?.());
    this.restButton.addEventListener('click', () => this.onRest?.());
    this.homeDecorButton.addEventListener('click', () => this.onDecorate?.());
    this.homeCraftButton.addEventListener('click', () => this.onCraftAtHome?.());
    this.homeInventoryButton.addEventListener('click', () => this.onOpenInventory?.());

    // The HUD buttons open the panels with the mouse.
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-panel]')) {
      button.addEventListener('click', () => {
        const panel = button.getAttribute('data-panel');
        if (panel) this.onOpenPanel?.(panel);
      });
    }

    // Every side panel gets a close button, so the mouse is never needed to
    // escape one.
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-close]')) {
      button.addEventListener('click', () => {
        this.closePanel();
        this.onPanelClosed?.();
      });
    }
  }

  // ---------------------------------------------------------------- loading

  setLoadingText(text: string): void {
    this.loadingText.textContent = text;
  }

  hideLoading(): void {
    this.loadingScreen.classList.add('hidden');
  }

  // ------------------------------------------------------------------ title

  showTitle(hasSave: boolean): void {
    this.titleScreen.classList.remove('hidden');
    this.continueButton.disabled = !hasSave;
    this.titleStatus.textContent = hasSave
      ? '有一座岛在等你回来。'
      : '没有存档 —— 从一座新岛开始。';
  }

  hideTitle(): void {
    this.titleScreen.classList.add('hidden');
  }

  get isTitleVisible(): boolean {
    return !this.titleScreen.classList.contains('hidden');
  }

  // ------------------------------------------------------------------- HUD

  setObjective(title: string, progress = ''): void {
    this.objectiveText.textContent = title;
    this.objectiveProgress.textContent = progress;
  }

  setStats(counts: {
    wood: number;
    fiber: number;
    crystal: number;
    total: number;
    coziness?: number;
    coins?: number;
    /** A short summary of the tools you carry and how much life is left. */
    tools?: string;
  }): void {
    this.statWood.textContent = String(counts.wood);
    this.statFiber.textContent = String(counts.fiber);
    this.statCrystal.textContent = String(counts.crystal);
    this.statTotal.textContent = String(counts.total);
    this.statCosy.textContent = String(counts.coziness ?? 0);
    this.statCoins.textContent = String(counts.coins ?? 0);
    this.statTools.textContent = counts.tools ?? '—';
  }

  /** The clock, the weather and the stamina bar. */
  setStatus(options: {
    day: number;
    phase: string;
    weather: string;
    stamina: number;
    staminaMax: number;
  }): void {
    this.statTime.textContent = `第 ${options.day} 天 · ${options.phase}`;
    this.statWeather.textContent = options.weather;
    const ratio = options.staminaMax > 0 ? options.stamina / options.staminaMax : 0;
    this.staminaFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    this.staminaFill.classList.toggle('is-low', ratio < 0.25);
    this.staminaLabel.textContent = `体力 ${Math.round(options.stamina)}/${options.staminaMax}`;
  }

  setPrompt(text: string | null): void {
    if (!text) {
      this.prompt.classList.add('hidden');
      return;
    }
    this.promptText.textContent = text;
    this.prompt.classList.remove('hidden');
  }

  // ----------------------------------------------------------------- toasts

  toast(message: string, kind: ToastKind = 'info', durationMs = 3200): void {
    const element = document.createElement('div');
    element.className = `toast toast--${kind}`;
    element.textContent = message;
    this.toasts.appendChild(element);

    window.setTimeout(() => {
      element.classList.add('is-fading');
      window.setTimeout(() => element.remove(), 320);
    }, durationMs);
  }

  // --------------------------------------------------------------- dialogue

  get isDialogueOpen(): boolean {
    return this.dialogueOpen;
  }

  showDialogue(node: DialogueNode): void {
    this.dialogueOpen = true;
    this.dialogueSpeaker.textContent = node.speaker;
    this.dialogueRole.textContent = node.role;
    this.dialogueText.textContent = node.text;

    this.dialogueChoices.replaceChildren();
    node.choices.forEach((choice, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice';
      button.textContent = `${index + 1}. ${choice.label}`;
      button.addEventListener('click', () => this.onDialogueChoice?.(choice));
      this.dialogueChoices.appendChild(button);
    });

    this.dialogue.classList.remove('hidden');
  }

  hideDialogue(): void {
    this.dialogueOpen = false;
    this.dialogue.classList.add('hidden');
    this.onDialogueClose?.();
  }

  // ----------------------------------------------------------------- panels

  get currentPanel(): PanelId {
    return this.openPanel;
  }

  get isPanelOpen(): boolean {
    return this.openPanel !== 'none';
  }

  get isInventoryOpen(): boolean {
    return this.openPanel === 'inventory';
  }

  openInventory(entries: readonly InventoryEntry[]): void {
    this.renderInventory(entries);
    this.openPanel = 'inventory';
    this.inventory.classList.remove('hidden');
  }

  closePanel(): void {
    this.openPanel = 'none';
    for (const panel of [
      this.inventory,
      this.crafting,
      this.building,
      this.home,
      this.decor,
      this.shop,
      this.fishing,
      this.interior,
      this.journal,
      this.saves,
    ]) {
      panel.classList.add('hidden');
    }
  }

  renderInventory(entries: readonly InventoryEntry[]): void {
    this.inventoryList.replaceChildren();

    if (entries.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'inventory__empty';
      empty.textContent = '你的背包是空的。';
      this.inventoryList.appendChild(empty);
      return;
    }

    for (const entry of entries) {
      const item = getItem(entry.id);
      const row = document.createElement('li');
      row.className = 'inventory__row';

      const icon = document.createElement('span');
      icon.className = 'inventory__icon';
      icon.textContent = item.icon;

      const name = document.createElement('span');
      name.className = 'inventory__name';
      name.textContent = item.name;
      const desc = document.createElement('span');
      desc.className = 'inventory__desc';
      desc.textContent = item.description;
      name.appendChild(desc);

      const count = document.createElement('span');
      count.className = 'inventory__count';
      count.textContent = `×${entry.count}`;

      row.append(icon, name, count);
      this.inventoryList.appendChild(row);
    }
  }

  // --------------------------------------------------------------- crafting

  showCrafting(
    recipes: readonly Recipe[],
    progressOf: (recipe: Recipe) => RequirementProgress[],
  ): void {
    this.craftingList.replaceChildren();

    for (const recipe of recipes) {
      const progress = progressOf(recipe);
      const ready = progress.every((entry) => entry.satisfied);

      const row = document.createElement('li');
      row.className = ready ? 'recipe recipe--ready' : 'recipe';

      const icon = document.createElement('span');
      icon.className = 'recipe__icon';
      icon.textContent = getItem(recipe.output.item).icon;

      const body = document.createElement('span');
      const name = document.createElement('span');
      name.className = 'recipe__name';
      name.textContent = recipe.name;
      const desc = document.createElement('span');
      desc.className = 'recipe__desc';
      desc.textContent = `${recipe.description} ${recipe.hint}`;
      const inputs = document.createElement('span');
      inputs.className = 'recipe__inputs';
      inputs.innerHTML = progress
        .map((entry) => {
          const item = getItem(entry.item);
          const cls = entry.satisfied ? 'ok' : 'missing';
          return `<span class="${cls}">${item.name} ${entry.have}/${entry.qty}</span>`;
        })
        .join(' · ');
      body.append(name, desc, inputs);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button recipe__craft';
      button.textContent = '制作';
      button.disabled = !ready;
      button.addEventListener('click', () => this.onCraft?.(recipe.id));

      row.append(icon, body, button);
      this.craftingList.appendChild(row);
    }

    this.openPanel = 'crafting';
    this.crafting.classList.remove('hidden');
  }

  // --------------------------------------------------------------- building

  showBuilding(
    name: string,
    description: string,
    progress: readonly BuildProgress[],
    canBuild: boolean,
  ): void {
    this.buildingName.textContent = name;
    this.buildingDesc.textContent = description;

    this.buildingList.replaceChildren();
    for (const entry of progress) {
      const item = getItem(entry.item);
      const row = document.createElement('li');
      row.className = entry.satisfied ? 'recipe recipe--ready' : 'recipe';

      const icon = document.createElement('span');
      icon.className = 'recipe__icon';
      icon.textContent = item.icon;

      const body = document.createElement('span');
      const label = document.createElement('span');
      label.className = 'recipe__name';
      label.textContent = item.name;
      const amount = document.createElement('span');
      amount.className = 'recipe__inputs';
      const cls = entry.satisfied ? 'ok' : 'missing';
      amount.innerHTML = `<span class="${cls}">需要 ${entry.qty}，你有 ${entry.have}</span>`;
      body.append(label, amount);

      row.append(icon, body);
      this.buildingList.appendChild(row);
    }

    this.buildButton.disabled = !canBuild;
    this.buildButton.textContent = canBuild ? '开始建造' : '材料不足';

    this.openPanel = 'building';
    this.building.classList.remove('hidden');
  }

  // ------------------------------------------------------------------- home

  showHome(text: string, detail: string): void {
    this.homeText.textContent = text;
    this.homeDetail.textContent = detail;
    this.openPanel = 'home';
    this.home.classList.remove('hidden');
  }

  // ------------------------------------------------------------ decorations

  showDecor(options: {
    coziness: number;
    maxCoziness: number;
    tierTitle: string;
    placed: { slot: string; slotLabel: string; name: string; icon: string }[];
    owned: { type: string; name: string; icon: string; count: number; description: string }[];
    onPlace: (type: string) => void;
    onRemove: (slot: string) => void;
  }): void {
    const percent =
      options.maxCoziness > 0
        ? Math.min(100, (options.coziness / options.maxCoziness) * 100)
        : 0;
    this.cozyFill.style.width = `${percent}%`;
    this.cozyValue.textContent = `温馨度 ${options.coziness} / ${options.maxCoziness}`;
    this.cozyTitle.textContent = options.tierTitle;

    this.decorPlaced.replaceChildren();
    if (options.placed.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'inventory__empty';
      empty.textContent = '还没有布置任何东西。';
      this.decorPlaced.appendChild(empty);
    } else {
      for (const item of options.placed) {
        const row = document.createElement('li');
        row.className = 'recipe recipe--ready';

        const icon = document.createElement('span');
        icon.className = 'recipe__icon';
        icon.textContent = item.icon;

        const body = document.createElement('span');
        const name = document.createElement('span');
        name.className = 'recipe__name';
        name.textContent = item.name;
        const where = document.createElement('span');
        where.className = 'recipe__inputs';
        where.textContent = item.slotLabel;
        body.append(name, where);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'button recipe__craft';
        button.textContent = '收回';
        button.addEventListener('click', () => options.onRemove(item.slot));

        row.append(icon, body, button);
        this.decorPlaced.appendChild(row);
      }
    }

    this.decorOwned.replaceChildren();
    if (options.owned.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'inventory__empty';
      empty.textContent = '背包里没有可以布置的东西。';
      this.decorOwned.appendChild(empty);
    } else {
      for (const item of options.owned) {
        const row = document.createElement('li');
        row.className = 'recipe';

        const icon = document.createElement('span');
        icon.className = 'recipe__icon';
        icon.textContent = item.icon;

        const body = document.createElement('span');
        const name = document.createElement('span');
        name.className = 'recipe__name';
        name.textContent = `${item.name} ×${item.count}`;
        const desc = document.createElement('span');
        desc.className = 'recipe__desc';
        desc.textContent = item.description;
        body.append(name, desc);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'button recipe__craft';
        button.textContent = '放置';
        button.addEventListener('click', () => options.onPlace(item.type));

        row.append(icon, body, button);
        this.decorOwned.appendChild(row);
      }
    }

    this.openPanel = 'decor';
    this.decor.classList.remove('hidden');
  }

  // ------------------------------------------------------------------ shop

  showShop(options: {
    sellerName: string;
    coins: number;
    entries: { entry: ShopEntry; affordable: boolean; owned: boolean }[];
    fish: { id: string; name: string; icon: string; count: number; price: number; wanted: boolean }[];
    /** The fish this villager is especially keen on. */
    wants?: string | null;
    /** Tools the player owns, with their remaining uses and refund value. */
    tools?: { id: string; name: string; icon: string; remaining: number; refund: number }[];
  }): void {
    this.shopTitle.textContent = `${options.sellerName} 的铺子 · ${options.coins} 币`;
    this.shopHint.textContent = options.wants
      ? `卖鱼换钱。★ 标记的是 ${options.sellerName} 特别想收的鱼，价钱翻倍。`
      : '卖鱼换钱。';

    this.shopList.replaceChildren();
    if (options.entries.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'inventory__empty';
      empty.textContent = '他今天没有想卖的东西。';
      this.shopList.appendChild(empty);
    }
    for (const { entry, affordable, owned } of options.entries) {
      const row = document.createElement('li');
      row.className = affordable && !owned ? 'recipe recipe--ready' : 'recipe';

      const icon = document.createElement('span');
      icon.className = 'recipe__icon';
      icon.textContent = entry.icon;

      const body = document.createElement('span');
      const name = document.createElement('span');
      name.className = 'recipe__name';
      name.textContent = entry.name;
      const desc = document.createElement('span');
      desc.className = 'recipe__desc';
      desc.textContent = entry.description;
      const cost = document.createElement('span');
      cost.className = 'recipe__inputs';
      cost.textContent = owned
        ? '已拥有'
        : entry.gift
          ? '免费借给你'
          : `${entry.cost} 币`;
      body.append(name, desc, cost);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button recipe__craft';
      button.textContent = owned ? '已买' : entry.gift ? '拿走' : '购买';
      button.disabled = owned || !affordable;
      button.addEventListener('click', () => this.onBuy?.(entry.id));

      row.append(icon, body, button);
      this.shopList.appendChild(row);
    }

    this.shopSell.replaceChildren();
    if (options.fish.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'inventory__empty';
      empty.textContent = '背包里没有鱼。';
      this.shopSell.appendChild(empty);
    }
    for (const fish of options.fish) {
      const row = document.createElement('li');
      row.className = 'recipe';

      const icon = document.createElement('span');
      icon.className = 'recipe__icon';
      icon.textContent = fish.icon;

      const body = document.createElement('span');
      const name = document.createElement('span');
      name.className = 'recipe__name';
      name.textContent = `${fish.wanted ? '★ ' : ''}${fish.name} ×${fish.count}`;
      const price = document.createElement('span');
      price.className = 'recipe__inputs';
      price.textContent = fish.wanted
        ? `特别想要这个：${fish.price} 币/条`
        : `卖 ${fish.price} 币/条`;
      body.append(name, price);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button recipe__craft';
      button.textContent = '卖掉';
      button.addEventListener('click', () => this.onSell?.(fish.id));

      row.append(icon, body, button);
      this.shopSell.appendChild(row);
    }

    // --- Tools you can sell ---------------------------------------------
    this.shopTools.replaceChildren();
    const tools = options.tools ?? [];
    if (tools.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'inventory__empty';
      empty.textContent = '你手上没有可以卖的工具。';
      this.shopTools.appendChild(empty);
    }
    for (const tool of tools) {
      const row = document.createElement('li');
      row.className = 'recipe';

      const icon = document.createElement('span');
      icon.className = 'recipe__icon';
      icon.textContent = tool.icon;

      const body = document.createElement('span');
      const name = document.createElement('span');
      name.className = 'recipe__name';
      name.textContent = tool.name;
      const info = document.createElement('span');
      info.className = 'recipe__inputs';
      info.textContent = `还能用 ${tool.remaining} 次 · 卖掉得 ${tool.refund} 币`;
      body.append(name, info);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button recipe__craft';
      button.textContent = '卖掉';
      button.addEventListener('click', () => this.onSellTool?.(tool.id));

      row.append(icon, body, button);
      this.shopTools.appendChild(row);
    }

    this.openPanel = 'shop';
    this.shop.classList.remove('hidden');
  }

  // ----------------------------------------------------------------- saves

  /** Renders the save-slot panel. */
  showSaves(options: {
    slots: {
      slot: number;
      exists: boolean;
      day?: number;
      phase?: string;
      playTime?: number;
      questsCompleted?: number;
    }[];
    currentSlot: number;
    onSelect: (slot: number) => void;
    onLoad: (slot: number) => void;
    onSave: (slot: number) => void;
    onDelete: (slot: number) => void;
  }): void {
    this.saveList.replaceChildren();

    for (const slot of options.slots) {
      const row = document.createElement('li');
      row.className = slot.slot === options.currentSlot ? 'save-slot save-slot--current' : 'save-slot';

      const title = document.createElement('div');
      title.className = 'save-slot__title';
      title.textContent = `存档 ${slot.slot}${slot.slot === options.currentSlot ? '（自动存档）' : ''}`;

      const info = document.createElement('div');
      info.className = 'save-slot__info';
      if (slot.exists) {
        const minutes = Math.round((slot.playTime ?? 0) / 60);
        info.textContent = `第 ${slot.day} 天 · ${slot.phase ?? ''} · 游玩 ${minutes} 分钟 · 任务 ${slot.questsCompleted ?? 0}/7`;
      } else {
        info.textContent = '空存档位';
      }

      const actions = document.createElement('div');
      actions.className = 'save-slot__actions';

      const makeButton = (label: string, onClick: () => void, disabled = false): void => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'button save-slot__button';
        button.textContent = label;
        button.disabled = disabled;
        button.addEventListener('click', onClick);
        actions.appendChild(button);
      };

      makeButton('设为当前', () => options.onSelect(slot.slot), slot.slot === options.currentSlot);
      makeButton('读取', () => options.onLoad(slot.slot), !slot.exists);
      makeButton('保存', () => options.onSave(slot.slot));
      makeButton('删除', () => options.onDelete(slot.slot), !slot.exists);

      row.append(title, info, actions);
      this.saveList.appendChild(row);
    }

    this.openPanel = 'saves';
    this.saves.classList.remove('hidden');
  }

  // ---------------------------------------------------------------- fishing

  showFishing(options: {
    status: string;
    hint: string;
    marker: number;
    target: number;
    bandWidth: number;
    active: boolean;
    bite: boolean;
  }): void {
    this.fishingStatus.textContent = options.status;
    this.fishingHint.textContent = options.hint;
    this.fishing.classList.toggle('is-bite', options.bite);
    this.fishingMarker.style.left = `${options.marker * 100}%`;
    this.fishingTarget.style.left = `${(options.target - options.bandWidth / 2) * 100}%`;
    this.fishingTarget.style.width = `${options.bandWidth * 100}%`;
    this.fishing.classList.toggle('is-hidden', !options.active);
    this.openPanel = 'fishing';
    this.fishing.classList.remove('hidden');
  }

  // --------------------------------------------------------------- interior

  showInterior(options: {
    placed: { slot: string; slotLabel: string; name: string; icon: string }[];
    furniture: { id: string; name: string; icon: string; cost: number; owned: boolean; affordable: boolean }[];
    expansions: { definition: ExpansionDef; built: boolean; affordable: boolean; progress: string }[];
    onPlace: (id: string) => void;
    onRemove: (slot: string) => void;
    onExpand: (id: string) => void;
  }): void {
    this.interiorFurniture.replaceChildren();
    if (options.placed.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'inventory__empty';
      empty.textContent = '屋里还是空的。';
      this.interiorFurniture.appendChild(empty);
    }
    for (const item of options.placed) {
      const row = document.createElement('li');
      row.className = 'recipe recipe--ready';

      const icon = document.createElement('span');
      icon.className = 'recipe__icon';
      icon.textContent = item.icon;

      const body = document.createElement('span');
      const name = document.createElement('span');
      name.className = 'recipe__name';
      name.textContent = item.name;
      const where = document.createElement('span');
      where.className = 'recipe__inputs';
      where.textContent = item.slotLabel;
      body.append(name, where);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button recipe__craft';
      button.textContent = '收回';
      button.addEventListener('click', () => options.onRemove(item.slot));

      row.append(icon, body, button);
      this.interiorFurniture.appendChild(row);
    }

    this.interiorExpansions.replaceChildren();
    for (const item of options.furniture) {
      const row = document.createElement('li');
      row.className = 'recipe';

      const icon = document.createElement('span');
      icon.className = 'recipe__icon';
      icon.textContent = item.icon;

      const body = document.createElement('span');
      const name = document.createElement('span');
      name.className = 'recipe__name';
      name.textContent = item.name;
      const cost = document.createElement('span');
      cost.className = 'recipe__inputs';
      cost.textContent = item.owned ? '已拥有' : `${item.cost} 币`;
      body.append(name, cost);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button recipe__craft';
      button.textContent = item.owned ? '放置' : '购买';
      button.disabled = !item.owned && !item.affordable;
      button.addEventListener('click', () => options.onPlace(item.id));

      row.append(icon, body, button);
      this.interiorExpansions.appendChild(row);
    }

    const expansionList = document.createElement('div');
    expansionList.className = 'recipe-list';
    for (const item of options.expansions) {
      const row = document.createElement('li');
      row.className = 'recipe';

      const icon = document.createElement('span');
      icon.className = 'recipe__icon';
      icon.textContent = '🏗️';

      const body = document.createElement('span');
      const name = document.createElement('span');
      name.className = 'recipe__name';
      name.textContent = item.definition.name;
      const desc = document.createElement('span');
      desc.className = 'recipe__desc';
      desc.textContent = item.definition.description;
      const progress = document.createElement('span');
      progress.className = 'recipe__inputs';
      progress.textContent = item.built ? '已建成' : item.progress;
      body.append(name, desc, progress);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button recipe__craft';
      button.textContent = item.built ? '完成' : '扩建';
      button.disabled = item.built || !item.affordable;
      button.addEventListener('click', () => options.onExpand(item.definition.id));

      row.append(icon, body, button);
      expansionList.appendChild(row);
    }
    this.interiorExpansions.appendChild(expansionList);

    this.openPanel = 'interior';
    this.interior.classList.remove('hidden');
  }

  // ---------------------------------------------------------------- journal

  showJournal(options: {
    quests: { title: string; summary: string; status: string; chapter: string }[];
    trust: { name: string; level: string }[];
  }): void {
    this.journalList.replaceChildren();
    for (const quest of options.quests) {
      const row = document.createElement('li');
      row.className = 'recipe';

      const icon = document.createElement('span');
      icon.className = 'recipe__icon';
      icon.textContent = quest.chapter === 'main' ? '⭐' : '📜';

      const body = document.createElement('span');
      const name = document.createElement('span');
      name.className = 'recipe__name';
      name.textContent = quest.title;
      const desc = document.createElement('span');
      desc.className = 'recipe__desc';
      desc.textContent = quest.summary;
      const status = document.createElement('span');
      status.className = 'recipe__inputs';
      status.textContent = quest.status;
      body.append(name, desc, status);

      row.append(icon, body);
      this.journalList.appendChild(row);
    }

    this.journalTrust.textContent = options.trust
      .map((entry) => `${entry.name}：${entry.level}`)
      .join('　');

    this.openPanel = 'journal';
    this.journal.classList.remove('hidden');
  }

  // ------------------------------------------------------------------- misc

  /** Shows the "click to resume" hint when the mouse is not captured. */
  setResumeHint(visible: boolean): void {
    this.resumeHint.classList.toggle('hidden', !visible);
  }

  /** Shows / hides the controls panel. */
  toggleHelp(): boolean {
    this.helpPanel.classList.toggle('hidden');
    return !this.helpPanel.classList.contains('hidden');
  }
}
