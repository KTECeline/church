import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { ref, onValue, update, push, set } from 'firebase/database'

const GOAL = 2000

export default function CashierView({ onExit, booths }) {
  const [tab, setTab] = useState('pay')
  const [orders, setOrders] = useState([])
  const [payments, setPayments] = useState([])
  const [quilts, setQuilts] = useState([])
  const [foundOrder, setFoundOrder] = useState(null)
  const [amountPaid, setAmountPaid] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [donateChange, setDonateChange] = useState(false)
  const [payError, setPayError] = useState('')
  const [paySuccess, setPaySuccess] = useState(false)
  const [showAddBooth, setShowAddBooth] = useState(false)
  const [newBooth, setNewBooth] = useState({ name: '', pin: '' })
  const [showAddQuilt, setShowAddQuilt] = useState(false)
  const [newQuilt, setNewQuilt] = useState({ name: '', amount: '' })
  const [filterBooth, setFilterBooth] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    const unsubs = [
      onValue(ref(db, 'orders'), s => {
        const all = s.val() || {}
        setOrders(Object.entries(all).map(([id, o]) => ({ id, ...o })).sort((a, b) => b.createdAt - a.createdAt))
      }),
      onValue(ref(db, 'payments'), s =>
        setPayments(s.val() ? Object.entries(s.val()).map(([id, v]) => ({ id, ...v })) : [])
      ),
      onValue(ref(db, 'quilts'), s =>
        setQuilts(s.val() ? Object.entries(s.val()).map(([id, v]) => ({ id, ...v })) : [])
      ),
    ]
    return () => unsubs.forEach(u => u())
  }, [])

  const selectOrder = o => {
    setFoundOrder(o)
    setAmountPaid(o.total.toFixed(2))
    setDonateChange(false)
    setPayError('')
    setPaySuccess(false)
  }

  const confirmPayment = async () => {
    if (!foundOrder) return
    const paid = parseFloat(amountPaid) || 0
    const extra = donateChange ? Math.max(0, paid - foundOrder.total) : 0
    if (paid < foundOrder.total) { setPayError('Amount paid is less than total due'); return }
    await update(ref(db, `orders/${foundOrder.id}`), { status: 'paid', amountPaid: paid, extra, payMethod, paidAt: Date.now() })
    await push(ref(db, 'payments'), {
      orderId: foundOrder.id, orderNum: foundOrder.orderNum,
      boothId: foundOrder.boothId, boothName: foundOrder.boothName,
      total: foundOrder.total, amountPaid: paid, extra, payMethod, timestamp: Date.now()
    })
    setPaySuccess(true)
    setFoundOrder(null)
    setAmountPaid('')
    setDonateChange(false)
    setPayMethod('cash')
  }

  const addBooth = async () => {
    if (!newBooth.name || !newBooth.pin) return
    const id = newBooth.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
    await set(ref(db, `booths/${id}`), { name: newBooth.name, pin: newBooth.pin })
    setNewBooth({ name: '', pin: '' }); setShowAddBooth(false)
  }

  const addQuilt = async () => {
    if (!newQuilt.name || !newQuilt.amount) return
    await push(ref(db, 'quilts'), { name: newQuilt.name, amount: parseFloat(newQuilt.amount), timestamp: Date.now() })
    setNewQuilt({ name: '', amount: '' }); setShowAddQuilt(false)
  }

  const totalCollected = payments.reduce((s, p) => s + p.amountPaid, 0)
  const totalDonations  = payments.reduce((s, p) => s + (p.extra || 0), 0)
  const totalQuilts     = quilts.reduce((s, q) => s + q.amount, 0)
  const grandTotal      = totalCollected + totalQuilts
  const pct             = Math.min(100, Math.round((grandTotal / GOAL) * 100))

  const boothRevenue = {}
  payments.forEach(p => {
    boothRevenue[p.boothName] = (boothRevenue[p.boothName] || 0) + p.amountPaid
  })

  const pendingOrders = orders.filter(o => o.status === 'pending')

  const filteredOrders = orders.filter(o => {
    if (filterBooth  !== 'all' && o.boothId !== filterBooth)  return false
    if (filterStatus !== 'all' && o.status  !== filterStatus) return false
    return true
  })

  const badgeClass  = { pending: 'badge-pending', paid: 'badge-paid', done: 'badge-done', cancelled: 'badge-cancelled' }
  const statusLabel = { pending: 'Pending', paid: 'Paid', done: 'Done', cancelled: 'Cancelled' }

  const change = foundOrder && amountPaid ? parseFloat(amountPaid) - foundOrder.total : 0

  return (
    <div className="view-wrap">
      <div className="top-bar">
        <h2>💰 Cashier</h2>
        <button className="exit-btn" onClick={onExit}>Exit</button>
      </div>

      <div className="tabs">
        {['pay', 'orders', 'dashboard', 'setup'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'pay'
              ? <>💳 Pay {pendingOrders.length > 0 && <span className="tab-pill">{pendingOrders.length}</span>}</>
              : t === 'orders' ? '📋 All Orders'
              : t === 'dashboard' ? '📊 Dashboard'
              : '⚙️ Setup'}
          </button>
        ))}
      </div>

      {/* ── PAY TAB — persistent two-column split ── */}
      {tab === 'pay' && (
        <div className="pay-layout">

          {/* LEFT — scrollable order queue */}
          <div className="pay-queue-col">
            {paySuccess && <div className="success-banner">✓ Payment confirmed!</div>}

            <div className="panel-head">
              {pendingOrders.length === 0
                ? 'No pending orders'
                : `${pendingOrders.length} pending order${pendingOrders.length !== 1 ? 's' : ''}`}
            </div>

            {pendingOrders.length === 0 ? (
              <div className="queue-empty">
                <div className="queue-empty-icon">🎉</div>
                <div>All clear!</div>
              </div>
            ) : (
              pendingOrders.map(o => (
                <div
                  key={o.id}
                  className={`order-slip${foundOrder?.id === o.id ? ' order-slip--active' : ''}`}
                  onClick={() => selectOrder(o)}
                >
                  <div className="order-slip-top">
                    <span className="order-slip-num">#{o.orderNum}</span>
                    <span className="order-slip-total">RM {o.total.toFixed(2)}</span>
                  </div>
                  <div className="order-slip-booth">{o.boothName}</div>
                  <div className="order-slip-items">
                    {o.items.map(i => `${i.name} ×${i.qty}`).join(' · ')}
                  </div>
                  {o.note && <div className="order-slip-note">"{o.note}"</div>}
                </div>
              ))
            )}
          </div>

          {/* RIGHT — payment panel */}
          <div className="pay-panel-col">
            {!foundOrder ? (
              <div className="pay-idle">
                <div className="pay-idle-icon">👈</div>
                <div className="pay-idle-text">Select an order<br />to process payment</div>
              </div>
            ) : (
              <div className="pay-panel">
                <button className="pay-back-btn" onClick={() => { setFoundOrder(null); setAmountPaid(''); setDonateChange(false); setPayError('') }}>
                  ← back
                </button>

                <div className="pay-order-num">#{foundOrder.orderNum}</div>
                <div className="pay-order-booth">{foundOrder.boothName}</div>

                <div className="pay-itemlist">
                  {foundOrder.items.map(i => (
                    <div key={i.itemId} className="pay-itemlist-row">
                      <span>{i.name} <span className="pay-itemlist-qty">×{i.qty}</span></span>
                      <span>RM {(i.price * i.qty).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {foundOrder.note && (
                  <div className="pay-note">Note: {foundOrder.note}</div>
                )}

                <div className="pay-total-bar">
                  <span>Total due</span>
                  <span>RM {foundOrder.total.toFixed(2)}</span>
                </div>

                <div className="pay-method-row">
                  {['cash', 'qr'].map(m => (
                    <button
                      key={m}
                      className={`pay-method-btn${payMethod === m ? ' pay-method-btn--on' : ''}`}
                      onClick={() => setPayMethod(m)}
                    >
                      {m === 'cash' ? '💵 Cash' : '📱 QR / E-wallet'}
                    </button>
                  ))}
                </div>

                <div className="form-group">
                  <label>Amount received (RM)</label>
                  <input
                    type="number" step="0.50"
                    value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)}
                    style={{ fontSize: '1.2rem', fontWeight: 700 }}
                    autoFocus
                  />
                </div>

                {change > 0 && (
                  <div className="change-decision">
                    <div className="change-decision-label">
                      RM {change.toFixed(2)} overpaid — what to do?
                    </div>
                    <div className="change-decision-btns">
                      <button
                        className={`change-opt${!donateChange ? ' change-opt--on' : ''}`}
                        onClick={() => setDonateChange(false)}
                      >
                        💵 Give back RM {change.toFixed(2)}
                      </button>
                      <button
                        className={`change-opt${donateChange ? ' change-opt--donate' : ''}`}
                        onClick={() => setDonateChange(true)}
                      >
                        🎁 Donate RM {change.toFixed(2)}
                      </button>
                    </div>
                  </div>
                )}

                {payError && <p className="error-msg">{payError}</p>}

                <button
                  className="btn btn-primary btn-full"
                  style={{ fontSize: '1.05rem', padding: '1rem', marginTop: '0.25rem' }}
                  onClick={confirmPayment}
                >
                  Confirm Payment →
                </button>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── ALL ORDERS TAB ── */}
      {tab === 'orders' && (
        <div className="section">
          <div className="filter-row">
            <select value={filterBooth} onChange={e => setFilterBooth(e.target.value)}>
              <option value="all">All booths</option>
              {Object.entries(booths).map(([id, b]) => <option key={id} value={id}>{b.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          {filteredOrders.length === 0 && <div className="empty">No orders match the filter</div>}
          <div className="orders-grid">
            {filteredOrders.map(o => (
              <div key={o.id} className={`order-card order-card--${o.status}`}>
                <div className="order-header">
                  <span className="order-num">#{o.orderNum}</span>
                  <span className={`badge ${badgeClass[o.status]}`}>{statusLabel[o.status]}</span>
                </div>
                <div className="order-booth-tag">{o.boothName}</div>
                <div className="order-items">{o.items.map(i => `${i.name} ×${i.qty}`).join(', ')}</div>
                <div className="order-total">
                  RM {o.total.toFixed(2)}
                  {o.amountPaid && o.amountPaid > o.total ? ` (paid RM ${o.amountPaid.toFixed(2)})` : ''}
                </div>
                {o.extra > 0 && <div className="order-donation">+RM {o.extra.toFixed(2)} extra</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DASHBOARD TAB ── */}
      {tab === 'dashboard' && (
        <div className="section">

          {/* Hero total */}
          <div className="dash-hero">
            <div className="dash-hero-label">Total Raised</div>
            <div className="dash-hero-amount">RM {grandTotal.toFixed(2)}</div>
            <div className="dash-hero-sub">of RM {GOAL.toLocaleString()} goal</div>
            <div className="dash-progress-track">
              <div className="dash-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="dash-progress-pct">{pct}%</div>
          </div>

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Food sales</div>
              <div className="stat-value">RM {totalCollected.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Quilt sales</div>
              <div className="stat-value blue">RM {totalQuilts.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Donations</div>
              <div className="stat-value green">RM {totalDonations.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Orders paid</div>
              <div className="stat-value">{payments.length}</div>
            </div>
          </div>

          {Object.keys(boothRevenue).length > 0 && (
            <>
              <div className="section-title" style={{ marginTop: '0.5rem' }}>Revenue by booth</div>
              <div className="booth-revenue-grid">
                {Object.entries(boothRevenue)
                  .sort(([, a], [, b]) => b - a)
                  .map(([name, rev]) => (
                    <div key={name} className="booth-revenue-card">
                      <div className="booth-revenue-name">{name}</div>
                      <div className="booth-revenue-amount">RM {rev.toFixed(2)}</div>
                      <div className="booth-revenue-bar">
                        <div className="booth-revenue-bar-fill"
                          style={{ width: `${Math.round((rev / Math.max(...Object.values(boothRevenue))) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}

          <div className="section-title" style={{ marginTop: '1.25rem' }}>百家被 Quilt Sales</div>
          {quilts.length === 0 && <div className="empty" style={{ padding: '1.5rem 0' }}>No quilt sales yet</div>}
          {quilts.map(q => (
            <div key={q.id} className="quilt-card">
              <div className="quilt-title">{q.name}</div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--purple-dark)' }}>RM {q.amount.toFixed(2)}</div>
            </div>
          ))}
          <button className="btn btn-outline btn-full" style={{ marginTop: '0.75rem' }} onClick={() => setShowAddQuilt(true)}>
            + Record quilt sale
          </button>
        </div>
      )}

      {/* ── SETUP TAB ── */}
      {tab === 'setup' && (
        <div className="section">
          <div className="section-title">Manage booths</div>
          <div className="booth-setup-grid">
            {Object.entries(booths).map(([id, b]) => (
              <div key={id} className="booth-setup-card">
                <div className="booth-setup-name">{b.name}</div>
                <div className="booth-setup-pin">PIN: {b.pin}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-full" style={{ marginTop: '0.75rem' }} onClick={() => setShowAddBooth(true)}>
            + Add Booth
          </button>
        </div>
      )}

      {/* ── ADD BOOTH MODAL ── */}
      {showAddBooth && (
        <div className="modal-overlay" onClick={() => setShowAddBooth(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Booth</div>
            <div className="form-group">
              <label>Booth name</label>
              <input value={newBooth.name} onChange={e => setNewBooth(p => ({ ...p, name: e.target.value }))} placeholder="e.g. 阿嬷糖水档" />
            </div>
            <div className="form-group">
              <label>PIN (numbers)</label>
              <input type="password" inputMode="numeric" value={newBooth.pin} onChange={e => setNewBooth(p => ({ ...p, pin: e.target.value }))} placeholder="e.g. 1234" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary btn-full" onClick={addBooth}>Create Booth</button>
              <button className="btn btn-outline" onClick={() => setShowAddBooth(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD QUILT MODAL ── */}
      {showAddQuilt && (
        <div className="modal-overlay" onClick={() => setShowAddQuilt(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Record Quilt Sale</div>
            <div className="form-group">
              <label>Quilt name</label>
              <input value={newQuilt.name} onChange={e => setNewQuilt(p => ({ ...p, name: e.target.value }))} placeholder="e.g. 大号百家被" />
            </div>
            <div className="form-group">
              <label>Sale amount (RM)</label>
              <input type="number" step="10" value={newQuilt.amount} onChange={e => setNewQuilt(p => ({ ...p, amount: e.target.value }))} placeholder="400" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary btn-full" onClick={addQuilt}>Save</button>
              <button className="btn btn-outline" onClick={() => setShowAddQuilt(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
