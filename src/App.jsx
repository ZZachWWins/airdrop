import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Navbar } from './components/layout/Navbar'
import { Footer } from './components/layout/Footer'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RouteFallback } from './components/layout/RouteFallback'
import { Home } from './pages/Home'
import { ToastProvider } from './context/ToastContext'
import { WalletProvider } from './context/WalletContext'
import { CampaignProvider } from './context/CampaignContext'

// Home ships in the main bundle — it is the landing page and almost every
// visitor arrives on a phone, often on mobile data. Everything else loads on
// demand, so the first paint does not carry the dashboard, the leaderboard and
// the claim flow along with it.
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Leaderboard = lazy(() =>
  import('./pages/Leaderboard').then((m) => ({ default: m.Leaderboard })),
)
const Claim = lazy(() => import('./pages/Claim').then((m) => ({ default: m.Claim })))
const Faq = lazy(() => import('./pages/Faq').then((m) => ({ default: m.Faq })))
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })))
const ReferralLanding = lazy(() =>
  import('./pages/ReferralLanding').then((m) => ({ default: m.ReferralLanding })),
)

// CampaignProvider reads the router location to capture invite codes, so it
// has to sit inside BrowserRouter.
function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <WalletProvider>
          <CampaignProvider>
            <div className="app-layout">
              <Navbar />
              <main className="content-area">
                <ErrorBoundary>
                  <Suspense fallback={<RouteFallback />}>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/leaderboard" element={<Leaderboard />} />
                      {/* Always routed. The endpoints refuse a claim until
                          CLAIM_PHASE=open, and the page shows a "not open yet"
                          state, so a stale link before launch is harmless. */}
                      <Route path="/claim" element={<Claim />} />
                      <Route path="/faq" element={<Faq />} />
                      <Route path="/r/:code" element={<ReferralLanding />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
              </main>
              <Footer />
            </div>
          </CampaignProvider>
        </WalletProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
