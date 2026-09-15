# Xeris Airdrop — Testnet Verification

A dapp where Xeris testnet users prove they hold their wallet, get recorded in a
signed registry, and invite friends with a tracked referral code. That registry
is the artefact this exists to produce: when **XRS** launches on mainnet, it
becomes the claim list.

Built on the connectivity and design system already used by
[XerisDex](https://github.com/KevinVanHA/XerisDex) and
[XerisLaunchpad](https://github.com/KevinVanHA/XerisLaunchpad) — same injected
`window.xeris` provider, same tokens, same enterprise-card visual language.

---

## How verification works

Verification is a two-step exchange, and both halves are checked server-side.

```
  browser (Xeris Web4)                    Netlify Function            Xeris node
  ────────────────────                    ────────────────            ──────────
  connect() ──────────────▶ address
                            POST /api/challenge ──────▶ mint nonce
                            ◀────────────────────────── { nonce, message }
  wallet.signMessage(message)
  (user approves in-wallet)
                            POST /api/verify ─────────▶ ed25519 verify
                                                        against the *issued*
                                                        message
                                                        ──────────────▶ GET /blocks
                                                        ──────────────▶ balance + account
                            ◀────────────────────────── record written
```

Two independent facts get recorded:

1. **Key ownership.** An ed25519 signature over a server-issued, single-use
   challenge. Verified with Node's built-in crypto — no third-party library in
   the trust path.
2. **Testnet presence.** The function queries the live Xeris node itself and
   stores the current block height alongside the record. The browser never
   supplies this, so it cannot be forged client-side.

Design decisions worth knowing:

- **The signed text is the text we issued.** The challenge message is stored
  with the nonce and the signature is checked against it, not against something
  the client rebuilds.
- **Nonces are single-use and consumed late.** A bad signature spends the
  challenge (no unlimited guessing), but a *recoverable* failure — an unknown
  invite code, an unreachable node — leaves it intact, so the client retries
  with the signature it already has instead of asking the user to approve a
  second prompt.
- **A new wallet still counts.** Zero balance and no history do not block
  verification; the record is tagged `new` / `funded` / `active` so a mainnet
  distribution can weight real usage without turning away early users.
- **Attribution is immutable.** Who invited you is locked at your first
  verification. Re-verifying refreshes the on-chain snapshot and nothing else.
- **The signature is kept.** `proof.message` + `proof.signature` stay
  server-side as the evidence trail, and `GET /api/export?proof=1` returns them
  so the whole list can be re-verified offline before anything is minted.

---

## Stack

| Layer | Choice |
| :--- | :--- |
| Frontend | Vite + React 19, react-router-dom, framer-motion, lucide-react |
| Backend | Netlify Functions (ESM, `Request`/`Response`) |
| Storage | Netlify Blobs, strong consistency |
| Fonts | `@fontsource` Inter + Plus Jakarta Sans, self-hosted |
| Hosting | Netlify |

Netlify Blobs means there is **no database to provision** — it works on a fresh
Netlify site with no setup. See [Scaling](#scaling) for when to outgrow it.

---

## Local development

```bash
npm install

# Frontend only — /api calls need the Netlify dev server (below).
npm run dev

# Full stack: Vite + Functions + Blobs on http://localhost:8888
npx netlify dev

npm test      # 42 tests: crypto units + full API integration
npm run lint
npm run build
```

`npm test` runs the real function handlers against an in-memory Blobs stand-in
and a stubbed Xeris node, so the signature checks, nonce lifecycle and referral
bookkeeping are all exercised end to end.

### Testing the wallet flow

The Xeris provider is only injected by the Xeris Web4 browser on iOS/Android.
On desktop the app shows the `WalletGate` panel instead of the connect button —
that is correct behaviour, not a failure. To exercise the real flow, deploy a
preview and open its URL inside the Xeris Web4 app.

---

## Deploying to Netlify

1. Point a new Netlify site at this repo. `netlify.toml` already sets the build
   command (`npm run build`), publish directory (`dist`) and functions
   directory (`netlify/functions`).
2. Deploy. Nothing else is required — Blobs is enabled automatically, and every
   environment variable has a working default.
3. Set `ADMIN_TOKEN` (Site configuration → Environment variables) to a long
   random value before you need the export endpoint. Until it is set,
   `/api/export` returns 503 rather than defaulting to open.
4. Optionally set `VITE_WALLET_DEEPLINK`, `VITE_APP_STORE_URL` and
   `VITE_PLAY_STORE_URL` — see below.

All variables and their defaults are documented in `.env.example`.

### The one thing that needs your input

`VITE_WALLET_DEEPLINK` is the URL scheme the Xeris Web4 app registers, used to
reopen the current page inside the wallet browser:

```
VITE_WALLET_DEEPLINK=xeris://browse?url={url}
```

`{url}` is replaced with the URL-encoded current page. **The value above is a
placeholder** — substitute whatever scheme the Xeris mobile app actually
handles. Leave it unset and the wallet gate falls back to copy-the-link
instructions, which work everywhere; setting it just turns that into one tap.

---

## API

All endpoints are same-origin under `/api`. There is no CORS layer — an airdrop
registry should not be callable from arbitrary origins.

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `POST` | `/api/challenge` | `{ address }` → `{ nonce, message, expiresAt }` |
| `POST` | `/api/verify` | `{ address, nonce, signature, inviteCode? }` → the record |
| `GET` | `/api/status?address=` | Verification record + referral list for one address |
| `GET` | `/api/stats` | Campaign totals and activity breakdown |
| `GET` | `/api/leaderboard?limit=` | Top referrers, masked addresses |
| `GET` | `/api/invite?code=` | Validate a code, return the masked referrer |
| `GET` | `/api/export` | Full registry — **requires `Authorization: Bearer $ADMIN_TOKEN`** |

`/api/verify` failure reasons, as `{ error, reason }`:

| `reason` | Status | Nonce spent? |
| :--- | :--- | :--- |
| `invalid_code`, `unknown_code`, `self_referral` | 400 | No — retry without the code |
| `node_unreachable` | 503 | No — retry the same signature |
| `nonce_not_found`, `nonce_expired`, `nonce_address_mismatch` | 400 | n/a |
| `bad_signature` | 401 | Yes |

### Referral links

`https://<site>/r/XRS-A1B2C3` and `https://<site>/?ref=XRS-A1B2C3` both work.
The code is persisted to `localStorage` on arrival so it survives the hop out
to the Xeris Web4 browser — visitors usually land in Safari or Chrome first,
then reopen the same link inside the wallet app.

Codes are `XRS-` plus six characters from a Crockford-style alphabet with no
`0`, `O`, `1`, `I`, `L` or `U`, because people read them off a phone screen and
type them by hand.

---

## Data model

Four Blobs stores, all opened with strong consistency:

| Store | Key | Value |
| :--- | :--- | :--- |
| `verifications` | address | the full record, including `proof` |
| `codes` | `XRS-A1B2C3` | `{ address, createdAt }` |
| `nonces` | nonce | `{ address, message, issuedAt }` |
| `referrals` | `referrer/referee` | `{ at }` |

**Referral counts are derived, not incremented.** One blob per edge means two
people redeeming the same code at the same instant cannot clobber each other —
there is no read-modify-write to lose.

---

## The mainnet claim path

When XRS launches:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://<site>/api/export?proof=1" > registry.json
```

Every entry carries the address, verification time, invite code, referrer,
referral count, the on-chain snapshot, and the signed message plus signature.
Re-verify the whole list offline with `netlify/lib/ed25519.js` before turning it
into an allowlist or Merkle root — the export is only as trustworthy as the
proofs in it, and they are all there precisely so you can check.

---

## Scaling

`/api/stats` and `/api/leaderboard` derive their numbers from key listings.
The two headline counts cost one listing each and stay cheap. The activity
breakdown reads every record, and is cached for 60s per function instance.

Past roughly the low tens of thousands of verifications, move the aggregates to
a durable counter or an external database. The endpoints are the only things
that would change — `netlify/lib/storage.js` is the single seam, and nothing
that gates eligibility reads through the cache.

There is no application-level rate limiting; Netlify's platform limits are the
only ones in play. If the campaign attracts scripted traffic, rate-limit
`/api/challenge` first — it is the cheapest endpoint to hammer.

---

## Project layout

```
netlify/
  functions/      challenge, verify, status, stats, leaderboard, invite, export
  lib/            base58, ed25519, chain, storage, campaign, http, cache
src/
  components/     ui/ layout/ wallet/ verify/ referral/
  context/        WalletContext, CampaignContext, ToastContext
  lib/            api, config, referral, inviteCode, device, encoding
  pages/          Home, Dashboard, Leaderboard, Faq, ReferralLanding, NotFound
tests/            crypto units + API integration
```

`src/lib/inviteCode.js` deliberately mirrors the code format in
`netlify/lib/campaign.js` — the bundle and the functions are separate build
targets. The server is the authority; the client copy only catches typos before
a signature is spent. **If the format changes, change both.**

---

## Disclaimer

Verifying records a testnet signature. It is not a purchase, not an investment,
and confers no guarantee of a mainnet distribution. Final allocation rules are
set at mainnet launch.
