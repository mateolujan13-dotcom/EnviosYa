import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { homeForRole } from '../auth/roleHome';
import { ApiError } from '../lib/api';
import { AuthShell } from '../components/AuthShell';
import { FormField } from '../components/FormField';

interface FieldErrors {
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: FieldErrors = {};

    if (!email.trim()) {
      nextErrors.email = 'Ingresá tu email.';
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = 'Ingresá un email válido.';
    }

    if (!password) {
      nextErrors.password = 'Ingresá tu contraseña.';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const usuario = await login({
        email: email.trim(),
        password,
        recordarme: remember,
      });

      const from = (location.state as { from?: string } | null)?.from;
      const destination =
        from && from.startsWith('/') ? from : homeForRole(usuario.rol);

      navigate(destination, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.status === 401
          ? 'Email o contraseña incorrectos.'
          : 'No pudimos iniciar sesión. Verificá tu conexión e intentá nuevamente.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell mode="login">
      <div className="mb-7">
        <div className="inline-flex items-center gap-1.5 text-signal-600 mb-2">
          <ShieldCheck className="w-4 h-4" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">
            Acceso seguro
          </span>
        </div>
        <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-ink-900 mb-2">
          Ingresá a tu cuenta
        </h1>
        <p className="text-sm text-ink-500">
          Gestioná tus envíos y seguí cada paquete.
        </p>
      </div>

      {formError && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-lg bg-danger-100 border border-danger-600 flex items-start gap-3 text-danger-600"
        >
          <AlertCircle className="w-[18px] h-[18px] mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold leading-snug">{formError}</p>
            <p className="text-xs opacity-90 mt-0.5">
              Revisá tus credenciales o contactá a soporte.
            </p>
          </div>
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <FormField
          id="login-email"
          label="Correo electrónico"
          icon={Mail}
          type="email"
          name="email"
          autoComplete="email"
          placeholder="tu@email.com"
          value={email}
          required
          error={errors.email}
          onChange={(event) => {
            setEmail(event.target.value);
            setErrors((current) => ({ ...current, email: undefined }));
            setFormError(null);
          }}
        />

        <FormField
          id="login-password"
          label="Contraseña"
          icon={Lock}
          type={showPassword ? 'text' : 'password'}
          name="password"
          autoComplete="current-password"
          placeholder="Ingresá tu contraseña"
          value={password}
          required
          error={errors.password}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrors((current) => ({ ...current, password: undefined }));
            setFormError(null);
          }}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="p-2 rounded text-ink-500 hover:text-ink-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
            >
              {showPassword ? (
                <EyeOff className="w-[18px] h-[18px]" />
              ) : (
                <Eye className="w-[18px] h-[18px]" />
              )}
            </button>
          }
        />

        <div className="flex items-center justify-between gap-4 pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="w-4 h-4 rounded border-sand-300 accent-signal-600"
            />
            <span className="text-sm text-ink-700 font-medium">Recordarme</span>
          </label>
          <span
            className="text-sm text-ink-500 cursor-default"
            title="Disponible en una próxima versión"
          >
            Olvidé mi contraseña
          </span>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[44px] py-3 px-5 bg-signal-600 hover:bg-signal-500 active:scale-[0.99] text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-signal-500/30 transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Ingresando…</span>
            </>
          ) : (
            <>
              <span>Ingresar</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <div className="relative py-2 flex items-center">
          <div className="flex-grow border-t border-sand-300" />
          <span className="flex-shrink mx-4 font-mono text-[10px] text-ink-500 uppercase tracking-wider font-semibold">
            o
          </span>
          <div className="flex-grow border-t border-sand-300" />
        </div>

        <div className="text-center">
          <p className="text-sm text-ink-700">
            ¿No tenés una cuenta?{' '}
            <Link
              to="/register"
              className="text-signal-600 font-semibold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 rounded ml-1"
            >
              Crear cuenta
            </Link>
          </p>
        </div>
      </form>

      <div className="mt-8 p-3.5 bg-white rounded-lg border border-sand-200 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sand-200/70 flex items-center justify-center text-ink-700">
            <Search className="w-[18px] h-[18px]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-950">
              ¿Solo necesitás rastrear?
            </p>
            <p className="text-xs text-ink-500">
              El seguimiento público llega en el próximo sprint.
            </p>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-500 bg-sand-200 px-2 py-1 rounded">
          Próximamente
        </span>
      </div>
    </AuthShell>
  );
}
