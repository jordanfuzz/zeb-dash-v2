import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import BranchTable from '../components/BranchTable'
import EmptyState from '../components/EmptyState'
import {
  getRepository,
  getBranches,
  getConversations,
  getDocuments,
} from '../lib/api'
import { getColor } from '../lib/colors'

function aggregateBranchStats(branches, conversations, documents) {
  const stats = {}
  for (const b of branches) {
    stats[b.id] = {
      conversations: 0,
      plans: 0,
      notes: 0,
      lastUser: null,
      lastActive: b.created_at,
    }
  }

  for (const c of conversations) {
    const s = stats[c.branch_id]
    if (!s) continue
    s.conversations++
    if (c.created_at > s.lastActive) {
      s.lastActive = c.created_at
      s.lastUser = c.user_name
    }
  }

  for (const d of documents) {
    const s = stats[d.branch_id]
    if (!s) continue
    if (d.document_type === 'plan') s.plans++
    else s.notes++
    if (d.created_at > s.lastActive) {
      s.lastActive = d.created_at
      s.lastUser = d.user_name
    }
  }

  // If lastUser is still null, try to get it from conversations
  for (const b of branches) {
    const s = stats[b.id]
    if (!s.lastUser && conversations.length > 0) {
      const branchConvos = conversations.filter(c => c.branch_id === b.id)
      if (branchConvos.length > 0) {
        s.lastUser = branchConvos[0].user_name
      }
    }
  }

  return stats
}

export default function RepositoryPage() {
  const { id } = useParams()
  const [repo, setRepo] = useState(null)
  const [branches, setBranches] = useState([])
  const [branchStats, setBranchStats] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getRepository(id),
      getBranches(id),
      getConversations({ repoId: id }),
      getDocuments({ repoId: id }),
    ])
      .then(([repoData, branchData, convoData, docData]) => {
        setRepo(repoData)
        setBranches(branchData)
        setBranchStats(aggregateBranchStats(branchData, convoData, docData))
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading || !repo) return null

  return (
    <>
      <Breadcrumbs
        items={[{ label: 'Repositories', to: '/' }, { label: repo.name }]}
      />

      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-1 flex items-center gap-2.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: getColor(0) }}
          />
          <span className="text-lg font-semibold text-gray-800">
            {repo.name}
          </span>
        </div>
        {repo.remote_url && (
          <div className="text-xs text-gray-400">{repo.remote_url}</div>
        )}
      </div>

      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Branches
      </div>

      {branches.length === 0 ? (
        <EmptyState message="No branches yet." />
      ) : (
        <BranchTable
          branches={branches}
          branchStats={branchStats}
          repoId={id}
        />
      )}
    </>
  )
}
