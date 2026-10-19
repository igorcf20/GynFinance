// Avisos no celular do Gynfinance: mostra o lembrete que o servidor manda e abre a tela certa ao tocar.
self.addEventListener('push', function (evento) {
  var dados = {}
  try {
    dados = evento.data ? evento.data.json() : {}
  } catch (e) {
    dados = { texto: evento.data ? evento.data.text() : '' }
  }
  evento.waitUntil(
    self.registration.showNotification(dados.titulo || 'Gynfinance', {
      body: dados.texto || 'Você tem lembretes para hoje.',
      icon: 'icone-192.png',
      badge: 'icone-192.png',
      tag: dados.marca || 'gynfinance',
      data: { url: dados.url || './' },
    }),
  )
})

self.addEventListener('notificationclick', function (evento) {
  evento.notification.close()
  var url = (evento.notification.data && evento.notification.data.url) || './'
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (janelas) {
      for (var i = 0; i < janelas.length; i++) {
        if ('focus' in janelas[i]) {
          janelas[i].navigate(url)
          return janelas[i].focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
