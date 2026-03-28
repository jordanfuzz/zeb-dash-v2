import { Link } from 'react-router-dom'
import { getColor } from '../lib/colors'
import { timeAgo } from '../lib/time'

export default function RepoCard({ repo, index }) {
  const color = getColor(index)

  return (
    <Link
      to={`/repos/${repo.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300"
    >
      <div className="mb-2 flex items-center gap-2.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-base font-semibold text-gray-800">
          {repo.name}
        </span>
      </div>
      <div className="flex gap-4 text-xs text-gray-400">
        <span>
          Last active{' '}
          <span className="text-gray-500">{timeAgo(repo.created_at)}</span>
        </span>
      </div>
    </Link>
  )
}
