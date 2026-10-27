export function isLandingPath(path: string) {
  return path === '/' || path === ''
}

export function navigateTo(path: string, replace = false) {
  if (replace) window.history.replaceState({}, '', path)
  else window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0, behavior: 'instant' })
  document.querySelector<HTMLElement>('.content-area')?.scrollTo({ top: 0, behavior: 'instant' })
}
