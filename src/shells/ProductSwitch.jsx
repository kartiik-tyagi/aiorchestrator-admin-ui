import { NavLink } from 'react-router-dom'

export default function ProductSwitch() {
  return (
    <nav className="product-switch" aria-label="Product">
      <NavLink to="/CC/admin" className={({ isActive }) => (isActive ? 'on' : undefined)}>
        Call Center
      </NavLink>
      <NavLink to="/MI/admin" className={({ isActive }) => (isActive ? 'on' : undefined)}>
        Meeting Intelligence
      </NavLink>
    </nav>
  )
}
