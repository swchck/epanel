export interface EncryptedEnvelope {
  format: 'panel-enc'
  version: 1
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string }
  cipher: { name: 'AES-GCM'; iv: string }
  data: string
}

// OWASP 2023 guidance for PBKDF2-HMAC-SHA256
export const PBKDF2_ITERATIONS = 310_000

const enc = new TextEncoder()
const dec = new TextDecoder()

function toB64(bytes: Uint8Array): string {
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(s)
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function gzip(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function encryptJson(value: unknown, password: string, iterations = PBKDF2_ITERATIONS): Promise<EncryptedEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, iterations)
  // gzip before encrypting: embedded photos are base64 and shrink noticeably, ciphertext would not
  const plain = await gzip(enc.encode(JSON.stringify(value)))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain))
  return {
    format: 'panel-enc',
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toB64(salt) },
    cipher: { name: 'AES-GCM', iv: toB64(iv) },
    data: toB64(cipher),
  }
}

export class WrongPasswordError extends Error {
  constructor() {
    super('wrong password')
    this.name = 'WrongPasswordError'
  }
}

export async function decryptJson<T = unknown>(env: EncryptedEnvelope, password: string): Promise<T> {
  const key = await deriveKey(password, fromB64(env.kdf.salt), env.kdf.iterations)
  let plain: Uint8Array<ArrayBuffer>
  try {
    plain = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(env.cipher.iv) }, key, fromB64(env.data)),
    )
  } catch {
    throw new WrongPasswordError()
  }
  return JSON.parse(dec.decode(await gunzip(plain))) as T
}

export function isEnvelope(v: unknown): v is EncryptedEnvelope {
  return typeof v === 'object' && v !== null && (v as { format?: unknown }).format === 'panel-enc'
}
