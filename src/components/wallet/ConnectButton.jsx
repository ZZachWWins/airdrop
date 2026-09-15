import { Wallet } from 'lucide-react'
import { useWallet } from '../../context/WalletContext'
import { useToast } from '../../context/ToastContext'
import './ConnectButton.css'

export function ConnectButton() {
  const { isConnected, address, connect, disconnect, connecting, isDetecting } = useWallet()
  const toast = useToast()

  const formattedAddress = address ? `${address.slice(0, 4)}...${address.slice(-4)}` : ''

  const handleClick = async () => {
    if (isConnected) {
      await disconnect()
      return
    }
    try {
      await connect()
    } catch (err) {
      toast.error(err.message || 'Failed to connect wallet')
    }
  }

  if (isConnected) {
    return (
      <button onClick={handleClick} className="connect-btn connected" title={address}>
        <span className="connect-dot" />
        <span>{formattedAddress}</span>
      </button>
    )
  }

  return (
    <button onClick={handleClick} className="connect-btn" disabled={connecting || isDetecting}>
      <Wallet size={14} />
      <span>{connecting ? 'Connecting…' : 'Connect Wallet'}</span>
    </button>
  )
}
