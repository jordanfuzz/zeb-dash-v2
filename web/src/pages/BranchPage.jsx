import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import ConversationItem from '../components/ConversationItem'
import DocumentItem from '../components/DocumentItem'
import EmptyState from '../components/EmptyState'
import { getRepository, getConversations, getDocuments } from '../lib/api'
import { getColor } from '../lib/colors'

export default function BranchPage() {
  const { id: repoId, branchId } = useParams()
  const [repo, setRepo] = useState(null)
  const [conversations, setConversations] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getRepository(repoId),
      getConversations({ branchId }),
      getDocuments({ branchId }),
    ])
      .then(([repoData, convoData, docData]) => {
        setRepo(repoData)
        setConversations(convoData)
        setDocuments(docData)
      })
      .finally(() => setLoading(false))
  }, [repoId, branchId])

  if (loading || !repo) return null

  const plans = documents.filter(d => d.document_type === 'plan')
  const notes = documents.filter(d => d.document_type !== 'plan')
  const branchName =
    conversations[0]?.branch || documents[0]?.branch || branchId

  const planCount = plans.length
  const noteCount = notes.length
  const convoCount = conversations.length
  const summaryParts = []
  if (convoCount > 0)
    summaryParts.push(
      `${convoCount} conversation${convoCount !== 1 ? 's' : ''}`
    )
  if (planCount > 0)
    summaryParts.push(`${planCount} plan${planCount !== 1 ? 's' : ''}`)
  if (noteCount > 0)
    summaryParts.push(`${noteCount} note${noteCount !== 1 ? 's' : ''}`)

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Repositories', to: '/' },
          { label: repo.name, to: `/repos/${repoId}` },
          { label: branchName },
        ]}
      />

      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-1 flex items-center gap-2.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: getColor(1) }}
          />
          <span className="text-lg font-semibold text-gray-800">
            {branchName}
          </span>
        </div>
        {summaryParts.length > 0 && (
          <div className="text-xs text-gray-400">
            {summaryParts.join(' · ')}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-6">
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Conversations
          </div>
          {conversations.length === 0 ? (
            <EmptyState message="No conversations yet." />
          ) : (
            <div className="flex flex-col gap-2">
              {conversations.map((convo, i) => (
                <ConversationItem
                  key={convo.id}
                  conversation={convo}
                  index={i}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          {plans.length > 0 && (
            <div className="mb-6">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Plans
              </div>
              <div className="flex flex-col gap-1.5">
                {plans.map(doc => (
                  <DocumentItem key={doc.id} document={doc} type="plan" />
                ))}
              </div>
            </div>
          )}

          {notes.length > 0 && (
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Notes
              </div>
              <div className="flex flex-col gap-1.5">
                {notes.map(doc => (
                  <DocumentItem key={doc.id} document={doc} type="note" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
