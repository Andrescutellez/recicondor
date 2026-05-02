import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, UserPlus, Pencil, Key } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { Profile, UserRole } from '../../types'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { RoleBadge, Badge } from '../../components/ui/Badge'
import { useAuth } from '../../hooks/useAuth'
import { formatDate } from '../../lib/format'

// Client without session persistence — for creating/updating other users
const tempClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

// Service-role client for admin password changes (requires VITE_SUPABASE_SERVICE_KEY in .env)
const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY as string | undefined
const adminClient = serviceKey
  ? createClient(import.meta.env.VITE_SUPABASE_URL, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null

export function UserList() {
  const { profile: currentProfile } = useAuth()
  const queryClient = useQueryClient()

  // Create user modal
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState<UserRole>('operator')
  const [createError, setCreateError] = useState('')
  const [createLoading, setCreateLoading] = useState(false)

  // Edit user modal
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('operator')
  const [editPassword, setEditPassword] = useState('')
  const [editError, setEditError] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  const { data: users = [], isLoading } = useQuery<Profile[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('name')
      if (error) throw error
      return data ?? []
    },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('profiles').update({ active: !active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  const openEdit = (user: Profile) => {
    setEditingUser(user)
    setEditName(user.name)
    setEditRole(user.role)
    setEditPassword('')
    setEditError('')
  }

  const handleCreateUser = async () => {
    setCreateError('')
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setCreateError('Nombre, email y contraseña son requeridos')
      return
    }
    if (newPassword.length < 6) {
      setCreateError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setCreateLoading(true)
    try {
      const { data, error } = await tempClient.auth.signUp({
        email: newEmail.trim(),
        password: newPassword,
        options: { data: { name: newName.trim() } },
      })
      if (error) throw error
      if (!data.user) throw new Error('No se pudo crear el usuario')

      // Wait for trigger to create profile, then update name and role
      await new Promise(r => setTimeout(r, 1000))
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ name: newName.trim(), role: newUserRole })
        .eq('id', data.user.id)
      if (profileError) throw profileError

      queryClient.invalidateQueries({ queryKey: ['users'] })
      setCreateOpen(false)
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewUserRole('operator')
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Error al crear usuario')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleEditUser = async () => {
    if (!editingUser) return
    setEditError('')
    if (!editName.trim()) { setEditError('El nombre es requerido'); return }

    setEditLoading(true)
    try {
      // Update name and role in profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ name: editName.trim(), role: editRole })
        .eq('id', editingUser.id)
      if (profileError) throw profileError

      // Change password if provided
      if (editPassword.trim()) {
        if (editPassword.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres')

        if (adminClient) {
          // Use service role to change password directly
          const { error: pwError } = await adminClient.auth.admin.updateUserById(
            editingUser.id,
            { password: editPassword }
          )
          if (pwError) throw pwError
        } else {
          // Fallback: send password reset email
          await supabase.auth.resetPasswordForEmail(editingUser.id, {
            redirectTo: window.location.origin,
          })
          throw new Error(
            'No hay VITE_SUPABASE_SERVICE_KEY configurada. Se envió un email de reseteo de contraseña al usuario.'
          )
        }
      }

      queryClient.invalidateQueries({ queryKey: ['users'] })
      setEditingUser(null)
      setEditPassword('')
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Error al actualizar')
    } finally {
      setEditLoading(false)
    }
  }

  if (currentProfile?.role !== 'admin') {
    return (
      <Card>
        <div className="flex items-center gap-3 text-yellow-700">
          <Shield className="w-5 h-5" />
          <p>Solo los administradores pueden acceder a esta sección.</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{users.length} usuarios registrados</p>
        <Button icon={<UserPlus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
          Crear Usuario
        </Button>
      </div>

      {!adminClient && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
          <strong>Tip:</strong> Para cambiar contraseñas directamente, agrega <code>VITE_SUPABASE_SERVICE_KEY</code> al archivo <code>.env</code>.
          La obtienes en Supabase → Settings → API → <em>service_role key</em>.
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando usuarios...</p>
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Rol</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Registrado</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">No hay usuarios</td>
                  </tr>
                ) : (
                  users.map((user, idx) => (
                    <tr
                      key={user.id}
                      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${!user.active ? 'opacity-60' : ''}`}
                    >
                      <td className="px-6 py-3">
                        <div className="font-medium text-gray-900">{user.name}</div>
                        {user.id === currentProfile?.id && (
                          <span className="text-xs text-green-600">(Tú)</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-center"><RoleBadge role={user.role} /></td>
                      <td className="px-6 py-3 text-center">
                        <Badge color={user.active ? 'green' : 'gray'}>
                          {user.active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-xs text-gray-400">{formatDate(user.created_at)}</td>
                      <td className="px-6 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Pencil className="w-3 h-3" />}
                            onClick={() => openEdit(user)}
                          >
                            Editar
                          </Button>
                          {user.id !== currentProfile?.id && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => toggleActive.mutate({ id: user.id, active: user.active })}
                            >
                              {user.active ? 'Desactivar' : 'Activar'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create user modal */}
      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setCreateError('') }} title="Crear Nuevo Usuario">
        <div className="space-y-4">
          <Input label="Nombre completo" placeholder="Ej: María García" required value={newName} onChange={e => setNewName(e.target.value)} />
          <Input label="Email" type="email" placeholder="correo@ejemplo.com" required value={newEmail} onChange={e => setNewEmail(e.target.value)} />
          <Input label="Contraseña" type="password" placeholder="Mínimo 6 caracteres" required value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          <Select
            label="Rol"
            value={newUserRole}
            onChange={e => setNewUserRole(e.target.value as UserRole)}
            options={[
              { value: 'operator', label: 'Operador' },
              { value: 'admin', label: 'Administrador' },
              { value: 'auditor', label: 'Auditor (solo lectura)' },
            ]}
          />
          {!adminClient && (
            <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
              Si tienes confirmación de email activa en Supabase, el usuario debe confirmar su correo antes de entrar.
              Para saltarlo: Supabase → Authentication → Settings → desactiva "Confirm email".
            </p>
          )}
          {createError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{createError}</p>}
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" fullWidth onClick={() => { setCreateOpen(false); setCreateError('') }}>Cancelar</Button>
            <Button fullWidth loading={createLoading} onClick={handleCreateUser}>Crear Usuario</Button>
          </div>
        </div>
      </Modal>

      {/* Edit user modal */}
      <Modal open={!!editingUser} onClose={() => { setEditingUser(null); setEditError('') }} title={`Editar — ${editingUser?.name}`}>
        <div className="space-y-4">
          <Input
            label="Nombre completo"
            required
            value={editName}
            onChange={e => setEditName(e.target.value)}
          />
          <Select
            label="Rol"
            value={editRole}
            onChange={e => setEditRole(e.target.value as UserRole)}
            options={[
              { value: 'operator', label: 'Operador' },
              { value: 'admin', label: 'Administrador' },
              { value: 'auditor', label: 'Auditor (solo lectura)' },
            ]}
          />
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-4 h-4 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">Nueva contraseña</p>
              <span className="text-xs text-gray-400">(dejar vacío para no cambiar)</span>
            </div>
            <Input
              label=""
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={editPassword}
              onChange={e => setEditPassword(e.target.value)}
            />
            {!adminClient && editPassword && (
              <p className="mt-1 text-xs text-yellow-600">
                Sin VITE_SUPABASE_SERVICE_KEY, se enviará un email de reseteo en lugar de cambiar la contraseña directamente.
              </p>
            )}
          </div>
          {editError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{editError}</p>}
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" fullWidth onClick={() => { setEditingUser(null); setEditError('') }}>Cancelar</Button>
            <Button fullWidth loading={editLoading} onClick={handleEditUser}>Guardar Cambios</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
