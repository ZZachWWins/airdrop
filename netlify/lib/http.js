/**
 * Small helpers shared by the Netlify Functions in this repo.
 *
 * The functions are same-origin with the site (Netlify serves them under
 * /api/* via the redirects in netlify.toml), so there is no CORS handling
 * here on purpose — an airdrop registry should not be callable from arbitrary
 * origins.
 */

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  })
}

export function error(message, status = 400, extra = {}) {
  return json({ error: message, ...extra }, status)
}

export function methodNotAllowed(allowed) {
  return json({ error: `Method not allowed. Use ${allowed}.` }, 405, { Allow: allowed })
}

/** Parse a JSON body, returning null rather than throwing on malformed input. */
export async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

/** The site's own origin, used in the challenge text so the user sees where it came from. */
export function siteDomain(request) {
  const configured = process.env.URL || process.env.DEPLOY_PRIME_URL
  if (configured) {
    try {
      return new URL(configured).host
    } catch {
      // fall through to the request host
    }
  }
  try {
    return new URL(request.url).host
  } catch {
    return 'xeris'
  }
}
