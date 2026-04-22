import { BrowserRouter, Routes, Route } from 'react-router'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Keywords from './pages/Keywords'
import SearchPage from './pages/Search'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/keywords" element={<Keywords />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
