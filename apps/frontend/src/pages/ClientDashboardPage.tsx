import {
  Calculator,
  CircleDollarSign,
  History,
  MapPinned,
  Package,
  PackageCheck,
  Search,
  Truck,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { DashboardShell } from '../components/DashboardShell';

const KPIS = [
  {
    label: 'Envíos activos',
    value: '0',
    detail: 'Sin envíos en curso',
    icon: Truck,
    tone: 'bg-route-100 text-route-600',
  },
  {
    label: 'Entregados este mes',
    value: '0',
    detail: 'Todavía sin entregas',
    icon: PackageCheck,
    tone: 'bg-mint-100 text-ink-700',
  },
  {
    label: 'Gasto del mes',
    value: '$ 0',
    detail: 'Sin facturación',
    icon: CircleDollarSign,
    tone: 'bg-sand-200 text-ink-700',
  },
];

const ACTIONS = [
  {
    title: 'Cotizar un envío',
    description: 'Calculá el costo y creá tu primer paquete.',
    icon: Calculator,
  },
  {
    title: 'Seguir un envío',
    description: 'Consultá el estado por código de guía.',
    icon: Search,
  },
  {
    title: 'Ver historial',
    description: 'Revisá tus envíos anteriores y facturas.',
    icon: History,
  },
];

export function ClientDashboardPage() {
  const { user } = useAuth();
  const firstName = user?.nombre.split(/\s+/)[0] ?? '';

  return (
    <DashboardShell badge="Portal del cliente">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-signal-600 font-semibold mb-1">
            Panel de cliente
          </p>
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-ink-950">
            Hola, {firstName}
          </h1>
          <p className="text-sm text-ink-500 mt-1">
            Acá vas a encontrar tus envíos, su seguimiento y tus facturas.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 self-start md:self-auto px-3 py-1.5 rounded-full bg-white border border-sand-200 text-xs font-medium text-ink-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Sesión activa
        </span>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {KPIS.map((kpi) => (
          <article
            key={kpi.label}
            className="bg-white border border-sand-200 rounded-xl p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-ink-500">{kpi.label}</p>
                <p className="font-display font-bold text-3xl text-ink-950 mt-2">
                  {kpi.value}
                </p>
              </div>
              <span
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.tone}`}
              >
                <kpi.icon className="w-5 h-5" />
              </span>
            </div>
            <p className="text-[11px] text-ink-500 mt-3">{kpi.detail}</p>
          </article>
        ))}
      </section>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-lg text-ink-950">
            Acciones rápidas
          </h2>
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-500 bg-sand-200 px-2 py-1 rounded">
            Próximamente
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {ACTIONS.map((action) => (
            <div
              key={action.title}
              aria-disabled="true"
              className="bg-white/60 border border-dashed border-sand-300 rounded-xl p-5 opacity-80"
            >
              <span className="w-9 h-9 rounded-lg bg-sand-200/70 text-ink-700 flex items-center justify-center mb-3">
                <action.icon className="w-[18px] h-[18px]" />
              </span>
              <p className="text-sm font-semibold text-ink-950">{action.title}</p>
              <p className="text-xs text-ink-500 mt-1">{action.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-sand-200 rounded-xl p-8 sm:p-10 text-center shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-sand-200/70 text-ink-700 flex items-center justify-center mx-auto mb-4">
          <Package className="w-7 h-7" />
        </div>
        <h2 className="font-display font-bold text-xl text-ink-950">
          Todavía no tenés envíos
        </h2>
        <p className="text-sm text-ink-500 max-w-md mx-auto mt-1.5">
          Cuando crees tu primer envío vas a ver acá su estado, su recorrido y
          el costo con todos los detalles.
        </p>
        <div className="inline-flex items-center gap-2 mt-5 px-3 py-2 rounded-lg bg-sand-200/70 text-xs font-medium text-ink-700">
          <MapPinned className="w-4 h-4 text-signal-600" />
          El portal completo se habilita en el próximo sprint
        </div>
      </section>
    </DashboardShell>
  );
}
