import { useState, useEffect } from 'react'
import Breadcrumbs from '../components/Breadcrumbs'
import RepoCard from '../components/RepoCard'
import EmptyState from '../components/EmptyState'
import { getRepositories } from '../lib/api'

export default function RepositoriesPage() {
  const [repos, setRepos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRepositories()
      .then(setRepos)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null

  return (
    <>
      <Breadcrumbs items={[{ label: 'Repositories' }]} />
      {repos.length === 0 ? (
        <EmptyState message="No repositories yet. Push a session with /post-session to get started." />
      ) : (
        <div className="flex flex-col gap-3">
          {repos.map((repo, i) => (
            <RepoCard key={repo.id} repo={repo} index={i} />
          ))}
        </div>
      )}
    </>
  )
}
