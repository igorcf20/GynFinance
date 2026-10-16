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

  function aplicarPlanos(planos, modulos, conteudo) {
    var destino = document.querySelector('[data-planos]');
    var estatico = document.querySelector('[data-preco-estatico]');
    if (!destino || !estatico) return;
    planos = planos.filter(function (p) { return p && typeof p === 'object' && p.ativo !== false && typeof p.nome === 'string'; });
    if (!planos.length) return;
    if (planos.some(function (p) { return typeof p.ordem === 'number'; })) {
      planos = planos.slice().sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
    }
    planos = planos.slice(0, 4);

    var catalogo = {};
    (Array.isArray(modulos) ? modulos : []).forEach(function (m) { if (m && typeof m.id === 'string') catalogo[m.id] = m; });

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
