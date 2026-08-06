self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()))

self.addEventListener("push", (e) => {
  let dados = {}
  try { dados = e.data ? e.data.json() : {} } catch { dados = {} }
  e.waitUntil(
    self.registration.showNotification(dados.titulo || "Commander", {
      body: dados.corpo || "",
      icon: "/icone-192.png",
      badge: "/icone-192.png",
      data: { url: dados.url || "/hoje" },
    }),
  )
})

self.addEventListener("notificationclick", (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || "/hoje"
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abas) => {
      const aberta = abas.find((a) => "focus" in a)
      return aberta ? aberta.focus().then(() => aberta.navigate(url)) : self.clients.openWindow(url)
    }),
  )
})
