import { useState, useEffect } from 'react'
import { db } from './firebase'
import { ref, onValue } from 'firebase/database'
import BoothView from './views/BoothView'
import CashierView from './views/CashierView'
import './index.css'

const CASHIER_PIN = import.meta.env.VITE_CASHIER_PIN || '0000'

export default function App() {
  const [mode, setMode] = useState(null)
  const [pin, setPin] = useState('')
  const [boothId, setBoothId] = useState(null)
  const [boothName, setBoothName] = useState('')
  const [error, setError] = useState('')
  const [booths, setBooths] = useState({})
  const [pinTarget, setPinTarget] = useState(null)

  useEffect(() => {
    const unsub = onValue(ref(db, 'booths'), snap => setBooths(snap.val() || {}))
    return unsub
  }, [])

  const handlePinSubmit = () => {
    setError('')
    if (pinTarget === 'cashier') {
      if (pin === CASHIER_PIN) { setMode('cashier') }
      else setError('Wrong PIN')
    } else {
      const booth = booths[pinTarget]
      if (booth && booth.pin === pin) {
        setBoothId(pinTarget); setBoothName(booth.name); setMode('booth')
      } else setError('Wrong PIN')
    }
    setPin('')
  }

  if (mode === 'booth') return <BoothView boothId={boothId} boothName={boothName} onExit={() => { setMode(null); setPinTarget(null) }} />
  if (mode === 'cashier') return <CashierView onExit={() => { setMode(null); setPinTarget(null) }} booths={booths} />

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">✝</div>
        <h1 className="login-title">GSLC 父母节嘉年华</h1>
        <p className="login-sub">Parents' Day Carnival 2026</p>
        {!pinTarget ? (
          <>
            <p className="login-label">Select your role</p>
            <button className="role-btn cashier-btn" onClick={() => setPinTarget('cashier')}>
              <span style={{ fontSize: '1.2rem' }}>💰</span>
              <span>Cashier</span>
            </button>
            <div className="booth-list">
              {Object.entries(booths).map(([id, b]) => (
                <button key={id} className="role-btn booth-btn" onClick={() => setPinTarget(id)}>
                  <span style={{ fontSize: '1.2rem' }}>🏪</span>
                  <span>{b.name}</span>
                </button>
              ))}
            </div>
            {Object.keys(booths).length === 0 && <p className="setup-hint">No booths yet — log in as cashier to set up booths.</p>}
          </>
        ) : (
          <>
            <p className="login-label">PIN for <strong>{pinTarget === 'cashier' ? 'Cashier' : booths[pinTarget]?.name}</strong></p>
            <input className="pin-input" type="password" inputMode="numeric" maxLength={6} placeholder="••••" value={pin}
              onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePinSubmit()} autoFocus />
            {error && <p className="error-msg">{error}</p>}
            <button className="submit-btn" onClick={handlePinSubmit}>Enter →</button>
            <button className="back-btn" onClick={() => { setPinTarget(null); setPin(''); setError('') }}>← Back</button>
          </>
        )}
      </div>
    </div>
  )
}

