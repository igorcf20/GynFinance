// Gynfinance — site de venda: menu, cabeçalho que encolhe ao rolar, voltar ao topo e entrada suave das seções.
(function () {
  var raiz = document.documentElement;
  var header = document.querySelector('.site-header');
  var botaoMenu = document.querySelector('.menu-btn');

  // Ao rolar: cabeçalho e logo encolhem (com folga para não tremer no limite) e aparece o botão de voltar ao topo.
  var topo = document.querySelector('.topo');
  var rolou = false;
  function aoRolar() {
    var y = window.scrollY;
    if (!rolou && y > 40) rolou = true;
    else if (rolou && y < 8) rolou = false;
    if (header) header.classList.toggle('rolou', rolou);
    if (topo) topo.classList.toggle('visivel', y > 600);
  }
  window.addEventListener('scroll', aoRolar, { passive: true });
  aoRolar();
  if (topo) {
    topo.addEventListener('click', function () {
      var suave = !window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: suave ? 'smooth' : 'auto' });
      var marca = document.querySelector('.brand');
      if (marca) marca.focus({ preventScroll: true });
    });
  }

  // Ano do rodapé
  document.querySelectorAll('[data-ano]').forEach(function (e) { e.textContent = String(new Date().getFullYear()); });

  // Menu: destaca a seção em que o visitante está, com um fundo que desliza entre os itens.
  var nav = document.querySelector('.nav');
  var marcaNav = document.querySelector('.nav-marca');
  var linksSecao = document.querySelectorAll('[data-secao]');
  function marcar(id) {
    var alvo = null;
    linksSecao.forEach(function (a) {
      var ativo = a.getAttribute('data-secao') === id;
      a.classList.toggle('ativo', ativo);
      if (ativo) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
      if (ativo && nav && nav.contains(a)) alvo = a;
    });
    if (!marcaNav) return;
    if (alvo) {
      marcaNav.style.width = alvo.offsetWidth + 'px';
      marcaNav.style.transform = 'translateX(' + alvo.offsetLeft + 'px)';
      marcaNav.classList.add('pronta');
    } else {
      marcaNav.classList.remove('pronta');
    }
  }
  var secoes = [];
  linksSecao.forEach(function (a) {
    var s = document.getElementById(a.getAttribute('data-secao'));
    if (s && secoes.indexOf(s) === -1) secoes.push(s);
  });
  function secaoAtual() {
    // A seção cujo topo já passou de um terço da tela; "Para o MEI" fica dentro de "Recursos" e vence quando visível.
    var linha = window.innerHeight / 3;
    var atual = null;
    secoes.forEach(function (s) {
      var r = s.getBoundingClientRect();
      if (r.top <= linha && r.bottom > linha) atual = s.id;
    });
    marcar(atual);
  }
  var agendado = false;
  window.addEventListener('scroll', function () {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(function () { agendado = false; secaoAtual(); });
  }, { passive: true });
  window.addEventListener('resize', secaoAtual);
  secaoAtual();

  // Barra de leitura no cabeçalho
  var barra = document.querySelector('.progresso span');
  if (barra) {
    var pendente = false;
    var medir = function () {
      pendente = false;
      var total = document.documentElement.scrollHeight - window.innerHeight;
      barra.style.transform = 'scaleX(' + (total > 0 ? Math.min(1, window.scrollY / total) : 0) + ')';
    };
    window.addEventListener('scroll', function () {
      if (!pendente) { pendente = true; requestAnimationFrame(medir); }
    }, { passive: true });
    medir();
  }

  // Recursos: painel com as telas. Abre ao passar o mouse (com pequena espera para fechar),
  // ao clicar na seta/no item ou pelo teclado; fecha com Esc, clique fora ou ao escolher uma tela.
  var grupo = document.querySelector('.nav-grupo');
  if (grupo) {
    var abreMega = grupo.querySelector('.nav-abre');
    var timer = null;
    var mouseFino = window.matchMedia && window.matchMedia('(hover: hover)').matches;
    var abrirMega = function (sim) {
      clearTimeout(timer);
      grupo.classList.toggle('aberto', sim);
      abreMega.setAttribute('aria-expanded', sim ? 'true' : 'false');
    };
    if (mouseFino) {
      grupo.addEventListener('mouseenter', function () { clearTimeout(timer); timer = setTimeout(function () { abrirMega(true); }, 80); });
      grupo.addEventListener('mouseleave', function () { clearTimeout(timer); timer = setTimeout(function () { abrirMega(false); }, 180); });
    }
    abreMega.addEventListener('click', function (e) {
      // Sem mouse (toque), o primeiro toque abre o painel; com o painel aberto, vai para a seção.
      if (!grupo.classList.contains('aberto')) { e.preventDefault(); abrirMega(true); }
      else abrirMega(false);
    });
    abreMega.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault(); abrirMega(true);
        var primeiro = grupo.querySelector('.mega-item');
        if (primeiro) primeiro.focus();
      }
    });
    grupo.querySelectorAll('.mega a').forEach(function (a) { a.addEventListener('click', function () { abrirMega(false); }); });
    grupo.addEventListener('focusout', function (e) { if (!grupo.contains(e.relatedTarget)) abrirMega(false); });
    document.addEventListener('click', function (e) { if (!grupo.contains(e.target)) abrirMega(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && grupo.classList.contains('aberto')) { abrirMega(false); abreMega.focus(); }
    });
  }

  // Celular: Recursos abre a lista das telas
  var abreSub = document.querySelector('.item-abre');
  var sub = document.getElementById('sub-recursos');
  if (abreSub && sub) {
    abreSub.addEventListener('click', function () {
      var aberto = sub.classList.toggle('aberto');
      abreSub.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    });
  }

  // Menu do celular
  function fecharMenu() {
    raiz.classList.remove('menu-aberto');
    if (botaoMenu) botaoMenu.setAttribute('aria-expanded', 'false');
  }
  if (botaoMenu) {
    botaoMenu.addEventListener('click', function () {
      var aberto = raiz.classList.toggle('menu-aberto');
      botaoMenu.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    });
    document.querySelectorAll('.menu-mobile a').forEach(function (a) {
      a.addEventListener('click', fecharMenu);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') fecharMenu();
    });
  }

  // Seções aparecem ao entrar na tela (o CSS só esconde quando o movimento está liberado)
  var itens = document.querySelectorAll('.revela');
  if (!('IntersectionObserver' in window)) {
    itens.forEach(function (el) { el.classList.add('visivel'); });
    return;
  }
  var obs = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('visivel');
        obs.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  itens.forEach(function (el) { obs.observe(el); });
})();

// Conteúdo editável pelo superadmin: textos, imagens, contatos e planos vêm de /api/publico/site.
// Se a API não responder, o HTML estático fica como está (é o padrão de cada campo).
(function () {
  var MSG_WHATS_PADRAO = 'Olá! Quero saber mais sobre o Gynfinance.';
  var LINK_COMECAR = '/app/#/entrar?depois=comecar';
  var LISTA_OFERTA_PADRAO = 'Os 10 primeiros assinantes ganham 3 meses grátis.';
  var WHATS_PADRAO = '351914125381';
  var LISTA_ABERTURA_PADRAO = '2026-11-05';
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var LISTA_BOTAO_PADRAO = 'Quero ser avisado';
  var LISTA_MSG_PADRAO = 'Olá! Quero entrar na lista de espera do Gynfinance e ser avisado quando abrir.\nNome:\nNegócio:\nCidade:\nComo conheci o Gynfinance:';
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function texto(v) { return typeof v === 'string' ? v : null; }

  function porTexto(el, valor) {
    el.textContent = valor;
    if (valor.indexOf('\n') !== -1) el.style.whiteSpace = 'pre-line';
  }

  function imagemPermitida(v) {
    return /^\/api\/publico\/imagens\/[^\s"'<>]+$/.test(v) || /^img\/[\w.\-\/]+$/.test(v) || /^https:\/\/[^\s"'<>]+$/.test(v);
  }

  function linkPermitido(v) { return /^https?:\/\/[^\s"'<>]+$/i.test(v); }

  function icone(nome, classe) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'icon' + (classe ? ' ' + classe : ''));
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#' + nome);
    svg.appendChild(use);
    return svg;
  }

  function el(tag, classe, conteudo) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (conteudo != null) e.textContent = conteudo;
    return e;
  }

  function trocarImagem(img, src) {
    img.removeAttribute('srcset');
    var pic = img.parentElement;
    if (pic && pic.tagName === 'PICTURE') {
      pic.querySelectorAll('source').forEach(function (s) { s.remove(); });
    }
    if (img.closest('.phone') || img.closest('.browser')) {
      // Moldura de celular / navegador: mantém o formato e corta a imagem pelo topo.
      img.style.objectFit = 'cover';
      img.style.objectPosition = img.closest('.browser') ? 'left top' : 'center top';
    } else {
      img.removeAttribute('width');
      img.removeAttribute('height');
      img.style.aspectRatio = 'auto';
    }
    var bloco = img.closest('.feature');
    var titulo = bloco && bloco.querySelector('h3');
    img.alt = titulo ? 'Tela do Gynfinance: ' + titulo.textContent : 'Tela do Gynfinance';
    img.src = src;
  }

  function numeroWhats(c) {
    var numero = ((texto(c['contato.whatsapp']) || '').trim() || WHATS_PADRAO).replace(/\D/g, '');
    if (numero.length === 10 || numero.length === 11) numero = '55' + numero; // só DDD + número: Brasil
    else if (/^9\d{8}$/.test(numero)) numero = '351' + numero; // celular de Portugal sem o 351
    return numero;
  }

  // Canal de onde a pessoa veio: ?origem=instagram (ou utm_source) no link divulgado.
  function origem() {
    var m = /[?&](?:origem|utm_source)=([^&#]+)/i.exec(location.search);
    if (!m) return '';
    try { return decodeURIComponent(m[1].replace(/\+/g, ' ')).replace(/[^\w\s.-]/g, '').trim().slice(0, 40); } catch (e) { return ''; }
  }

  // Link de indicação (?indicacao=CODIGO): guarda no aparelho para o cadastro no sistema saber quem indicou.
  (function () {
    var m = /[?&]indicacao=([0-9a-z]{4,40})(?:&|#|$)/i.exec(location.search);
    if (!m) return;
    try { localStorage.setItem('gynfinance:indicacao', m[1]); } catch (e) { /* sem armazenamento */ }
  })();

  // Troca o texto do botão sem mexer nos ícones: o span editável, ou o primeiro texto solto.
  function trocarRotulo(a, valor) {
    var alvo = a.querySelector('span[data-cms]');
    if (alvo) { alvo.textContent = valor; return; }
    for (var n = a.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && n.textContent.trim()) { n.textContent = n.textContent.replace(/\S[\s\S]*\S|\S/, valor); return; }
    }
    a.insertBefore(document.createTextNode(valor), a.firstChild);
  }

  // "2026-11-05" -> "5 de novembro" (vazio ou inválido -> "")
  function dataExtenso(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((v || '').trim());
    if (!m || +m[2] < 1 || +m[2] > 12) return '';
    return String(+m[3]) + ' de ' + MESES[+m[2] - 1];
  }

  // Cadastro fechado (Superadmin > Sistema): "Criar minha conta" vira "Quero ser avisado" e abre o WhatsApp.
  function aplicarListaEspera(c) {
    var rotulo = (texto(c['lista.botao']) || '').trim() || LISTA_BOTAO_PADRAO;
    var msg = (texto(c['lista.mensagem']) || '').trim() || LISTA_MSG_PADRAO;
    var quando = dataExtenso(texto(c['lista.abertura']) || LISTA_ABERTURA_PADRAO);
    var canal = origem();
    if (canal) msg += '\nVim por: ' + canal;
    var href = 'https://wa.me/' + numeroWhats(c) + '?text=' + encodeURIComponent(msg);
    document.querySelectorAll('a[data-cadastro]').forEach(function (a) {
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener';
      trocarRotulo(a, rotulo);
    });
    document.querySelectorAll('[data-lista-texto]').forEach(function (e) {
      // Texto editado pelo superadmin vale mais que o texto da lista.
      var chave = e.getAttribute('data-cms');
      if (chave && texto(c[chave]) !== null) return;
      e.textContent = e.getAttribute('data-lista-texto').replace('{data}', quando ? 'em ' + quando : 'em breve');
    });
    var oferta = (texto(c['lista.oferta']) || '').trim() || LISTA_OFERTA_PADRAO;
    var faixa = [quando ? 'Cadastros abrem em ' + quando + '.' : '', oferta].filter(Boolean).join(' ');
    var caixa = document.querySelector('[data-lista-oferta]');
    if (faixa && caixa) {
      caixa.querySelector('span').textContent = faixa;
      caixa.hidden = false;
    }
  }

  function aplicarConteudo(c) {
    document.querySelectorAll('[data-cms]').forEach(function (e) {
      var v = texto(c[e.getAttribute('data-cms')]);
      if (v !== null) porTexto(e, v);
    });
    document.querySelectorAll('img[data-cms-img]').forEach(function (img) {
      var v = texto(c[img.getAttribute('data-cms-img')]);
      if (v && imagemPermitida(v.trim())) trocarImagem(img, v.trim());
    });

    // WhatsApp
    var numero = numeroWhats(c);
    var msg = texto(c['contato.whatsapp_mensagem']);
    if (msg === null || !msg.trim()) msg = MSG_WHATS_PADRAO;
    if (numero || msg !== MSG_WHATS_PADRAO) {
      var href = 'https://wa.me/' + numero + '?text=' + encodeURIComponent(msg);
      document.querySelectorAll('[data-whats]').forEach(function (a) { a.href = href; });
    }

    // E-mail
    var email = (texto(c['contato.email']) || '').trim();
    document.querySelectorAll('[data-contato="email"]').forEach(function (a) {
      if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email)) return;
      a.href = 'mailto:' + email;
      var alvo = a.querySelector('span') || a;
      alvo.textContent = email;
      a.hidden = false;
    });

    // Empresa: CNPJ, responsável e endereço só aparecem quando preenchidos.
    document.querySelectorAll('[data-empresa]').forEach(function (e) {
      var v = (texto(c['empresa.' + e.getAttribute('data-empresa')]) || '').trim();
      if (!v) return;
      var alvo = e.querySelector('span') || e;
      alvo.textContent = v;
      e.hidden = false;
    });

    // Instagram (aceita link completo ou @perfil)
    var insta = (texto(c['contato.instagram']) || '').trim();
    if (/^@?[\w.]{1,30}$/.test(insta)) insta = 'https://instagram.com/' + insta.replace(/^@/, '');
    document.querySelectorAll('[data-contato="instagram"]').forEach(function (a) {
      if (!linkPermitido(insta)) return;
      a.href = insta;
      var perfil = insta.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').split(/[/?#]/)[0];
      var alvo = a.querySelector('span') || a;
      alvo.textContent = perfil && perfil !== insta ? '@' + perfil : 'Instagram';
      a.hidden = false;
    });
  }

  function formatarPreco(centavos) {
    var reais = centavos / 100;
    var temCentavos = centavos % 100 !== 0;
    return 'R$ ' + reais.toLocaleString('pt-BR', { minimumFractionDigits: temCentavos ? 2 : 0, maximumFractionDigits: 2 });
  }

  function itemCheck(nome, descricao, emBreve) {
    var li = el('li');
    var ck = el('span', 'ck');
    ck.appendChild(icone('i-check'));
    li.appendChild(ck);
    var corpo = el('span');
    if (descricao) {
      corpo.appendChild(el('span', 'mod-nome', nome));
    } else {
      corpo.appendChild(document.createTextNode(nome));
    }
    if (emBreve) corpo.appendChild(el('span', 'em-breve', 'em breve'));
    if (descricao) corpo.appendChild(el('span', 'mod-desc', descricao));
    li.appendChild(corpo);
    return li;
  }

  function listaModulos(plano, catalogo, comDescricao) {
    var ul = el('ul', 'checks');
    (plano.modulos || []).forEach(function (id) {
      var m = catalogo[id];
      if (!m || typeof m.nome !== 'string') return;
      ul.appendChild(itemCheck(m.nome, comDescricao ? texto(m.descricao) : null, m.pronto === false));
    });
    if (plano.temIa) {
      ul.appendChild(itemCheck('Inteligência artificial', comDescricao ? 'Recursos de inteligência artificial para ajudar no dia a dia.' : null, false));
    }
    return ul;
  }

  function valorPlano(plano, comPartir) {
    var p = el('p', 'valor num');
    if (comPartir) p.appendChild(el('small', null, 'a partir de'));
    var centavos = Math.max(0, Math.round(Number(plano.precoCentavos) || 0));
    if (centavos === 0) {
      p.appendChild(el('strong', null, 'Grátis'));
    } else {
      p.appendChild(el('strong', null, formatarPreco(centavos)));
      p.appendChild(el('span', null, '/mês'));
    }
    return p;
  }

  function botaoComecar() {
    var a = el('a', 'btn btn-primary btn-block');
    a.href = LINK_COMECAR;
    a.setAttribute('data-cadastro', '');
    a.appendChild(document.createTextNode('Começar agora'));
    a.appendChild(icone('i-seta', 'icon-arrow'));
    return a;
  }

  function cartaoPlano(plano, catalogo, varios) {
    var card = el('article', 'price-card plano-card' + (varios && plano.destaque ? ' destaque' : ''));
    var topo = el('div', 'plano-topo');
    topo.appendChild(el('h3', 'plano', texto(plano.nome) || 'Plano'));
    if (varios && plano.destaque) topo.appendChild(el('span', 'selo-destaque', 'Mais escolhido'));
    card.appendChild(topo);
    card.appendChild(valorPlano(plano, false));
    if (texto(plano.descricao)) card.appendChild(el('p', 'desc', plano.descricao));
    if (varios) {
      card.appendChild(listaModulos(plano, catalogo, false));
      var acao = el('div', 'plano-acao');
      acao.appendChild(botaoComecar());
      card.appendChild(acao);
    } else {
      card.appendChild(botaoComecar());
    }
    return card;
  }

  // Planos que aparecem no site: ativos, na ordem do painel, no máximo 4.
  function planosAtivos(planos) {
    planos = planos.filter(function (p) { return p && typeof p === 'object' && p.ativo !== false && typeof p.nome === 'string'; });
    if (planos.some(function (p) { return typeof p.ordem === 'number'; })) {
      planos = planos.slice().sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
    }
    return planos.slice(0, 4);
  }

  function catalogoModulos(modulos) {
    var catalogo = {};
    (Array.isArray(modulos) ? modulos : []).forEach(function (m) { if (m && typeof m.id === 'string') catalogo[m.id] = m; });
    return catalogo;
  }

  function aplicarPlanos(planos, modulos, conteudo) {
    var destino = document.querySelector('[data-planos]');
    var estatico = document.querySelector('[data-preco-estatico]');
    if (!destino || !estatico) return;
    planos = planosAtivos(planos);
    if (!planos.length) return;

    var catalogo = catalogoModulos(modulos);

    // Textos que vivem no cartão estático e são aproveitados (já com as edições aplicadas)
    var alt = estatico.querySelector('.alt');
    var contato = estatico.querySelector('.price-contato');
    var varios = planos.length > 1;

    destino.textContent = '';
    destino.className = 'planos planos-n' + planos.length;

    if (!varios) {
      var plano = planos[0];
      var grade = el('div', 'pricing');
      var card = cartaoPlano(plano, catalogo, false);
      if (alt) card.appendChild(alt);
      if (contato) card.appendChild(contato);
      grade.appendChild(card);
      var lista = el('div', 'price-list');
      lista.appendChild(el('h3', null, 'O que vem no plano'));
      var ul = listaModulos(plano, catalogo, true);
      lista.appendChild(ul);
      if (ul.children.length) grade.appendChild(lista);
      else {
        grade.style.gridTemplateColumns = 'minmax(0, 520px)';
        grade.style.justifyContent = 'center';
      }
      destino.appendChild(grade);
    } else {
      var g = el('div', 'planos-grade');
      planos.forEach(function (p) { g.appendChild(cartaoPlano(p, catalogo, true)); });
      destino.appendChild(g);
      if (alt || contato) {
        var rodape = el('div', 'planos-rodape');
        if (alt) rodape.appendChild(alt);
        if (contato) rodape.appendChild(contato);
        destino.appendChild(rodape);
      }
    }
    estatico.hidden = true;
    destino.hidden = false;

    // Títulos da seção para quando há vários planos
    if (varios) {
      document.querySelectorAll('[data-cms-varios]').forEach(function (e) {
        var v = texto(conteudo[e.getAttribute('data-cms-varios')]);
        porTexto(e, v !== null ? v : (e.getAttribute('data-texto-varios') || e.textContent));
      });
    }

    // "a partir de R$ X" no resto da página
    var min = Math.min.apply(null, planos.map(function (p) { return Math.max(0, Math.round(Number(p.precoCentavos) || 0)); }));
    if (min > 0) {
      document.querySelectorAll('[data-preco-min]').forEach(function (e) { e.textContent = formatarPreco(min); });
    }
  }

  // ---------- Tudo o que o Gynfinance faz ----------
  // Cada linha diz do que depende (data-req): "base" (todo plano), o id de um módulo, "ia" (plan.temIa)
  // ou "negocios" (quantos negócios o plano permite). As colunas são os planos ativos do painel.

  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }

  function marcaSim(nomePlano) {
    var s = el('span', 'comp-marca sim');
    s.appendChild(icone('i-check'));
    s.appendChild(el('span', 'sr-only', 'Incluído no ' + nomePlano));
    return [s];
  }

  function marcaNao(nomePlano) {
    var s = el('span', 'comp-marca nao', '–');
    s.setAttribute('aria-hidden', 'true');
    return [s, el('span', 'sr-only', 'Não incluído no ' + nomePlano)];
  }

  function marcaQtd(n, nomePlano) {
    var s = el('span', 'comp-marca qtd');
    var v = el('span', null, String(n));
    v.setAttribute('aria-hidden', 'true');
    s.appendChild(v);
    s.appendChild(el('span', 'sr-only', nomePlano + ': ' + plural(n, 'negócio', 'negócios')));
    return [s];
  }

  function negociosDo(p) { return Math.max(1, Math.round(Number(p.negocios) || 1)); }

  function temModuloPlano(p, id) { return id === 'financeiro' || (Array.isArray(p.modulos) && p.modulos.indexOf(id) !== -1); }

  // Devolve as marcas da linha, 'breve' (ainda não existe) ou null (nenhum plano oferece: some da lista).
  function marcasDaLinha(linha, planos, catalogo) {
    var req = linha.getAttribute('data-req') || 'base';
    var nome = function (p) { return p.nome; };
    if (req === 'base') return planos.map(function (p) { return marcaSim(nome(p)); });
    if (req === 'ia') {
      if (!planos.some(function (p) { return p.temIa === true; })) return 'breve';
      return planos.map(function (p) { return p.temIa === true ? marcaSim(nome(p)) : marcaNao(nome(p)); });
    }
    if (req === 'negocios') {
      if (!planos.some(function (p) { return negociosDo(p) > 1; })) return null;
      return planos.map(function (p) { return marcaQtd(negociosDo(p), nome(p)); });
    }
    var m = catalogo[req];
    var pronto = m ? m.pronto !== false : linha.getAttribute('data-pronto') !== 'nao';
    if (!pronto) return 'breve';
    if (!planos.some(function (p) { return temModuloPlano(p, req); })) return null;
    return planos.map(function (p) { return temModuloPlano(p, req) ? marcaSim(nome(p)) : marcaNao(nome(p)); });
  }

  function aplicarComparacao(planos, modulos) {
    var caixa = document.querySelector('[data-comp]');
    if (!caixa) return;
    planos = planosAtivos(planos);
    if (!planos.length) return;
    var catalogo = catalogoModulos(modulos);
    var varios = planos.length > 1;
    var classeN = 'comp-n' + planos.length;

    var cabeca = caixa.querySelector('[data-comp-cabeca]');
    var grupos = caixa.querySelector('[data-comp-grupos]');
    [cabeca, grupos].forEach(function (e) {
      if (e) e.className = e.className.replace(/\bcomp-n\d\b/g, '').trim() + ' ' + classeN;
    });
    if (cabeca) {
      var rotulo = cabeca.querySelector('.comp-cabeca-rotulo');
      if (rotulo) rotulo.textContent = varios ? 'Compare os planos' : 'O que vem no plano';
      var colunas = cabeca.querySelector('.comp-planos');
      colunas.textContent = '';
      planos.forEach(function (p) {
        var c = el('span', 'comp-plano' + (varios && p.destaque ? ' destaque' : ''));
        c.appendChild(el('strong', null, p.nome));
        var centavos = Math.max(0, Math.round(Number(p.precoCentavos) || 0));
        c.appendChild(el('small', null, centavos === 0 ? 'Grátis' : formatarPreco(centavos) + '/mês'));
        colunas.appendChild(c);
      });
    }

    caixa.querySelectorAll('.comp-linha').forEach(function (linha) {
      var alvo = linha.querySelector('.comp-marcas');
      var marcas = marcasDaLinha(linha, planos, catalogo);
      linha.hidden = marcas === null;
      if (!alvo || marcas === null) return;
      alvo.textContent = '';
      if (marcas === 'breve') { alvo.appendChild(el('span', 'comp-breve', 'em breve')); return; }
      marcas.forEach(function (partes) { partes.forEach(function (n) { alvo.appendChild(n); }); });
    });
    contarComparacao(caixa);
  }

  // Quantas funcionalidades cada grupo mostra; grupo sem nenhuma linha visível some.
  function contarComparacao(caixa) {
    var total = 0;
    var areas = 0;
    caixa.querySelectorAll('.comp-grupo').forEach(function (g) {
      var n = 0;
      g.querySelectorAll('.comp-linha').forEach(function (l) { if (!l.hidden) n++; });
      g.hidden = n === 0;
      var qtd = g.querySelector('[data-comp-qtd]');
      if (qtd) qtd.textContent = plural(n, 'funcionalidade', 'funcionalidades');
      total += n;
      if (n) areas++;
    });
    var resumo = caixa.querySelector('[data-comp-resumo]');
    if (resumo) resumo.textContent = plural(total, 'funcionalidade', 'funcionalidades') + ' em ' + plural(areas, 'área', 'áreas');
    atualizarAlternar(caixa);
  }

  function gruposVisiveis(caixa) {
    return Array.prototype.filter.call(caixa.querySelectorAll('.comp-grupo'), function (g) { return !g.hidden; });
  }

  // "Abrir tudo" quando falta algum grupo aberto; "Fechar tudo" quando todos estão abertos.
  function atualizarAlternar(caixa) {
    var botao = caixa.querySelector('[data-comp-alternar]');
    if (!botao) return;
    var todos = gruposVisiveis(caixa).every(function (g) { return g.open; });
    botao.setAttribute('aria-expanded', todos ? 'true' : 'false');
    botao.querySelector('span').textContent = todos ? 'Fechar tudo' : 'Abrir tudo';
  }

  function prepararComparacao() {
    var caixa = document.querySelector('[data-comp]');
    if (!caixa) return;
    var botao = caixa.querySelector('[data-comp-alternar]');
    caixa.querySelectorAll('.comp-grupo').forEach(function (g) {
      g.addEventListener('toggle', function () { atualizarAlternar(caixa); });
    });
    if (botao) {
      botao.addEventListener('click', function () {
        var abrir = botao.getAttribute('aria-expanded') !== 'true';
        gruposVisiveis(caixa).forEach(function (g) { g.open = abrir; });
        atualizarAlternar(caixa);
      });
    }
    // Link para um grupo (#tudo-mei, por exemplo) já chega com ele aberto.
    var abrirDoEndereco = function () {
      var g = location.hash && document.getElementById(location.hash.slice(1));
      if (g && g.classList.contains('comp-grupo')) g.open = true;
    };
    window.addEventListener('hashchange', abrirDoEndereco);
    abrirDoEndereco();
    contarComparacao(caixa);
  }

  try { prepararComparacao(); } catch (e) { /* os grupos continuam abrindo pelo navegador */ }

  function iniciar() {
    if (!window.fetch) return;
    fetch('/api/publico/site', { headers: { Accept: 'application/json' }, credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (dados) {
        if (!dados || typeof dados !== 'object') return;
        var conteudo = dados.conteudo && typeof dados.conteudo === 'object' ? dados.conteudo : {};
        try { aplicarConteudo(conteudo); } catch (e) { /* mantém o HTML */ }
        if (Array.isArray(dados.planos)) {
          try { aplicarPlanos(dados.planos, dados.modulos, conteudo); } catch (e) { /* mantém o cartão estático */ }
          try { aplicarComparacao(dados.planos, dados.modulos); } catch (e) { /* mantém a lista estática */ }
        }
        if (dados.cadastroAberto === false) {
          try { aplicarListaEspera(conteudo); } catch (e) { /* mantém os botões de cadastro */ }
        }
      })
      .catch(function () { /* sem API: fica o conteúdo estático */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
