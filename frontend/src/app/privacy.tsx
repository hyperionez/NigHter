import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'nighter.hideBalances'
const MASK = '••••'

interface Privacy {
  hidden: boolean
  toggle: () => void
  mask: (value: string) => string
}

const PrivacyContext = createContext<Privacy>({
  hidden: false,
  toggle: () => {},
  mask: (value) => value,
})

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(readStored)

  const toggle = useCallback(() => {
    setHidden((current) => {
      const next = !current
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // a blocked store only costs the preference, not the page
      }
      return next
    })
  }, [])

  const value = useMemo<Privacy>(
    () => ({ hidden, toggle, mask: (shown: string) => (hidden ? MASK : shown) }),
    [hidden, toggle],
  )

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
}

export function usePrivacy(): Privacy {
  return useContext(PrivacyContext)
}
