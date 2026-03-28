import { Link } from 'react-router-dom'
import { getBranchColor } from '../lib/colors'
import { timeAgo } from '../lib/time'

function formatDocsSummary(plans, notes) {
  const parts = []
  if (plans > 0) parts.push(`${plans} plan${plans !== 1 ? 's' : ''}`)
  if (notes > 0) parts.push(`${notes} note${notes !== 1 ? 's' : ''}`)
  return parts.length > 0 ? parts.join(', ') : '\u2014'
}

export default function BranchTable({ branches, branchStats, repoId }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] border-b border-gray-200 bg-gray-50 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Branch
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Conversations
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Documents
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Last User
        </span>
        <span className="text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
          Last Active
        </span>
      </div>
      {branches.map((branch, i) => {
        const stats = branchStats[branch.id] || {}
        return (
          <Link
            key={branch.id}
            to={`/repos/${repoId}/branches/${branch.id}`}
            className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center border-b border-gray-100 px-4 py-3.5 last:border-b-0 hover:bg-gray-50"
          >
            <span
              className="text-sm font-medium"
              style={{ color: getBranchColor(branch.name) }}
            >
              {branch.name}
            </span>
            <span className="text-sm text-gray-500">
              {stats.conversations || 0}
            </span>
            <span className="text-sm text-gray-500">
              {formatDocsSummary(stats.plans || 0, stats.notes || 0)}
            </span>
            <span className="text-xs text-gray-400">
              {stats.lastUser || '\u2014'}
            </span>
            <span className="text-right text-xs text-gray-400">
              {timeAgo(stats.lastActive || branch.created_at)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
