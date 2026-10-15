import logo from '../../assets/logo.png'
import simbolo from '../../assets/logo-simbolo.png'

/** Símbolo da logo oficial (as três barras). */
export function LogoMarca({ size = 28 }: { size?: number }) {
  return <img src={simbolo} width={size} height={size} alt="" aria-hidden className="shrink-0" />
}

/** Logo oficial enviada pelo Igor; compacto mostra só o símbolo. */
export function Logo({ compacto }: { compacto?: boolean }) {
  if (compacto) return <LogoMarca size={34} />
  return <img src={logo} alt="Gynfinance" className="h-[30px] w-auto" />
}
