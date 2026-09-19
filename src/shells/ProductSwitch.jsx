import { NavLink } from 'react-router-dom'
import { confirmLeaveDirty } from '../lib/dirtyGuard'

function guardClick(e) {
  if (!confirmLeaveDirty()) e.preventDefault()
}

export default function ProductSwitch() {
  return (
    <nav className="product-switch" aria-label="Product">
      <NavLink to="/CC/admin" className={({ isActive }) => (isActive ? 'on' : undefined)} onClick={guardClick}>
        Call Center
      </NavLink>
      <NavLink to="/MI/admin" className={({ isActive }) => (isActive ? 'on' : undefined)} onClick={guardClick}>
        Meeting Intelligence
      </NavLink>
    </nav>
  )
}
