import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    const mql = typeof window.matchMedia === 'function'
      ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
      : null
    if (mql) mql.addEventListener("change", onChange)
    else window.addEventListener('resize', onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => {
      if (mql) mql.removeEventListener("change", onChange)
      else window.removeEventListener('resize', onChange)
    }
  }, [])

  return !!isMobile
}

export function useNeedsTouchDisclosure() {
  const [needsTouchDisclosure, setNeedsTouchDisclosure] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(hover: none), (any-pointer: coarse)')
      : null
    const update = () => setNeedsTouchDisclosure(
      mediaQuery?.matches ?? ('ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0))
    )
    update()
    if (mediaQuery) mediaQuery.addEventListener('change', update)
    else window.addEventListener('resize', update)
    return () => {
      if (mediaQuery) mediaQuery.removeEventListener('change', update)
      else window.removeEventListener('resize', update)
    }
  }, [])

  return needsTouchDisclosure
}
