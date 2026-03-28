import { timeAgo } from '../lib/time'

const TYPE_COLORS = {
  plan: '#059669',
  note: '#f59e0b',
}

export default function DocumentItem({ document, type }) {
  const color = TYPE_COLORS[type] || TYPE_COLORS.note

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="mb-0.5 text-sm font-medium" style={{ color }}>
        {document.title || 'Untitled'}
      </div>
      <div className="text-xs text-gray-400">
        {timeAgo(document.created_at)} · {document.user_name}
      </div>
    </div>
  )
}
