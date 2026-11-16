import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Flocks from './pages/Flocks'
import FlockDetail from './pages/FlockDetail'
import FlockReport from './pages/FlockReport'
import Expenses from './pages/Expenses'
import Reports from './pages/Reports'
import Profile from './pages/Profile'
import LoadingScreen from './components/LoadingScreen'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      {/* Report renders outside Layout for a clean print page */}
      <Route path="/flocks/:id/report" element={<FlockReport />} />
      <Route path="*" element={
        <Layout>
          <Routes>
            <Route path="/"            element={<Dashboard />} />
            <Route path="/flocks"      element={<Flocks />} />
            <Route path="/flocks/:id"  element={<FlockDetail />} />
            <Route path="/expenses"    element={<Expenses />} />
            <Route path="/reports"     element={<Reports />} />
            <Route path="/profile"     element={<Profile />} />
            <Route path="/settings"    element={<Navigate to="/profile" replace />} />
            <Route path="*"            element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      } />
    </Routes>
  )
}