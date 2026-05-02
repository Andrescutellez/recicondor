import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

export function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setAuthError('')
    try {
      await signIn(data.email, data.password)
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión'
      if (msg.includes('Invalid login credentials')) {
        setAuthError('Credenciales incorrectas. Verifique email y contraseña.')
      } else {
        setAuthError(msg)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 lg:p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <img
              src="/logo-recicondor.png"
              alt="Recicondor"
              className="h-24 w-auto object-contain mb-2"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
            <p className="text-gray-500 text-sm">Colina Verde · ID 50863</p>
          </div>

          {/* Error */}
          {authError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{authError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Correo electrónico"
              type="email"
              placeholder="usuario@empresa.com"
              autoComplete="email"
              autoFocus
              error={errors.email?.message}
              {...register('email')}
            />

            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`
                    w-full rounded-xl border px-3.5 py-3 lg:py-2.5 text-base lg:text-sm text-gray-900 placeholder-gray-400 pr-10
                    focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                    transition-colors
                    ${errors.password ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'}
                  `}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={isSubmitting}
            >
              Iniciar Sesión
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          ECA v0.1.0 — Sistema de Gestión de Reciclaje
        </p>
      </div>
    </div>
  )
}
