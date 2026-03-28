import { getColor } from '../lib/colors'
import { timeAgo } from '../lib/time'

const MODEL_BADGE_STYLES = {
  opus: { bg: 'bg-blue-100', text: 'text-blue-600' },
  sonnet: { bg: 'bg-pink-100', text: 'text-pink-600' },
  haiku: { bg: 'bg-green-100', text: 'text-green-600' },
}

function getModelBadge(model) {
  if (!model)
    return { bg: 'bg-gray-100', text: 'text-gray-500', label: 'unknown' }
  const lower = model.toLowerCase()
  for (const [key, style] of Object.entries(MODEL_BADGE_STYLES)) {
    if (lower.includes(key)) return { ...style, label: model }
  }
  return { bg: 'bg-purple-100', text: 'text-purple-600', label: model }
}

export default function ConversationItem({ conversation, index }) {
  const color = getColor(index)
  const badge = getModelBadge(conversation.claude_model)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-1.5 flex items-start justify-between">
        <span className="text-xs text-gray-400">
          {timeAgo(conversation.created_at)}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.bg} ${badge.text}`}
        >
          {badge.label}
        </span>
      </div>
      <div className="mb-1 text-sm font-medium" style={{ color }}>
        {conversation.git_commit || conversation.id.slice(0, 7)}
      </div>
      <div className="text-xs text-gray-500">{conversation.user_name}</div>
    </div>
  )
}
