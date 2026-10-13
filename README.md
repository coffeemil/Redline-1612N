# Redline1612N

> 一款关于「刹车踩到刚好」的无限赛车游戏 —— 一脚踩到 1612N，多一牛顿就断。

单指操作、无限赛道、程序化生成的弯道。你唯一要做的判断是：**这一脚刹车，踩多久。**

---

## 玩法

- **按住屏幕** = 刹车，**松手** = 加速。
- 刹车力度会持续累积，仪表盘上的**虚线就是断裂点 1612N**。
- 踩到 1612N 以上 → **刹车线断裂**，车辆失控滑出赛道，本局结束。
- 刹车不足 → 过弯时被离心力推出赛道，同样结束。
- 目标：在断裂之前，把每一脚刹车都踩到刚好。

桌面端用 **空格键** 刹车，**R 键** 重开。

### 两种结算

| 结算 | 触发条件 |
|---|---|
| **出界** | 车辆横向偏移超过路面半宽 |
| **刹车断裂** | 刹车力度达到 1612N，刹车线崩断 |

---

## 快速开始

需要 **Node.js ≥ 20**。

```bash
npm install
npm run dev
```

打开终端里输出的地址（默认 `http://127.0.0.1:5273/`）即可游玩。

### 可用脚本

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动开发服务器，带热更新 |
| `npm run build` | 类型检查 + 生产构建，输出到 `dist/` |
| `npm run preview` | 本地预览 `dist/` 构建产物 |
| `npm run typecheck` | 只跑 `tsc --noEmit` |
| `npm run lint` | ESLint 检查 |
| `npm run lint:fix` | ESLint 自动修复 |
| `npm run check` | lint + typecheck + build 一条龙 |

---

## 技术栈

- **TypeScript**（`strict` 模式，`noUnusedLocals` / `noUnusedParameters` 全开）
- **Vite** 构建与开发服务器
- **Canvas 2D** 渲染，无任何运行时依赖
- **Web Audio API** 音效（程序化合成，无音频资源文件）
- **ESLint** + `typescript-eslint`

整个游戏**零运行时依赖**，`devDependencies` 只有构建工具链。

---

## 架构

```
src/
├── main.ts              入口：拿到 canvas，启动 Game
├── core/                纯逻辑，不碰 DOM
│   ├── config.ts        所有可调参数集中在此（唯一的调参入口）
│   ├── math.ts          clamp / lerp / damp / smoothstep 等数值工具
│   ├── physics.ts       车辆模拟：刹车、速度、横向动力学、漂移
│   ├── track.ts         程序化赛道生成（按弧长增量扩展）
│   ├── camera.ts        跟随镜头 + 震屏
│   ├── effects.ts       粒子系统：胎痕、烟雾、火花
│   ├── viewport.ts      视口尺寸、DPR、安全区
│   └── storage.ts       最高纪录持久化
├── platform/            浏览器胶水层
│   ├── game.ts          主循环：固定步长累加器 + 渲染编排
│   ├── input.ts         指针 / 触摸 / 鼠标 / 键盘统一输入
│   └── audio.ts         Web Audio 音效引擎
└── render/              纯绘制，不持有状态
    ├── road.ts          赛道
    ├── car.ts           车辆
    ├── effects.ts       胎痕 / 粒子 / 火花
    ├── danger.ts        红色危险暗角
    └── hud.ts           仪表盘、刹车条、结算遮罩、重开按钮
```

### 几个值得一提的设计

**固定步长模拟。** 物理永远以 `1/60` 秒的切片推进，渲染每帧一次。60Hz 手机和 144Hz 显示器手感完全一致，不会因为帧率不同导致刹车力度累积速度不一样。

**赛道空间模拟。** 车辆不是在世界坐标里积分，而是在**赛道空间**：`s` 沿中心线前进，`o` 是横向偏移。弯道曲率把车往外推（`aOut`），轮胎抓地力把它拉回来（`aIn`），两者之差积分成横向速度。玩家感受到的推头、抓地和断裂后的失控，都是这个差值的自然结果。

**程序化赛道。** 赛道按弧长增量生成，永不预先分配整条路。每个弯道用 smoothstep 缓入曲率，保证接缝处曲率连续。航向角被限制在起始方向 ±90° 内，防止赛道折回自身。

**粒子预算。** 胎痕 / 烟雾 / 火花都有硬上限，触摸设备用更小的预算（`BUDGETS_COARSE`），长漂移不会把内存吃爆。

**音效全程序化。** 没有 `.mp3` / `.wav`。轮胎噪音是一个循环的带通滤波白噪声，过弯时开滤波器、抬音量；撞击音是方波振荡器 + 低通噪声。`AudioContext` 在首次用户手势时才创建（浏览器要求）。

---

## 浏览器支持

需要支持 Pointer Events、Canvas 2D 和 Web Audio 的现代浏览器。对不支持 Pointer Events 的浏览器有 touch / mouse 回退路径。

针对移动端做了适配：安全区（`env(safe-area-inset-*)`）、`visualViewport` 尺寸、禁用双击缩放与长按菜单、`touch-action: none`。

---

## License

[MIT](./LICENSE)
