// Termos de Uso e Política de Privacidade: busca a versão em vigor no servidor e monta a página.
// Formato simples: "# " título, "## " seção, "- " item de lista, "| a | b |" tabela e **negrito**.
// Tudo entra como texto (textContent), nunca como HTML.
(function () {
  'use strict';

  function comNegrito(pai, linha) {
    linha.split('**').forEach(function (parte, i) {
      if (!parte) return;
      if (i % 2) {
        var b = document.createElement('strong');
        b.textContent = parte;
        pai.appendChild(b);
      } else pai.appendChild(document.createTextNode(parte));
    });
    return pai;
  }

  function celulas(linha) {
    return linha.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (c) { return c.trim(); });
  }

  function montar(texto) {
    var frag = document.createDocumentFragment();
    var linhas = texto.replace(/\r/g, '').split('\n');
    var lista = null;
    var tabela = null;
    var paragrafo = [];
    function fecharParagrafo() {
      if (!paragrafo.length) return;
      frag.appendChild(comNegrito(document.createElement('p'), paragrafo.join(' ')));
      paragrafo = [];
    }
    function fecharTudo() {
      fecharParagrafo();
      lista = null;
      tabela = null;
    }
    linhas.forEach(function (bruta) {
      var l = bruta.trim();
      if (!l) return fecharTudo();
      if (/^#\s/.test(l)) return fecharTudo(); // o título da página já vem do HTML
      if (/^##\s/.test(l)) {
        fecharTudo();
        frag.appendChild(comNegrito(document.createElement('h2'), l.replace(/^##\s+/, '')));
        return;
      }
      if (/^[-*]\s/.test(l)) {
        fecharParagrafo();
        tabela = null;
        if (!lista) {
          lista = document.createElement('ul');
          frag.appendChild(lista);
        }
        lista.appendChild(comNegrito(document.createElement('li'), l.replace(/^[-*]\s+/, '')));
        return;
      }
      if (/^\|/.test(l)) {
        fecharParagrafo();
        lista = null;
        if (/^\|[\s:|-]+\|?$/.test(l)) return; // linha de separação do cabeçalho
        if (!tabela) {
          var caixa = document.createElement('div');
          caixa.className = 'legal-tabela';
          tabela = document.createElement('table');
          caixa.appendChild(tabela);
          frag.appendChild(caixa);
          var tr = tabela.createTHead().insertRow();
          celulas(l).forEach(function (c) { var th = document.createElement('th'); comNegrito(th, c); tr.appendChild(th); });
          tabela.createTBody();
          return;
        }
        var linha = tabela.tBodies[0].insertRow();
        celulas(l).forEach(function (c) { comNegrito(linha.insertCell(), c); });
        return;
      }
      lista = null;
      tabela = null;
      paragrafo.push(l);
    });
    fecharTudo();
    return frag;
  }

  function dataBR(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('pt-BR');
  }

  function iniciar() {
    var tipo = document.body.getAttribute('data-documento');
    var versao = document.querySelector('[data-versao]');
    var alvo = document.querySelector('[data-texto]');
    fetch('/api/publico/legal/' + tipo, { headers: { Accept: 'application/json' }, credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (doc) {
        if (!doc || typeof doc.texto !== 'string') throw new Error('sem documento');
        versao.textContent = 'Versão em vigor desde ' + dataBR(doc.publicadoEm);
        alvo.textContent = '';
        alvo.appendChild(montar(doc.texto));
      })
      .catch(function () {
        versao.textContent = '';
        alvo.textContent = 'Não foi possível carregar o documento agora. Tente de novo em instantes ou fale com a gente pelo WhatsApp.';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
