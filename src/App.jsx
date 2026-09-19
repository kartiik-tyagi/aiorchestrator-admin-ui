import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import Home from './pages/Home'
import CcShell from './shells/CcShell'
import MiShell from './shells/MiShell'

function LegacyFlowBuilder() {
  const { flowId } = useParams()
  return <Navigate to={`/CC/admin/flows/${encodeURIComponent(flowId)}/builder`} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/CC" element={<Navigate to="/CC/admin" replace />} />
      <Route path="/MI" element={<Navigate to="/MI/admin" replace />} />
      <Route path="/CC/admin/*" element={<CcShell />} />
      <Route path="/MI/admin/*" element={<MiShell />} />
      <Route path="/engines" element={<Navigate to="/CC/admin/engines" replace />} />
      <Route path="/profiles" element={<Navigate to="/CC/admin/profiles" replace />} />
      <Route path="/flows" element={<Navigate to="/CC/admin/flows" replace />} />
      <Route path="/flows/:flowId/builder" element={<LegacyFlowBuilder />} />
      <Route path="/bindings" element={<Navigate to="/CC/admin/bindings" replace />} />
      <Route path="/pins" element={<Navigate to="/CC/admin/pins" replace />} />
      <Route path="/settings" element={<Navigate to="/CC/admin/settings" replace />} />
      <Route path="/tutorial" element={<Navigate to="/CC/admin/tutorial" replace />} />
      <Route path="/CC/*" element={<Navigate to="/CC/admin" replace />} />
      <Route path="/MI/*" element={<Navigate to="/MI/admin" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
