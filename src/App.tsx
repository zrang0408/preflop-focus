import { useMemo, useState } from 'react'

type Action = 'raise' | 'call' | 'fold'
type Page = 'train' | 'ranges' | 'records' | 'settings'
type ScenarioId = 'UTG_OPEN' | 'HJ_OPEN' | 'CO_OPEN' | 'BTN_OPEN' | 'SB_OPEN' | 'BB_VS_UTG' | 'BB_VS_HJ' | 'BB_VS_CO' | 'BB_VS_BTN' | 'BB_VS_SB'

type Scenario = {
  id: ScenarioId
  name: string
  short: string
  kind: 'open' | 'sb_open' | 'defend'
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
  lowFrequencyAsFold: boolean
}

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const

const SCENARIOS: Scenario[] = [
  { id: 'UTG_OPEN', name: 'UTG Open', short: 'UTG', kind: 'open' },
  { id: 'HJ_OPEN', name: 'HJ Open', short: 'HJ', kind: 'open' },
  { id: 'CO_OPEN', name: 'CO Open', short: 'CO', kind: 'open' },
  { id: 'BTN_OPEN', name: 'BTN Open', short: 'BTN', kind: 'open' },
  { id: 'SB_OPEN', name: 'SB Open', short: 'SB', kind: 'sb_open' },
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

const DEFAULT_UTG_OPEN = rangeFromLists(['AA-77', 'AKs-A2s', 'KQs-K5s', 'QJs-Q9s', 'JTs', 'AKo-ATo', 'KQo-KTo'],[],)
const DEFAULT_HJ_OPEN = rangeFromLists(['AA-66', 'AKs-A2s', 'KQs-K4s', 'QJs-Q8s', 'JTs', 'AKo-A9o', 'A5o', 'KQo-KTo', 'QJo'],[],)
const DEFAULT_CO_OPEN = rangeFromLists(['AA-44', 'AKs-A2s', 'KQs-K2s', 'QJs-Q8s', 'JTs-J8s', 'T9s', '98s', 'AKo-A7o', 'A5o', 'KQo-KTo', 'QJo-QTo', 'JTo'],[],)
const DEFAULT_BTN_OPEN = rangeFromLists(['AA-33', 'AKs-A2s', 'KQs-K2s', 'QJs-Q3s', 'JTs-J5s', 'T9s-T6s', '98s-97s', '87s-86s', '76s', '65s', 'AKo-A3o', 'KQo-K8o', 'QJo-Q9o', 'JTo-J9o', 'T9o'],[],)
const DEFAULT_SB_OPEN = rangeFromLists(['AA-KK', 'QQ', 'JJ', 'TT', '99', '44-22', 'AKs-A9s', 'A5s', 'A2s', 'KQs-KTs', 'K7s-K2s', 'QJs', 'Q8s-Q2s', 'J8s-J4s', 'T8s-T6s', '98s-96s', '87s-85s', '76s-75s', '65s-64s', '54s', 'AKo-A3o', 'KQo-K8o', 'QJo-Q9o', 'JTo-J9o', 'T9o', '98o'],
  ['88', '77', '66', '55', 'A8s-A6s', 'A4s-A3s', 'K9s-K8s', 'QTs-Q9s', 'JTs-J9s', 'T9s', 'T5s', '95s', '74s', '53s', 'A2o', 'K7o', 'Q8o'],)

const DEFAULT_BB_VS_UTG = rangeFromLists(['AA-KK', 'AKs', 'A6s', 'A4s-A2s', 'K6s-K5s', 'AKo'],
  ['QQ-22', 'AQs-A7s', 'A5s', 'KQs-K7s', 'QJs-Q9s', 'JTs-J9s', 'T9s-T8s', '98s-97s', '87s-86s', '76s-75s', '65s-64s', '54s-53s', '43s', 'AQo-ATo', 'KQo-KJo'],)

const DEFAULT_BB_VS_HJ = rangeFromLists(['AA-QQ', 'AKs', 'A3s-A2s', 'K6s', 'K4s-K2s', 'Q9s-Q7s', 'AKo', 'A5o'],
  ['JJ-22', 'AQs-A4s', 'KQs-K7s', 'K5s', 'QJs-QTs', 'JTs-J8s', 'T9s-T7s', '98s-97s', '87s-86s', '76s-75s', '65s-64s', '54s-53s', '43s', 'AQo-ATo', 'KQo-KJo', 'QJo'],)

const DEFAULT_BB_VS_CO = rangeFromLists(['AA-JJ', 'AKs', 'K3s-K2s', 'Q6s', 'AKo', 'A5o', 'KJo', 'QJo'],
  ['TT-22', 'AQs-A2s', 'KQs-K4s', 'QJs-Q8s', 'JTs-J8s', 'T9s-T7s', '98s-96s', '87s-86s', '76s-75s', '65s-64s', '54s-53s', '43s', 'AQo-A9o', 'KQo', 'KTo', 'QTo', 'JTo'],)

const DEFAULT_BB_VS_BTN = rangeFromLists(  ['AA-TT', 'AKs-AQs', 'KQs', 'K3s-K2s', 'Q5s', 'Q2s', 'J5s', 'T6s', 'AKo-AQo', 'A5o-A4o', 'KJo-KTo', 'QTo'],
  ['99-22', 'AJs-A2s', 'KJs-K4s', 'QJs-Q6s', 'Q4s-Q3s', 'JTs-J6s', 'T9s-T7s', '98s-96s', '87s-85s', '76s-74s', '65s-64s', '54s-53s', '43s', 'AJo-A7o', 'KQo', 'K9o', 'QJo', 'JTo'],)

const DEFAULT_BB_VS_SB = rangeFromLists(  ['AA-99', 'AKs-AJs', 'A5s-A4s', 'KQs-KJs', 'QJs', 'Q3s-Q2s', 'J6s-J4s', 'T9s', '65s', '54s', 'AKo-AQo', 'A7o-A6o', 'A4o-A2o', 'K9o-K8o', 'Q9o'],
  ['88-22', 'ATs-A6s', 'A3s-A2s', 'KTs-K2s', 'QTs-Q4s', 'JTs-J7s', 'T8s-T6s', '98s-96s', '87s-85s', '76s-74s', '64s', '53s', '43s', 'AJo-A8o', 'A5o', 'KQo-KTo', 'QJo-QTo', 'JTo', 'T9o'],)

  const DEFAULT_RANGES: RangeStore = {
  UTG_OPEN: DEFAULT_UTG_OPEN,
  HJ_OPEN: DEFAULT_HJ_OPEN,
  CO_OPEN: DEFAULT_CO_OPEN,
  BTN_OPEN: DEFAULT_BTN_OPEN,
  SB_OPEN: DEFAULT_SB_OPEN,
  BB_VS_UTG: DEFAULT_BB_VS_UTG,
  BB_VS_HJ: DEFAULT_BB_VS_HJ,
  BB_VS_CO: DEFAULT_BB_VS_CO,
  BB_VS_BTN: DEFAULT_BB_VS_BTN,
  BB_VS_SB: DEFAULT_BB_VS_SB,
}

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

function App() {
  const [page, setPage] = useState<Page>('train')
  const [ranges, setRanges] = useState<RangeStore>(() => ({ ...DEFAULT_RANGES, ...readJSON<RangeStore>('pf_ranges_v1', {}) }))
  const [records, setRecords] = useState<TrainingRecord[]>(() => readJSON('pf_records_v1', []))
  const [settings, setSettings] = useState<Settings>(() => readJSON('pf_settings_v1', {
    firstRunDone: false,
    selected: ['BB_VS_UTG'],
    mode: 'fixed',
    handCount: 20,
    lowFrequencyAsFold: true,
  }))

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
        {page === 'settings' && <SettingsPage settings={settings} updateSettings={updateSettings} ranges={ranges} updateRanges={updateRanges} records={records} updateRecords={updateRecords} />}
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

//訓練設定位置分組
function ScenarioGroup({ title, scenarios, ranges, settings, updateSettings }: { title:string; scenarios:Scenario[]; ranges:RangeStore; settings:Settings; updateSettings:(s:Settings)=>void }) {
  return <div className="scenario-section">
    <div className="scenario-section-title">{title}</div>
    <div className="scenario-grid">
      {scenarios.map(s => {
        const available = !!ranges[s.id], checked = settings.selected.includes(s.id)
        return <button key={s.id} disabled={!available} className={`scenario-choice ${checked ? 'selected' : ''} ${!available ? 'disabled' : ''}`} onClick={() => updateSettings({ ...settings, selected: checked ? settings.selected.filter(x => x !== s.id) : [...settings.selected, s.id] })}>
          <span>{s.name}</span><small>{available ? (checked ? '已選擇' : '可訓練') : '尚未設定範圍'}</small>
        </button>
      })}
    </div>
  </div>
}

type Suit = '♠' | '♥' | '♦' | '♣'

type PlayingCard = {
  rank: string
  suit: Suit
}

type TrainingQuestion = {
  scenarioId: ScenarioId
  hand: string
  cards: [PlayingCard, PlayingCard]
  expected: Action
}

const SUITS: Suit[] = ['♠', '♥', '♦', '♣']
const SEATS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']

//產生兩張實際牌
function drawCardsForHand(hand: string): [PlayingCard, PlayingCard] {
  const match = hand.match(/^([AKQJT2-9])([AKQJT2-9])([so])?$/)

  if (!match) {
    return [
      { rank: '?', suit: '♠' },
      { rank: '?', suit: '♥' },
    ]
  }

  const [, firstRank, secondRank, suitedness] = match

  const firstSuit =
    SUITS[Math.floor(Math.random() * SUITS.length)]

  // 同花牌，例如 AKs
  if (suitedness === 's') {
    return [
      { rank: firstRank, suit: firstSuit },
      { rank: secondRank, suit: firstSuit },
    ]
  }

  // 非同花牌以及口袋對
  const otherSuits =
    SUITS.filter(suit => suit !== firstSuit)

  const secondSuit =
    otherSuits[Math.floor(Math.random() * otherSuits.length)]

  return [
    { rank: firstRank, suit: firstSuit },
    { rank: secondRank, suit: secondSuit },
  ]
}

//新增單張撲克牌元件
function PlayingCardView({
  card,
}: {
  card: PlayingCard
}) {
  const red =
    card.suit === '♥' ||
    card.suit === '♦'

  return (
    <div
      className={`playing-card ${red ? 'red' : 'black'}`}
      aria-label={`${card.rank}${card.suit}`}
    >
      <span className="playing-card-rank">
        {card.rank}
      </span>

      <span className="playing-card-suit">
        {card.suit}
      </span>
    </div>
  )
}

function PositionTable({ scenario }: { scenario: Scenario }) {
  const hero = scenario.kind === 'defend' ? 'BB' : scenario.id.split('_')[0]
  const opener = scenario.kind === 'defend' ? scenario.id.split('_').pop() || '' : ''

  return <div className="position-table">
    <div className="table-center">6-MAX</div>

    {SEATS.map(p =>
      <div
        key={p}
        style={{ gridArea: p.toLowerCase() }}
        className={`seat ${p === hero ? 'hero' : p === opener ? 'opener' : ''}`}
      >
        <b>{p}</b>
        {(p === hero || p === opener) &&
          <small>{p === hero ? 'HERO' : 'OPEN'}</small>}
      </div>
    )}
  </div>
}

function TrainingPage({ ranges, settings, updateSettings, records, updateRecords }: {
  ranges: RangeStore
  settings: Settings
  updateSettings: (s: Settings) => void
  records: TrainingRecord[]
  updateRecords: (r: TrainingRecord[]) => void
}) {
  const activeIds = settings.selected.filter(id => ranges[id])
  const pool = activeIds
  const [sessionStarted, setSessionStarted] = useState(false)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<Action | null>(null)
  const [question, setQuestion] = useState<TrainingQuestion | null>(null)

  const drawQuestion = (): TrainingQuestion | null => {
    if (!pool.length) return null
  
    // 1. 從目前勾選的位置隨機選一個
    const scenarioId = pool[Math.floor(Math.random() * pool.length)]
  
    // 2. 從該位置的 169 種起手牌隨機抽一手
    const range = ranges[scenarioId]!
    const hands = Object.keys(range)
    const hand = hands[Math.floor(Math.random() * hands.length)]
  
    return {
      scenarioId,
      hand,
      cards: drawCardsForHand(hand),
      expected: range[hand],
    }
  } 
  
  const start = () => {
    updateSettings({ ...settings, firstRunDone: true })
    setIndex(0)
    setAnswer(null)
    setQuestion(drawQuestion())
    setSessionStarted(true)
  }

  const end = () => {
    setSessionStarted(false)
    setIndex(0)
    setAnswer(null)
  }

  if (!settings.firstRunDone || !sessionStarted) {
    return <section className="page train-setup">
      <div className="eyebrow">PREFLOP TRAINER</div>
      <h2>{settings.firstRunDone ? '開始新的訓練' : '訓練設定'}</h2>
      <p className="muted">可同時選擇多個位置。尚未建立範圍的位置不會進入出題。</p>
      <div className="scenario-sections">
       <ScenarioGroup title="Open" scenarios={SCENARIOS.filter(s => s.kind === 'open' || s.kind === 'sb_open')} ranges={ranges} settings={settings} updateSettings={updateSettings} />
       <ScenarioGroup title="BB 防守" scenarios={SCENARIOS.filter(s => s.kind === 'defend')} ranges={ranges} settings={settings} updateSettings={updateSettings} />
      </div>
      <div className="panel inline-settings">
        <div><strong>題數</strong><span className="muted">固定題數或無限模式</span></div>
        <div className="segmented">
          <button className={settings.mode === 'fixed' ? 'active' : ''} onClick={() => updateSettings({ ...settings, mode: 'fixed' })}>固定</button>
          <button className={settings.mode === 'infinite' ? 'active' : ''} onClick={() => updateSettings({ ...settings, mode: 'infinite' })}>無限</button>
        </div>
        {settings.mode === 'fixed' && <input className="number-input" type="number" min={1} max={500} value={settings.handCount} onChange={e => updateSettings({ ...settings, handCount: Math.max(1, Number(e.target.value) || 1) })} />}
      </div>
      <button className="primary wide" onClick={start} disabled={!activeIds.length}> 開始訓練 </button>
      {!pool.length && <p className="warning">請至少選擇一個訓練位置。</p>}
    </section>
  }

  if (!question) return null
  const scenario = SCENARIOS.find(s => s.id === question.scenarioId)!
  const correct = answer === question.expected
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
      <button className="secondary wide" onClick={end}>返回設定</button>
    </section>
  }

  const nextQuestion = () => {
    setIndex(i => i + 1)
    setAnswer(null)
    setQuestion(drawQuestion())
  }

  const choose = (a: Action) => {
    if (answer) return
    const ok = a === question.expected
  
    updateRecords([{
      id: crypto.randomUUID(),
      scenarioId: question.scenarioId,
      hand: question.hand,
      expected: question.expected,
      answered: a,
      correct: ok,
      at: Date.now(),
    }, ...records])
  
    if (ok) nextQuestion()
    else setAnswer(a)
  }

  return <section className="page training-card-page">
    <div className="training-progress"><span>{scenario.name}</span><span>{settings.mode === 'fixed' ? `${index + 1} / ${settings.handCount}` : `#${index + 1}`}</span></div>
    <PositionTable scenario={scenario} />
    <div className="hand-card">
      <small>HERO HAND</small>

      <div className="hole-cards">
        <PlayingCardView card={question.cards[0]} />
        <PlayingCardView card={question.cards[1]} />
      </div>

  <div className="hand-meta">
    <span className="hand-name">
      {question.hand}
    </span>

    <span className="position-badge">
      {scenario.short}
    </span>
  </div>
</div>
    <p className="question-copy">這手牌的翻前策略是？</p>
    <div className="answer-grid">
      <AnswerButton action="raise" selected={answer} expected={question.expected} onClick={choose} label={scenario.kind === 'defend' ? '加注' : '加注'} />
      {(scenario.kind === 'defend' || scenario.kind === 'sb_open') && <AnswerButton action="call" selected={answer} expected={question.expected} onClick={choose} label={scenario.kind === 'sb_open' ? '跟注' : '跟注'} />}
      <AnswerButton action="fold" selected={answer} expected={question.expected} onClick={choose} label="棄牌" />
    </div>
    {answer && <div className={correct ? 'feedback correct' : 'feedback wrong'}>
      <strong>{correct ? '正確' : '錯誤'}</strong>
      <span>正確策略：{question.expected === 'raise' && scenario.kind === 'defend' ? '加注' : question.expected === 'call' && scenario.kind === 'sb_open' ? '跟注' : actionText[question.expected]}</span>
    </div>}
    {answer && !correct && <button className="primary wide" onClick={nextQuestion}>繼續</button>}
    <button className="secondary wide" onClick={end}>結束訓練</button>
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

  const ensure = () => {
    if (!range) updateRanges({ ...ranges, [scenarioId]: emptyRange() })
    setEditing(true)
  }

  const cycle = (hand: string) => {
    const current = ranges[scenarioId] || emptyRange()
    const order: Action[] = scenario.kind === 'defend' || scenario.kind === 'sb_open' ? ['fold', 'call', 'raise'] : ['fold', 'raise']
    const i = order.indexOf(current[hand] || 'fold')
    const nextAction = order[(i + 1) % order.length]
    updateRanges({ ...ranges, [scenarioId]: { ...current, [hand]: nextAction } })
  }

  const counts = range
    ? (Object.values(range) as Action[]).reduce<Record<Action, number>>((a, x) => { a[x] += 1; return a }, { raise: 0, call: 0, fold: 0 })
    : { raise: 0, call: 0, fold: 169 }

  return <section className="page ranges-page">
    <div className="eyebrow">RANGE LIBRARY</div>
    <div className="title-row"><div><h2>翻前範圍</h2><p className="muted">點擊格子可依序切換策略。</p></div><button className="secondary compact" onClick={() => editing ? setEditing(false) : ensure()}>{editing ? '完成' : '編輯'}</button></div>
    <div className="scenario-tabs">
      {SCENARIOS.map(s => <button key={s.id} className={scenarioId === s.id ? 'active' : ''} onClick={() => { setScenarioId(s.id); setEditing(false) }}>{s.short}</button>)}
    </div>
    <div className="panel range-heading">
      <div><strong>{scenario.name}</strong><span className="muted">{range ? '已設定' : '尚未設定'}</span></div>
      {!range && <button className="primary compact" onClick={ensure}>建立範圍</button>}
      {range && <div className="legend"><span className="raise-dot">{scenario.kind === 'defend' ? '加注' : '加注'} {counts.raise}</span>{(scenario.kind === 'defend' || scenario.kind === 'sb_open') && <span className="call-dot">{scenario.kind === 'sb_open' ? '跟注' : '跟注'} {counts.call}</span>}<span className="fold-dot">棄牌 {counts.fold}</span></div>}
    </div>
    <RangeMatrix range={range || emptyRange()} editing={editing} onCell={cycle} scenario={scenario} />
    {editing && <p className="helper">編輯模式：{scenario.kind === 'defend' ? 'Fold → Call → 3-Bet → Fold' : scenario.kind === 'sb_open' ? 'Fold → Limp / Call → Raise → Fold' : 'Fold → Raise → Fold'}</p>}
  </section>
}

function RangeMatrix({ range, editing, onCell, scenario }: { range: RangeMap; editing: boolean; onCell: (h: string) => void; scenario: Scenario }) {
  return <div className="matrix-wrap"><div className="range-matrix">
    {RANKS.map((_, r) => RANKS.map((__, c) => {
      const hand = cellName(r, c)
      const action = range[hand] || 'fold'
      return <button key={hand} disabled={!editing} onClick={() => onCell(hand)} className={`range-cell ${action}`} title={`${hand}: ${action === 'raise' && scenario.kind === 'defend' ? '加注' : actionText[action]}`}>{hand}</button>
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

function SettingsPage({ settings, updateSettings, ranges, updateRanges, records, updateRecords }: {
  settings: Settings; updateSettings: (s: Settings) => void; ranges: RangeStore; updateRanges: (r: RangeStore) => void; records: TrainingRecord[]; updateRecords: (r: TrainingRecord[]) => void
}) {
  return <section className="page settings-page">
    <div className="eyebrow">APP SETTINGS</div><h2>設定</h2>
    <div className="panel setting-row"><div><strong>遊戲類型</strong><span>6-Max 極速現金桌</span></div><b>固定</b></div>
    <div className="panel setting-row"><div><strong>有效籌碼</strong><span>100BB</span></div><b>固定</b></div>
    <div className="danger-zone">
      <h3>資料管理</h3>
      <button className="secondary wide" disabled={!records.length} onClick={() => { if (confirm('刪除全部訓練紀錄？')) updateRecords([]) }}>刪除全部訓練紀錄</button>
      <button className="danger wide" onClick={() => { if (confirm('重設所有自訂範圍？將恢復全部內建預設範圍。')) updateRanges(DEFAULT_RANGES) }}>重設翻前範圍</button>
      <button className="danger wide" onClick={() => { if (confirm('重設整個 App？')) { localStorage.clear(); location.reload() } }}>清除所有本機資料</button>
    </div>
    <div className="about"><strong>Preflop Focus</strong><span>GitHub Pages Edition · v1.0.0</span><small>資料只儲存在這台裝置的瀏覽器。</small></div>
  </section>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>
}

function hash(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0
  return h
}

export default App