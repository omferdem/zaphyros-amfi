import { Navigate, Route, Routes } from 'react-router-dom'
import Panel from './sayfalar/Panel'
import Sahne from './sayfalar/Sahne'
import Katil from './sayfalar/Katil'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/panel" replace />} />
      <Route path="/panel" element={<Panel />} />
      <Route path="/sahne/:oturumId" element={<Sahne />} />
      <Route path="/katil" element={<Katil />} />
      <Route path="*" element={<Navigate to="/panel" replace />} />
    </Routes>
  )
}
