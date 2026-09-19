import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="picker">
      <div className="picker-inner">
        <p className="picker-kicker">Coral Orchestrator</p>
        <h1>Which product are you configuring?</h1>
        <p className="picker-lede">
          Two products, one lab. Pick a home — the nav never mixes them.
        </p>
        <div className="picker-cards">
          <Link className="picker-card" to="/CC/admin">
            <span className="picker-mark">CC</span>
            <span className="picker-title">Call Center</span>
            <span className="picker-why">Answer phone calls</span>
            <span className="picker-desc">
              Engines, profile, knowledge, conversation graph, and the pin that makes a DID
              answerable.
            </span>
          </Link>
          <Link className="picker-card" to="/MI/admin">
            <span className="picker-mark">MI</span>
            <span className="picker-title">Meeting Intelligence</span>
            <span className="picker-why">Minutes and Ask on meetings</span>
            <span className="picker-desc">
              Meeting profiles, transcripts, human-approved minutes, and Ask over the official
              archive.
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
