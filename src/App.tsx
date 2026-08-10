

App.tsx
TypeScript

styles.css
檔案
解析檔案

處理時間為 57s
檔案整體定位
這兩個檔案構成一個 React + TypeScript 的翻前範圍記憶訓練 App：

App.tsx：全部功能、範圍資料、訓練邏輯、本機儲存。


styles.css：完整 UI、手機版配置、13×13 Range Matrix 樣式。


目前可以視為：

Preflop Focus v1：將每個 169 手牌類別固定分類成 Raise / Call / Fold，再進行記憶測驗。

1. App 的功能架構
共有四個頁面：

頁面	功能
訓練	隨機出一個位置 + 手牌，回答策略
範圍	查看、建立及修改 13×13 翻前範圍
紀錄	查看答題紀錄、正確率、錯題
設定	App 設定、清除資料、重設 Range
支援 10 種 Scenario：


Open：

UTG Open

HJ Open

CO Open

BTN Open

SB Open

BB 防守：

BB vs UTG

BB vs HJ

BB vs CO

BB vs BTN

BB vs SB

資料模型非常簡單：

type Action = 'raise' | 'call' | 'fold'

type RangeMap = Record<string, Action>
也就是：

AA  → raise
AKs → raise
AQs → call
72o → fold
每個手牌只能有唯一策略。

2. 目前內建 Range
程式目前實際只有：

BB vs UTG

有內建範圍。

其他 9 個 Scenario 預設都是空的，要自己建立。


BB vs UTG：3-Bet
AA-KK
AKs
A6s
A4s-A2s
K6s-K5s
AKo
總共 10 個 hand classes。

Call
QQ-22
AQs-A7s
A5s
KQs-K7s
QJs-Q9s
JTs-J9s
T9s-T8s
98s-97s
87s-86s
76s-75s
65s-64s
54s-53s
43s
AQo-ATo
KQo-KJo
總共 47 個 hand classes。

剩餘：

Fold = 112
所以目前 169 格為：

策略	手牌類別
3-Bet	10
Call	47
Fold	112
合計	169
注意，這是 169 類手牌的格數，不是實際 combo 數。

3. Range 編輯機制
BB 防守 Range 點擊格子時：

Fold
 ↓
Call
 ↓
3-Bet
 ↓
Fold
Open Range 則是：

Fold
 ↓
Raise
 ↓
Fold
所以 UI 本質上是在建立一張：

Hand → 單一 Action
的 lookup table。


這種設計非常適合你之前定義的：

3-Bet > 50% → 固定 3-Bet
Call > 50% → 固定 Call
都沒有 >50% → Fold

前提是轉換工作已經先在外部完成。

4. 一個重要限制：它其實不知道「頻率」
這是目前架構最重要的問題。

例如 GTO 原始策略：

A5s
3bet 42%
Call 56%
Fold 2%
目前 App 無法保存：

42 / 56 / 2
只能保存：

A5s → call
原因就是：

type RangeMap = Record<string, Action>
而不是：

type HandStrategy = {
  raise: number
  call: number
  fold: number
}
因此 App 是一個簡化後策略訓練器，不是 GTO frequency trainer。


5. 「低頻率加注直接棄牌」設定目前沒有作用
設定頁有：

lowFrequencyAsFold: boolean
UI 也有：

低頻率加注直接棄牌
低於 50% 的加注頻率視為 Fold

但是我檢查整份 App.tsx 後，這個值除了：

儲存

checkbox 顯示

修改設定

之外，沒有被任何 Range 計算或 Training 邏輯讀取。 


也就是現在：

開啟 ON
和

關閉 OFF
對實際訓練結果完全沒有差異。

根本原因
程式裡根本沒有：

3bet frequency = 47%
call frequency = 35%
...
這種資料。

所以程式也無從判斷：

frequency < 50%
6. 出題演算法有明顯問題
現在不是正常的 random。

核心是：

const n =
  Math.abs(
    hash(`${scenarioId}-${index}-${questionSeed}`)
  ) % hands.length
然後：

hand = hands[n]


問題一：每次重新進入訓練頁，序列會重置
const [questionSeed, setQuestionSeed] = useState(0)
開始：

setQuestionSeed(x => x + 1)
因此重新進入 TrainingPage：

questionSeed = 0
第一次按「開始」：

questionSeed = 1
所以第一次訓練的題目序列會再次相同。

問題二：同一 Session 可以重複出相同手牌
我實際按程式的 hash 演算法計算過。

某些 seed 的前 20 題會只有：

15 個不同手牌

也就是 20 題內有 5 題是重複的。

所以目前不是：

169 手牌洗牌
→ 每手出一次
而是：

每題 hash
→ % 169
→ 有放回抽樣
這會直接影響 Range 記憶訓練效率。

7. 更適合這個 App 的出題方法
如果目的就是背熟 169 Range，我會把現在的演算法改成：

建立 169 手牌
        ↓
Fisher-Yates Shuffle
        ↓
依序出題
        ↓
169 題全部出完
        ↓
重新洗牌
這樣有三個優點：

一輪內不會重複。

169 題必定完整覆蓋。

題目順序仍然隨機。

這比目前 hash 方法更符合「Range Trainer」用途。

8. 目前是「169 格等權重」
現在：

const hands = Object.keys(range)
也就是 169 格每格被抽中的機率相同。


因此：

AA
AKs
AKo
72o
四者的出題權重全部一樣。

這和真實發牌不同：

類型	Combo
Pair	6
Suited	4
Offsuit	12
例如：

AA  = 6 combos
AKs = 4 combos
AKo = 12 combos
如果目標是Range 記憶：

現在的 169 格等權重反而是合理的。

如果目標是：

模擬實戰遇到各手牌的頻率

就應該按照 combo weighting 出題。

我會保留現在的等權重，因為這個 App 明顯比較像考試工具，而不是發牌模擬器。

9. 訓練流程
目前流程是：

選擇 Scenario
    ↓
選擇固定 / 無限模式
    ↓
出現手牌
    ↓
Raise / Call / Fold
    ↓
立即顯示正解
    ↓
寫入 LocalStorage
    ↓
下一題
固定模式結束後會計算：

正確率

答對數

覆蓋率



覆蓋率：

unique / (pool.length * 169)
例如只練：

BB vs UTG
20 題全部不重複：

20 / 169 = 11.8%
如果有重複，就會更低。

這項設計概念是正確的，但把出題改為洗牌後會更有意義。

10. 紀錄頁有一個文案 Bug
訓練頁知道 BB 防守時：

raise = 3-Bet
因此會顯示：

正確策略：3-Bet

但是紀錄頁直接使用：

actionText.raise = '加注'
所以 BB vs UTG 的錯題紀錄可能顯示：

你的答案：加注
正解：跟注
而不是：

你的答案：3-Bet
正解：跟注


屬於小問題，但應統一。

11. LocalStorage
目前資料全部存在瀏覽器：

pf_ranges_v1
pf_records_v1
pf_settings_v1


優點：

不需要 Server

GitHub Pages 就能使用

不需要登入

非常簡單

缺點：

換裝置資料消失

清 Browser Data 會消失

沒有同步

沒有 Export / Import

Range 很多時不方便備份

而且程式本身 UI 也明確標示：

資料只儲存在這台裝置的瀏覽器。

12. UI / CSS
CSS 是明顯的 mobile-first 設計。


主要結構：

Sticky Topbar
      ↓
內容區 max 820px
      ↓
Fixed Bottom Navigation
畫面大於：

@media (min-width: 700px)
才切成較寬版。


整體視覺：

深色背景

綠色 = Raise

藍色 = Call

灰色 = Fold

紅色 = Wrong

手機安全區 safe-area-inset-*

頂部 sticky

底部固定 navigation

從純 CSS 架構來看相當完整。

13. 13×13 Matrix
這段也是正確的：

if (row === col) return `${a}${b}`
if (row < col) return `${a}${b}s`
return `${b}${a}o`
所以：

對角線 → AA KK QQ...
右上    → AKs AQs...
左下    → AKo AQo...
就是標準 Poker 13×13 Range Matrix。


不過 CSS：

.range-matrix {
  min-width: 620px;
}


因此手機上不是完整縮成一個畫面，而是：

橫向滑動 Matrix。

如果你的要求是「手機上必須完整看到 13×13」，這裡就需要改。

14. 目前最大的架構缺口
按照重要性排序：

優先級	問題	影響
P0	出題序列是假隨機且可能大量重複	直接影響訓練
P0	lowFrequencyAsFold 完全沒作用	設定與實際功能不一致
P1	無法保存 GTO frequency	無法自動執行 >50% 規則
P1	只有 BB vs UTG 內建	其他位置不能直接訓練
P1	Range 只能逐格點擊	建立 10 組範圍非常慢
P2	BB Raise 在紀錄顯示為「加注」	用詞不一致
P2	無 Export / Import	換裝置困難
P2	手機 Matrix 需要橫向滑動	查看速度降低
15. 如果按照你的用途，我建議的 v2 架構
不要急著做完整 Solver。

這個 App 最重要的核心應該維持：

GTO Wizard 原始 Range
        ↓
按照 >50% 規則簡化
        ↓
生成固定 Raise / Call / Fold Range
        ↓
169 手牌無重複隨機訓練
        ↓
統計每個位置、每個手牌的錯誤率
        ↓
錯題加權重複訓練
資料最好改成：

type HandStrategy = {
  raiseFrequency: number
  callFrequency: number
  foldFrequency: number
  simplifiedAction: Action
}
這樣才能真正做到：

3-Bet > 50%
→ 3-Bet

否則 Call > 50%
→ Call

否則
→ Fold
同時還可以保留原始 GTO frequency。

結論
目前這版UI 已經接近完整 App，核心問題反而集中在資料與訓練演算法，而不是介面。

 


最先應該處理三件事：

把出題改成 169 手牌 shuffle，避免一輪重複。

決定是否保存 GTO 原始 frequency；否則刪掉目前無效的 50% 設定。

加入批次輸入 Range 的方式，不能靠 169 格逐格點擊建立 10 個位置。

其中第 1 項是現在最明確的程式邏輯問題；第 2、3 項則決定這個工具能不能真正拿來長期訓練你的 GTO Wizard 翻前範圍。


-把出題改成 169 手牌 shuffle，避免一輪重複。
-刪掉目前無效的 50% 設定。
-加入批次輸入 Range 的方式，不能靠 169 格逐格點擊建立 10 個位置。

處理時間為 2m 55s
已完成三項修改。

修改內容
169 手牌 Shuffle

改用 Fisher–Yates shuffle。

單一位置：169 手牌一輪內不重複。

多位置：以「位置 × 169 手牌」建立整體題庫後洗牌。

固定題數超過一輪、或無限模式時，才重新產生下一輪。

刪除 50% 無效設定

移除 lowFrequencyAsFold 型別、UI、邏輯。

移除舊 LocalStorage 中殘留的此欄位。

移除舊 hash / questionSeed 出題邏輯。

新增批次輸入 Range

每個位置可按「批次輸入」。

Open Range：輸入 Raise。

BB Defend Range：分別輸入 3-Bet / Call。

支援：

AA-KK

A4s-A2s

AQo-ATo

逗號、空白、換行分隔

套用時會整組覆蓋：未輸入的牌全部設為 Fold。

無效格式會報錯。

同一牌同時出現在 3-Bet / Call 時會阻止套用。

版本顯示同步更新為 v1.1.0，TSX 型別檢查已通過。






App.tsx


import { useState } from 'react'

type Action = 'raise' | 'call' | 'fold'
type Page = 'train' | 'ranges' | 'records' | 'settings'
type ScenarioId = 'UTG_OPEN' | 'HJ_OPEN' | 'CO_OPEN' | 'BTN_OPEN' | 'SB_OPEN' | 'BB_VS_UTG' | 'BB_VS_HJ' | 'BB_VS_CO' | 'BB_VS_BTN' | 'BB_VS_SB'

type Scenario = {
  id: ScenarioId
  name: string
  short: string
  kind: 'open' | 'defend'
}

type RangeMap = Record<string, Action>
type RangeStore = Partial<Record<ScenarioId, RangeMap>>

type TrainingRecord = {
  id: string
  scenarioId: ScenarioId
  hand: string
  expected: Action
  answered: Action
  correct: boolean
  at: number
}

type Settings = {
  firstRunDone: boolean
  selected: ScenarioId[]
  mode: 'fixed' | 'infinite'
  handCount: number
}

type TrainingQuestion = {
  scenarioId: ScenarioId
  hand: string
  expected: Action
}

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const

const SCENARIOS: Scenario[] = [
  { id: 'UTG_OPEN', name: 'UTG Open', short: 'UTG', kind: 'open' },
  { id: 'HJ_OPEN', name: 'HJ Open', short: 'HJ', kind: 'open' },
  { id: 'CO_OPEN', name: 'CO Open', short: 'CO', kind: 'open' },
  { id: 'BTN_OPEN', name: 'BTN Open', short: 'BTN', kind: 'open' },
  { id: 'SB_OPEN', name: 'SB Open', short: 'SB', kind: 'open' },
  { id: 'BB_VS_UTG', name: 'BB vs UTG Open', short: 'BB/UTG', kind: 'defend' },
  { id: 'BB_VS_HJ', name: 'BB vs HJ Open', short: 'BB/HJ', kind: 'defend' },
  { id: 'BB_VS_CO', name: 'BB vs CO Open', short: 'BB/CO', kind: 'defend' },
  { id: 'BB_VS_BTN', name: 'BB vs BTN Open', short: 'BB/BTN', kind: 'defend' },
  { id: 'BB_VS_SB', name: 'BB vs SB Open', short: 'BB/SB', kind: 'defend' },
]

const actionText: Record<Action, string> = { raise: '加注', call: '跟注', fold: '棄牌' }

function cellName(row: number, col: number) {
  const a = RANKS[row]
  const b = RANKS[col]
  if (row === col) return `${a}${b}`
  if (row < col) return `${a}${b}s`
  return `${b}${a}o`
}

function emptyRange(): RangeMap {
  const out: RangeMap = {}
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) out[cellName(r, c)] = 'fold'
  return out
}

function expandToken(token: string): string[] {
  token = token.trim()
  if (!token) return []
  if (!token.includes('-')) return [token]
  const [start, end] = token.split('-')
  const pair = /^([AKQJT2-9])\1$/.test(start) && /^([AKQJT2-9])\1$/.test(end)
  if (pair) {
    const s = RANKS.indexOf(start[0] as typeof RANKS[number])
    const e = RANKS.indexOf(end[0] as typeof RANKS[number])
    return RANKS.slice(Math.min(s, e), Math.max(s, e) + 1).map(x => `${x}${x}`)
  }
  const m1 = start.match(/^([AKQJT2-9])([AKQJT2-9])([so])$/)
  const m2 = end.match(/^([AKQJT2-9])([AKQJT2-9])([so])$/)
  if (!m1 || !m2 || m1[1] !== m2[1] || m1[3] !== m2[3]) return [start, end]
  const first = m1[1]
  const suffix = m1[3]
  const s = RANKS.indexOf(m1[2] as typeof RANKS[number])
  const e = RANKS.indexOf(m2[2] as typeof RANKS[number])
  return RANKS.slice(Math.min(s, e), Math.max(s, e) + 1).map(x => `${first}${x}${suffix}`)
}

function rangeFromLists(raiseTokens: string[], callTokens: string[]): RangeMap {
  const out = emptyRange()
  for (const t of raiseTokens.flatMap(expandToken)) if (t in out) out[t] = 'raise'
  for (const t of callTokens.flatMap(expandToken)) if (t in out) out[t] = 'call'
  return out
}

const DEFAULT_BB_VS_UTG = rangeFromLists(
  ['AA-KK', 'AKs', 'A6s', 'A4s-A2s', 'K6s-K5s', 'AKo'],
  ['QQ-22', 'AQs-A7s', 'A5s', 'KQs-K7s', 'QJs-Q9s', 'JTs-J9s', 'T9s-T8s', '98s-97s', '87s-86s', '76s-75s', '65s-64s', '54s-53s', '43s', 'AQo-ATo', 'KQo-KJo'],
)

const DEFAULT_RANGES: RangeStore = { BB_VS_UTG: DEFAULT_BB_VS_UTG }

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

const DEFAULT_SETTINGS: Settings = {
  firstRunDone: false,
  selected: ['BB_VS_UTG'],
  mode: 'fixed',
  handCount: 20,
}

function readSettings(): Settings {
  const saved = readJSON<Partial<Settings>>('pf_settings_v1', {})
  const sanitized: Settings = {
    firstRunDone: typeof saved.firstRunDone === 'boolean' ? saved.firstRunDone : DEFAULT_SETTINGS.firstRunDone,
    selected: Array.isArray(saved.selected) ? saved.selected.filter((id): id is ScenarioId => SCENARIOS.some(s => s.id === id)) : DEFAULT_SETTINGS.selected,
    mode: saved.mode === 'infinite' ? 'infinite' : 'fixed',
    handCount: typeof saved.handCount === 'number' && saved.handCount > 0 ? saved.handCount : DEFAULT_SETTINGS.handCount,
  }
  writeJSON('pf_settings_v1', sanitized)
  return sanitized
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function buildTrainingDeck(pool: ScenarioId[], ranges: RangeStore): TrainingQuestion[] {
  const questions: TrainingQuestion[] = []
  for (const scenarioId of pool) {
    const range = ranges[scenarioId]
    if (!range) continue
    for (const hand of Object.keys(range)) {
      questions.push({ scenarioId, hand, expected: range[hand] })
    }
  }
  return shuffle(questions)
}

function parseRangeInput(text: string) {
  const validHands = emptyRange()
  const hands = new Set<string>()
  const invalid: string[] = []
  const tokens = text.split(/[,，、;；\s]+/).map(t => t.trim()).filter(Boolean)

  for (const token of tokens) {
    const expanded = expandToken(token)
    const validExpanded = expanded.filter(hand => hand in validHands)
    if (!expanded.length || validExpanded.length !== expanded.length) {
      invalid.push(token)
      continue
    }
    validExpanded.forEach(hand => hands.add(hand))
  }

  return { hands: [...hands], invalid }
}

function App() {
  const [page, setPage] = useState<Page>('train')
  const [ranges, setRanges] = useState<RangeStore>(() => readJSON('pf_ranges_v1', DEFAULT_RANGES))
  const [records, setRecords] = useState<TrainingRecord[]>(() => readJSON('pf_records_v1', []))
  const [settings, setSettings] = useState<Settings>(() => readSettings())

  const updateRanges = (next: RangeStore) => { setRanges(next); writeJSON('pf_ranges_v1', next) }
  const updateRecords = (next: TrainingRecord[]) => { setRecords(next); writeJSON('pf_records_v1', next) }
  const updateSettings = (next: Settings) => { setSettings(next); writeJSON('pf_settings_v1', next) }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand-mark">PF</div>
          <div>
            <h1>Preflop Focus</h1>
            <p>6-Max · 100BB · 極速現金桌</p>
          </div>
        </div>
        <span className="pool-pill">Unknown Pool</span>
      </header>

      <main>
        {page === 'train' && <TrainingPage ranges={ranges} settings={settings} updateSettings={updateSettings} records={records} updateRecords={updateRecords} />}
        {page === 'ranges' && <RangesPage ranges={ranges} updateRanges={updateRanges} />}
        {page === 'records' && <RecordsPage records={records} updateRecords={updateRecords} />}
        {page === 'settings' && <SettingsPage updateRanges={updateRanges} records={records} updateRecords={updateRecords} />}
      </main>

      <nav className="bottom-nav" aria-label="主選單">
        <NavButton active={page === 'train'} label="訓練" icon="◎" onClick={() => setPage('train')} />
        <NavButton active={page === 'ranges'} label="範圍" icon="▦" onClick={() => setPage('ranges')} />
        <NavButton active={page === 'records'} label="紀錄" icon="↗" onClick={() => setPage('records')} />
        <NavButton active={page === 'settings'} label="設定" icon="⚙" onClick={() => setPage('settings')} />
      </nav>
    </div>
  )
}

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: string; onClick: () => void }) {
  return <button className={active ? 'nav-btn active' : 'nav-btn'} onClick={onClick}><span>{icon}</span><small>{label}</small></button>
}

function TrainingPage({ ranges, settings, updateSettings, records, updateRecords }: {
  ranges: RangeStore
  settings: Settings
  updateSettings: (s: Settings) => void
  records: TrainingRecord[]
  updateRecords: (r: TrainingRecord[]) => void
}) {
  const configured = SCENARIOS.filter(s => ranges[s.id])
  const activeIds = settings.selected.filter(id => ranges[id])
  const pool = activeIds.length ? activeIds : configured.map(s => s.id)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<Action | null>(null)
  const [deck, setDeck] = useState<TrainingQuestion[]>([])

  const start = () => {
    updateSettings({ ...settings, firstRunDone: true })
    setDeck(buildTrainingDeck(pool, ranges))
    setIndex(0)
    setAnswer(null)
    setSessionStarted(true)
  }

  if (!settings.firstRunDone || !sessionStarted) {
    return <section className="page train-setup">
      <div className="eyebrow">PREFLOP TRAINER</div>
      <h2>{settings.firstRunDone ? '開始新的訓練' : '訓練設定'}</h2>
      <p className="muted">可同時選擇多個位置。每一輪會先將所有可訓練手牌洗牌，同一位置的 169 手牌在該輪內不重複。</p>
      <div className="scenario-grid">
        {SCENARIOS.map(s => {
          const available = !!ranges[s.id]
          const checked = settings.selected.includes(s.id)
          return <button key={s.id} disabled={!available} className={`scenario-choice ${checked ? 'selected' : ''} ${!available ? 'disabled' : ''}`} onClick={() => {
            const next = checked ? settings.selected.filter(x => x !== s.id) : [...settings.selected, s.id]
            updateSettings({ ...settings, selected: next })
          }}>
            <span>{s.name}</span><small>{available ? (checked ? '已選擇' : '可訓練') : '尚未設定範圍'}</small>
          </button>
        })}
      </div>
      <div className="panel inline-settings">
        <div><strong>題數</strong><span className="muted">固定題數或無限模式</span></div>
        <div className="segmented">
          <button className={settings.mode === 'fixed' ? 'active' : ''} onClick={() => updateSettings({ ...settings, mode: 'fixed' })}>固定</button>
          <button className={settings.mode === 'infinite' ? 'active' : ''} onClick={() => updateSettings({ ...settings, mode: 'infinite' })}>無限</button>
        </div>
        {settings.mode === 'fixed' && <input className="number-input" type="number" min={1} max={500} value={settings.handCount} onChange={e => updateSettings({ ...settings, handCount: Math.max(1, Number(e.target.value) || 1) })} />}
      </div>
      <button className="primary wide" onClick={start} disabled={!pool.length}>開始訓練</button>
      {!pool.length && <p className="warning">請先到「範圍」建立至少一組可訓練範圍。</p>}
    </section>
  }

  const sessionDone = settings.mode === 'fixed' && index >= settings.handCount

  if (sessionDone) {
    const recent = records.slice(0, settings.handCount)
    const right = recent.filter(r => r.correct).length
    const unique = new Set(recent.map(r => `${r.scenarioId}:${r.hand}`)).size
    const denom = Math.max(1, pool.length * 169)
    return <section className="page">
      <div className="eyebrow">SESSION COMPLETE</div>
      <h2>本次訓練完成</h2>
      <div className="summary-grid">
        <Metric label="正確率" value={`${Math.round((right / Math.max(1, recent.length)) * 100)}%`} />
        <Metric label="答對" value={`${right}/${recent.length}`} />
        <Metric label="覆蓋率" value={`${((unique / denom) * 100).toFixed(1)}%`} />
      </div>
      <button className="primary wide" onClick={start}>再訓練一次</button>
      <button className="secondary wide" onClick={() => setSessionStarted(false)}>返回設定</button>
    </section>
  }

  const question = deck[index]
  if (!question) return null

  const scenario = SCENARIOS.find(s => s.id === question.scenarioId)!
  const correct = answer === question.expected

  const choose = (a: Action) => {
    if (answer) return
    setAnswer(a)
    const rec: TrainingRecord = {
      id: crypto.randomUUID(), scenarioId: question.scenarioId, hand: question.hand,
      expected: question.expected, answered: a, correct: a === question.expected, at: Date.now(),
    }
    updateRecords([rec, ...records])
  }

  const nextQuestion = () => {
    const nextIndex = index + 1
    const needsAnotherRound = nextIndex >= deck.length && (settings.mode === 'infinite' || nextIndex < settings.handCount)
    if (needsAnotherRound) setDeck(current => [...current, ...buildTrainingDeck(pool, ranges)])
    setIndex(nextIndex)
    setAnswer(null)
  }

  return <section className="page training-card-page">
    <div className="training-progress"><span>{scenario.name}</span><span>{settings.mode === 'fixed' ? `${index + 1} / ${settings.handCount}` : `#${index + 1}`}</span></div>
    <div className="hand-card">
      <small>HERO HAND</small>
      <div className="hand-name">{question.hand}</div>
      <div className="position-badge">{scenario.short}</div>
    </div>
    <p className="question-copy">這手牌的翻前策略是？</p>
    <div className="answer-grid">
      <AnswerButton action="raise" selected={answer} expected={question.expected} onClick={choose} label={scenario.kind === 'defend' ? '3-Bet' : '加注'} />
      {scenario.kind === 'defend' && <AnswerButton action="call" selected={answer} expected={question.expected} onClick={choose} label="跟注" />}
      <AnswerButton action="fold" selected={answer} expected={question.expected} onClick={choose} label="棄牌" />
    </div>
    {answer && <div className={correct ? 'feedback correct' : 'feedback wrong'}>
      <strong>{correct ? '正確' : '錯誤'}</strong>
      <span>正確策略：{question.expected === 'raise' && scenario.kind === 'defend' ? '3-Bet' : actionText[question.expected]}</span>
    </div>}
    {answer && <button className="primary wide" onClick={nextQuestion}>繼續</button>}
  </section>
}

function AnswerButton({ action, selected, expected, onClick, label }: { action: Action; selected: Action | null; expected: Action; onClick: (a: Action) => void; label: string }) {
  let cls = `answer-btn ${action}`
  if (selected) {
    if (action === expected) cls += ' reveal-correct'
    if (action === selected && selected !== expected) cls += ' reveal-wrong'
  }
  return <button className={cls} onClick={() => onClick(action)}>{label}</button>
}

function RangesPage({ ranges, updateRanges }: { ranges: RangeStore; updateRanges: (r: RangeStore) => void }) {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('BB_VS_UTG')
  const scenario = SCENARIOS.find(s => s.id === scenarioId)!
  const range = ranges[scenarioId]
  const [editing, setEditing] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const [raiseInput, setRaiseInput] = useState('')
  const [callInput, setCallInput] = useState('')
  const [batchError, setBatchError] = useState('')

  const ensure = () => {
    if (!range) updateRanges({ ...ranges, [scenarioId]: emptyRange() })
    setEditing(true)
  }

  const cycle = (hand: string) => {
    const current = ranges[scenarioId] || emptyRange()
    const order: Action[] = scenario.kind === 'defend' ? ['fold', 'call', 'raise'] : ['fold', 'raise']
    const i = order.indexOf(current[hand] || 'fold')
    const nextAction = order[(i + 1) % order.length]
    updateRanges({ ...ranges, [scenarioId]: { ...current, [hand]: nextAction } })
  }

  const resetBatchFields = () => {
    setRaiseInput('')
    setCallInput('')
    setBatchError('')
  }

  const applyBatch = () => {
    const raiseParsed = parseRangeInput(raiseInput)
    const callParsed = scenario.kind === 'defend' ? parseRangeInput(callInput) : { hands: [] as string[], invalid: [] as string[] }
    const invalid = [...raiseParsed.invalid, ...callParsed.invalid]

    if (!raiseParsed.hands.length && !callParsed.hands.length) {
      setBatchError('請至少輸入一組手牌。')
      return
    }
    if (invalid.length) {
      setBatchError(`無法辨識：${[...new Set(invalid)].join(', ')}`)
      return
    }

    const overlap = raiseParsed.hands.filter(hand => callParsed.hands.includes(hand))
    if (overlap.length) {
      setBatchError(`同一手牌不能同時指定兩種策略：${overlap.join(', ')}`)
      return
    }

    const next = emptyRange()
    raiseParsed.hands.forEach(hand => { next[hand] = 'raise' })
    callParsed.hands.forEach(hand => { next[hand] = 'call' })
    updateRanges({ ...ranges, [scenarioId]: next })
    setEditing(false)
    setBatchOpen(false)
    resetBatchFields()
  }

  const counts: Record<Action, number> = { raise: 0, call: 0, fold: 0 }
  if (range) {
    for (const action of Object.values(range) as Action[]) counts[action] += 1
  } else {
    counts.fold = 169
  }

  return <section className="page ranges-page">
    <div className="eyebrow">RANGE LIBRARY</div>
    <div className="title-row">
      <div><h2>翻前範圍</h2><p className="muted">可逐格編輯，也可一次貼上整組範圍。</p></div>
      <div className="title-actions">
        <button className="secondary compact" onClick={() => { setBatchOpen(x => !x); setEditing(false); setBatchError('') }}>{batchOpen ? '關閉批次' : '批次輸入'}</button>
        <button className="secondary compact" onClick={() => { setBatchOpen(false); editing ? setEditing(false) : ensure() }}>{editing ? '完成' : '編輯'}</button>
      </div>
    </div>
    <div className="scenario-tabs">
      {SCENARIOS.map(s => <button key={s.id} className={scenarioId === s.id ? 'active' : ''} onClick={() => {
        setScenarioId(s.id)
        setEditing(false)
        setBatchOpen(false)
        resetBatchFields()
      }}>{s.short}</button>)}
    </div>
    <div className="panel range-heading">
      <div><strong>{scenario.name}</strong><span className="muted">{range ? '已設定' : '尚未設定'}</span></div>
      {!range && !batchOpen && <button className="primary compact" onClick={ensure}>建立範圍</button>}
      {range && <div className="legend"><span className="raise-dot">{scenario.kind === 'defend' ? '3-Bet' : '加注'} {counts.raise}</span>{scenario.kind === 'defend' && <span className="call-dot">跟注 {counts.call}</span>}<span className="fold-dot">棄牌 {counts.fold}</span></div>}
    </div>

    {batchOpen && <div className="panel batch-editor">
      <div className="batch-copy">
        <strong>批次覆蓋 {scenario.name}</strong>
        <span>支援逗號、空白或換行分隔；可使用 AA-KK、A4s-A2s 這類區間。未輸入的手牌一律設為 Fold。</span>
      </div>
      <label className="batch-field">
        <span>{scenario.kind === 'defend' ? '3-Bet' : 'Raise'}</span>
        <textarea value={raiseInput} onChange={e => { setRaiseInput(e.target.value); setBatchError('') }} placeholder={scenario.kind === 'defend' ? '例如：AA-KK, AKs, A6s, A4s-A2s, AKo' : '例如：AA-22, AKs-A2s, AKo-ATo'} />
      </label>
      {scenario.kind === 'defend' && <label className="batch-field">
        <span>Call</span>
        <textarea value={callInput} onChange={e => { setCallInput(e.target.value); setBatchError('') }} placeholder="例如：QQ-22, AQs-A7s, A5s, KQs-K7s" />
      </label>}
      {batchError && <div className="batch-error">{batchError}</div>}
      <button className="primary wide" onClick={applyBatch}>套用並覆蓋此範圍</button>
    </div>}

    <RangeMatrix range={range || emptyRange()} editing={editing} onCell={cycle} scenario={scenario} />
    {editing && <p className="helper">編輯模式：{scenario.kind === 'defend' ? 'Fold → Call → 3-Bet → Fold' : 'Fold → Raise → Fold'}</p>}
  </section>
}

function RangeMatrix({ range, editing, onCell, scenario }: { range: RangeMap; editing: boolean; onCell: (h: string) => void; scenario: Scenario }) {
  return <div className="matrix-wrap"><div className="range-matrix">
    {RANKS.map((_, r) => RANKS.map((__, c) => {
      const hand = cellName(r, c)
      const action = range[hand] || 'fold'
      return <button key={hand} disabled={!editing} onClick={() => onCell(hand)} className={`range-cell ${action}`} title={`${hand}: ${action === 'raise' && scenario.kind === 'defend' ? '3-Bet' : actionText[action]}`}>{hand}</button>
    }))}
  </div></div>
}

function RecordsPage({ records, updateRecords }: { records: TrainingRecord[]; updateRecords: (r: TrainingRecord[]) => void }) {
  const [tab, setTab] = useState<'all' | 'wrong'>('all')
  const shown = tab === 'all' ? records : records.filter(r => !r.correct)
  const total = records.length
  const correct = records.filter(r => r.correct).length
  return <section className="page">
    <div className="eyebrow">TRAINING HISTORY</div>
    <h2>訓練紀錄</h2>
    <div className="summary-grid">
      <Metric label="總題數" value={String(total)} />
      <Metric label="正確率" value={total ? `${Math.round(correct / total * 100)}%` : '—'} />
      <Metric label="錯題" value={String(total - correct)} />
    </div>
    <div className="segmented record-tabs"><button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>全部</button><button className={tab === 'wrong' ? 'active' : ''} onClick={() => setTab('wrong')}>錯題</button></div>
    <div className="record-list">
      {!shown.length && <div className="empty-state">尚無紀錄</div>}
      {shown.map(r => {
        const s = SCENARIOS.find(x => x.id === r.scenarioId)!
        return <article className="record-row" key={r.id}>
          <div className={`record-hand ${r.correct ? 'ok' : 'bad'}`}>{r.hand}</div>
          <div className="record-main"><strong>{s.name}</strong><span>{r.correct ? '答對' : `你的答案：${actionText[r.answered]} · 正解：${actionText[r.expected]}`}</span><small>{new Date(r.at).toLocaleString('zh-TW')}</small></div>
          <button className="icon-btn" aria-label="刪除" onClick={() => updateRecords(records.filter(x => x.id !== r.id))}>×</button>
        </article>
      })}
    </div>
  </section>
}

function SettingsPage({ updateRanges, records, updateRecords }: {
  updateRanges: (r: RangeStore) => void; records: TrainingRecord[]; updateRecords: (r: TrainingRecord[]) => void
}) {
  return <section className="page settings-page">
    <div className="eyebrow">APP SETTINGS</div><h2>設定</h2>
    <div className="panel setting-row"><div><strong>遊戲類型</strong><span>6-Max 極速現金桌</span></div><b>固定</b></div>
    <div className="panel setting-row"><div><strong>有效籌碼</strong><span>100BB</span></div><b>固定</b></div>
    <div className="panel setting-row"><div><strong>對手模型</strong><span>Unknown Pool</span></div><b>固定</b></div>
    <div className="danger-zone">
      <h3>資料管理</h3>
      <button className="secondary wide" disabled={!records.length} onClick={() => { if (confirm('刪除全部訓練紀錄？')) updateRecords([]) }}>刪除全部訓練紀錄</button>
      <button className="danger wide" onClick={() => { if (confirm('重設所有自訂範圍？只保留內建 BB vs UTG。')) updateRanges(DEFAULT_RANGES) }}>重設翻前範圍</button>
      <button className="danger wide" onClick={() => { if (confirm('重設整個 App？')) { localStorage.clear(); location.reload() } }}>清除所有本機資料</button>
    </div>
    <div className="about"><strong>Preflop Focus</strong><span>GitHub Pages Edition · v1.1.0</span><small>資料只儲存在這台裝置的瀏覽器。</small></div>
  </section>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>
}


export default App
App.tsx


import { useState } from 'react'

type Action = 'raise' | 'call' | 'fold'
type Page = 'train' | 'ranges' | 'records' | 'settings'
type ScenarioId = 'UTG_OPEN' | 'HJ_OPEN' | 'CO_OPEN' | 'BTN_OPEN' | 'SB_OPEN' | 'BB_VS_UTG' | 'BB_VS_HJ' | 'BB_VS_CO' | 'BB_VS_BTN' | 'BB_VS_SB'

type Scenario = {
  id: ScenarioId
  name: string
  short: string
  kind: 'open' | 'defend'
}

type RangeMap = Record<string, Action>
type RangeStore = Partial<Record<ScenarioId, RangeMap>>

type TrainingRecord = {
  id: string
  scenarioId: ScenarioId
  hand: string
  expected: Action
  answered: Action
  correct: boolean
  at: number
}

type Settings = {
  firstRunDone: boolean
  selected: ScenarioId[]
  mode: 'fixed' | 'infinite'
  handCount: number
}

type TrainingQuestion = {
  scenarioId: ScenarioId
  hand: string
  expected: Action
}

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const

const SCENARIOS: Scenario[] = [
  { id: 'UTG_OPEN', name: 'UTG Open', short: 'UTG', kind: 'open' },
  { id: 'HJ_OPEN', name: 'HJ Open', short: 'HJ', kind: 'open' },
  { id: 'CO_OPEN', name: 'CO Open', short: 'CO', kind: 'open' },
  { id: 'BTN_OPEN', name: 'BTN Open', short: 'BTN', kind: 'open' },
  { id: 'SB_OPEN', name: 'SB Open', short: 'SB', kind: 'open' },
  { id: 'BB_VS_UTG', name: 'BB vs UTG Open', short: 'BB/UTG', kind: 'defend' },
  { id: 'BB_VS_HJ', name: 'BB vs HJ Open', short: 'BB/HJ', kind: 'defend' },
  { id: 'BB_VS_CO', name: 'BB vs CO Open', short: 'BB/CO', kind: 'defend' },
  { id: 'BB_VS_BTN', name: 'BB vs BTN Open', short: 'BB/BTN', kind: 'defend' },
  { id: 'BB_VS_SB', name: 'BB vs SB Open', short: 'BB/SB', kind: 'defend' },
]

const actionText: Record<Action, string> = { raise: '加注', call: '跟注', fold: '棄牌' }

function cellName(row: number, col: number) {
  const a = RANKS[row]
  const b = RANKS[col]
  if (row === col) return `${a}${b}`
  if (row < col) return `${a}${b}s`
  return `${b}${a}o`
}

function emptyRange(): RangeMap {
  const out: RangeMap = {}
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) out[cellName(r, c)] = 'fold'
  return out
}

function expandToken(token: string): string[] {
  token = token.trim()
  if (!token) return []
  if (!token.includes('-')) return [token]
  const [start, end] = token.split('-')
  const pair = /^([AKQJT2-9])\1$/.test(start) && /^([AKQJT2-9])\1$/.test(end)
  if (pair) {
    const s = RANKS.indexOf(start[0] as typeof RANKS[number])
    const e = RANKS.indexOf(end[0] as typeof RANKS[number])
    return RANKS.slice(Math.min(s, e), Math.max(s, e) + 1).map(x => `${x}${x}`)
  }
  const m1 = start.match(/^([AKQJT2-9])([AKQJT2-9])([so])$/)
  const m2 = end.match(/^([AKQJT2-9])([AKQJT2-9])([so])$/)
  if (!m1 || !m2 || m1[1] !== m2[1] || m1[3] !== m2[3]) return [start, end]
  const first = m1[1]
  const suffix = m1[3]
  const s = RANKS.indexOf(m1[2] as typeof RANKS[number])
  const e = RANKS.indexOf(m2[2] as typeof RANKS[number])
  return RANKS.slice(Math.min(s, e), Math.max(s, e) + 1).map(x => `${first}${x}${suffix}`)
}

function rangeFromLists(raiseTokens: string[], callTokens: string[]): RangeMap {
  const out = emptyRange()
  for (const t of raiseTokens.flatMap(expandToken)) if (t in out) out[t] = 'raise'
  for (const t of callTokens.flatMap(expandToken)) if (t in out) out[t] = 'call'
  return out
}

const DEFAULT_BB_VS_UTG = rangeFromLists(
  ['AA-KK', 'AKs', 'A6s', 'A4s-A2s', 'K6s-K5s', 'AKo'],
  ['QQ-22', 'AQs-A7s', 'A5s', 'KQs-K7s', 'QJs-Q9s', 'JTs-J9s', 'T9s-T8s', '98s-97s', '87s-86s', '76s-75s', '65s-64s', '54s-53s', '43s', 'AQo-ATo', 'KQo-KJo'],
)

const DEFAULT_RANGES: RangeStore = { BB_VS_UTG: DEFAULT_BB_VS_UTG }

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

const DEFAULT_SETTINGS: Settings = {
  firstRunDone: false,
  selected: ['BB_VS_UTG'],
  mode: 'fixed',
  handCount: 20,
}

function readSettings(): Settings {
  const saved = readJSON<Partial<Settings>>('pf_settings_v1', {})
  const sanitized: Settings = {
    firstRunDone: typeof saved.firstRunDone === 'boolean' ? saved.firstRunDone : DEFAULT_SETTINGS.firstRunDone,
    selected: Array.isArray(saved.selected) ? saved.selected.filter((id): id is ScenarioId => SCENARIOS.some(s => s.id === id)) : DEFAULT_SETTINGS.selected,
    mode: saved.mode === 'infinite' ? 'infinite' : 'fixed',
    handCount: typeof saved.handCount === 'number' && saved.handCount > 0 ? saved.handCount : DEFAULT_SETTINGS.handCount,
  }
  writeJSON('pf_settings_v1', sanitized)
  return sanitized
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function buildTrainingDeck(pool: ScenarioId[], ranges: RangeStore): TrainingQuestion[] {
  const questions: TrainingQuestion[] = []
  for (const scenarioId of pool) {
    const range = ranges[scenarioId]
    if (!range) continue
    for (const hand of Object.keys(range)) {
      questions.push({ scenarioId, hand, expected: range[hand] })
    }
  }
  return shuffle(questions)
}

function parseRangeInput(text: string) {
  const validHands = emptyRange()
  const hands = new Set<string>()
  const invalid: string[] = []
  const tokens = text.split(/[,，、;；\s]+/).map(t => t.trim()).filter(Boolean)

  for (const token of tokens) {
    const expanded = expandToken(token)
    const validExpanded = expanded.filter(hand => hand in validHands)
    if (!expanded.length || validExpanded.length !== expanded.length) {
      invalid.push(token)
      continue
    }
    validExpanded.forEach(hand => hands.add(hand))
  }

  return { hands: [...hands], invalid }
}

function App() {
  const [page, setPage] = useState<Page>('train')
  const [ranges, setRanges] = useState<RangeStore>(() => readJSON('pf_ranges_v1', DEFAULT_RANGES))
  const [records, setRecords] = useState<TrainingRecord[]>(() => readJSON('pf_records_v1', []))
  const [settings, setSettings] = useState<Settings>(() => readSettings())

  const updateRanges = (next: RangeStore) => { setRanges(next); writeJSON('pf_ranges_v1', next) }
  const updateRecords = (next: TrainingRecord[]) => { setRecords(next); writeJSON('pf_records_v1', next) }
  const updateSettings = (next: Settings) => { setSettings(next); writeJSON('pf_settings_v1', next) }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand-mark">PF</div>
          <div>
            <h1>Preflop Focus</h1>
            <p>6-Max · 100BB · 極速現金桌</p>
          </div>
        </div>
        <span className="pool-pill">Unknown Pool</span>
      </header>

      <main>
        {page === 'train' && <TrainingPage ranges={ranges} settings={settings} updateSettings={updateSettings} records={records} updateRecords={updateRecords} />}
        {page === 'ranges' && <RangesPage ranges={ranges} updateRanges={updateRanges} />}
        {page === 'records' && <RecordsPage records={records} updateRecords={updateRecords} />}
        {page === 'settings' && <SettingsPage updateRanges={updateRanges} records={records} updateRecords={updateRecords} />}
      </main>

      <nav className="bottom-nav" aria-label="主選單">
        <NavButton active={page === 'train'} label="訓練" icon="◎" onClick={() => setPage('train')} />
        <NavButton active={page === 'ranges'} label="範圍" icon="▦" onClick={() => setPage('ranges')} />
        <NavButton active={page === 'records'} label="紀錄" icon="↗" onClick={() => setPage('records')} />
        <NavButton active={page === 'settings'} label="設定" icon="⚙" onClick={() => setPage('settings')} />
      </nav>
    </div>
  )
}

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: string; onClick: () => void }) {
  return <button className={active ? 'nav-btn active' : 'nav-btn'} onClick={onClick}><span>{icon}</span><small>{label}</small></button>
}

function TrainingPage({ ranges, settings, updateSettings, records, updateRecords }: {
  ranges: RangeStore
  settings: Settings
  updateSettings: (s: Settings) => void
  records: TrainingRecord[]
  updateRecords: (r: TrainingRecord[]) => void
}) {
  const configured = SCENARIOS.filter(s => ranges[s.id])
  const activeIds = settings.selected.filter(id => ranges[id])
  const pool = activeIds.length ? activeIds : configured.map(s => s.id)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<Action | null>(null)
  const [deck, setDeck] = useState<TrainingQuestion[]>([])

  const start = () => {
    updateSettings({ ...settings, firstRunDone: true })
    setDeck(buildTrainingDeck(pool, ranges))
    setIndex(0)
    setAnswer(null)
    setSessionStarted(true)
  }

  if (!settings.firstRunDone || !sessionStarted) {
    return <section className="page train-setup">
      <div className="eyebrow">PREFLOP TRAINER</div>
      <h2>{settings.firstRunDone ? '開始新的訓練' : '訓練設定'}</h2>
      <p className="muted">可同時選擇多個位置。每一輪會先將所有可訓練手牌洗牌，同一位置的 169 手牌在該輪內不重複。</p>
      <div className="scenario-grid">
        {SCENARIOS.map(s => {
          const available = !!ranges[s.id]
          const checked = settings.selected.includes(s.id)
          return <button key={s.id} disabled={!available} className={`scenario-choice ${checked ? 'selected' : ''} ${!available ? 'disabled' : ''}`} onClick={() => {
            const next = checked ? settings.selected.filter(x => x !== s.id) : [...settings.selected, s.id]
            updateSettings({ ...settings, selected: next })
          }}>
            <span>{s.name}</span><small>{available ? (checked ? '已選擇' : '可訓練') : '尚未設定範圍'}</small>
          </button>
        })}
      </div>
      <div className="panel inline-settings">
        <div><strong>題數</strong><span className="muted">固定題數或無限模式</span></div>
        <div className="segmented">
          <button className={settings.mode === 'fixed' ? 'active' : ''} onClick={() => updateSettings({ ...settings, mode: 'fixed' })}>固定</button>
          <button className={settings.mode === 'infinite' ? 'active' : ''} onClick={() => updateSettings({ ...settings, mode: 'infinite' })}>無限</button>
        </div>
        {settings.mode === 'fixed' && <input className="number-input" type="number" min={1} max={500} value={settings.handCount} onChange={e => updateSettings({ ...settings, handCount: Math.max(1, Number(e.target.value) || 1) })} />}
      </div>
      <button className="primary wide" onClick={start} disabled={!pool.length}>開始訓練</button>
      {!pool.length && <p className="warning">請先到「範圍」建立至少一組可訓練範圍。</p>}
    </section>
  }

  const sessionDone = settings.mode === 'fixed' && index >= settings.handCount

  if (sessionDone) {
    const recent = records.slice(0, settings.handCount)
    const right = recent.filter(r => r.correct).length
    const unique = new Set(recent.map(r => `${r.scenarioId}:${r.hand}`)).size
    const denom = Math.max(1, pool.length * 169)
    return <section className="page">
      <div className="eyebrow">SESSION COMPLETE</div>
      <h2>本次訓練完成</h2>
      <div className="summary-grid">
        <Metric label="正確率" value={`${Math.round((right / Math.max(1, recent.length)) * 100)}%`} />
        <Metric label="答對" value={`${right}/${recent.length}`} />
        <Metric label="覆蓋率" value={`${((unique / denom) * 100).toFixed(1)}%`} />
      </div>
      <button className="primary wide" onClick={start}>再訓練一次</button>
      <button className="secondary wide" onClick={() => setSessionStarted(false)}>返回設定</button>
    </section>
  }

  const question = deck[index]
  if (!question) return null

  const scenario = SCENARIOS.find(s => s.id === question.scenarioId)!
  const correct = answer === question.expected

  const choose = (a: Action) => {
    if (answer) return
    setAnswer(a)
    const rec: TrainingRecord = {
      id: crypto.randomUUID(), scenarioId: question.scenarioId, hand: question.hand,
      expected: question.expected, answered: a, correct: a === question.expected, at: Date.now(),
    }
    updateRecords([rec, ...records])
  }

  const nextQuestion = () => {
    const nextIndex = index + 1
    const needsAnotherRound = nextIndex >= deck.length && (settings.mode === 'infinite' || nextIndex < settings.handCount)
    if (needsAnotherRound) setDeck(current => [...current, ...buildTrainingDeck(pool, ranges)])
    setIndex(nextIndex)
    setAnswer(null)
  }

  return <section className="page training-card-page">
    <div className="training-progress"><span>{scenario.name}</span><span>{settings.mode === 'fixed' ? `${index + 1} / ${settings.handCount}` : `#${index + 1}`}</span></div>
    <div className="hand-card">
      <small>HERO HAND</small>
      <div className="hand-name">{question.hand}</div>
      <div className="position-badge">{scenario.short}</div>
    </div>
    <p className="question-copy">這手牌的翻前策略是？</p>
    <div className="answer-grid">
      <AnswerButton action="raise" selected={answer} expected={question.expected} onClick={choose} label={scenario.kind === 'defend' ? '3-Bet' : '加注'} />
      {scenario.kind === 'defend' && <AnswerButton action="call" selected={answer} expected={question.expected} onClick={choose} label="跟注" />}
      <AnswerButton action="fold" selected={answer} expected={question.expected} onClick={choose} label="棄牌" />
    </div>
    {answer && <div className={correct ? 'feedback correct' : 'feedback wrong'}>
      <strong>{correct ? '正確' : '錯誤'}</strong>
      <span>正確策略：{question.expected === 'raise' && scenario.kind === 'defend' ? '3-Bet' : actionText[question.expected]}</span>
    </div>}
    {answer && <button className="primary wide" onClick={nextQuestion}>繼續</button>}
  </section>
}

function AnswerButton({ action, selected, expected, onClick, label }: { action: Action; selected: Action | null; expected: Action; onClick: (a: Action) => void; label: string }) {
  let cls = `answer-btn ${action}`
  if (selected) {
    if (action === expected) cls += ' reveal-correct'
    if (action === selected && selected !== expected) cls += ' reveal-wrong'
  }
  return <button className={cls} onClick={() => onClick(action)}>{label}</button>
}

function RangesPage({ ranges, updateRanges }: { ranges: RangeStore; updateRanges: (r: RangeStore) => void }) {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('BB_VS_UTG')
  const scenario = SCENARIOS.find(s => s.id === scenarioId)!
  const range = ranges[scenarioId]
  const [editing, setEditing] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const [raiseInput, setRaiseInput] = useState('')
  const [callInput, setCallInput] = useState('')
  const [batchError, setBatchError] = useState('')

  const ensure = () => {
    if (!range) updateRanges({ ...ranges, [scenarioId]: emptyRange() })
    setEditing(true)
  }

  const cycle = (hand: string) => {
    const current = ranges[scenarioId] || emptyRange()
    const order: Action[] = scenario.kind === 'defend' ? ['fold', 'call', 'raise'] : ['fold', 'raise']
    const i = order.indexOf(current[hand] || 'fold')
    const nextAction = order[(i + 1) % order.length]
    updateRanges({ ...ranges, [scenarioId]: { ...current, [hand]: nextAction } })
  }

  const resetBatchFields = () => {
    setRaiseInput('')
    setCallInput('')
    setBatchError('')
  }

  const applyBatch = () => {
    const raiseParsed = parseRangeInput(raiseInput)
    const callParsed = scenario.kind === 'defend' ? parseRangeInput(callInput) : { hands: [] as string[], invalid: [] as string[] }
    const invalid = [...raiseParsed.invalid, ...callParsed.invalid]

    if (!raiseParsed.hands.length && !callParsed.hands.length) {
      setBatchError('請至少輸入一組手牌。')
      return
    }
    if (invalid.length) {
      setBatchError(`無法辨識：${[...new Set(invalid)].join(', ')}`)
      return
    }

    const overlap = raiseParsed.hands.filter(hand => callParsed.hands.includes(hand))
    if (overlap.length) {
      setBatchError(`同一手牌不能同時指定兩種策略：${overlap.join(', ')}`)
      return
    }

    const next = emptyRange()
    raiseParsed.hands.forEach(hand => { next[hand] = 'raise' })
    callParsed.hands.forEach(hand => { next[hand] = 'call' })
    updateRanges({ ...ranges, [scenarioId]: next })
    setEditing(false)
    setBatchOpen(false)
    resetBatchFields()
  }

  const counts: Record<Action, number> = { raise: 0, call: 0, fold: 0 }
  if (range) {
    for (const action of Object.values(range) as Action[]) counts[action] += 1
  } else {
    counts.fold = 169
  }

  return <section className="page ranges-page">
    <div className="eyebrow">RANGE LIBRARY</div>
    <div className="title-row">
      <div><h2>翻前範圍</h2><p className="muted">可逐格編輯，也可一次貼上整組範圍。</p></div>
      <div className="title-actions">
        <button className="secondary compact" onClick={() => { setBatchOpen(x => !x); setEditing(false); setBatchError('') }}>{batchOpen ? '關閉批次' : '批次輸入'}</button>
        <button className="secondary compact" onClick={() => { setBatchOpen(false); editing ? setEditing(false) : ensure() }}>{editing ? '完成' : '編輯'}</button>
      </div>
    </div>
    <div className="scenario-tabs">
      {SCENARIOS.map(s => <button key={s.id} className={scenarioId === s.id ? 'active' : ''} onClick={() => {
        setScenarioId(s.id)
        setEditing(false)
        setBatchOpen(false)
        resetBatchFields()
      }}>{s.short}</button>)}
    </div>
    <div className="panel range-heading">
      <div><strong>{scenario.name}</strong><span className="muted">{range ? '已設定' : '尚未設定'}</span></div>
      {!range && !batchOpen && <button className="primary compact" onClick={ensure}>建立範圍</button>}
      {range && <div className="legend"><span className="raise-dot">{scenario.kind === 'defend' ? '3-Bet' : '加注'} {counts.raise}</span>{scenario.kind === 'defend' && <span className="call-dot">跟注 {counts.call}</span>}<span className="fold-dot">棄牌 {counts.fold}</span></div>}
    </div>

    {batchOpen && <div className="panel batch-editor">
      <div className="batch-copy">
        <strong>批次覆蓋 {scenario.name}</strong>
        <span>支援逗號、空白或換行分隔；可使用 AA-KK、A4s-A2s 這類區間。未輸入的手牌一律設為 Fold。</span>
      </div>
      <label className="batch-field">
        <span>{scenario.kind === 'defend' ? '3-Bet' : 'Raise'}</span>
        <textarea value={raiseInput} onChange={e => { setRaiseInput(e.target.value); setBatchError('') }} placeholder={scenario.kind === 'defend' ? '例如：AA-KK, AKs, A6s, A4s-A2s, AKo' : '例如：AA-22, AKs-A2s, AKo-ATo'} />
      </label>
      {scenario.kind === 'defend' && <label className="batch-field">
        <span>Call</span>
        <textarea value={callInput} onChange={e => { setCallInput(e.target.value); setBatchError('') }} placeholder="例如：QQ-22, AQs-A7s, A5s, KQs-K7s" />
      </label>}
      {batchError && <div className="batch-error">{batchError}</div>}
      <button className="primary wide" onClick={applyBatch}>套用並覆蓋此範圍</button>
    </div>}

    <RangeMatrix range={range || emptyRange()} editing={editing} onCell={cycle} scenario={scenario} />
    {editing && <p className="helper">編輯模式：{scenario.kind === 'defend' ? 'Fold → Call → 3-Bet → Fold' : 'Fold → Raise → Fold'}</p>}
  </section>
}

function RangeMatrix({ range, editing, onCell, scenario }: { range: RangeMap; editing: boolean; onCell: (h: string) => void; scenario: Scenario }) {
  return <div className="matrix-wrap"><div className="range-matrix">
    {RANKS.map((_, r) => RANKS.map((__, c) => {
      const hand = cellName(r, c)
      const action = range[hand] || 'fold'
      return <button key={hand} disabled={!editing} onClick={() => onCell(hand)} className={`range-cell ${action}`} title={`${hand}: ${action === 'raise' && scenario.kind === 'defend' ? '3-Bet' : actionText[action]}`}>{hand}</button>
    }))}
  </div></div>
}

function RecordsPage({ records, updateRecords }: { records: TrainingRecord[]; updateRecords: (r: TrainingRecord[]) => void }) {
  const [tab, setTab] = useState<'all' | 'wrong'>('all')
  const shown = tab === 'all' ? records : records.filter(r => !r.correct)
  const total = records.length
  const correct = records.filter(r => r.correct).length
  return <section className="page">
    <div className="eyebrow">TRAINING HISTORY</div>
    <h2>訓練紀錄</h2>
    <div className="summary-grid">
      <Metric label="總題數" value={String(total)} />
      <Metric label="正確率" value={total ? `${Math.round(correct / total * 100)}%` : '—'} />
      <Metric label="錯題" value={String(total - correct)} />
    </div>
    <div className="segmented record-tabs"><button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>全部</button><button className={tab === 'wrong' ? 'active' : ''} onClick={() => setTab('wrong')}>錯題</button></div>
    <div className="record-list">
      {!shown.length && <div className="empty-state">尚無紀錄</div>}
      {shown.map(r => {
        const s = SCENARIOS.find(x => x.id === r.scenarioId)!
        return <article className="record-row" key={r.id}>
          <div className={`record-hand ${r.correct ? 'ok' : 'bad'}`}>{r.hand}</div>
          <div className="record-main"><strong>{s.name}</strong><span>{r.correct ? '答對' : `你的答案：${actionText[r.answered]} · 正解：${actionText[r.expected]}`}</span><small>{new Date(r.at).toLocaleString('zh-TW')}</small></div>
          <button className="icon-btn" aria-label="刪除" onClick={() => updateRecords(records.filter(x => x.id !== r.id))}>×</button>
        </article>
      })}
    </div>
  </section>
}

function SettingsPage({ updateRanges, records, updateRecords }: {
  updateRanges: (r: RangeStore) => void; records: TrainingRecord[]; updateRecords: (r: TrainingRecord[]) => void
}) {
  return <section className="page settings-page">
    <div className="eyebrow">APP SETTINGS</div><h2>設定</h2>
    <div className="panel setting-row"><div><strong>遊戲類型</strong><span>6-Max 極速現金桌</span></div><b>固定</b></div>
    <div className="panel setting-row"><div><strong>有效籌碼</strong><span>100BB</span></div><b>固定</b></div>
    <div className="panel setting-row"><div><strong>對手模型</strong><span>Unknown Pool</span></div><b>固定</b></div>
    <div className="danger-zone">
      <h3>資料管理</h3>
      <button className="secondary wide" disabled={!records.length} onClick={() => { if (confirm('刪除全部訓練紀錄？')) updateRecords([]) }}>刪除全部訓練紀錄</button>
      <button className="danger wide" onClick={() => { if (confirm('重設所有自訂範圍？只保留內建 BB vs UTG。')) updateRanges(DEFAULT_RANGES) }}>重設翻前範圍</button>
      <button className="danger wide" onClick={() => { if (confirm('重設整個 App？')) { localStorage.clear(); location.reload() } }}>清除所有本機資料</button>
    </div>
    <div className="about"><strong>Preflop Focus</strong><span>GitHub Pages Edition · v1.1.0</span><small>資料只儲存在這台裝置的瀏覽器。</small></div>
  </section>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>
}


export default App
