# -*- coding: utf-8 -*-
"""
======================================================================
  贪吃蛇 Snake  ——  Python + tkinter 标准库实现
---------------------------------------------------------------------
  运行方式:  python snake.py
  依赖:     仅使用 Python 标准库 (tkinter / random / os)，无需 pip 安装
======================================================================
"""

import os
import random
import tkinter as tk


# ====================== 一、可配置参数 ======================

CELL = 20                 # 每个格子的边长(像素)
COLS = 30                 # 棋盘列数
ROWS = 20                 # 棋盘行数
BOARD_W = CELL * COLS     # 棋盘宽度
BOARD_H = CELL * ROWS     # 棋盘高度

START_DELAY = 140         # 初始每步间隔(毫秒)，越小越快
MIN_DELAY = 60            # 最快速度
SPEED_STEP = 4            # 每吃 5 个食物提速的毫秒数

# 颜色
C_BG = "#10131a"
C_GRID = "#1b2030"
C_SNAKE = "#3fb950"
C_HEAD = "#9ef59e"
C_FOOD = "#ff5d5d"
C_TEXT = "#e6edf3"
C_DIM = "#8b949e"
C_ACCENT = "#58a6ff"

# 方向：坐标 (x=列, y=行)，y 轴向下为正
DIRS = {
    "Up": (0, -1),
    "Down": (0, 1),
    "Left": (-1, 0),
    "Right": (1, 0),
}
OPPOSITE = {"Up": "Down", "Down": "Up", "Left": "Right", "Right": "Left"}

# 按键映射：方向键 + WASD
KEYS = {
    "Up": "Up", "Down": "Down", "Left": "Left", "Right": "Right",
    "w": "Up", "W": "Up",
    "s": "Down", "S": "Down",
    "a": "Left", "A": "Left",
    "d": "Right", "D": "Right",
}

# 字体（负数 = 像素，不受系统 DPI 缩放影响，布局更稳定）
FONT = ("Microsoft YaHei", -16)
FONT_BOLD = ("Microsoft YaHei", -19, "bold")
FONT_BIG = ("Microsoft YaHei", -34, "bold")
FONT_SMALL = ("Microsoft YaHei", -15)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SCORE_FILE = os.path.join(BASE_DIR, "snake_highscore.txt")


# ====================== 二、游戏主类 ======================

class SnakeGame:
    """贪吃蛇游戏主体：负责状态、逻辑与绘制。"""

    def __init__(self, root):
        self.root = root
        root.title("贪吃蛇 Snake Game")
        root.configure(bg=C_BG)
        root.resizable(False, False)

        self.best = self._load_best()

        # ---------- 顶部信息栏 ----------
        header = tk.Frame(root, bg=C_BG)
        header.pack(side="top", fill="x", padx=14, pady=(10, 4))

        self.score_label = tk.Label(header, text="得分: 0", bg=C_BG, fg=C_TEXT,
                                    font=FONT_BOLD, anchor="w")
        self.score_label.pack(side="left")

        self.best_label = tk.Label(header, text=f"最高分: {self.best}", bg=C_BG,
                                   fg=C_ACCENT, font=FONT_BOLD, anchor="e")
        self.best_label.pack(side="right")

        # ---------- 棋盘 ----------
        self.canvas = tk.Canvas(root, width=BOARD_W, height=BOARD_H,
                                bg=C_BG, highlightthickness=0, bd=0)
        self.canvas.pack(padx=14, pady=6)

        # ---------- 底部提示 ----------
        self.status = tk.Label(root, text="", bg=C_BG, fg=C_DIM, font=FONT_SMALL)
        self.status.pack(side="bottom", pady=(2, 12))

        # ---------- 游戏状态 ----------
        self.snake = []            # 蛇身坐标列表，list[0] 是蛇头
        self.direction = "Right"   # 当前移动方向
        self.next_direction = "Right"
        self.food = None
        self.score = 0
        self.state = "ready"       # ready / running / paused / over
        self.reason = ""
        self.timer = None
        self.help_visible = False
        self.paused_by_help = False

        root.bind("<Key>", self.on_key)
        root.protocol("WM_DELETE_WINDOW", root.destroy)

        self.set_status("方向键 / WASD 开始   空格 暂停   R 重开   H 说明   Q 退出")
        self.draw()

    # ---------------- 初始化 / 重开 ----------------

    def new_game(self, start_dir="Right"):
        """开始一局新游戏。"""
        self.snake = [(COLS // 2, ROWS // 2)]
        self.direction = start_dir
        self.next_direction = start_dir
        self.score = 0
        self.reason = ""
        self.help_visible = False
        self.paused_by_help = False
        self.place_food()
        self.state = "running"
        self.update_labels()
        self.set_status("游戏中：吃红色食物，别撞墙、别咬自己！   (H 查看操作说明)")
        self.draw()
        self.start_loop()

    def reset(self):
        """回到初始待机界面。"""
        self.cancel_loop()
        self.snake = []
        self.food = None
        self.score = 0
        self.state = "ready"
        self.update_labels()
        self.set_status("方向键 / WASD 开始   空格 暂停   R 重开   H 说明   Q 退出")
        self.draw()

    # ---------------- 主循环 ----------------

    def delay(self):
        """根据分数计算当前速度（分数越高越快）。"""
        return max(MIN_DELAY, START_DELAY - (self.score // 5) * SPEED_STEP)

    def start_loop(self):
        self.cancel_loop()
        self.timer = self.root.after(self.delay(), self.tick)

    def cancel_loop(self):
        if self.timer is not None:
            try:
                self.root.after_cancel(self.timer)
            except tk.TclError:
                pass
            self.timer = None

    def tick(self):
        """推进一步：移动 -> 判定 -> 绘制 -> 预约下一帧。"""
        if self.state != "running":
            return

        # 应用方向：禁止 180 度掉头(掉头会立刻咬到自己)
        d = self.next_direction
        if OPPOSITE[d] == self.direction:
            d = self.direction
        self.direction = d

        dx, dy = DIRS[self.direction]
        hx, hy = self.snake[0]
        nx, ny = hx + dx, hy + dy

        # 撞墙
        if not (0 <= nx < COLS and 0 <= ny < ROWS):
            self.game_over("撞到墙壁啦！")
            return

        eating = (nx, ny) == self.food
        body = self.snake if eating else self.snake[:-1]  # 不吃食物时尾巴会移走
        if (nx, ny) in body:
            self.game_over("咬到自己啦！")
            return

        self.snake.insert(0, (nx, ny))
        if eating:
            self.score += 1
            self.update_labels()
            self.place_food()
            if self.state == "over":     # 棋盘被填满
                return
        else:
            self.snake.pop()

        self.draw()
        self.timer = self.root.after(self.delay(), self.tick)

    # ---------------- 食物 / 结算 ----------------

    def place_food(self):
        occupied = set(self.snake)
        free = [(x, y) for x in range(COLS) for y in range(ROWS)
                if (x, y) not in occupied]
        if not free:
            self.game_over("完美！整个棋盘都被你填满了")
            return
        self.food = random.choice(free)

    def game_over(self, reason):
        self.state = "over"
        self.reason = reason
        self.cancel_loop()
        if self.score > self.best:
            self.best = self.score
            self._save_best()
        self.update_labels()
        self.set_status(f"{reason}   最终得分 {self.score}")
        self.draw()

    # ---------------- 键盘事件 ----------------

    def on_key(self, event):
        key = event.keysym

        if key in ("q", "Q", "Escape"):
            self.root.destroy()
            return

        if key in ("h", "H", "question"):
            self.toggle_help()
            return

        if key in ("r", "R", "Return", "KP_Enter"):
            self.new_game()
            return

        if key == "space":
            if self.help_visible:
                self.toggle_help()      # 先关闭说明浮层
                return
            if self.state == "running":
                self.state = "paused"
                self.cancel_loop()
                self.set_status("已暂停：按 空格 继续")
                self.draw()
            elif self.state == "paused":
                self.state = "running"
                self.set_status("游戏中：吃红色食物，别撞墙、别咬自己！")
                self.draw()
                self.start_loop()
            return

        d = KEYS.get(key)
        if d is None:
            return

        if self.state == "ready":
            self.new_game(start_dir=d)          # 用按下的方向开局
        elif self.state in ("running", "paused"):
            # 禁止直接反向
            if d != OPPOSITE[self.direction]:
                self.next_direction = d

    # ---------------- 操作说明浮层 ----------------

    def toggle_help(self):
        """显示 / 隐藏操作说明；显示时会自动暂停游戏。"""
        if self.help_visible:
            self.help_visible = False
            if self.paused_by_help:
                self.paused_by_help = False
                if self.state == "paused":
                    self.state = "running"
                    self.set_status("游戏中：吃红色食物，别撞墙、别咬自己！")
                    self.start_loop()
        else:
            self.help_visible = True
            if self.state == "running":
                self.paused_by_help = True
                self.state = "paused"
                self.cancel_loop()
        self.draw()

    # ---------------- 绘制 ----------------

    def draw(self):
        c = self.canvas
        c.delete("all")

        # 网格线
        for i in range(COLS + 1):
            c.create_line(i * CELL, 0, i * CELL, BOARD_H, fill=C_GRID)
        for j in range(ROWS + 1):
            c.create_line(0, j * CELL, BOARD_W, j * CELL, fill=C_GRID)

        # 食物
        if self.food:
            fx, fy = self.food
            cx, cy = fx * CELL + CELL / 2, fy * CELL + CELL / 2
            c.create_oval(cx - 8, cy - 8, cx + 8, cy + 8,
                          fill=C_FOOD, outline="")

        # 蛇身
        for idx, (sx, sy) in enumerate(self.snake):
            x0, y0 = sx * CELL, sy * CELL
            if idx == 0:
                c.create_rectangle(x0 + 1, y0 + 1, x0 + CELL - 1, y0 + CELL - 1,
                                   fill=C_HEAD, outline="")
                self.draw_eyes(c, sx, sy)
            else:
                c.create_rectangle(x0 + 2, y0 + 2, x0 + CELL - 2, y0 + CELL - 2,
                                   fill=C_SNAKE, outline="")

        # 状态浮层
        if self.help_visible:
            self.help_overlay()
        elif self.state == "ready":
            self.overlay("贪吃蛇", "按 方向键 / WASD 开始游戏")
        elif self.state == "paused":
            self.overlay("已暂停", "按 空格 继续")
        elif self.state == "over":
            self.overlay("游戏结束", f"{self.reason}   得分 {self.score}   按 R 重开")

    def draw_eyes(self, canvas, sx, sy):
        """给蛇头画两只眼睛，方向随移动方向变化。"""
        dx, dy = DIRS[self.direction]
        px, py = -dy, dx                      # 垂直方向
        hx = sx * CELL + CELL / 2
        hy = sy * CELL + CELL / 2
        for sign in (-1, 1):
            ex = hx + dx * 4 + px * 4 * sign
            ey = hy + dy * 4 + py * 4 * sign
            canvas.create_oval(ex - 2.6, ey - 2.6, ex + 2.6, ey + 2.6,
                               fill="#0d1117", outline="")

    def overlay(self, title, subtitle):
        """在棋盘中央显示半透明提示块。"""
        c = self.canvas
        w, h = 320, 100
        x0 = (BOARD_W - w) / 2
        y0 = (BOARD_H - h) / 2
        c.create_rectangle(x0, y0, x0 + w, y0 + h,
                           fill=C_BG, outline=C_ACCENT, width=2)
        c.create_text(BOARD_W / 2, y0 + 34, text=title, fill=C_TEXT,
                      font=FONT_BIG)
        c.create_text(BOARD_W / 2, y0 + 72, text=subtitle, fill=C_DIM,
                      font=FONT_SMALL)

    def help_overlay(self):
        """显示操作说明表格（左右两列排版）。"""
        c = self.canvas
        w, h = 440, 210
        x0 = (BOARD_W - w) / 2
        y0 = (BOARD_H - h) / 2
        c.create_rectangle(x0, y0, x0 + w, y0 + h,
                           fill=C_BG, outline=C_ACCENT, width=2)
        c.create_text(BOARD_W / 2, y0 + 30, text="操作说明", fill=C_TEXT,
                      font=FONT_BOLD)
        c.create_line(x0 + 30, y0 + 52, x0 + w - 30, y0 + 52, fill=C_GRID)

        rows = [
            ("↑ ↓ ← →  /  WASD", "控制蛇的方向"),
            ("空格", "暂停 / 继续"),
            ("R", "重新开始"),
            ("H", "显示 / 隐藏本说明"),
            ("Q  /  ESC", "退出游戏"),
        ]
        for i, (k, desc) in enumerate(rows):
            y = y0 + 76 + i * 26
            c.create_text(x0 + 45, y, text=k, fill=C_ACCENT, font=FONT_SMALL,
                          anchor="w")
            c.create_text(x0 + 190, y, text=desc, fill=C_DIM, font=FONT_SMALL,
                          anchor="w")

    # ---------------- 界面文字 ----------------

    def update_labels(self):
        self.score_label.config(text=f"得分: {self.score}")
        self.best_label.config(text=f"最高分: {self.best}")

    def set_status(self, text):
        self.status.config(text=text)

    # ---------------- 最高分读写 ----------------

    def _load_best(self):
        try:
            with open(SCORE_FILE, "r", encoding="utf-8") as f:
                return int(f.read().strip() or 0)
        except (OSError, ValueError):
            return 0

    def _save_best(self):
        try:
            with open(SCORE_FILE, "w", encoding="utf-8") as f:
                f.write(str(self.best))
        except OSError:
            pass


# ====================== 三、程序入口 ======================

def main():
    root = tk.Tk()
    SnakeGame(root)
    root.mainloop()


if __name__ == "__main__":
    main()
