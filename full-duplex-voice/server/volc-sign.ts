import crypto from 'node:crypto'

export function sha256Hex(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function hmac(key: Buffer, value: string) {
  return crypto.createHmac('sha256', key).update(value).digest()
}

export function signVolcRequest(input: {
  method: 'POST' | 'GET'; host: string; path: string; query: string; body: string
  accessKeyId: string; secretAccessKey: string; region: string; service: string
}): Record<string, string> {
  const xDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const shortDate = xDate.slice(0, 8)
  const payloadHash = sha256Hex(input.body)
  const canonicalHeaders = `content-type:application/json\nhost:${input.host}\nx-content-sha256:${payloadHash}\nx-date:${xDate}\n`
  const signedHeaders = 'content-type;host;x-content-sha256;x-date'
  const canonicalRequest = [input.method, input.path, input.query, canonicalHeaders, signedHeaders, payloadHash].join('\n')
  const scope = `${shortDate}/${input.region}/${input.service}/request`
  const stringToSign = ['HMAC-SHA256', xDate, scope, sha256Hex(canonicalRequest)].join('\n')
  const signingKey = hmac(Buffer.from(input.secretAccessKey), shortDate)
  const requestKey = hmac(hmac(hmac(signingKey, input.region), input.service), 'request')
  const signature = crypto.createHmac('sha256', requestKey).update(stringToSign).digest('hex')
  return {
    Host: input.host,
    'X-Date': xDate,
    'X-Content-Sha256': payloadHash,
    Authorization: `HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }
}
