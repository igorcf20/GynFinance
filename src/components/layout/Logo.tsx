import logo from '../../assets/logo.png'
import simbolo from '../../assets/logo-simbolo.png'

/** Símbolo da logo oficial (as três barras). */
export function LogoMarca({ size = 28 }: { size?: number }) {
  return <img src={simbolo} width={size} height={size} alt="" aria-hidden className="shrink-0" />
}

/** Logo oficial enviada pelo Igor; compacto mostra só o símbolo. */
export function Logo({ compacto }: { compacto?: boolean }) {
  if (compacto) return <LogoMarca size={34} />
  return (
    <>
      <img src={logo} alt="Gynfinance" className="h-[30px] w-auto escuro:hidden" />
      {/* No modo escuro, o nome em letra clara ao lado do símbolo (a imagem tem o texto escuro). */}
      <span className="hidden items-center gap-1.5 escuro:inline-flex" aria-label="Gynfinance">
        <LogoMarca size={30} />
        <span className="text-[23px] leading-none tracking-[-0.03em] text-ink" aria-hidden>
          <b className="font-extrabold">Gyn</b>
          <span className="font-normal text-ink-2">finance</span>
        </span>
      </span>
    </>
  )
}
