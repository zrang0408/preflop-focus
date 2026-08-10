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
    <div>
      <h2>翻前範圍</h2>
      <p className="muted">點擊格子可依序切換策略。</p>
    </div>

    <button
      className="secondary compact"
      onClick={() => editing ? setEditing(false) : ensure()}
    >
      {editing ? '完成' : '編輯'}
    </button>
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
      {!range && (<button className="primary compact" onClick={ensure}>建立範圍</button>)}
      {range && <div className="legend"><span className="raise-dot">{scenario.kind === 'defend' ? '3-Bet' : '加注'} {counts.raise}</span>{scenario.kind === 'defend' && <span className="call-dot">跟注 {counts.call}</span>}<span className="fold-dot">棄牌 {counts.fold}</span></div>}
    </div>

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
