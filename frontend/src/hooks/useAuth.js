import useAuthStore from '@/store/authStore'

export function useAuth() {
  const { user, profile, loading, login, logout } = useAuthStore()
  return { user, profile, loading, login, logout, role: profile?.role }
}

export function useHasRole(...roles) {
  const { role } = useAuth()
  return roles.includes(role)
}
