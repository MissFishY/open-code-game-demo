# 🏝️ 低多边形小岛 · Low-Poly Island

A low-poly 3D open-world exploration game built with **Three.js + TypeScript + Vite**.

You wake up on a small island with grass, hills, forests and an inland lake.
Three villagers each need something from you, and each of them is carrying a
trouble of their own. Gather, craft, build, fish, dive, decorate — and give
the island a reason to hum.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script              | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | Start the Vite dev server with hot reload             |
| `npm run build`     | Type-check (`tsc --noEmit`) and build to `dist/`      |
| `npm run preview`   | Serve the production build locally                    |
| `npm run typecheck` | Type-check only                                       |
| `npm test`          | Run the unit test suite once (Vitest)                 |
| `npm run test:watch`| Run the tests in watch mode                           |

## Controls

| Input          | Action                                    |
| -------------- | ----------------------------------------- |
| `W` `A` `S` `D` | Move (relative to the camera)           |
| Mouse          | Look around (click the canvas to capture the pointer) |
| `Shift`        | Sprint (costs stamina)                    |
| `Space`        | Jump                                      |
| `E` / `Enter`  | Interact — talk, chop, mine, fish, dive, build, decorate |
| `Tab` / `I`    | Open / close the backpack                 |
| `J`            | Open the journal (quests and friendships)  |
| `1` `2` `3`    | Pick a dialogue option                     |
| `F1`           | Toggle the controls panel                  |
| `Esc`          | Close a panel / release the mouse          |
| `Delete`       | Erase the save (press twice within 4 s)    |

## The island

The world is **fully deterministic**: it is generated from a single seed
(`WORLD.seed` in `src/config.ts`) with a seeded PRNG, never `Math.random`.
That is what makes it possible to save "the tree I chopped" and have it stay
chopped after a reload.

| Feature      | How it works                                                                 |
| ------------ | ---------------------------------------------------------------------------- |
| Terrain      | An **analytic height function** (`src/world/terrain.ts`) — not a baked heightmap. Collision samples the exact ground height anywhere, with no raycasts and no drift between the visual mesh and the physics. |
| Island shape | Radial falloff × fBm noise + six gaussian hills, with the sea floor continuing downwards past the shoreline. |
| Lake         | A depression carved by blending the terrain down to a flat lake bed. |
| Water        | One large plane with a custom shader. A depth texture baked from the height field drives the turquoise→deep-blue gradient, the shoreline foam and the horizon fade. |
| Vegetation   | Jittered-grid scatter with a minimum spacing filter, driven by a forest-density noise field so trees clump naturally. ~450 trees, rocks, bushes, reeds, flowers, shells and aether crystals, all rendered with `InstancedMesh`. |
| NPCs         | Three villagers with idle animations, floating quest markers and dialogue that changes with the time, the weather, your state and how well you know them. |

## Time, weather and stamina

The island keeps a simple rhythm: **four phases a day** (清晨 / 白天 / 傍晚 / 夜晚)
and the **weather is rolled fresh every morning** (晴 / 雨 / 风). The weather is
deterministic for a given day, so reloading a save always gives you the same
morning.

| Weather | What it changes                                        |
| ------- | ------------------------------------------------------ |
| 晴 clear | Everything normal                                      |
| 雨 rain  | Fish bite far less often, the water is rough, stamina drains faster outdoors |
| 风 wind  | The fish are nervous, the water is choppy              |

**Stamina** drains while sprinting, swimming, chopping, mining and diving, and
recovers while you rest. At zero you cannot sprint and swimming becomes
dangerous. **Resting** in your hut (or by the fire) refills it, rolls the
night over, resets the villagers' greetings and saves the game.

| 动作 | 消耗 | 恢复 |
| ---- | ---- | ---- |
| 冲刺 | 26 / 秒 | 站立 15 / 秒，走路 5 / 秒 |
| 游泳 | 14 / 秒（雨天 ×1.6） | 同上 |
| 潜水 | 20 / 秒 | 同上 |
| 砍树 | 9 / 次 | 同上 |
| 挖矿 | 8 / 次 | 同上 |
| 抛竿 | 5 / 次 | 同上 |

So you can sprint for roughly three seconds before you need to catch your
breath, and a swim across the lake is a real decision rather than a free ride.

## The villagers

Each one has a trade and a trouble of their own.

| NPC | Trade | Personal storyline |
| --- | ----- | ------------------ |
| **Tallis** the ranger | Tools — the axe, the pickaxe and the fishing rod, plus sturdy clothes | *The Light That Went Out* — help him rebuild the beacon that the storm took down |
| **Nell** the forager | Food and practical clothes, including the **swimsuit** | *The Raft* — help her finish the raft she has been building since she was six |
| **Maren** the stone reader | Hints about the island, and a few strange charms | *The One Who Went Down* — find what his sister left at the bottom of the lake |

### The main chain

> 砍木 → 交差 → 合成木板/绳索/石斧 → **盖房子** → 交差 → 继续采集 → 交差 → 通关

1. **Firewood for the Beacon** — *Tallis* wants **3 wood**.
2. **A Roof of Your Own** — raise a **hut** at the village and tell Tallis.
3. **The Forager's Request** — *Nell* wants **4 fiber** and **3 berries**.
4. **Heart of the Island** — *Maren* wants **3 aether crystals** → 👑 Island Crown.

The three personal storylines unlock alongside and never block the main chain.
Finishing all seven gives the warmest ending.

## Crafting, building and the hut

**The workbench** stands in front of the village, and your **hut** doubles as a
second workbench once it is raised.

### Recipes

| Recipe      | In                     | Out      | Effect                                   |
| ----------- | ---------------------- | -------- | ---------------------------------------- |
| **Plank**   | 2 wood                 | 1 plank  | Basic building block                     |
| **Rope**    | 3 fiber                | 1 rope   | Lashes the hut together                  |
| **Stone Axe** 🪓 | 2 stone + 1 fiber | 1 axe | Chop 2 wood per tree |
| **Stone Pickaxe** ⛏️ | 2 stone + 1 plank | 1 pickaxe | Mine 2 stone per swing |
| **Campfire** 🔥 | 3 wood + 2 fiber | 1 campfire | Place it in the fire pit. +3 coziness |
| **Lantern** 🏮 | 1 wood + 1 rope | 1 lantern | Place it by the door. +2 coziness |
| **Banner** 🚩 | 2 fiber + 1 flower | 1 banner | Place it on the roof. +2 coziness |
| **Flowerpot** 🪴 | 1 stone + 1 fiber | 1 flowerpot | Place it outside. +1 coziness |
| **Stool** 🪑 | 1 plank | 1 stool | Place it outside. +1 coziness |

### The tools

Bare hands work — you can always chop a tree or dig a rock. But a tool is
worth its materials:

| 工具 | 得到方式 | 每棵树 / 每块石头 |
| ---- | -------- | ----------------- |
| 徒手 | —— | 1 木材 · 2 石块 |
| **石斧** | **自己合成**：2 石块 + 1 绳索 | 2 木材 · 4 石块 |
| **石镐** | **自己合成**：2 石块 + 1 木板 | 2 木材 · 4 石块 |
| **磨石斧 / 护林员之斧** | Tallis 处 20 / 48 币 + 材料 | 3 / 4 木材 |
| **重石镐 / 矿工之镐** | Tallis 处 20 / 48 币 + 材料 | 3 / 4 石块 |
| **韧鱼竿 / 月见鱼竿** | Tallis 处 30 / 65 币 + 材料 | 绿区更宽 |

**Tallis 只会借你一根鱼竿**（免费，钓鱼是岛上的经济，得一开始就够得着）。
斧头和镐子得你自己打 —— 所以开局的目标很明确：

> 挖 1 块石头（2 下）→ 割 3 根芦苇 → **合成石斧** → 砍树快一倍

石斧到手后效率翻倍，接着做石镐，再找 Tallis 升级工具。

### Blueprints and expansions

| Blueprint / Expansion | In / Cost | What it adds |
| --------------------- | --------- | ------------ |
| **Small Hut** | 4 planks + 2 rope + 2 stone | A door, a lit window, a chimney — and you can walk inside |
| **Porch** | 3 planks + 2 rope + 15 coins | A covered step and a new decoration slot |
| **Upper Floor** | 6 planks + 4 stone + 2 rope + 40 coins | A ladder, a low room and two more slots |
| **Kitchen Nook** | 4 planks + 6 stone + 2 fiber + 35 coins | A stone hearth — and a place to cook |

Inside the hut you can place **furniture** (bed, table, rug, shelf, lamp,
hearth, bench) bought with coins. The roof hides itself while you are inside,
and the door stands open so you can walk in and out.

## Decorating your hut

Press `E` at the hut and choose **布置** (decorate). The panel shows a coziness
meter, everything you have placed and everything in your backpack that you
could place. Placing an item takes it out of your backpack; taking it back
returns it — you can rearrange as much as you like, for free.

### The slots

| Slot kind | Where | How many | Fits                      |
| --------- | ----- | -------- | ------------------------- |
| 火坑 firepit | in front of the door | 1 | campfire |
| 门前 / 门右 / 屋后 / 屋角 | around the hut | 4 | lantern, flowerpot, stool, shell |
| 屋脊 roof ridge | on the roof | 2 | banner |
| 后墙 back wall | on the back wall | 2 | shell |

### Coziness tiers

Every decoration adds coziness. Crossing a tier is noticed by the island,
which sends a gift:

| Coziness | Title                              | Gift              |
| -------- | ---------------------------------- | ----------------- |
| 4        | *Someone lives here now*           | 2 wildflowers     |
| 9        | *A proper little home*             | 1 aether crystal  |
| 14       | *The warmest corner of the island* | 3 berries         |

From coziness 4 onwards the villagers also mention your hut when you talk to
them — each of them has their own line about it.

## Fishing, diving and the economy

### Fishing

Tallis lends you a **竹鱼竿** for free, then look for a fishing spot (a stake
with a float in the water — 6 in the lake, 9 along the shore). The flow is:

1. 按 **E** 抛竿 → 面板显示「等待鱼上钩……」
2. 咬钩时面板会**闪烁**，给出 3.2 秒的反应时间
3. 按 **E** 挂钩 → 标记开始来回移动
4. 标记停在**绿区**里时再按一次 **E** → 上钩！

Missing the green band only loses the fish, never any bait or money. The
rarer the fish, the narrower the band — and the moonfish only rises on a
clear night over the deep part of the lake.

| Fish | Where | Value | Note |
| ---- | ----- | ----- | ---- |
| **Sardine** 🐟 | sea | 2 | Everywhere |
| **Perch** 🐠 | lake | 3 | Everywhere |
| **Mackerel** 🐡 | sea | 7 | Uncommon |
| **Carp** 🎣 | lake | 9 | Uncommon |
| **Moonfish** 🌙 | lake | 26 | Only on a **clear night** |

The beach is deliberately shallow and gentle: you can wade a good few
metres into the sea before the water is too deep to stand in, so you can always
walk back out. Past that the sea floor drops away steeply.

### Diving

**Deep shells** live on the lake floor and the sea bed — 36 of them, worth
more than the beach shells. You cannot reach them by wading: buy the
**swimsuit** from Nell, swim out, and press `E` over them. Diving costs
stamina, so do not stay under too long.

### How you earn money

You start with **30 coins** (the little purse you arrived with) and Tallis
lends you his tools for free, so you can start fishing on day one. Then:

> **钓�� → 卖给村民 → 拿钱 → 买游泳衣 / 衣服 / 家具 / 扩建**

Each villager buys fish at a different rate and is after one species in
particular — the fish they want pays **double**, and the shop marks it with
★:

| Buyer | Rate | Wants |
| ----- | ---- | ----- |
| Tallis | 0.6× | perch (2× rate) |
| Nell | 0.7× | carp (2× rate) |
| Maren | 0.8× | moonfish (2× rate) |

Coins buy the clothes, the food, the furniture and Maren's hints.

## The wardrobe

Clothing is bought with fish money and worn for passive bonuses — and you
can **see it on the traveller**: the swimsuit changes their shirt, the hat
sits on their head, the cloak hangs off their back and the necklace shows at
their collar.

| Piece | Seller | Bonuses |
| ----- | ------ | ------- |
| **Swimsuit** 🩱 | Nell | Lets you swim past the shallows; −25% swimming, −30% diving |
| **Fisherman's Hat** 🎩 | Nell | +20% bite chance, wider catch band |
| **Seaweed Cloak** 🧥 | Nell | +20 max stamina, faster recovery |
| **Waders** 🥾 | Tallis | Faster recovery, −15% swimming drain |
| **Work Coat** 🧥 | Tallis | +15 max stamina, rain no longer drains you |
| **Shell Necklace** 📿 | Maren | +2 coziness, +10% bite chance |
| **Aether Charm** 🔮 | Maren | Faster recovery, −15% diving, +1 coziness |

## Dialogue

The old system had three lines per villager and one fixed set of buttons, so
every conversation felt the same. It is now layered:

| Layer | What it is |
| ----- | ---------- |
| **greet** | How they greet you — depends on trust, the time of day and the weather |
| **quest** | What they want, and what they say when it is done |
| **reactive** | A line about *right now*: your low stamina, your full bag, your house, the fish you are carrying, the weather |
| **chatter** | Idle talk, unlocked as you get to know them (4 trust levels) |

Lines are filtered by conditions, weighted, and **not repeated on the same
day**. The options change too: a villager offers his shop once you have
nothing else to trade, and the journal (`J`) keeps track of every quest and
how well you know each of them.

## 把游戏发给别人玩

游戏是**纯静态站点** —— 没有后端、没有账号、没有联网请求。构建出来的东西直接扔到任何静态托管上就能玩。

### 方式 A：打包成一个 HTML 文件（最省事，推荐）

```bash
npm run build:single
```

会生成 `dist-single/index.html` —— **一个自包含的单文件**（约 680 KB，JS/CSS 全部内联）。
把它和 `试玩说明.txt` 一起压成 ZIP 发给朋友即可：

```bash
npm run build:single
# 然后把 dist-single/ 里的两个文件压缩成 zip
```

朋友收到后**双击 index.html 就能玩**，不用装任何东西、不用联网。
（微信 / QQ 会拦截 `.html` 附件，所以务必发 ZIP。）

### 方式 B：局域网自建（同一 WiFi 下的朋友）

```bash
npm run build
npm run preview -- --host
```

然后把终端里显示的 Network 地址发给他们，例如
`http://100.70.37.121:4173/`。同一个局域网内可以直接访问。

### 方式 C：公网托管（任何人可玩）

`npm run build` 出来的 `dist/` 是一个标准静态站点，直接传到下面任意一个：

| 平台 | 做法 |
| ---- | ---- |
| **Netlify Drop** | 打开 app.netlify.com/drop，把 `dist/` 文件夹拖进去，立刻拿到一个 `https://xxx.netlify.app` 链接 |
| **GitHub Pages** | 推到仓库，仓库设置里开启 Pages，选 `dist` |
| **Cloudflare Pages** | 连接仓库，构建命令 `npm run build`，输出目录 `dist` |
| **itch.io** | 专门做游戏分享的平台，可以设置"仅自己可见"来收集反馈 |

### 存档说明

进度存在浏览器的 `localStorage` 里（键名 `lowpoly-island.save.v1`）。
每个浏览器各存各的，换浏览器或清缓存会丢档。
如果浏览器禁用了本地存储（某些隐私模式），游戏会自动退回到内存存档 —— 能玩，但关掉就没了。
游戏内按 `Delete` 两次可以手动清档。

---

## Project structure

```
src/
├── config.ts            # All tunables in one place
├── data/
│   ├── clothing.ts      # Wardrobe pieces and their bonuses
│   ├── decorations.ts   # Decoration types, slots and coziness tiers
│   ├── dialogue.ts      # The layered voice of each villager
│   ├── fish.ts          # Fish species, habitats and values
│   ├── interior.ts      # Hut expansions and furniture
│   ├── items.ts         # Item definitions
│   ├── npcs.ts          # NPC definitions + the dialogue builder
│   ├── recipes.ts       # Crafting recipes and blueprints
│   └── shop.ts          # Shop entries, tool upgrades and buyer profiles
├── entities/
│   ├── CharacterModel.ts  # Shared low-poly humanoid rig
│   ├── NpcAvatar.ts       # NPC model + idle animation
│   ├── Player.ts          # Third-person controller (movement, swimming, jump)
│   └── PlayerAvatar.ts    # Player model + walk cycle
├── systems/
│   ├── BuildingSystem.ts     # Blueprint state + material checks
│   ├── CameraController.ts   # Orbit camera with terrain + tree avoidance
│   ├── CollisionSystem.ts    # Circle collisions, sliding movement, spatial hash
│   ├── CraftingSystem.ts     # Recipe logic
│   ├── DecorationSystem.ts   # Slots, coziness and tier rewards
│   ├── FishingSystem.ts     # The fishing mini-game
│   ├── Game.ts               # Orchestrator: scene, loop, save/load, interaction
│   ├── InputSystem.ts        # Keyboard + pointer-lock mouse
│   ├── InteractionSystem.ts  # "What am I looking at?" selection
│   ├── InteriorSystem.ts     # Furniture and expansions
│   ├── InventorySystem.ts    # Backpack
│   ├── MarketSystem.ts       # Coins, buying, selling, tool upgrades
│   ├── QuestSystem.ts        # Quest definitions + progression
│   ├── SaveSystem.ts         # localStorage persistence
│   ├── StaminaSystem.ts      # Stamina
│   ├── TimeSystem.ts         # Day, phase and weather
│   ├── TrustSystem.ts        # Friendship with each villager
│   └── WardrobeSystem.ts     # Clothing and its bonuses
├── ui/
│   └── GameUI.ts          # All DOM/UI
├── utils/
│   ├── math.ts            # clamp, lerp, smoothstep, damp, ...
│   ├── noise.ts           # Seeded value noise + fBm
│   └── rng.ts             # Seeded PRNG (mulberry32)
└── world/
    ├── PropBuilder.ts     # Low-poly prop geometries
    ├── ResourceField.ts   # Prop placement, instancing and harvesting
    ├── Structures.ts      # The hut, the workbench, decorations, furniture
    ├── TerrainMesh.ts     # Faceted, vertex-coloured terrain mesh
    ├── Water.ts           # Shaded water surface
    ├── WorldBuilder.ts    # Assembles the world + lighting
    └── terrain.ts         # Pure height / colour / density functions
```

### Design rules

- **Gameplay modules are pure.** `terrain.ts`, `InventorySystem.ts`,
  `CraftingSystem.ts`, `BuildingSystem.ts`, `DecorationSystem.ts`,
  `FishingSystem.ts`, `InteriorSystem.ts`, `MarketSystem.ts`, `StaminaSystem.ts`,
  `TimeSystem.ts`, `TrustSystem.ts`, `WardrobeSystem.ts`, `QuestSystem.ts`,
  `CollisionSystem.ts`, `InteractionSystem.ts` and `SaveSystem.ts` have no
  Three.js and no DOM imports, so they can be unit tested in plain Node.

## Saving

Progress is stored in `localStorage` under `lowpoly-island.save.v1`:

```jsonc
{
  "version": 1,
  "savedAt": 1792563072743,
  "player": { "position": [12.5, 2.16, -9.25], "yaw": 1.1, "pitch": 0.2 },
  "inventory": { "wood": 3, "crystal": 1, "perch": 2 },
  "quests": { "completed": ["firewood"] },
  "harvested": ["node-wood-0--531--6"],
  "build": { "built": ["hut"] },
  "decorations": { "placements": [{ "slot": "firepit", "type": "campfire" }], "claimed": [4] },
  "interior": { "furniture": [{ "slot": "floor-a", "id": "bed" }], "expansions": ["porch"] },
  "wardrobe": { "owned": ["swimsuit"] },
  "market": { "coins": 120, "tools": { "axe": 1, "pickaxe": 0, "rod": 2 }, "bought": ["tool.rod.1"] },
  "trust": { "tallis": 2, "nell": 1, "maren": 0 },
  "time": { "day": 3, "phase": "evening", "weather": "rain" },
  "stamina": { "current": 64, "max": 120 },
  "flags": { "talked:tallis": true, "hut:built": true },
  "playTime": 128.4,
  "seenIntro": true
}
```

The game autosaves every 10 seconds, when the tab is hidden, and when the
page is closed. Saving is defensive: corrupt JSON, unknown item ids, missing
fields and saves from a newer version are all handled gracefully instead of
crashing the game.

## Tests

```bash
npm test
```

158 unit tests covering the terrain (determinism, shoreline continuity, hill
placement), the inventory (stack limits, round-tripping, malformed data), the
save system (versioning, corruption, storage failures), collision (pushing
out of obstacles, sliding along walls, water and slope rules), interaction
targeting, crafting (missing materials, full stacks, multi-step chains),
building (blueprints, double-build protection, crafted-material path),
decorations (slot rules, taking things back, coziness tiers, tier gifts),
the clock and the weather, stamina, the fishing mini-game, the market
(buying, selling, buyer rates, tool upgrades), trust, the wardrobe, the hut
interior, the quest state machine including flag quests, dialogue generation
and world placement.

## Performance notes

- The terrain is one non-indexed mesh with flat shading — 1 draw call.
- Every prop type is an `InstancedMesh` — 1 draw call per type.
- Static colliders live in a uniform spatial hash, so collision only tests the
  handful of obstacles near the player.
- The shadow camera follows the player, keeping the shadow map at a high
  effective resolution without a huge frustum.
