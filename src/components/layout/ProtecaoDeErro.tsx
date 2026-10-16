// Se uma tela quebrar, mostra o aviso no lugar dela em vez de deixar a página inteira em branco.
import { LifeBuoy, TriangleAlert } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { paginaAtual, registrarErro } from '../../lib/erros'

interface Props {
  children: ReactNode
  /** Botão para sair da tela com problema (por exemplo, voltar ao Início). */
  acao: ReactNode
  /** Abre um chamado de suporte com este erro (recebe a tela onde aconteceu). */
  onSuporte?: (pagina: string) => void
}

export class ProtecaoDeErro extends Component<Props, { erro: Error | null; pagina: string }> {
  state = { erro: null as Error | null, pagina: '/' }

  static getDerivedStateFromError(erro: Error) {
    return { erro, pagina: paginaAtual() }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('Gynfinance: erro ao mostrar a tela', erro, info.componentStack)
    // Fica na lista do chamado e avisa a equipe no painel, mesmo sem chamado aberto.
    registrarErro('tela', erro)
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
        <p className="text-[14px] text-ink-2">Seus dados continuam salvos. A equipe já foi avisada; se quiser, abra um chamado e conte o que você estava fazendo.</p>
        <code className="w-full rounded-[10px] bg-[#f3f6fa] px-3 py-2 text-left text-[12px] break-words whitespace-pre-wrap text-ink-2 select-all">{erro.message || String(erro)}
          {erro.stack ? `\n${erro.stack.split('\n').slice(1, 3).join('\n')}` : ''}
        </code>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {this.props.acao}
          {this.props.onSuporte && (
            <button
              type="button"
              onClick={() => this.props.onSuporte?.(this.state.pagina)}
              className="inline-flex h-11 items-center gap-2 rounded-[12px] border border-line bg-surface px-5 text-[14px] font-semibold text-ink transition-colors hover:border-primary-line hover:text-primary"
            >
              <LifeBuoy size={17} aria-hidden /> Falar com o suporte
            </button>
          )}
        </div>
      </div>
    )
  }
}
