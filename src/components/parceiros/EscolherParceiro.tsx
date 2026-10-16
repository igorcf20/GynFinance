import { Check, UserRound } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router-dom'
import { ehCliente, ehFornecedor, parceiroPeloNome } from '../../domain/parceiros'
import type { Parceiro } from '../../domain/types'
import { Input } from '../ui/Field'

/**
 * Campo de cliente ou fornecedor com as fichas cadastradas. Digitou o nome de uma ficha, liga a
 * ela; nome novo pode virar ficha ao salvar (cadastrarNovo).
 */
export function EscolherParceiro({
  label,
  placeholder,
  papel,
  parceiros,
  historico,
  nome,
  onNome,
  cadastrarNovo,
  onCadastrarNovo,
}: {
  label: string
  placeholder: string
  papel: 'cliente' | 'fornecedor'
  parceiros: Parceiro[] | undefined
  /** Nomes usados antes, sem ficha (completar). */
  historico: string[]
  nome: string
  onNome: (nome: string, p: Parceiro | undefined) => void
  cadastrarNovo: boolean
  onCadastrarNovo: (v: boolean) => void
}) {
  const idLista = useId()
  const servem = (parceiros ?? []).filter((p) => p.ativo && (papel === 'cliente' ? ehCliente(p) : ehFornecedor(p)))
  const escolhido = parceiroPeloNome(parceiros, nome, papel)
  const opcoes = [...servem.map((p) => p.nome), ...historico.filter((h) => !parceiroPeloNome(parceiros, h))]
  return (
    <div>
      <Input
        label={label}
        placeholder={placeholder}
        icone={<UserRound size={16} />}
        list={idLista}
        autoComplete="off"
        value={nome}
        onChange={(e) => onNome(e.target.value, parceiroPeloNome(parceiros, e.target.value, papel))}
      />
      <datalist id={idLista}>
        {opcoes.slice(0, 60).map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      {escolhido ? (
        <p className="anim-aparecer mt-1.5 flex items-center gap-1.5 text-[12px] text-success">
          <Check size={14} aria-hidden /> Vai para a ficha de{' '}
          <Link to={`/clientes/${escolhido.id}`} className="font-semibold underline-offset-2 hover:underline">
            {escolhido.nome}
          </Link>
        </p>
      ) : (
        nome.trim() && (
          <label className="anim-aparecer mt-2 flex cursor-pointer items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" checked={cadastrarNovo} onChange={(e) => onCadastrarNovo(e.target.checked)} className="size-4 accent-[#3478F6]" />
            Cadastrar {nome.trim()} como {papel}
          </label>
        )
      )}
    </div>
  )
}
