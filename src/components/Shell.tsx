import { ArrowUpRight, CircleHelp, Gamepad2, ShieldCheck, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import { Brand } from './UI'

export function Shell({ page, children }: { page: string; children: ReactNode }) {
  return <>
    <header className="header"><div className="wrap nav">
      <Brand/>
      <nav aria-label="Navegação principal">
        <a href="#inicio" aria-current={page === 'inicio' ? 'page' : undefined}><Gamepad2 size={16}/> Início</a>
        <a href="#ranking" aria-current={page === 'ranking' ? 'page' : undefined}><Trophy size={16}/> Ranking</a>
        <a href="#como-jogar" aria-current={page === 'como-jogar' ? 'page' : undefined}><CircleHelp size={16}/> Como jogar</a>
      </nav>
      <a href="#professores" className="staff"><ShieldCheck size={16}/><span>Área do professor</span><ArrowUpRight size={14}/></a>
    </div></header>
    <main id="conteudo">{children}</main>
    <footer className="footer"><div className="wrap flex flex-wrap justify-between gap-4"><Brand/><span>Feira Interdisciplinar de Matemática</span>{!__PROBMATH_FIREBASE__ && <span>Dados em SQLite local</span>}<a href="#professores">Área do professor <ArrowUpRight size={13}/></a></div></footer>
  </>
}
