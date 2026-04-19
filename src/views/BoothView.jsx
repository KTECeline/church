import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { ref, onValue, push, set, update, remove, get } from 'firebase/database'

export default function BoothView({ boothId, boothName, onExit }) {
  const [tab, setTab] = useState('orders')
  const [items, setItems] = useState([])
  const [orders, setOrders] = useState([])
  const [expenses, setExpenses] = useState([])
  const [showAddItem, setShowAddItem] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [newItem, setNewItem] = useState({ name: '', price: '' })
  const [newExpense, setNewExpense] = useState({ desc: '', amount: '' })
  const [orderCart, setOrderCart] = useState({})
  const [orderNote, setOrderNote] = useState('')
  const [lastOrderNum, setLastOrderNum] = useState(null)

  useEffect(() => {
    const unsubs = [
      onValue(ref(db, `booths/${boothId}/items`), s =>
        setItems(s.val() ? Object.entries(s.val()).map(([id, v]) => ({ id, ...v })) : [])
      ),
      onValue(ref(db, 'orders'), s => {
        const all = s.val() || {}
        setOrders(
          Object.entries(all)
            .filter(([, o]) => o.boothId === boothId)
            .map(([id, o]) => ({ id, ...o }))
            .sort((a, b) => b.createdAt - a.createdAt)
        )
      }),
      onValue(ref(db, `booths/${boothId}/expenses`), s =>
        setExpenses(s.val() ? Object.entries(s.val()).map(([id, v]) => ({ id, ...v })) : [])
      ),
    ]
    return () => unsubs.forEach(u => u())
  }, [boothId])

  const saveItem = async () => {
    if (!newItem.name || !newItem.price) return
    const data = { name: newItem.name, price: parseFloat(newItem.price), soldOut: false }
    if (editItem) {
      await update(ref(db, `booths/${boothId}/items/${editItem.id}`), data)
    } else {
      await push(ref(db, `booths/${boothId}/items`), data)
    }
    setNewItem({ name: '', price: '' }); setShowAddItem(false); setEditItem(null)
  }

  const deleteItem = id => remove(ref(db, `booths/${boothId}/items/${id}`))
  const toggleSoldOut = item => update(ref(db, `booths/${boothId}/items/${item.id}`), { soldOut: !item.soldOut })

  const placeOrder = async () => {
    const cartItems = Object.entries(orderCart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = items.find(i => i.id === id)
        return { itemId: id, name: item.name, price: item.price, qty }
      })
    if (cartItems.length === 0) return
    const total = cartItems.reduce((s, i) => s + i.price * i.qty, 0)
    const snap = await get(ref(db, 'orderCounter'))
    const counter = (snap.val() || 0) + 1
    await set(ref(db, 'orderCounter'), counter)
    const orderNum = String(counter).padStart(3, '0')
    await push(ref(db, 'orders'), {
      boothId, boothName, orderNum, items: cartItems, total,
      status: 'pending', note: orderNote, createdAt: Date.now()
    })
    setOrderCart({})
    setOrderNote('')
    setLastOrderNum(orderNum)
  }

  const markDone = orderId => update(ref(db, `orders/${orderId}`), { status: 'done' })
  const cancelOrder = orderId => update(ref(db, `orders/${orderId}`), { status: 'cancelled' })

  const saveExpense = async () => {
    if (!newExpense.desc || !newExpense.amount) return
    await push(ref(db, `booths/${boothId}/expenses`), { desc: newExpense.desc, amount: parseFloat(newExpense.amount), createdAt: Date.now() })
    setNewExpense({ desc: '', amount: '' }); setShowAddExpense(false)
  }

  const cartTotal = Object.entries(orderCart).reduce((s, [id, qty]) => {
    const item = items.find(i => i.id === id)
    return s + (item ? item.price * qty : 0)
  }, 0)
  const cartCount = Object.values(orderCart).reduce((s, q) => s + q, 0)

  const totalRevenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.amountPaid || 0), 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const netProfit = totalRevenue - totalExpenses

  const statusLabel = { pending: 'Pending', paid: 'Paid', done: 'Done', cancelled: 'Cancelled' }
  const badgeClass = { pending: 'badge-pending', paid: 'badge-paid', done: 'badge-done', cancelled: 'badge-cancelled' }

  return (
    <div className="view-wrap">
      <div className="top-bar">
        <h2>🏪 {boothName}</h2>
        <button className="exit-btn" onClick={onExit}>Exit</button>
      </div>

      <div className="tabs">
        {['orders', 'menu', 'finance'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'orders' ? '🛒 Order' : t === 'menu' ? '🍽 Menu' : '💵 Finance'}
          </button>
        ))}
      </div>

      {/* ── ORDER TAB ── */}
      {tab === 'orders' && (
        <div className="booth-order-layout">

          {/* LEFT — item selector */}
          <div className="booth-order-left">
            <div className="booth-panel-head">New Order</div>

            {items.length === 0 ? (
              <div className="empty">No items yet — add them in the Menu tab.</div>
            ) : (
              items.map(item => (
                <div key={item.id} className={`item-select-row${item.soldOut ? ' sold-out-row' : ''}${orderCart[item.id] > 0 ? ' item-select-row--active' : ''}`}>
                  <div className="item-select-info">
                    <div className="item-select-name">{item.name}</div>
                    <div className="item-select-price">RM {item.price.toFixed(2)}</div>
                  </div>
                  {item.soldOut ? (
                    <span className="sold-out-tag">Sold Out</span>
                  ) : (
                    <div className="qty-ctrl">
                      <button className="qty-btn" onClick={() =>
                        setOrderCart(p => ({ ...p, [item.id]: Math.max(0, (p[item.id] || 0) - 1) }))
                      }>−</button>
                      <span className="qty-value">{orderCart[item.id] || 0}</span>
                      <button className="qty-btn" onClick={() =>
                        setOrderCart(p => ({ ...p, [item.id]: (p[item.id] || 0) + 1 }))
                      }>+</button>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Cart summary + submit — always at bottom of left panel */}
            <div className="cart-submit-area">
              <div className="form-group">
                <label>Note (optional)</label>
                <input value={orderNote} onChange={e => setOrderNote(e.target.value)} placeholder="Special request..." />
              </div>

              <div className="cart-total-row">
                <span className="cart-total-label">
                  {cartCount > 0 ? `${cartCount} item${cartCount !== 1 ? 's' : ''}` : 'Nothing selected'}
                </span>
                <span className="cart-total-amount">RM {cartTotal.toFixed(2)}</span>
              </div>

              <button
                className={`btn btn-full cart-place-btn${cartCount === 0 ? ' cart-place-btn--empty' : ''}`}
                onClick={placeOrder}
                disabled={cartCount === 0}
              >
                {cartCount === 0 ? 'Select items above' : `Place Order →`}
              </button>
            </div>
          </div>

          {/* RIGHT — recent orders */}
          <div className="booth-order-right">
            <div className="booth-panel-head">
              Recent Orders
              {orders.filter(o => o.status === 'paid').length > 0 && (
                <span className="ready-badge">{orders.filter(o => o.status === 'paid').length} ready</span>
              )}
            </div>

            {orders.length === 0 ? (
              <div className="empty">No orders yet</div>
            ) : (
              orders.slice(0, 20).map(o => (
                <div key={o.id} className={`order-card order-card--${o.status}`}>
                  <div className="order-header">
                    <span className="order-num">#{o.orderNum}</span>
                    <span className={`badge ${badgeClass[o.status]}`}>{statusLabel[o.status]}</span>
                  </div>
                  <div className="order-items">{o.items.map(i => `${i.name} × ${i.qty}`).join(', ')}</div>
                  {o.note && <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginBottom: '4px' }}>Note: {o.note}</div>}
                  <div className="order-total">RM {o.total.toFixed(2)}</div>
                  <div className="order-actions">
                    {o.status === 'paid' && (
                      <button className="btn btn-primary btn-sm" onClick={() => markDone(o.id)}>✓ Mark Done</button>
                    )}
                    {o.status === 'pending' && (
                      <button className="btn btn-outline btn-sm" onClick={() => cancelOrder(o.id)}>Cancel</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* ── MENU TAB ── */}
      {tab === 'menu' && (
        <div className="section">
          <button className="btn btn-primary btn-full" style={{ marginBottom: '1rem' }}
            onClick={() => { setShowAddItem(true); setEditItem(null); setNewItem({ name: '', price: '' }) }}>
            + Add Item
          </button>
          <div className="card">
            {items.length === 0 && <div className="empty" style={{ padding: '1rem' }}>No items yet</div>}
            {items.map(item => (
              <div key={item.id} className="menu-item">
                <span className={`menu-item-name ${item.soldOut ? 'sold-out' : ''}`}>{item.name}</span>
                <span className="menu-item-price">RM {item.price.toFixed(2)}</span>
                <div className="menu-item-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => toggleSoldOut(item)}>
                    {item.soldOut ? 'Restore' : 'Sold Out'}
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => {
                    setEditItem(item); setNewItem({ name: item.name, price: String(item.price) }); setShowAddItem(true)
                  }}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteItem(item.id)}>Del</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FINANCE TAB ── */}
      {tab === 'finance' && (
        <div className="section">
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-label">Revenue collected</div><div className="stat-value green">RM {totalRevenue.toFixed(2)}</div></div>
            <div className="stat-card"><div className="stat-label">Total expenses</div><div className="stat-value orange">RM {totalExpenses.toFixed(2)}</div></div>
            <div className="stat-card"><div className="stat-label">Net profit</div><div className="stat-value blue">RM {netProfit.toFixed(2)}</div></div>
            <div className="stat-card"><div className="stat-label">Orders completed</div><div className="stat-value">{orders.filter(o => o.status === 'done').length}</div></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="section-title" style={{ margin: 0 }}>Expenses</div>
            <button className="btn btn-outline btn-sm" onClick={() => setShowAddExpense(true)}>+ Add</button>
          </div>
          {expenses.length === 0 && <div className="empty">No expenses logged</div>}
          {expenses.map(e => (
            <div key={e.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem' }}>
              <span style={{ fontSize: '0.9rem' }}>{e.desc}</span>
              <span style={{ fontWeight: 600, color: '#c0392b' }}>−RM {e.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}


{/* ── ORDER SUCCESS POPUP ── */}
      {lastOrderNum && (
        <div className="order-success-overlay" onClick={() => setLastOrderNum(null)}>
          <div className="order-success-popup" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎉</div>
            <div className="success-popup-label">Order Placed!</div>
            <div className="success-popup-num">#{lastOrderNum}</div>
            <div className="success-popup-hint">Give this number to the customer</div>
            <button className="btn btn-primary btn-full" style={{ marginTop: '1.5rem' }} onClick={() => setLastOrderNum(null)}>
              Next Order
            </button>
          </div>
        </div>
      )}

      {/* ── ADD ITEM MODAL ── */}
      {showAddItem && (
        <div className="modal-overlay" onClick={() => setShowAddItem(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editItem ? 'Edit Item' : 'Add Menu Item'}</div>
            <div className="form-group">
              <label>Item name</label>
              <input value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} placeholder="e.g. 红豆汤" />
            </div>
            <div className="form-group">
              <label>Price (RM)</label>
              <input type="number" step="0.5" value={newItem.price} onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))} placeholder="3.00" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary btn-full" onClick={saveItem}>Save</button>
              <button className="btn btn-outline" onClick={() => setShowAddItem(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD EXPENSE MODAL ── */}
      {showAddExpense && (
        <div className="modal-overlay" onClick={() => setShowAddExpense(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Log Expense</div>
            <div className="form-group">
              <label>Description</label>
              <input value={newExpense.desc} onChange={e => setNewExpense(p => ({ ...p, desc: e.target.value }))} placeholder="e.g. Ingredients, cups..." />
            </div>
            <div className="form-group">
              <label>Amount (RM)</label>
              <input type="number" step="0.5" value={newExpense.amount} onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary btn-full" onClick={saveExpense}>Save</button>
              <button className="btn btn-outline" onClick={() => setShowAddExpense(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
