import {
  AlertTriangle,
  ClipboardList,
  Map,
  ShieldCheck,
  Truck,
  Users,
} from 'lucide-react';
import { RolUsuario } from '@envioya/shared';
import { useAuth } from '../auth/AuthContext';
import { roleLabel } from '../auth/roleHome';
import { DashboardShell } from '../components/DashboardShell';

const KPIS = [
  {
    label: 'Envíos activos',
    value: '—',
    icon: Truck,
    tone: 'bg-route-100 text-route-600',
  },
  {
    label: 'Pendientes de asignación',
    value: '—',
    icon: ClipboardList,
    tone: 'bg-sand-200 text-ink-700',
  },
  {
    label: 'Incidencias abiertas',
    value: '—',
    icon: AlertTriangle,
    tone: 'bg-danger-100 text-danger-600',
  },
  {
    label: 'Repartidores disponibles',
    value: '—',
    icon: Users,
    tone: 'bg-mint-100 text-ink-700',
  },
];

export function OpsDashboardPage() {
  const { user } = useAuth();
  const firstName = user?.nombre.split(/\s+/)[0] ?? '';
  const isAdmin = user?.rol === RolUsuario.ADMIN;

  return (
    <DashboardShell badge={isAdmin ? 'Administración' : 'Torre de control'}>
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-signal-600 font-semibold mb-1">
            {isAdmin ? 'Panel de administración' : 'Torre de control'}
          </p>
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-ink-950">
            Hola, {firstName}
          </h1>
          <p className="text-sm text-ink-500 mt-1">
            {isAdmin
              ? 'Acceso total a la operación, usuarios y configuración de tarifas.'
              : 'Cola de despacho, asignación de flota y seguimiento operativo.'}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start md:self-auto px-3 py-1.5 rounded-full bg-white border border-sand-200 text-xs font-medium text-ink-700">
          <ShieldCheck className="w-4 h-4 text-signal-600" />
          {roleLabel(user?.rol ?? RolUsuario.OPERADOR)} · acceso verificado
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {KPIS.map((kpi) => (
          <article
            key={kpi.label}
            className="bg-white border border-sand-200 rounded-xl p-4 sm:p-5 shadow-sm"
          >
            <span
              className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${kpi.tone}`}
            >
              <kpi.icon className="w-[18px] h-[18px]" />
            </span>
            <p className="font-display font-bold text-2xl text-ink-950">
              {kpi.value}
            </p>
            <p className="text-[11px] text-ink-500 mt-0.5">{kpi.label}</p>
          </article>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
        <section className="bg-white border border-sand-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display font-bold text-lg text-ink-950">
                Cola de despacho
              </h2>
              <p className="text-xs text-ink-500 mt-0.5">
                Envíos pendientes de asignación y seguimiento.
              </p>
            </div>
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-500 bg-sand-200 px-2 py-1 rounded">
              Próximamente
            </span>
          </div>

          <div className="rounded-xl border border-dashed border-sand-300 bg-paper/60 p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-sand-200/70 text-ink-700 flex items-center justify-center mx-auto mb-3">
              <Map className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-ink-950">
              La torre de control se conecta en el próximo sprint
            </p>
            <p className="text-xs text-ink-500 mt-1 max-w-sm mx-auto">
              Acá vas a ver la cola completa, asignar repartidores y vehículos,
              y registrar incidencias.
            </p>
          </div>
        </section>

        <section className="bg-white border border-sand-200 rounded-xl p-6 shadow-sm">
          <h2 className="font-display font-bold text-lg text-ink-950 mb-1">
            Control de acceso
          </h2>
          <p className="text-xs text-ink-500 mb-4">
            Esta vista está protegida por rol.
          </p>

          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span className="text-ink-700">
                Sesión JWT en cookie <span className="font-mono text-xs">httpOnly</span>
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span className="text-ink-700">
                Rol habilitado: <strong>{roleLabel(user?.rol ?? RolUsuario.OPERADOR)}</strong>
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span className="text-ink-700">
                Clientes redirigidos automáticamente a su portal
              </span>
            </li>
          </ul>

          {isAdmin && (
            <div className="mt-5 p-3 rounded-lg bg-sand-200/60 border border-sand-300 text-xs text-ink-700">
              <strong className="text-ink-950">Rol admin:</strong> la gestión de
              usuarios y tarifas se habilita en el próximo sprint.
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
