import { useState } from 'react'
import type { Group } from './types'
import GroupList from './components/GroupList'
import GroupDetail from './components/GroupDetail'

export default function App() {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-neutral-50)' }}>
      <header style={{
        background: 'white',
        borderBottom: '1px solid var(--color-neutral-200)',
        padding: '0 16px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        boxShadow: 'var(--shadow-sm)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'var(--color-primary-600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-neutral-900)', letterSpacing: '-0.02em' }}>
            SplitWise
          </span>
        </div>
      </header>

      {selectedGroup ? (
        <GroupDetail group={selectedGroup} onBack={() => setSelectedGroup(null)} />
      ) : (
        <GroupList onSelect={setSelectedGroup} />
      )}
    </div>
  )
}
