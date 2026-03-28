const BASE = '/api'

async function fetchJson(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`)
  }
  return res.json()
}

export function getRepositories() {
  return fetchJson('/repositories')
}

export function getRepository(id) {
  return fetchJson(`/repositories/${id}`)
}

export function getBranches(repositoryId) {
  return fetchJson(`/branches?repository_id=${repositoryId}`)
}

export function getConversations({ branchId, repoId } = {}) {
  const params = []
  if (branchId) params.push(`branch_id=${branchId}`)
  if (repoId) params.push(`repo_id=${repoId}`)
  const query = params.length ? `?${params.join('&')}` : ''
  return fetchJson(`/conversations${query}`)
}

export function getDocuments({ branchId, repoId } = {}) {
  const params = []
  if (branchId) params.push(`branch_id=${branchId}`)
  if (repoId) params.push(`repo_id=${repoId}`)
  const query = params.length ? `?${params.join('&')}` : ''
  return fetchJson(`/documents${query}`)
}
