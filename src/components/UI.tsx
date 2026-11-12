import { Dices, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'

export function Brand() {
  return <a className="brand" href="#inicio" aria-label="ProbMath — início">
    <span className="brand-icon"><Dices size={24} strokeWidth={1.75}/></span><span>Prob<span>Math</span></span>
  </a>
}
export function Notice({ children }: { children: ReactNode }) {
  return children ? <p className="notice" role="alert">{children}</p> : null
}
export function Loading({ children = 'Carregando…' }: { children?: ReactNode }) {
  return <div className="loading" role="status"><LoaderCircle size={19} className="animate-spin"/>{children}</div>
}
