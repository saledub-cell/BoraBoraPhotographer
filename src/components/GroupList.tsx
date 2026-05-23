import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Group } from '../types'
import { Plus, Users, ChevronRight, Loader as Loader2 } from 'lucide-react'
import Modal from './Modal'

interface Props {
  onSelect: (group: Group) => void
}

export default function GroupList({ onSelect }: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchGroups()
  }, [])

  async function fetchGroups() {
    setLoading(true)
    const { data } = await supabase
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false })
    setGroups(data ?? [])
    setLoading(false)
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('groups')
      .insert({ name: name.trim(), description: description.trim() || null })
      .select()
      .single()
    if (data) {
      setGroups(prev => [data, ...prev])
      setShowModal(false)
      setName('')
      setDescription('')
    }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-neutral-900)' }}>Groups</h1>
          <p style={{ color: 'var(--color-neutral-500)', marginTop: 2 }}>Track shared expenses with friends</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--color-primary-600)', color: 'white',
            padding: '10px 16px', borderRadius: 'var(--radius-md)',
            fontSize: 14, fontWeight: 500, boxShadow: 'var(--shadow-sm)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-primary-700)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-primary-600)')}
        >
          <Plus size={16} />
          New Group
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Loader2 size={24} style={{ color: 'var(--color-primary-500)', animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : groups.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px 24px',
          background: 'white', borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-neutral-100)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--color-primary-50)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Users size={28} style={{ color: 'var(--color-primary-500)' }} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-neutral-700)', marginBottom: 6 }}>No groups yet</h3>
          <p style={{ color: 'var(--color-neutral-500)' }}>Create a group to start splitting expenses</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => onSelect(g)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'white', border: '1px solid var(--color-neutral-200)',
                borderRadius: 'var(--radius-md)', padding: '16px 20px',
                textAlign: 'left', width: '100%',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--color-primary-300)'
                e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--color-neutral-200)'
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-primary-50)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Users size={18} style={{ color: 'var(--color-primary-500)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-neutral-800)', fontSize: 15 }}>{g.name}</div>
                  {g.description && (
                    <div style={{ color: 'var(--color-neutral-500)', fontSize: 13, marginTop: 2 }}>{g.description}</div>
                  )}
                </div>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--color-neutral-400)', flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title="Create Group" onClose={() => { setShowModal(false); setName(''); setDescription('') }}>
          <form onSubmit={createGroup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-neutral-700)', marginBottom: 6 }}>
                Group Name *
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Trip to Barcelona"
                autoFocus
                required
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1px solid var(--color-neutral-200)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 14, color: 'var(--color-neutral-800)',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary-400)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-neutral-200)')}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-neutral-700)', marginBottom: 6 }}>
                Description
              </label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional description"
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1px solid var(--color-neutral-200)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 14, color: 'var(--color-neutral-800)',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary-400)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-neutral-200)')}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                onClick={() => { setShowModal(false); setName(''); setDescription('') }}
                style={{
                  padding: '10px 16px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-neutral-100)', color: 'var(--color-neutral-700)',
                  fontSize: 14, fontWeight: 500,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-neutral-200)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-neutral-100)')}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                style={{
                  padding: '10px 20px', borderRadius: 'var(--radius-sm)',
                  background: saving || !name.trim() ? 'var(--color-neutral-300)' : 'var(--color-primary-600)',
                  color: 'white', fontSize: 14, fontWeight: 500,
                  cursor: saving || !name.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                Create Group
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
