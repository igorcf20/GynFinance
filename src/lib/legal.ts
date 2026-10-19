// Endereços das páginas de termos de uso e política de privacidade (site de venda, na raiz do domínio).
// O texto em vigor vem do servidor e se edita em Superadmin > Termos.
export const LINK_TERMOS = '/termos.html'
export const LINK_PRIVACIDADE = '/privacidade.html'
export const linkDocumento = (tipo: 'termos' | 'privacidade') => (tipo === 'termos' ? LINK_TERMOS : LINK_PRIVACIDADE)
