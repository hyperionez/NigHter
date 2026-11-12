export function decodeMoveBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value
  if (Array.isArray(value)) return Uint8Array.from(value.map((b) => Number(b) & 0xff))
  if (typeof value !== 'string' || value.length === 0) return new Uint8Array()

  const hexBody = value.startsWith('0x') || value.startsWith('0X') ? value.slice(2) : undefined
  if (hexBody !== undefined) {
    if (hexBody.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hexBody)) return new Uint8Array()
    const out = new Uint8Array(hexBody.length / 2)
    for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hexBody.slice(i * 2, i * 2 + 2), 16)
    return out
  }

  try {
    const binary = atob(value)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
    return out
  } catch {
    return new Uint8Array()
  }
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = ''
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0')
  return `0x${hex}`
}

export function moveBytesToHex(value: unknown): string {
  return bytesToHex(decodeMoveBytes(value))
}
