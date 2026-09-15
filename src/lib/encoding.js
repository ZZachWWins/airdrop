/** Encode raw signature bytes as base64 for transport to the API. */
export function bytesToBase64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/** Shorten an address for display: 7xQpAb…3kAf. */
export function shortenAddress(address, lead = 6, tail = 4) {
  if (typeof address !== 'string' || address.length <= lead + tail + 1) return address
  return `${address.slice(0, lead)}…${address.slice(-tail)}`
}

/** Lamports (9 decimals) to a display string in XRS. */
export function formatXrs(lamports, decimals = 4) {
  const value = Number(lamports || 0) / 1e9
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
}

export function formatDate(timestamp) {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(timestamp) {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
