import { ChevronRight, Plus, UserRound } from 'lucide-react'
import { Fragment } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useStore } from '../../data/store'
import { useNaoLidosSuporte } from '../../data/suporte'
import { emAtraso } from '../../domain/calc'
import { Logo } from './Logo'
import { doPlano, estaAtivo, GRUPOS_NAV, NAV_ADMIN, type GrupoNav, type ItemNav } from './navegacao'

const ATIVIDADE: Record<string, string> = { comercio: 'Comércio', servico: 'Serviços', industria: 'Indústria', misto: 'Comércio e serviços' }

/** Números que aparecem ao lado dos itens do menu. */
export function useSelosNav(): Record<NonNullable<ItemNav['selo']>, number> {
  const { dados, hoje } = useStore()
  const atraso = emAtraso(dados.lancamentos, hoje)
  return { atrasadas: atraso.pagar.quantidade + atraso.receber.quantidade, suporte: useNaoLidosSuporte() }
}

const TEXTO_SELO: Record<NonNullable<ItemNav['selo']>, (n: number) => string> = {
  atrasadas: (n) => `${n} conta${n === 1 ? '' : 's'} em atraso`,
  suporte: (n) => `${n} resposta${n === 1 ? '' : 's'} nova${n === 1 ? '' : 's'} do suporte`,
}

/** Grupos do menu já sem o que o plano ou o negócio não usa. */
export function useGruposNav(): GrupoNav[] {
  const { dados, servidor, conta, modulos } = useStore()
  // Superadmin: quem o servidor reconhece, e todo mundo na demonstração (para conhecer o painel).
  const admin = conta?.admin || servidor === 'sem'
  return GRUPOS_NAV.map((g) => ({
    ...g,
    itens: [...doPlano(g.itens, modulos).filter((i) => i.para !== '/mei' || dados.empresa.ehMei), ...(g.titulo === 'Ajustes' && admin ? [NAV_ADMIN] : [])],
  })).filter((g) => g.itens.length)
}

export function SeloNav({ item, n, compacto }: { item: ItemNav; n: number; compacto?: boolean }) {
  if (!item.selo || !n) return null
  const cor = item.selo === 'atrasadas' ? 'bg-danger text-white' : 'bg-primary text-white'
  if (compacto) return <span className={`absolute top-1 right-1 size-2.5 rounded-full ring-2 ring-[#f6f9fc] ${cor}`} aria-hidden />
  return (
    <span className={`num ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${cor}`} aria-hidden>
      {n > 99 ? '99+' : n}
    </span>
  )
}

function Item({ item, caminho, compacto, selo }: { item: ItemNav; caminho: string; compacto: boolean; selo: number }) {
  const ativo = estaAtivo(item, caminho)
  const Icone = item.icone
  const dica = item.selo && selo ? `${item.rotulo}: ${TEXTO_SELO[item.selo](selo)}` : item.rotulo
  return (
    <NavLink
      to={item.para}
      title={compacto ? dica : undefined}
      aria-current={ativo ? 'page' : undefined}
      className={`group relative flex h-10 items-center gap-3 rounded-[12px] text-[14px] transition-all duration-200 ${compacto ? 'justify-center' : 'pr-2.5 pl-2'} ${
        ativo
          ? 'bg-gradient-to-r from-[#dbe7fc] to-[#e9f1fe] font-bold text-navy shadow-[inset_0_0_0_1px_rgba(52,120,246,0.08)]'
          : 'font-medium text-[#3d5170] hover:bg-hover hover:text-ink'
      }`}
    >
      {/* Faixa azul à esquerda marca onde a pessoa está. */}
      <span
        aria-hidden
        className={`absolute top-1/2 -left-3 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-all duration-300 xl:-left-4 ${ativo ? 'opacity-100' : 'h-0 opacity-0'}`}
      />
      {/* Ativo: ícone branco num quadrado azul-marinho, como na imagem de referência. */}
      <span
        className={`relative inline-flex size-[28px] shrink-0 items-center justify-center rounded-[8px] transition-all duration-300 ${ativo ? 'grad-navy text-white shadow-[0_4px_10px_-4px_rgba(23,43,77,0.5)]' : 'text-[#2f4a72] group-hover:scale-110'}`}
      >
        <Icone size={ativo ? 16 : 19} strokeWidth={ativo ? 2.2 : 1.8} aria-hidden />
        {compacto && <SeloNav item={item} n={selo} compacto />}
      </span>
      <span className={compacto ? 'sr-only' : 'min-w-0 flex-1 truncate'}>{item.rotulo}</span>
      {item.selo && selo > 0 && <span className="sr-only">, {TEXTO_SELO[item.selo](selo)}</span>}
      {!compacto && <SeloNav item={item} n={selo} />}
    </NavLink>
  )
}

/** Navegação lateral: expandida acima de 1200px e só com ícones no tablet. */
export function Sidebar() {
  const { pathname } = useLocation()
  const { dados, modo, servidor, conta } = useStore()
  const grupos = useGruposNav()
  const selos = useSelosNav()
  const e = dados.empresa

  const lista = (compacto: boolean) =>
    grupos.map((g, n) => (
      <Fragment key={g.titulo ?? n}>
        {g.titulo &&
          (compacto ? (
            <span aria-hidden className="mx-auto my-2 block h-px w-8 bg-[#dfe6ef]" />
          ) : (
            <p className="mt-4 mb-1 px-2.5 text-[11px] font-bold tracking-[0.08em] text-slate uppercase">{g.titulo}</p>
          ))}
        {g.itens.map((i) => (
          <Item key={i.para} item={i} caminho={pathname} compacto={compacto} selo={i.selo ? selos[i.selo] : 0} />
        ))}
      </Fragment>
    ))

  return (
    <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col border-r border-[#e3e9f1] bg-gradient-to-b from-[#fbfcfe] to-[#f2f6fb] px-3 pt-6 pb-4 shadow-[1px_0_0_rgba(255,255,255,0.8)] md:flex xl:w-[248px] xl:px-4">
      <Link to="/" className="mb-6 flex justify-center px-1 xl:justify-start xl:px-2.5" aria-label="Gynfinance, início">
        <span className="xl:hidden">
          <Logo compacto />
        </span>
        <span className="hidden xl:inline">
          <Logo />
        </span>
      </Link>

      <Link
        to="/lancar"
        title="Novo lançamento"
        className="grad-primario group mb-3 flex h-11 shrink-0 items-center justify-center gap-2 rounded-[12px] text-[14px] font-bold text-white shadow-[0_10px_22px_-10px_rgba(52,120,246,0.7)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_14px_26px_-10px_rgba(52,120,246,0.75)] active:translate-y-0"
      >
        <Plus size={19} strokeWidth={2.4} className="transition-transform duration-300 group-hover:rotate-90" aria-hidden />
        <span className="sr-only xl:not-sr-only">Novo lançamento</span>
      </Link>

      {/* Só a lista rola quando a tela é baixa; logo, botão e perfil ficam no lugar. */}
      <nav aria-label="Principal" className="-mx-3 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-1 [scrollbar-width:thin] xl:-mx-4 xl:px-4">
        <div className="contents xl:hidden">{lista(true)}</div>
        <div className="hidden xl:contents">{lista(false)}</div>
      </nav>

      <div className="mt-3 shrink-0">
        {modo === 'demo' && (
          <Link
            to="/comecar"
            className="group mb-3 hidden rounded-[12px] border border-[#d6e4fc] [@media(max-height:760px)]:!hidden bg-primary-soft/70 px-3 py-2.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary-soft xl:block"
          >
            Modo demonstração com dados de exemplo.
            <span className="mt-1 flex items-center gap-1 font-bold">
              Usar com o meu negócio <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        )}
        {modo === 'demo' && servidor === 'com' && !conta && (
          <Link to="/entrar" className="mb-3 hidden text-center text-[12px] font-semibold text-ink-2 hover:text-primary xl:block">
            Já tem conta? Entrar
          </Link>
        )}
        <Link
          to="/configuracoes"
          className="flex items-center justify-center gap-3 rounded-[14px] border border-[#e3e9f1] bg-surface p-2 shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-px xl:justify-start xl:p-3"
          title={e.nomeFantasia}
        >
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#eef3f9] to-[#dfe7f1] text-[#2f4a72]">
            <UserRound size={19} strokeWidth={1.9} aria-hidden />
          </span>
          <span className="hidden min-w-0 flex-1 xl:block">
            <span className="block truncate text-[13px] font-bold text-ink">{e.nomeFantasia}</span>
            <span className="block truncate text-[12px] text-ink-2">
              {e.ehMei ? 'MEI' : 'Empresa'} · {ATIVIDADE[e.atividade]}
            </span>
          </span>
          <ChevronRight size={16} className="hidden text-slate xl:block" aria-hidden />
        </Link>
      </div>
    </aside>
  )
}
