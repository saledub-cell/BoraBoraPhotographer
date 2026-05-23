import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Group, Member, Expense, ExpenseSplit } from '../types'
import { ArrowLeft, Plus, Receipt, Users, ChartBar as BarChart3, Loader as Loader2, Trash2 } from 'lucide-react'
import Modal from './Modal'

interface Props {
  group: Group
  onBack: () => void
}

type Tab = 'expenses' | 'members' | 'balances'

interface NetBalance {
  member: Member
  net: number
}

interface Settlement {
  from: Member
  to: Member
  amount: number
}

export default function GroupDetail({ group, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('expenses')
  const [members, setMembers] = useState<Member[]>([])
  const [expenses, setExpenses] = useState<(Expense & { splits: ExpenseSplit[] })[]>([])
  const [loading, setLoading] = useState(true)

  const [showAddMember, setShowAddMember] = useState(false)
  const [memberName, setMemberName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [savingMember, setSavingMember] = useState(false)

  const [showAddExpense, setShowAddExpense] = useState(false)
  const [expDesc, setExpDesc] = useState('')
  const [expAmount, setExpAmount] = useState('')
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0])
  const [expPaidBy, setExpPaidBy] = useState('')
  const [expSplitMode, setExpSplitMode] = useState<'equal' | 'custom'>('equal')
  const [expCustomSplits, setExpCustomSplits] = useState<Record<string, string>>({})
  const [savingExpense, setSavingExpense] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: mData }, { data: eData }, { data: sData }] = await Promise.all([
      supabase.from('members').select('*').eq('group_id', group.id).order('created_at'),
      supabase.from('expenses').select('*').eq('group_id', group.id).order('date', { ascending: false }),
      supabase.from('expense_splits').select('*').in(
        'expense_id',
        (await supabase.from('expenses').select('id').eq('group_id', group.id)).data?.map(e => e.id) ?? []
      ),
    ])
    const mems = mData ?? []
    const exps = (eData ?? []).map(e => ({
      ...e,
      splits: (sData ?? []).filter(s => s.expense_id === e.id),
    }))
    setMembers(mems)
    setExpenses(exps)
    if (mems.length > 0 && !expPaidBy) setExpPaidBy(mems[0].id)
    setLoading(false)
  }, [group.id, expPaidBy])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    if (!memberName.trim()) return
    setSavingMember(true)
    const { data } = await supabase
      .from('members')
      .insert({ group_id: group.id, name: memberName.trim(), email: memberEmail.trim() || null })
      .select().single()
    if (data) {
      const updated = [...members, data]
      setMembers(updated)
      if (!expPaidBy) setExpPaidBy(data.id)
      setShowAddMember(false)
      setMemberName('')
      setMemberEmail('')
    }
    setSavingMember(false)
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(expAmount)
    if (!expDesc.trim() || isNaN(amount) || amount <= 0 || !expPaidBy) return
    setSavingExpense(true)

    const { data: exp } = await supabase
      .from('expenses')
      .insert({ group_id: group.id, paid_by: expPaidBy, description: expDesc.trim(), amount, date: expDate })
      .select().single()

    if (exp) {
      let splits: { expense_id: string; member_id: string; amount: number }[]
      if (expSplitMode === 'equal') {
        const share = Math.round((amount / members.length) * 100) / 100
        splits = members.map((m, i) => ({
          expense_id: exp.id,
          member_id: m.id,
          amount: i === members.length - 1 ? Math.round((amount - share * (members.length - 1)) * 100) / 100 : share,
        }))
      } else {
        splits = members
          .filter(m => expCustomSplits[m.id] && parseFloat(expCustomSplits[m.id]) > 0)
          .map(m => ({ expense_id: exp.id, member_id: m.id, amount: parseFloat(expCustomSplits[m.id]) }))
      }
      const { data: splitsData } = await supabase.from('expense_splits').insert(splits).select()
      setExpenses(prev => [{ ...exp, splits: splitsData ?? [] }, ...prev])
    }

    setSavingExpense(false)
    setShowAddExpense(false)
    setExpDesc('')
    setExpAmount('')
    setExpDate(new Date().toISOString().split('T')[0])
    setExpSplitMode('equal')
    setExpCustomSplits({})
  }

  async function deleteExpense(id: string) {
    await supabase.from('expense_splits').delete().eq('expense_id', id)
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  function computeSettlements(): Settlement[] {
    const netMap: Record<string, number> = {}
    members.forEach(m => { netMap[m.id] = 0 })

    expenses.forEach(exp => {
      netMap[exp.paid_by] = (netMap[exp.paid_by] ?? 0) + exp.amount
      exp.splits.forEach(s => {
        netMap[s.member_id] = (netMap[s.member_id] ?? 0) - s.amount
      })
    })

    const creditors: NetBalance[] = []
    const debtors: NetBalance[] = []
    members.forEach(m => {
      const net = Math.round((netMap[m.id] ?? 0) * 100) / 100
      if (net > 0) creditors.push({ member: m, net })
      else if (net < 0) debtors.push({ member: m, net: -net })
    })

    const settlements: Settlement[] = []
    let ci = 0, di = 0
    const cred = creditors.map(c => ({ ...c }))
    const debt = debtors.map(d => ({ ...d }))

    while (ci < cred.length && di < debt.length) {
      const amount = Math.min(cred[ci].net, debt[di].net)
      if (amount > 0.005) {
        settlements.push({ from: debt[di].member, to: cred[ci].member, amount: Math.round(amount * 100) / 100 })
      }
      cred[ci].net -= amount
      debt[di].net -= amount
      if (cred[ci].net < 0.005) ci++
      if (debt[di].net < 0.005) di++
    }

    return settlements
  }

  function getMemberName(id: string) {
    return members.find(m => m.id === id)?.name ?? 'Unknown'
  }

  const settlements = computeSettlements()

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 14, color: 'var(--color-neutral-800)',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 500,
    color: 'var(--color-neutral-700)', marginBottom: 6,
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 500,
    background: active ? 'white' : 'transparent',
    color: active ? 'var(--color-primary-600)' : 'var(--color-neutral-500)',
    boxShadow: active ? 'var(--shadow-sm)' : 'none',
    border: active ? '1px solid var(--color-neutral-200)' : '1px solid transparent',
    display: 'flex', alignItems: 'center', gap: 6,
    transition: 'all 0.15s ease',
  })

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          color: 'var(--color-neutral-500)', background: 'transparent',
          fontSize: 14, marginBottom: 20, padding: '4px 0',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-neutral-800)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-neutral-500)')}
      >
        <ArrowLeft size={16} /> Back to Groups
      </button>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-neutral-900)' }}>{group.name}</h1>
        {group.description && (
          <p style={{ color: 'var(--color-neutral-500)', marginTop: 4 }}>{group.description}</p>
        )}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, gap: 12,
      }}>
        <div style={{
          display: 'flex', gap: 4, background: 'var(--color-neutral-100)',
          padding: 4, borderRadius: 'var(--radius-md)',
        }}>
          {([
            ['expenses', Receipt, 'Expenses'],
            ['members', Users, 'Members'],
            ['balances', BarChart3, 'Balances'],
          ] as [Tab, typeof Receipt, string][]).map(([id, Icon, label]) => (
            <button key={id} style={tabStyle(tab === id)} onClick={() => setTab(id)}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => tab === 'members' ? setShowAddMember(true) : setShowAddExpense(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--color-primary-600)', color: 'white',
            padding: '9px 14px', borderRadius: 'var(--radius-md)',
            fontSize: 13, fontWeight: 500,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-primary-700)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-primary-600)')}
        >
          <Plus size={15} />
          {tab === 'members' ? 'Add Member' : 'Add Expense'}
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Loader2 size={24} style={{ color: 'var(--color-primary-500)', animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : (
        <>
          {tab === 'expenses' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {expenses.length === 0 ? (
                <EmptyState icon={Receipt} title="No expenses yet" sub="Add the first expense to get started" />
              ) : expenses.map(exp => (
                <div key={exp.id} style={{
                  background: 'white', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-neutral-200)',
                  padding: '14px 16px', boxShadow: 'var(--shadow-sm)',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                  gap: 12,
                }}>
                  <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-primary-50)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Receipt size={16} style={{ color: 'var(--color-primary-500)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-neutral-800)', fontSize: 14 }}>{exp.description}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginTop: 2 }}>
                        Paid by <strong style={{ color: 'var(--color-neutral-700)' }}>{getMemberName(exp.paid_by)}</strong> · {new Date(exp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-neutral-900)' }}>
                      ${exp.amount.toFixed(2)}
                    </span>
                    <button
                      onClick={() => deleteExpense(exp.id)}
                      style={{
                        width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                        background: 'transparent', color: 'var(--color-neutral-300)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-error-50)'; e.currentTarget.style.color = 'var(--color-error-500)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-neutral-300)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'members' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {members.length === 0 ? (
                <EmptyState icon={Users} title="No members yet" sub="Add members to start tracking expenses" />
              ) : members.map(m => (
                <div key={m.id} style={{
                  background: 'white', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-neutral-200)',
                  padding: '14px 16px', boxShadow: 'var(--shadow-sm)',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'var(--color-primary-100)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 600, color: 'var(--color-primary-700)',
                    flexShrink: 0,
                  }}>
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--color-neutral-800)' }}>{m.name}</div>
                    {m.email && <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{m.email}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'balances' && (
            <div>
              {members.length < 2 ? (
                <EmptyState icon={BarChart3} title="Not enough members" sub="Add at least 2 members to see balances" />
              ) : expenses.length === 0 ? (
                <EmptyState icon={BarChart3} title="No expenses yet" sub="Add expenses to see how much everyone owes" />
              ) : settlements.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '48px 24px',
                  background: 'white', borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-neutral-100)',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'var(--color-success-50)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 12px',
                  }}>
                    <BarChart3 size={24} style={{ color: 'var(--color-success-600)' }} />
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-neutral-700)' }}>All settled up!</h3>
                  <p style={{ color: 'var(--color-neutral-500)', marginTop: 4 }}>Everyone is even — no payments needed</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 13, color: 'var(--color-neutral-500)', marginBottom: 8 }}>
                    Suggested settlements to balance all expenses:
                  </p>
                  {settlements.map((s, i) => (
                    <div key={i} style={{
                      background: 'white', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-neutral-200)',
                      padding: '14px 16px', boxShadow: 'var(--shadow-sm)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          padding: '4px 10px', borderRadius: 20,
                          background: 'var(--color-error-50)',
                          color: 'var(--color-error-600)', fontSize: 13, fontWeight: 600,
                        }}>
                          {s.from.name}
                        </div>
                        <span style={{ fontSize: 13, color: 'var(--color-neutral-400)' }}>pays</span>
                        <div style={{
                          padding: '4px 10px', borderRadius: 20,
                          background: 'var(--color-success-50)',
                          color: 'var(--color-success-700)', fontSize: 13, fontWeight: 600,
                        }}>
                          {s.to.name}
                        </div>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-neutral-900)' }}>
                        ${s.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showAddMember && (
        <Modal title="Add Member" onClose={() => { setShowAddMember(false); setMemberName(''); setMemberEmail('') }}>
          <form onSubmit={addMember} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Name *</label>
              <input value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="Enter name" autoFocus required style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary-400)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-neutral-200)')}
              />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="Optional email" type="email" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary-400)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-neutral-200)')}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setShowAddMember(false); setMemberName(''); setMemberEmail('') }}
                style={{ padding: '10px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--color-neutral-100)', color: 'var(--color-neutral-700)', fontSize: 14, fontWeight: 500 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-neutral-200)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-neutral-100)')}
              >Cancel</button>
              <button type="submit" disabled={savingMember || !memberName.trim()}
                style={{ padding: '10px 20px', borderRadius: 'var(--radius-sm)', background: savingMember || !memberName.trim() ? 'var(--color-neutral-300)' : 'var(--color-primary-600)', color: 'white', fontSize: 14, fontWeight: 500, cursor: savingMember || !memberName.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                {savingMember && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                Add Member
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showAddExpense && (
        <Modal title="Add Expense" onClose={() => { setShowAddExpense(false); setExpDesc(''); setExpAmount(''); setExpSplitMode('equal'); setExpCustomSplits({}) }}>
          <form onSubmit={addExpense} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {members.length === 0 && (
              <div style={{ padding: '10px 14px', background: 'var(--color-warning-50)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--color-warning-600)' }}>
                Please add members to the group first.
              </div>
            )}
            <div>
              <label style={labelStyle}>Description *</label>
              <input value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="e.g. Dinner" autoFocus required style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary-400)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-neutral-200)')}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Amount ($) *</label>
                <input value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="0.00" type="number" step="0.01" min="0.01" required style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary-400)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-neutral-200)')}
                />
              </div>
              <div>
                <label style={labelStyle}>Date *</label>
                <input value={expDate} onChange={e => setExpDate(e.target.value)} type="date" required style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary-400)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-neutral-200)')}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Paid by *</label>
              <select value={expPaidBy} onChange={e => setExpPaidBy(e.target.value)} required style={{ ...inputStyle, background: 'white' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary-400)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-neutral-200)')}
              >
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Split</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: expSplitMode === 'custom' ? 12 : 0 }}>
                {(['equal', 'custom'] as const).map(mode => (
                  <button key={mode} type="button" onClick={() => setExpSplitMode(mode)}
                    style={{
                      flex: 1, padding: '8px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 500,
                      background: expSplitMode === mode ? 'var(--color-primary-50)' : 'var(--color-neutral-50)',
                      color: expSplitMode === mode ? 'var(--color-primary-700)' : 'var(--color-neutral-500)',
                      border: `1px solid ${expSplitMode === mode ? 'var(--color-primary-200)' : 'var(--color-neutral-200)'}`,
                    }}>
                    {mode === 'equal' ? 'Equal split' : 'Custom split'}
                  </button>
                ))}
              </div>
              {expSplitMode === 'custom' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {members.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--color-neutral-700)' }}>{m.name}</span>
                      <input
                        value={expCustomSplits[m.id] ?? ''}
                        onChange={e => setExpCustomSplits(prev => ({ ...prev, [m.id]: e.target.value }))}
                        placeholder="0.00" type="number" step="0.01" min="0"
                        style={{ ...inputStyle, width: 110 }}
                        onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary-400)')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-neutral-200)')}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setShowAddExpense(false); setExpDesc(''); setExpAmount('') }}
                style={{ padding: '10px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--color-neutral-100)', color: 'var(--color-neutral-700)', fontSize: 14, fontWeight: 500 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-neutral-200)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-neutral-100)')}
              >Cancel</button>
              <button type="submit" disabled={savingExpense || !expDesc.trim() || !expAmount || members.length === 0}
                style={{ padding: '10px 20px', borderRadius: 'var(--radius-sm)', background: savingExpense || !expDesc.trim() || !expAmount || members.length === 0 ? 'var(--color-neutral-300)' : 'var(--color-primary-600)', color: 'white', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                {savingExpense && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                Add Expense
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function EmptyState({ icon: Icon, title, sub }: { icon: typeof Receipt; title: string; sub: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '56px 24px',
      background: 'white', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-neutral-100)', boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%', background: 'var(--color-neutral-100)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
      }}>
        <Icon size={24} style={{ color: 'var(--color-neutral-400)' }} />
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{title}</h3>
      <p style={{ color: 'var(--color-neutral-400)', fontSize: 13, marginTop: 4 }}>{sub}</p>
    </div>
  )
}
