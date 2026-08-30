/**
 * Prise en compte des mises à jour de l'app installée.
 *
 * Le service worker est en `autoUpdate` : la nouvelle version s'installe et
 * prend la main toute seule. Mais la page déjà affichée, elle, continue de
 * tourner sur l'ancien bundle — c'est ce qui donne l'impression que l'app
 * installée est « en retard » sur le site.
 *
 * On recharge donc quand une nouvelle version prend le contrôle, mais jamais
 * sous les doigts de l'utilisateur : on attend que l'app repasse au premier
 * plan. Une mise à jour ne doit pas interrompre une soirée en cours.
 */
if ('serviceWorker' in navigator) {
  // Au tout premier chargement il n'y a pas encore de contrôleur ; `clientsClaim`
  // en déclenche alors un sans qu'il y ait quoi que ce soit à mettre à jour.
  // Recharger dans ce cas provoquerait une boucle.
  const hadController = Boolean(navigator.serviceWorker.controller)
  let pending = false
  let reloading = false

  const reload = () => {
    if (!pending || reloading) return
    reloading = true
    location.reload()
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return
    pending = true
    // Si l'app est déjà en arrière-plan, on peut recharger tout de suite.
    if (document.visibilityState === 'hidden') reload()
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') reload()
  })
}

export {}
