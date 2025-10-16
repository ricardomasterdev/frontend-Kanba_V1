import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import KanbanPage from './pages/KanbanPage'
import ProjetosPage from './pages/ProjetosPage'
import ResponsaveisPage from './pages/ResponsaveisPage'
import SecretariasPage from './pages/SecretariasPage'
import NotFound from './pages/NotFound'

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>} />
        <Route path="/kanban" element={<ProtectedRoute><Layout><KanbanPage /></Layout></ProtectedRoute>} />
        <Route path="/projetos" element={<ProtectedRoute><Layout><ProjetosPage /></Layout></ProtectedRoute>} />
        <Route path="/responsaveis" element={<ProtectedRoute><Layout><ResponsaveisPage /></Layout></ProtectedRoute>} />
        <Route path="/secretarias" element={<ProtectedRoute><Layout><SecretariasPage /></Layout></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )
}
export default App
