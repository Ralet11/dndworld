import useAuth from '../store/useAuth'
export default function Profile(){
  const { user } = useAuth()
  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold">Perfil</h2>
      <div className="card">
        <div><b>Nombre:</b> {user?.name}</div>
        <div><b>Email:</b> {user?.email}</div>
        <div><b>Roles:</b> {user?.roles?.join(', ')}</div>
      </div>
    </div>
  )
}
