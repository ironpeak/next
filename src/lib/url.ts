const DUMMY_ORIGIN = 'http://n'

function getUrlWithoutHost(url: string) {
  return new URL(url, DUMMY_ORIGIN)
}

export function getPathname(url: string) {
  return getUrlWithoutHost(url).pathname
}

export function isFullStringUrl(url: string) {
  return /https?:\/\//.test(url)
}

export function parseUrl(url: string): URL | undefined {
  let parsed = undefined
  try {
    parsed = new URL(url, DUMMY_ORIGIN)
  } catch {}
  return parsed
}
