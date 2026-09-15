import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Navbar } from './components/layout/Navbar'
import { Footer } from './components/layout/Footer'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Home } from './pages/Home'
import { Dashboard } from './pages/Dashboard'
import { Leaderboard } from './pages/Leaderboard'
import { Faq } from './pages/Faq'
import { ReferralLanding } from './pages/ReferralLanding'
import { NotFound } from './pages/NotFound'
import { ToastProvider } from './context/ToastContext'
import { WalletProvider } from './context/WalletContext'
import { CampaignProvider } from './context/CampaignContext'

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
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/leaderboard" element={<Leaderboard />} />
                    <Route path="/faq" element={<Faq />} />
                    <Route path="/r/:code" element={<ReferralLanding />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
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
