import { Routes, Route } from 'react-router-dom'
import RepositoriesPage from './pages/RepositoriesPage'
import RepositoryPage from './pages/RepositoryPage'
import BranchPage from './pages/BranchPage'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Routes>
          <Route path="/" element={<RepositoriesPage />} />
          <Route path="/repos/:id" element={<RepositoryPage />} />
          <Route
            path="/repos/:id/branches/:branchId"
            element={<BranchPage />}
          />
        </Routes>
      </div>
    </div>
  )
}
