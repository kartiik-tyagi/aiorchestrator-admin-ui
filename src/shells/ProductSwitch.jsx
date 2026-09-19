import { NavLink } from 'react-router-dom'
import { confirmLeaveDirty } from '../lib/dirtyGuard'

export default function ProductSwitch() {
  return (
    <nav className="product-switch" aria-label="Product">
      <NavLink to="/CC/admin" className={({ isActive }) => (isActive ? 'on' : undefined)}>
        Call Center
      </NavLink>
      <NavLink
        to="/MI/admin"
        className={({ isActive }) => (isActive ? 'on' : undefined)}
        onClick={(e) => {
          if (!confirmLeaveDirty()) e.preventDefault()
        }}
      >
        Meeting Intelligence
      </NavLink>
    </nav>
  )
}
