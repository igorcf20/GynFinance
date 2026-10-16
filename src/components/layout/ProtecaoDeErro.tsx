// Se uma tela quebrar, mostra o aviso no lugar dela em vez de deixar a página inteira em branco.
import { TriangleAlert } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Botão para sair da tela com problema (por exemplo, voltar ao Início). */
  acao: ReactNode
}

export class ProtecaoDeErro extends Component<Props, { erro: Error | null }> {
  state = { erro: null as Error | null }

  static getDerivedStateFromError(erro: Error) {
    return { erro }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('Gynfinance: erro ao mostrar a tela', erro, info.componentStack)
  }

  render() {
    const { erro } = this.state
    if (!erro) return this.props.children
    return (
      <div role="alert" className="card mx-auto mt-6 flex max-w-[520px] flex-col items-center gap-3 p-7 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-[#fff1e6] text-[#c2410c]">
          <TriangleAlert size={26} aria-hidden />
        </span>
        <p className="text-[17px] font-bold text-ink">Esta tela não abriu</p>
        <p className="text-[14px] text-ink-2">Seus dados continuam salvos. Se acontecer de novo, mande para o suporte o texto abaixo.</p>
        <code className="w-full rounded-[10px] bg-[#f3f6fa] px-3 py-2 text-left text-[12px] break-words whitespace-pre-wrap text-ink-2 select-all">{erro.message || String(erro)}
          {erro.stack ? `\n${erro.stack.split('\n').slice(1, 3).join('\n')}` : ''}
        </code>
        <div className="mt-1">{this.props.acao}</div>
      </div>
    )
  }
}
