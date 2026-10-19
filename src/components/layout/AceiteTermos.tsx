// Versão nova dos termos de uso ou da política de privacidade: antes de continuar, a pessoa lê e
// aceita (fica gravado no servidor qual versão, quando e de onde).
import { ExternalLink, FileCheck2, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../data/api'
import { useStore } from '../../data/store'
import { linkDocumento } from '../../lib/legal'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

export function AceiteTermos() {
  const { conta, recarregarConta, sair } = useStore()
  const navigate = useNavigate()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const pendentes = conta?.aceitesPendentes ?? []
  if (!pendentes.length) return null

  async function aceitar() {
    setEnviando(true)
    setErro('')
    try {
      await api('POST', 'conta/aceitar')
      await recarregarConta()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      aberto
      onFechar={() => {}}
      titulo="Atualizamos as regras do Gynfinance"
      rodape={
        <>
          <Button
            variante="discreto"
            icone={<LogOut size={16} />}
            onClick={async () => {
              await sair()
              navigate('/entrar', { replace: true })
            }}
          >
            Sair da conta
          </Button>
          <Button icone={<FileCheck2 size={16} />} carregando={enviando} onClick={aceitar}>
            Li e aceito
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-[14px]">
        <p>
          Publicamos uma versão nova {pendentes.length > 1 ? 'dos documentos abaixo' : 'do documento abaixo'}. Para continuar usando o sistema, leia e confirme que concorda.
        </p>
        <ul className="flex flex-col gap-2">
          {pendentes.map((p) => (
            <li key={p.tipo}>
              <a href={linkDocumento(p.tipo)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
                {p.titulo} (versão de {p.versao.slice(8, 10)}/{p.versao.slice(5, 7)}/{p.versao.slice(0, 4)}) <ExternalLink size={14} aria-hidden />
              </a>
            </li>
          ))}
        </ul>
        <p className="text-[12px]">Se não concordar, você pode sair e pedir o cancelamento sem custo pelo atendimento.</p>
        {erro && (
          <p role="alert" className="rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-[13px] text-[#9b1c2e]">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}
