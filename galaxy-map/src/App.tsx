import './App.css'
import { Routes, Route } from 'react-router-dom'
import { Grid } from './components/Grid.tsx'
import { SystemListPanel } from './components/SystemListPanel.tsx'
import { SystemDetailPage } from './pages/SystemDetailPage.tsx'

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="layout">
            <div className="layout__grid">
              <Grid />
            </div>
            <SystemListPanel />
          </div>
        }
      />
      <Route path="/systems/:id" element={<SystemDetailPage />} />
    </Routes>
  )
}

export default App
