/** `MediaQueryList` falso: jsdom no implementa matchMedia y Motion lo consulta. */
export function fakeMediaQueryList(query: string, matches = false): MediaQueryList {
  return {
    matches,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  } satisfies MediaQueryList;
}
