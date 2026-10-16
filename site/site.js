// Gynfinance — site de venda: menu do celular, sombra do cabeçalho e entrada suave das seções.
(function () {
  var raiz = document.documentElement;
  var header = document.querySelector('.site-header');
  var botaoMenu = document.querySelector('.menu-btn');

  // Sombra no cabeçalho depois de rolar a página
  function aoRolar() {
    if (header) header.classList.toggle('rolou', window.scrollY > 8);
  }
  window.addEventListener('scroll', aoRolar, { passive: true });
  aoRolar();

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
