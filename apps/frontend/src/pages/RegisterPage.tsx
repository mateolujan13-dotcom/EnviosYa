import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserPlus,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { homeForRole } from '../auth/roleHome';
import { ApiError } from '../lib/api';
import { AuthShell } from '../components/AuthShell';
import { FormField } from '../components/FormField';

interface FieldErrors {
  nombre?: string;
  email?: string;
  telefono?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+()\s-]{6,25}$/;
const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d).+$/;

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const clearError = (field: keyof FieldErrors) => {
    setErrors((current) =>
      current[field] ? { ...current, [field]: undefined } : current,
    );
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: FieldErrors = {};

    if (nombre.trim().length < 2) {
      nextErrors.nombre = 'Ingresá tu nombre y apellido.';
    }

    if (!email.trim()) {
      nextErrors.email = 'Ingresá tu email.';
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = 'Ingresá un email válido.';
    }

    if (!PHONE_PATTERN.test(telefono.trim())) {
      nextErrors.telefono = 'Ingresá un teléfono válido.';
    }

    if (password.length < 8) {
      nextErrors.password = 'La contraseña debe tener al menos 8 caracteres.';
    } else if (!PASSWORD_PATTERN.test(password)) {
      nextErrors.password = 'La contraseña debe incluir una mayúscula y un número.';
    }

    if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Las contraseñas no coinciden.';
    }

    if (!terms) {
      nextErrors.terms = 'Tenés que aceptar los términos para continuar.';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const telefonoCompleto = telefono.trim().startsWith('+')
      ? telefono.trim()
      : `+54 9 ${telefono.trim()}`;

    try {
      const usuario = await register({
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: telefonoCompleto,
        password,
      });

      navigate(homeForRole(usuario.rol), { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setErrors({
          email: 'Ya existe una cuenta con este email.',
        });
      } else if (error instanceof ApiError && error.status === 400) {
        setFormError(error.message);
      } else {
        setFormError(
          'No pudimos crear tu cuenta. Verificá tu conexión e intentá nuevamente.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell mode="register">
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 text-signal-600 mb-2">
          <UserPlus className="w-4 h-4" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">
            Alta de cuenta digital
          </span>
        </div>
        <h1 className="font-display font-bold text-3xl sm:text-[34px] tracking-tight text-ink-900 mb-1.5">
          Creá tu cuenta
        </h1>
        <p className="text-sm text-ink-500">
          Cotizá y seguí tus envíos en minutos, con trazabilidad garantizada.
        </p>
      </div>

      {formError && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-lg bg-danger-100 border border-danger-600 flex items-start gap-2.5 text-danger-600"
        >
          <AlertCircle className="w-[18px] h-[18px] mt-0.5 shrink-0" />
          <p className="text-sm font-semibold leading-snug">{formError}</p>
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <FormField
          id="register-name"
          label="Nombre y apellido"
          icon={UserRound}
          type="text"
          name="name"
          autoComplete="name"
          placeholder="Ej. Sofía Martínez"
          value={nombre}
          maxLength={80}
          required
          error={errors.nombre}
          onChange={(event) => {
            setNombre(event.target.value);
            clearError('nombre');
          }}
        />

        <FormField
          id="register-email"
          label="Correo electrónico"
          icon={Mail}
          type="email"
          name="email"
          autoComplete="email"
          placeholder="tu@email.com"
          value={email}
          maxLength={120}
          required
          error={errors.email}
          onChange={(event) => {
            setEmail(event.target.value);
            clearError('email');
          }}
        />

        <div>
          <FormField
            id="register-phone"
            label="Teléfono de contacto"
            icon={Phone}
            type="tel"
            name="phone"
            autoComplete="tel"
            placeholder="11 4022-8921"
            value={telefono}
            maxLength={19}
            required
            error={errors.telefono}
            onChange={(event) => {
              setTelefono(event.target.value);
              clearError('telefono');
            }}
          />
          <p className="mt-1.5 text-[11px] text-ink-500">
            Si no incluís el código de país, agregamos +54 9 automáticamente.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FormField
            id="register-password"
            label="Contraseña"
            icon={Lock}
            type={showPassword ? 'text' : 'password'}
            name="new-password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            value={password}
            maxLength={72}
            required
            error={errors.password}
            onChange={(event) => {
              setPassword(event.target.value);
              clearError('password');
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

          <FormField
            id="register-confirm-password"
            label="Confirmar contraseña"
            icon={LockKeyhole}
            type={showConfirmation ? 'text' : 'password'}
            name="confirm-password"
            autoComplete="new-password"
            placeholder="Repetí la contraseña"
            value={confirmPassword}
            maxLength={72}
            required
            error={errors.confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              clearError('confirmPassword');
            }}
            trailing={
              <button
                type="button"
                onClick={() => setShowConfirmation((current) => !current)}
                aria-label={
                  showConfirmation ? 'Ocultar contraseña' : 'Mostrar contraseña'
                }
                className="p-2 rounded text-ink-500 hover:text-ink-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
              >
                {showConfirmation ? (
                  <EyeOff className="w-[18px] h-[18px]" />
                ) : (
                  <Eye className="w-[18px] h-[18px]" />
                )}
              </button>
            }
          />
        </div>

        <div className="flex items-start gap-2 px-3 py-2 bg-white border border-sand-200 rounded-lg">
          <ShieldCheck className="w-4 h-4 text-signal-600 mt-0.5 shrink-0" />
          <p className="text-xs text-ink-700 leading-snug">
            Mínimo 8 caracteres, una mayúscula y un número.
          </p>
        </div>

        <div className="pt-1">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={terms}
              onChange={(event) => {
                setTerms(event.target.checked);
                clearError('terms');
              }}
              className="mt-0.5 w-4 h-4 rounded border-sand-300 accent-signal-600"
            />
            <span className="text-[13px] text-ink-700 leading-snug">
              Acepto los{' '}
              <span className="font-medium text-signal-600 underline decoration-signal-600/30 underline-offset-2">
                términos y condiciones
              </span>{' '}
              y la{' '}
              <span className="font-medium text-signal-600 underline decoration-signal-600/30 underline-offset-2">
                política de privacidad
              </span>{' '}
              de EnvíoYa.
            </span>
          </label>
          {errors.terms && (
            <p className="mt-1.5 text-xs font-medium text-danger-600">
              {errors.terms}
            </p>
          )}
        </div>

        <div className="pt-1">
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[48px] py-3 px-5 bg-signal-600 hover:bg-signal-500 active:scale-[0.99] text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-signal-500/30 transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creando cuenta…</span>
              </>
            ) : (
              <>
                <span>Crear cuenta</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        <div className="text-center pt-1">
          <p className="text-sm text-ink-500">
            ¿Ya tenés una cuenta?{' '}
            <Link
              to="/login"
              className="text-ink-950 font-semibold hover:text-signal-600 transition-colors ml-1 underline decoration-sand-300 hover:decoration-signal-600 underline-offset-4"
            >
              Iniciar sesión
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  );
}
