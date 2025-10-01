import useAuth from '../store/useAuth'
export function RoleGate({ role, children }){
  const { user } = useAuth()
  if (!user?.roles?.includes(role)) return <div className="text-red-300">No tenés permiso ({role})</div>
  return children
}
