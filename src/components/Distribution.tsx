import { useState } from 'react'
import { BINS, number, percent } from '../../shared/model'

export function Distribution({ counts }: { counts: number[] }) {
  const [selection, select] = useState<number | null>(null)
  const total = counts.reduce((sum, n) => sum + n, 0)
  const observed = counts.map(n => total ? n / total : 0)
  const scale = Math.max(0.4, ...observed, ...BINS.map(bin => bin.probability))
  return <div className="distribution">
    <div className="chart-legend"><span><i/> Frequência observada</span><span><i/> Probabilidade teórica</span></div>
    <div className="chart" aria-label="Gráfico comparativo por compartimento">
      {BINS.map((bin, i) => <button key={bin.points} className={selection === i ? 'active' : ''} aria-pressed={selection === i} aria-label={`${bin.points} pontos, ${number(counts[i])} bolinhas, ${percent(observed[i])} observado e ${percent(bin.probability)} teórico`} onClick={() => select(selection === i ? null : i)}>
        <span className="bars"><i style={{ height: `${observed[i] / scale * 100}%` }}/><i style={{ height: `${bin.probability / scale * 100}%` }}/></span>
        <b>{bin.points} pts</b>
      </button>)}
    </div>
    <div className="table-scroll"><table>
      <thead><tr><th scope="col">Compartimento</th><th scope="col">Bolinhas</th><th scope="col">Esperadas</th><th scope="col">Observado</th><th scope="col">Teórico</th><th scope="col">Diferença</th></tr></thead>
      <tbody>{BINS.map((bin, i) => <tr key={bin.points} className={selection === i ? 'own' : ''}>
        <th scope="row">{bin.points} pts</th><td>{number(counts[i])}</td><td>{number(Number((total * bin.probability).toFixed(2)))}</td>
        <td>{total ? percent(observed[i]) : '—'}</td><td>{percent(bin.probability)}</td>
        <td>{total ? `${number(Number(((observed[i] - bin.probability) * 100).toFixed(2)))} p.p.` : '—'}</td>
      </tr>)}</tbody>
    </table></div>
  </div>
}
