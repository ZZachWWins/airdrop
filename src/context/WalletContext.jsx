import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { toSignatureBytes } from '../lib/signature'

/**
 * Xeris Web4 wallet connectivity.
 *
 * The Xeris Web4 browser (iOS / Android) injects its provider on `window.xeris`
 * — older builds injected it as `window.solana` with an `isXeris` flag, so we
 * accept either. Injection can land after first paint, so we poll briefly on
 * mount rather than reading `window` once.
 *
 * The provider surface we rely on (same as XerisDex / XerisLaunchpad):
 *   connect()                 -> { publicKey } | address string
 *   disconnect()              -> void
 *   signMessage(Uint8Array)   -> { signature: Uint8Array }
 */

const DETECT_INTERVAL_MS = 100
// Android WebView injects noticeably later than iOS WKWebView, especially on a
// cold app start — 2.5s was short enough to miss it and show the "no wallet"
// gate to someone who does have one.
const DETECT_TIMEOUT_MS = 8000
const RECONNECT_KEY = 'xeris_airdrop_connected'

/**
 * A user declining is a normal outcome; a bridge refusing the *shape* of an
 * argument is not, and is worth retrying differently. The two are only
 * distinguishable by message, so match conservatively and let anything
 * ambiguous propagate as a real failure.
 */
function isArgumentRejection(err) {
  const message = String(err?.message ?? err ?? '').toLowerCase()
  if (/reject|denied|declin|cancel|dismiss/.test(message)) return false
  return /argument|param|type|convert|marshal|serializ|not a function|invalid/.test(message)
}

const WalletContext = createContext({
  isConnected: false,
  address: undefined,
  walletProvider: undefined,
  hasWallet: false,
  isDetecting: true,
  connecting: false,
  connect: async () => {},
  disconnect: async () => {},
  signMessage: async () => {
    throw new Error('Wallet not connected')
  },
})

/**
 * Globals the Xeris provider has been seen under. `window.xeris` is current;
 * `window.solana` is the older injection; the nested forms show up in some
 * Android builds that namespace their bridge.
 */
function readInjectedProvider() {
  if (typeof window === 'undefined') return undefined

  const candidates = [
    window.xeris,
    window.solana,
    window.xerisWallet,
    window.XerisWallet,
    window.ethereum?.xeris,
    window.webkit?.messageHandlers?.xeris && window.xeris,
  ]

  // Prefer a provider that identifies itself, but accept one that can do the
  // job: a build that forgets the isXeris flag is still a usable wallet, and
  // refusing it strands the user with no way forward.
  const flagged = candidates.find((candidate) => candidate?.isXeris)
  if (flagged) return flagged

  return candidates.find(
    (candidate) =>
      typeof candidate?.connect === 'function' && typeof candidate?.signMessage === 'function',
  )
}

function addressOf(response) {
  if (!response) return undefined
  if (typeof response === 'string') return response
  const key = response.publicKey ?? response.address
  if (!key) return undefined
  return typeof key === 'string' ? key : key.toString()
}

export function WalletProvider({ children }) {
  const [walletProvider, setWalletProvider] = useState(readInjectedProvider)
  const [isDetecting, setIsDetecting] = useState(!readInjectedProvider())
  const [address, setAddress] = useState(undefined)
  const [connecting, setConnecting] = useState(false)
  const autoConnectAttempted = useRef(false)

  // Detect the injected provider. A provider that is already there at mount is
  // picked up by the lazy initialisers above; this polls for one that injects
  // after first paint, then gives up.
  useEffect(() => {
    if (walletProvider) return undefined

    const interval = setInterval(() => {
      const found = readInjectedProvider()
      if (found) {
        setWalletProvider(found)
        setIsDetecting(false)
      }
    }, DETECT_INTERVAL_MS)

    const timeout = setTimeout(() => {
      clearInterval(interval)
      setIsDetecting(false)
    }, DETECT_TIMEOUT_MS)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [walletProvider])

  // Restore a previous session once the provider shows up. The ref keeps this
  // to one attempt per page load — a user who disconnects on purpose should
  // not be reconnected by the next render.
  useEffect(() => {
    if (!walletProvider || address || autoConnectAttempted.current) return undefined

    let wanted = false
    try {
      wanted = localStorage.getItem(RECONNECT_KEY) === '1'
    } catch {
      // Private browsing can throw on localStorage — reconnect is optional.
    }
    if (!wanted) return undefined

    autoConnectAttempted.current = true
    let cancelled = false

    walletProvider
      .connect()
      .then((response) => {
        const addr = addressOf(response)
        if (addr && !cancelled) setAddress(addr)
      })
      .catch(() => {
        // A silent reconnect the wallet declines is not worth surfacing — the
        // user can still connect explicitly.
      })

    return () => {
      cancelled = true
    }
  }, [walletProvider, address])

  // Track account switches and in-wallet disconnects.
  useEffect(() => {
    if (!walletProvider?.on) return undefined

    const handleAccountChanged = (next) => {
      const addr = addressOf(next)
      if (addr) setAddress(addr)
      else setAddress(undefined)
    }
    const handleDisconnect = () => {
      setAddress(undefined)
      try {
        localStorage.removeItem(RECONNECT_KEY)
      } catch {
        // ignore
      }
    }

    walletProvider.on('accountChanged', handleAccountChanged)
    walletProvider.on('disconnect', handleDisconnect)
    return () => {
      walletProvider.off?.('accountChanged', handleAccountChanged)
      walletProvider.off?.('disconnect', handleDisconnect)
    }
  }, [walletProvider])

  const connect = useCallback(async () => {
    const provider = walletProvider ?? readInjectedProvider()
    if (!provider) {
      throw new Error(
        'No Xeris wallet detected. Open this page inside the Xeris Web4 browser on iOS or Android.',
      )
    }

    setConnecting(true)
    try {
      const response = await provider.connect()
      const addr = addressOf(response)
      if (!addr) throw new Error('Wallet returned no address.')
      setWalletProvider(provider)
      setAddress(addr)
      try {
        localStorage.setItem(RECONNECT_KEY, '1')
      } catch {
        // ignore
      }
      return addr
    } finally {
      setConnecting(false)
    }
  }, [walletProvider])

  const disconnect = useCallback(async () => {
    if (walletProvider?.disconnect) {
      try {
        await walletProvider.disconnect()
      } catch {
        // Clear local state even if the wallet refuses.
      }
    }
    setAddress(undefined)
    try {
      localStorage.removeItem(RECONNECT_KEY)
    } catch {
      // ignore
    }
  }, [walletProvider])

  /**
   * Sign a UTF-8 string and return the raw signature bytes.
   * Wallets differ in what they hand back — a `{ signature }` object, a bare
   * Uint8Array, or a plain array — so normalise here.
   */
  const signMessage = useCallback(
    async (message) => {
      if (!walletProvider) throw new Error('Wallet not connected.')
      if (typeof walletProvider.signMessage !== 'function') {
        throw new Error('This wallet build does not support message signing. Please update Xeris Web4.')
      }

      const encoded = new TextEncoder().encode(message)

      // Some Android bridges reject a Uint8Array argument because it does not
      // survive JSON marshalling. Fall back to a plain array, then to the raw
      // string, rather than failing on the first shape the bridge dislikes.
      let result
      try {
        result = await walletProvider.signMessage(encoded)
      } catch (err) {
        if (isArgumentRejection(err)) {
          try {
            result = await walletProvider.signMessage(Array.from(encoded))
          } catch (secondErr) {
            if (!isArgumentRejection(secondErr)) throw secondErr
            result = await walletProvider.signMessage(message)
          }
        } else {
          throw err
        }
      }

      return toSignatureBytes(result)
    },
    [walletProvider],
  )

  const value = useMemo(
    () => ({
      isConnected: Boolean(address),
      address,
      walletProvider,
      hasWallet: Boolean(walletProvider),
      isDetecting,
      connecting,
      connect,
      disconnect,
      signMessage,
    }),
    [address, walletProvider, isDetecting, connecting, connect, disconnect, signMessage],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  return useContext(WalletContext)
}
