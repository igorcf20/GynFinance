import { useEffect, useRef, useState } from 'react'
import { brl } from '../../lib/format'

const semMovimento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Número que corre até o valor (R$ 0 → R$ 2.480) e, depois, do valor antigo ao novo quando muda. */
export function useContagem(alvo: number, duracao = 900): number {
  const [atual, setAtual] = useState(() => (semMovimento() ? alvo : 0))
  const de = useRef(semMovimento() ? alvo : 0)
  useEffect(() => {
    if (semMovimento()) {
      setAtual(alvo)
      return
    }
    const inicio = performance.now()
    const origem = de.current
    let quadro = 0
    const passo = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracao)
      const suave = 1 - Math.pow(1 - p, 4)
      const v = Math.round(origem + (alvo - origem) * suave)
      de.current = v
      setAtual(v)
      if (p < 1) quadro = requestAnimationFrame(passo)
    }
    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [alvo, duracao])
  return atual
}

/** Valor em reais animado. O leitor de tela recebe só o valor final. */
export function ValorAnimado({ centavos, comCentavos }: { centavos: number; comCentavos?: boolean }) {
  const v = useContagem(centavos)
  // Decide pelos centavos do valor final, para o número não piscar ",00" no meio da contagem.
  const mostra = comCentavos ?? centavos % 100 !== 0
  const final = brl(centavos, { centavos: mostra })
  return (
    <>
      <span aria-hidden>{brl(mostra ? v : Math.round(v / 100) * 100, { centavos: mostra })}</span>
      <span className="sr-only">{final}</span>
    </>
  )
}
