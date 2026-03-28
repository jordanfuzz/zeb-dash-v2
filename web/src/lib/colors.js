const ACCENT_COLORS = [
  '#f472b6',
  '#2563eb',
  '#059669',
  '#6d28d9',
  '#0891b2',
  '#f59e0b',
]

export function getColor(index) {
  return ACCENT_COLORS[index % ACCENT_COLORS.length]
}

const BRANCH_PREFIX_COLORS = {
  feature: '#2563eb',
  hotfix: '#f59e0b',
  bugfix: '#f472b6',
  research: '#6d28d9',
}

const BRANCH_DEFAULT_COLOR = '#059669'

export function getBranchColor(branchName) {
  const prefix = branchName.split('/')[0]
  return BRANCH_PREFIX_COLORS[prefix] || BRANCH_DEFAULT_COLOR
}
