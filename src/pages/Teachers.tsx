import { useEffect, useState, type FormEvent } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { Beaker, BookOpen, ChartNoAxesColumnIncreasing, ClipboardList, LogOut, Plus, Save, Settings2, ShieldCheck, Trophy, Users } from 'lucide-react'
import { CATEGORIES, DIFFICULTIES, draw, number, percent, type AdminData, type Decision, type Question, type Ranking, type Rules } from '../../shared/model'
import { Distribution } from '../components/Distribution'
import { Loading, Notice } from '../components/UI'
import { api, ApiError, message, randomId } from '../services/api'
import { auth, db } from '../services/firebase'
import { RankingTable } from './Ranking'

const tabs = [
  { label: 'Visão geral', icon: ChartNoAxesColumnIncreasing }, { label: 'Questões', icon: BookOpen },
  { label: 'Regulamento', icon: Settings2 }, { label: 'Modo científico', icon: Beaker },
  { label: 'Ranking', icon: Trophy }, { label: 'Atividade', icon: ClipboardList },
  { label: 'Participantes', icon: Users },
]
type Save = (action: string, data: object) => Promise<void>

export function Teachers({ ranking }: { ranking: Ranking[] | null }) {
  const [user, setUser] = useState<User | null | undefined>(auth ? undefined : null)
  const [data, setData] = useState<AdminData | null>(null)
  const [failure, setFailure] = useState('')
  const [authError, setAuthError] = useState('')
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState(0)
  const [revision, setRevision] = useState(0)

  useEffect(() => auth ? onAuthStateChanged(auth, current => {
    setData(null)
    setFailure('')
    setUser(current)
  }) : undefined, [])
  useEffect(() => {
    if (!user) return
    let alive = true
    let latest = 0
    async function refresh() {
      const sequence = ++latest
      try {
        const value = await api<AdminData>('admin:read', {}, await user!.getIdToken())
        if (alive && sequence === latest) { setData(value); setFailure('') }
      } catch (error) {
        if (alive && sequence === latest) {
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) setData(null)
          setFailure(message(error))
        }
      }
    }
    void refresh()
    const unsubscribe = db ? onSnapshot(doc(db, 'adminStats', 'global'), () => void refresh()) : undefined
    const interval = window.setInterval(refresh, 30_000)
    return () => { alive = false; unsubscribe?.(); window.clearInterval(interval) }
  }, [user, revision])
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth || busy) return
    setBusy(true); setAuthError('')
    const form = new FormData(event.currentTarget)
    try { await signInWithEmailAndPassword(auth, String(form.get('email')).trim(), String(form.get('password'))) }
    catch (error) {
      setAuthError(String((error as { code?: string }).code).includes('network') ? 'Conexão indisponível. Tente novamente.' : 'Não foi possível entrar. Confira seu e-mail e senha.')
    } finally { setBusy(false) }
  }
  const save: Save = async (action, input) => {
    if (!user) return
    await api(action, input, await user.getIdToken())
    setRevision(value => value + 1)
  }
  if (user === undefined) return <div className="wrap standalone"><Loading/></div>
  if (!user) return <div className="wrap play-page">
    <section className="panel game-card identity">
      <span className="icon-box"><ShieldCheck size={27}/></span><h1>Área do professor</h1>
      <p>Entre para acompanhar partidas, administrar questões e usar o modo científico.</p>
      {auth ? <form onSubmit={login}>
        <label htmlFor="email">E-mail</label><input name="email" id="email" type="email" autoComplete="username" required/>
        <label htmlFor="password">Senha</label><input name="password" id="password" type="password" autoComplete="current-password" required/>
        <Notice>{authError}</Notice><button className="button primary" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form> : <Notice>O painel estará disponível quando o Firebase Authentication for configurado.</Notice>}
    </section>
  </div>
  return <section className="wrap standalone dashboard">
    <div className="section-head"><div><h1>Área do professor</h1><p>{user.email}</p></div>
      <button className="button secondary" onClick={() => { if (auth) void signOut(auth).catch(error => setFailure(message(error))) }}><LogOut size={17}/> Sair</button></div>
    <Notice>{failure}</Notice>
    {!data ? failure ? <button className="button secondary" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button> : <Loading/> : <>
      <nav className="tabs" aria-label="Painel administrativo">{tabs.map(({ label, icon: Icon }, i) => <button key={label} aria-pressed={i === active} onClick={() => setActive(i)}><Icon size={17}/>{label}</button>)}</nav>
      {active === 0 && <Overview data={data}/>}
      {active === 1 && <Questions questions={data.questions} save={save}/>}
      {active === 2 && <RuleEditor key={JSON.stringify(data.rules)} rules={data.rules} save={save}/>}
      {active === 3 && <Science/>}
      {active === 4 && <div className="panel">{ranking ? <RankingTable ranking={ranking}/> : <Loading/>}</div>}
      {active === 5 && <section className="panel admin-section"><h2>Atividade recente</h2>{data.activity.length ? <ul className="activity">{data.activity.map(item => <li key={item.id}><span>{item.message}</span><time dateTime={new Date(item.at).toISOString()}>{new Date(item.at).toLocaleString('pt-BR')}</time></li>)}</ul> : <p>Sem registros por enquanto.</p>}</section>}
      {active === 6 && <section className="panel admin-section"><h2>Participantes recentes</h2>
        {data.participants.length ? <div className="table-scroll"><table>
          <thead><tr><th scope="col">Apelido</th><th scope="col">Tentativas</th><th scope="col">Última tentativa</th></tr></thead>
          <tbody>{data.participants.map(player => <tr key={player.id}><th scope="row">{player.nickname}</th><td>{player.attempts}</td><td><time dateTime={new Date(player.lastPlayedAt).toISOString()}>{new Date(player.lastPlayedAt).toLocaleString('pt-BR')}</time></td></tr>)}</tbody>
        </table></div> : <p>Nenhum participante por enquanto.</p>}
      </section>}
    </>}
  </section>
}

function Overview({ data }: { data: AdminData }) {
  const { stats, games } = data
  const metrics = [
    ['Participantes', number(stats.participants)], ['Partidas iniciadas', number(stats.games)], ['Partidas concluídas', number(stats.completed)],
    ['Média de pontos', stats.completed ? number(Number((stats.points / stats.completed).toFixed(2))) : '—'],
    ['Acertos', number(stats.correct)], ['Erros', number(stats.wrong)],
    ['Fichas conquistadas', number(stats.correct)], ['Fichas consumidas', number(stats.spent)],
  ]
  const labels = { quiz: 'Quiz', machine: 'Máquina', complete: 'Concluída', expired: 'Expirada' }
  return <div className="admin-stack">
    <div className="admin-metrics">{metrics.map(([label, value]) => <div className="panel metric" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
    <section className="panel admin-section"><h2>Distribuição dos lançamentos</h2><Distribution counts={stats.bins}/></section>
    <section className="panel admin-section"><h2>Últimas partidas</h2>
      {games.length ? <div className="table-scroll"><table><thead><tr><th scope="col">Apelido</th><th scope="col">Etapa</th><th scope="col">Acertos</th><th scope="col">Fichas restantes</th><th scope="col">Pontos</th></tr></thead>
      <tbody>{games.map(game => <tr key={game.id}><th scope="row">{game.nickname}</th><td>{labels[game.stage]}</td><td>{game.correct}</td><td>{game.tokens}</td><td>{game.points}</td></tr>)}</tbody></table></div> : <p>Nenhuma partida iniciada.</p>}
    </section>
  </div>
}
function Science() {
  const [size, setSize] = useState(100)
  const [counts, setCounts] = useState<number[] | null>(null)
  function simulate() {
    const next = [0, 0, 0, 0, 0]
    const bits = crypto.getRandomValues(new Uint8Array(size * 4))
    let bit = 0
    for (let i = 0; i < size; i++) next[draw(() => (bits[bit++] & 1) as Decision).bin]++
    setCounts(next)
  }
  const total = counts?.reduce((sum, count) => sum + count, 0)
  return <section className="panel admin-section">
    <h2>Modo científico</h2><p>Simule quatro decisões independentes por bolinha, cada uma com chance de {percent(0.5)} para cada lado.</p>
    <form className="science-controls" onSubmit={event => { event.preventDefault(); simulate() }}>
      <label htmlFor="quantity">Lançamentos</label><select id="quantity" value={size} onChange={event => setSize(Number(event.target.value))}>{[100, 500, 1000].map(n => <option key={n} value={n}>{number(n)}</option>)}</select>
      <button className="button primary"><Beaker size={18}/> Simular</button>
    </form>
    {counts && <><p role="status">{number(total ?? 0)} bolinhas lançadas</p><Distribution counts={counts}/></>}
  </section>
}

const newQuestion = (): Question => ({
  id: randomId(), prompt: '', options: ['', '', '', ''], correct: 0, explanation: '',
  difficulty: DIFFICULTIES[0], category: CATEGORIES[0], active: true,
})
function Questions({ questions, save }: { questions: Question[]; save: Save }) {
  const [edit, setEdit] = useState<Question | null>(null)
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const visible = questions.filter(q => (!category || q.category === category) && (!difficulty || q.difficulty === difficulty))
  return <section className="panel admin-section">
    <div className="section-head"><h2>Banco de questões</h2><button className="button secondary" onClick={() => setEdit(newQuestion())}><Plus size={17}/> Nova questão</button></div>
    {edit && <QuestionEditor key={edit.id} question={edit} save={save} close={() => setEdit(null)}/>}
    <div className="filters">
      <label>Categoria<select value={category} onChange={event => setCategory(event.target.value)}><option value="">Todas</option>{CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Dificuldade<select value={difficulty} onChange={event => setDifficulty(event.target.value)}><option value="">Todas</option>{DIFFICULTIES.map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <ul className="question-list">{visible.map(question => <li key={question.id}><div><strong>{question.prompt}</strong><small>{question.category} · {question.difficulty} · {question.active ? 'Ativa' : 'Inativa'}</small></div><button className="button secondary" onClick={() => setEdit(question)}>Editar</button></li>)}</ul>
    {!visible.length && <p>Nenhuma questão nessa seleção.</p>}
  </section>
}
function QuestionEditor({ question, save, close }: { question: Question; save: Save; close: () => void }) {
  const [edit, change] = useState(question)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try { await save('admin:question', edit); close() } catch (error) { setError(message(error)) } finally { setBusy(false) }
  }
  return <form className="edit-form" onSubmit={submit}>
    <h3>{question.prompt ? 'Editar questão' : 'Nova questão'}</h3>
    <label>Enunciado<textarea value={edit.prompt} maxLength={500} required onChange={event => change({ ...edit, prompt: event.target.value })}/></label>
    {edit.options.map((option, index) => <label key={index}>Alternativa {'ABCD'[index]}<input required maxLength={200} value={option} onChange={event => change({ ...edit, options: edit.options.map((text, i) => i === index ? event.target.value : text) })}/></label>)}
    <div className="filters">
      <label>Resposta correta<select value={edit.correct} onChange={event => change({ ...edit, correct: Number(event.target.value) })}>{['A', 'B', 'C', 'D'].map((letter, i) => <option value={i} key={letter}>{letter}</option>)}</select></label>
      <label>Dificuldade<select value={edit.difficulty} onChange={event => change({ ...edit, difficulty: event.target.value as Question['difficulty'] })}>{DIFFICULTIES.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Categoria<select value={edit.category} onChange={event => change({ ...edit, category: event.target.value as Question['category'] })}>{CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <label>Explicação<textarea required maxLength={1200} value={edit.explanation} onChange={event => change({ ...edit, explanation: event.target.value })}/></label>
    <label className="checkbox"><input type="checkbox" checked={edit.active} onChange={event => change({ ...edit, active: event.target.checked })}/> Disponível para sorteio</label>
    <Notice>{error}</Notice><div className="flex flex-wrap gap-3"><button className="button primary" disabled={busy}><Save size={17}/> Salvar</button><button type="button" className="button secondary" disabled={busy} onClick={close}>Cancelar</button></div>
  </form>
}
function RuleEditor({ rules, save }: { rules: Rules; save: Save }) {
  const [attempts, setAttempts] = useState(rules.maxAttempts)
  const [words, setWords] = useState(rules.blockedWords.join('\n'))
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError(''); setFeedback('')
    try {
      await save('admin:rules', { maxAttempts: attempts, blockedWords: words.split('\n').map(word => word.trim()).filter(Boolean) })
      setFeedback('Regulamento salvo.')
    } catch (error) { setError(message(error)) } finally { setBusy(false) }
  }
  return <section className="panel admin-section">
    <h2>Regulamento</h2><form className="edit-form" onSubmit={submit}>
      <label>Tentativas por apelido<input required type="number" min={1} max={20} value={attempts || ''} onChange={event => setAttempts(Number(event.target.value))}/></label>
      <label>Termos bloqueados, um por linha<textarea rows={7} value={words} onChange={event => setWords(event.target.value)}/></label>
      <Notice>{error}</Notice>{feedback && <p role="status">{feedback}</p>}<button className="button primary" disabled={busy}><Save size={17}/> Salvar regras</button>
    </form>
  </section>
}
