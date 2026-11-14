import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Info,
  Loader2,
  MapPin,
  Package,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import {
  ModalidadServicio,
  type CotizacionResultadoDto,
  type CreateShipmentInput,
  type IDireccion,
  type IPaquete,
  type ShipmentDetailDto,
} from '@envioya/shared';
import { DashboardShell } from '../components/DashboardShell';
import { api, ApiError } from '../lib/api';
import { formatArs, formatNumberAr, formatWeightKg } from '../lib/shipmentMeta';

const STORAGE_KEY = 'envioya.wizard.v1';
const QUOTE_MAX_AGE_MS = 30 * 60 * 1000;

interface DireccionForm {
  calle: string;
  numero: string;
  ciudad: string;
  provincia: string;
  cp: string;
}

interface DestinatarioForm {
  nombre: string;
  telefono: string;
}

interface PaqueteForm {
  id: string;
  descripcion: string;
  pesoKg: string;
  altoCm: string;
  anchoCm: string;
  profundoCm: string;
  fragil: boolean;
  valorDeclarado: string;
}

interface WizardPersist {
  v: 1;
  step: number;
  origen: DireccionForm;
  destino: DireccionForm;
  destinatario: DestinatarioForm;
  paquetes: PaqueteForm[];
}

const EMPTY_DIRECCION: DireccionForm = {
  calle: '',
  numero: '',
  ciudad: '',
  provincia: '',
  cp: '',
};

const EMPTY_DESTINATARIO: DestinatarioForm = { nombre: '', telefono: '' };

let paqueteSeq = 0;

/** crypto.randomUUID is unavailable in non-secure (http LAN) contexts. */
function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  paqueteSeq += 1;
  return `pkg-${Date.now().toString(36)}-${paqueteSeq}-${Math.random().toString(36).slice(2, 8)}`;
}

const newPaquete = (): PaqueteForm => ({
  id: newId(),
  descripcion: '',
  pesoKg: '',
  altoCm: '',
  anchoCm: '',
  profundoCm: '',
  fragil: false,
  valorDeclarado: '',
});

function loadPersistedWizard(): WizardPersist | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<WizardPersist>;
    if (parsed?.v !== 1 || typeof parsed.step !== 'number') return null;

    return {
      v: 1,
      step: Math.min(Math.max(Math.trunc(parsed.step), 1), 3),
      origen: { ...EMPTY_DIRECCION, ...(parsed.origen ?? {}) },
      destino: { ...EMPTY_DIRECCION, ...(parsed.destino ?? {}) },
      destinatario: { ...EMPTY_DESTINATARIO, ...(parsed.destinatario ?? {}) },
      paquetes:
        Array.isArray(parsed.paquetes) && parsed.paquetes.length > 0
          ? parsed.paquetes.map((paquete) => ({
              ...newPaquete(),
              ...paquete,
              id: typeof paquete?.id === 'string' ? paquete.id : newId(),
            }))
          : [newPaquete()],
    };
  } catch {
    return null;
  }
}

function toDireccion(form: DireccionForm): IDireccion {
  return {
    calle: form.calle.trim(),
    numero: form.numero.trim(),
    ciudad: form.ciudad.trim(),
    provincia: form.provincia.trim(),
    cp: form.cp.trim(),
  };
}

function toPayloadPaquetes(list: PaqueteForm[]): IPaquete[] {
  return list.map((paquete) => {
    const base: IPaquete = {
      descripcion: paquete.descripcion.trim(),
      pesoKg: parseFloat(paquete.pesoKg),
      dimensiones: {
        altoCm: parseFloat(paquete.altoCm),
        anchoCm: parseFloat(paquete.anchoCm),
        profundoCm: parseFloat(paquete.profundoCm),
      },
      fragil: paquete.fragil,
    };

    const valorDeclarado = parseFloat(paquete.valorDeclarado);
    if (paquete.valorDeclarado.trim() && Number.isFinite(valorDeclarado) && valorDeclarado > 0) {
      base.caracteristicas = [{ k: 'valorDeclarado', v: valorDeclarado }];
    }

    return base;
  });
}

export function WizardPage() {
  const navigate = useNavigate();

  const [initial] = useState<WizardPersist | null>(() => loadPersistedWizard());
  const [step, setStep] = useState<number>(initial?.step ?? 1);
  const [origen, setOrigen] = useState<DireccionForm>(initial?.origen ?? EMPTY_DIRECCION);
  const [destino, setDestino] = useState<DireccionForm>(initial?.destino ?? EMPTY_DIRECCION);
  const [destinatario, setDestinatario] = useState<DestinatarioForm>(
    initial?.destinatario ?? EMPTY_DESTINATARIO,
  );
  const [paquetes, setPaquetes] = useState<PaqueteForm[]>(
    initial?.paquetes ?? [newPaquete()],
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [quote, setQuote] = useState<CotizacionResultadoDto | null>(null);
  const [quoteFetchedAt, setQuoteFetchedAt] = useState<number | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [quoteError, setQuoteError] = useState<{
    kind: 'tarifa' | 'direccion' | 'network' | 'other';
    message: string;
  } | null>(null);
  const [quoteNotice, setQuoteNotice] = useState<string | null>(null);
  const [revalidating, setRevalidating] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submittingRef = useRef(false);
  const quoteAbortRef = useRef<AbortController | null>(null);

  // Persist the in-progress wizard so a refresh does not lose the data.
  useEffect(() => {
    const payload: WizardPersist = { v: 1, step, origen, destino, destinatario, paquetes };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage unavailable or full: the wizard keeps working in memory.
    }
  }, [step, origen, destino, destinatario, paquetes]);

  const totals = useMemo(() => {
    let kg = 0;
    let m3 = 0;

    for (const paquete of paquetes) {
      const peso = parseFloat(paquete.pesoKg);
      if (Number.isFinite(peso)) kg += peso;

      const alto = parseFloat(paquete.altoCm);
      const ancho = parseFloat(paquete.anchoCm);
      const profundo = parseFloat(paquete.profundoCm);
      if ([alto, ancho, profundo].every(Number.isFinite)) {
        m3 += (alto * ancho * profundo) / 1_000_000;
      }
    }

    return { bultos: paquetes.length, kg, m3 };
  }, [paquetes]);

  const setFieldError = (key: string, value: string | undefined) => {
    setErrors((previous) => {
      if (!value) {
        if (!(key in previous)) return previous;
        const next = { ...previous };
        delete next[key];
        return next;
      }
      return { ...previous, [key]: value };
    });
  };

  const validateStep1 = (): boolean => {
    const next: Record<string, string> = {};

    const requireDirection = (prefix: 'origen' | 'destino', direction: DireccionForm) => {
      if (!direction.calle.trim()) next[`${prefix}.calle`] = 'Ingresá la calle.';
      if (!direction.numero.trim()) next[`${prefix}.numero`] = 'Ingresá el número.';
      if (!direction.ciudad.trim()) next[`${prefix}.ciudad`] = 'Ingresá la ciudad.';
      if (!direction.provincia.trim()) next[`${prefix}.provincia`] = 'Ingresá la provincia.';
      if (!direction.cp.trim()) next[`${prefix}.cp`] = 'Ingresá el código postal.';
    };

    requireDirection('origen', origen);
    requireDirection('destino', destino);

    if (!destinatario.nombre.trim()) {
      next['destinatario.nombre'] = 'Ingresá el nombre del destinatario.';
    }
    if (!destinatario.telefono.trim()) {
      next['destinatario.telefono'] = 'Ingresá un teléfono de contacto.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateStep2 = (): boolean => {
    const next: Record<string, string> = {};

    if (paquetes.length === 0) {
      next['paquetes.general'] = 'Agregá al menos un bulto para continuar.';
    }

    for (const paquete of paquetes) {
      if (!paquete.descripcion.trim()) {
        next[`paquete.${paquete.id}.descripcion`] = 'Ingresá una descripción.';
      }

      const peso = parseFloat(paquete.pesoKg);
      if (!paquete.pesoKg.trim() || !Number.isFinite(peso) || peso <= 0) {
        next[`paquete.${paquete.id}.pesoKg`] = 'Ingresá un peso mayor a 0.';
      }

      const dimensiones: Array<keyof PaqueteForm> = ['altoCm', 'anchoCm', 'profundoCm'];
      for (const dimension of dimensiones) {
        const raw = paquete[dimension] as string;
        const value = parseFloat(raw);
        if (!raw.trim() || !Number.isFinite(value) || value <= 0) {
          next[`paquete.${paquete.id}.${dimension}`] = 'Mayor a 0.';
        }
      }

      if (paquete.valorDeclarado.trim()) {
        const value = parseFloat(paquete.valorDeclarado);
        if (!Number.isFinite(value) || value <= 0) {
          next[`paquete.${paquete.id}.valorDeclarado`] =
            'Mayor a 0, o dejá el campo vacío.';
        }
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleStep1Continue = () => {
    if (!validateStep1()) return;
    setStep(2);
  };

  const handleStep2Continue = () => {
    if (!validateStep2()) return;
    setQuoteNotice(null);
    setConfirmError(null);
    setStep(3);
  };

  const buildCreateInput = (): CreateShipmentInput => ({
    origen: toDireccion(origen),
    destino: toDireccion(destino),
    destinatario: {
      nombre: destinatario.nombre.trim(),
      telefono: destinatario.telefono.trim(),
    },
    paquetes: toPayloadPaquetes(paquetes),
    modalidad: ModalidadServicio.ESTANDAR,
  });

  const runQuote = useCallback(
    async (mode: 'entry' | 'retry' | 'revalidate'): Promise<CotizacionResultadoDto | null> => {
      quoteAbortRef.current?.abort();
      const controller = new AbortController();
      quoteAbortRef.current = controller;

      const body = buildCreateInput();

      if (mode === 'revalidate') {
        setRevalidating(true);
      } else {
        setQuoteStatus('loading');
      }
      setQuoteError(null);
      setConfirmError(null);

      try {
        const data = await api<CotizacionResultadoDto>('/pricing/quote', {
          method: 'POST',
          body,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return null;

        setQuote(data);
        setQuoteFetchedAt(Date.now());
        setQuoteStatus('ready');
        return data;
      } catch (error) {
        if (controller.signal.aborted) return null;

        if (error instanceof ApiError) {
          if (error.status === 503) {
            setQuoteError({
              kind: 'tarifa',
              message: 'No hay tarifa vigente. Intentá de nuevo en unos minutos.',
            });
          } else if (error.status === 400) {
            setQuoteError({ kind: 'direccion', message: error.message });
          } else {
            setQuoteError({ kind: 'other', message: error.message });
          }
        } else if (error instanceof Error && error.name === 'AbortError') {
          return null;
        } else {
          setQuoteError({
            kind: 'network',
            message:
              'No pudimos conectar con el servidor. Verificá tu conexión e intentá nuevamente.',
          });
        }

        setQuoteStatus('error');
        return null;
      } finally {
        if (mode === 'revalidate') setRevalidating(false);
      }
    },
    // buildCreateInput closes over the current form state.
    [origen, destino, destinatario, paquetes],
  );

  // Quote on entry to step 3.
  useEffect(() => {
    if (step !== 3) return;
    void runQuote('entry');
  }, [step, runQuote]);

  const handleConfirm = async () => {
    // Synchronous double-click guard; `submitting` drives the disabled state.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setConfirmError(null);

    const stale =
      !quote ||
      quoteFetchedAt === null ||
      Date.now() - quoteFetchedAt > QUOTE_MAX_AGE_MS;

    if (stale) {
      setQuoteNotice('Tu cotización venció; actualizamos el precio antes de confirmar.');
      const fresh = await runQuote('revalidate');
      if (!fresh) {
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }
    }

    try {
      const created = await api<ShipmentDetailDto>('/shipments', {
        method: 'POST',
        body: buildCreateInput(),
      });

      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // Best effort: nothing critical if storage cannot be cleared.
      }

      navigate(`/app/envios/${created.codigo}`, {
        replace: true,
        state: { created: true },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setConfirmError(error.message);
      } else {
        setConfirmError('No pudimos crear el envío. Verificá tu conexión e intentá nuevamente.');
      }
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const updatePaquete = (id: string, patch: Partial<PaqueteForm>) => {
    setPaquetes((previous) =>
      previous.map((paquete) => (paquete.id === id ? { ...paquete, ...patch } : paquete)),
    );
  };

  const removePaquete = (id: string) => {
    setPaquetes((previous) => previous.filter((paquete) => paquete.id !== id));
  };

  const errorFor = (key: string) => errors[key];

  return (
    <DashboardShell badge="Portal del cliente">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-signal-600 font-semibold mb-1">
            Nuevo envío
          </p>
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-ink-950">
            Nuevo envío
          </h1>
        </div>
        <span className="text-sm font-medium text-ink-500">
          Paso {step} de 3 ·{' '}
          {step === 1 ? 'Origen y destino' : step === 2 ? 'Paquetes y carga' : 'Cotización'}
        </span>
      </div>

      <WizardStepper step={step} />

      {step === 1 && (
        <form
          noValidate
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            handleStep1Continue();
          }}
          className="mt-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Punto de retiro */}
            <fieldset className="rounded-xl border border-sand-300 bg-white p-5 sm:p-6 shadow-sm">
              <legend className="sr-only">Punto de retiro (Origen)</legend>
              <div className="flex items-center gap-2 border-b border-sand-200 pb-3 mb-4">
                <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-ink-950" />
                <h2 className="font-display font-bold text-lg text-ink-950">
                  Punto de retiro (Origen)
                </h2>
              </div>
              <DireccionFields
                prefix="origen"
                value={origen}
                onChange={(patch) => {
                  setOrigen((previous) => ({ ...previous, ...patch }));
                  for (const key of Object.keys(patch)) {
                    setFieldError(`origen.${key}`, undefined);
                  }
                }}
                errorFor={errorFor}
              />
            </fieldset>

            {/* Punto de entrega */}
            <fieldset className="rounded-xl border border-sand-300 bg-white p-5 sm:p-6 shadow-sm">
              <legend className="sr-only">Punto de entrega (Destino)</legend>
              <div className="flex items-center gap-2 border-b border-sand-200 pb-3 mb-4">
                <MapPin aria-hidden="true" className="w-5 h-5 text-signal-600" />
                <h2 className="font-display font-bold text-lg text-ink-950">
                  Punto de entrega (Destino)
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor="destinatario-nombre" required>
                    Nombre del destinatario
                  </FieldLabel>
                  <input
                    id="destinatario-nombre"
                    type="text"
                    autoComplete="name"
                    value={destinatario.nombre}
                    onChange={(event) => {
                      setDestinatario((previous) => ({ ...previous, nombre: event.target.value }));
                      setFieldError('destinatario.nombre', undefined);
                    }}
                    aria-invalid={errorFor('destinatario.nombre') ? true : undefined}
                    aria-describedby={
                      errorFor('destinatario.nombre') ? 'destinatario-nombre-error' : undefined
                    }
                    className={inputClass(Boolean(errorFor('destinatario.nombre')))}
                  />
                  <FieldError id="destinatario-nombre-error" message={errorFor('destinatario.nombre')} />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor="destinatario-telefono" required>
                    Teléfono del destinatario
                  </FieldLabel>
                  <input
                    id="destinatario-telefono"
                    type="tel"
                    autoComplete="tel"
                    placeholder="Ej: 11 5555 1234"
                    value={destinatario.telefono}
                    onChange={(event) => {
                      setDestinatario((previous) => ({ ...previous, telefono: event.target.value }));
                      setFieldError('destinatario.telefono', undefined);
                    }}
                    aria-invalid={errorFor('destinatario.telefono') ? true : undefined}
                    aria-describedby={
                      errorFor('destinatario.telefono') ? 'destinatario-telefono-error' : undefined
                    }
                    className={inputClass(Boolean(errorFor('destinatario.telefono')))}
                  />
                  <FieldError id="destinatario-telefono-error" message={errorFor('destinatario.telefono')} />
                </div>
              </div>
              <DireccionFields
                prefix="destino"
                value={destino}
                onChange={(patch) => {
                  setDestino((previous) => ({ ...previous, ...patch }));
                  for (const key of Object.keys(patch)) {
                    setFieldError(`destino.${key}`, undefined);
                  }
                }}
                errorFor={errorFor}
              />
            </fieldset>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Link
              to="/app"
              className="inline-flex h-11 items-center gap-2 rounded-lg text-sm font-semibold text-ink-500 hover:text-ink-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
            >
              <ArrowLeft aria-hidden="true" className="w-4 h-4" />
              Volver al panel
            </Link>
            <button
              type="submit"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-ink-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
            >
              Continuar a paquetes
              <ArrowRight aria-hidden="true" className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <div className="mt-6">
          <div className="space-y-4">
            {paquetes.map((paquete, index) => (
              <fieldset
                key={paquete.id}
                className="rounded-xl border border-sand-300 bg-white p-5 sm:p-6 shadow-sm"
              >
                <legend className="sr-only">{`Bulto ${index + 1}`}</legend>
                <div className="flex items-center justify-between gap-3 border-b border-sand-200 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Package aria-hidden="true" className="w-5 h-5 text-route-600" />
                    <h2 className="font-display font-bold text-base text-ink-950">
                      Bulto {index + 1}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePaquete(paquete.id)}
                    aria-label={`Quitar bulto ${index + 1}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-sand-300 px-3 text-xs font-semibold text-danger-600 transition-colors hover:bg-danger-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                    Quitar
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-8">
                    <FieldLabel htmlFor={`pkg-${paquete.id}-descripcion`} required>
                      Descripción
                    </FieldLabel>
                    <input
                      id={`pkg-${paquete.id}-descripcion`}
                      type="text"
                      placeholder="Ej: Caja con ropa"
                      value={paquete.descripcion}
                      onChange={(event) => {
                        updatePaquete(paquete.id, { descripcion: event.target.value });
                        setFieldError(`paquete.${paquete.id}.descripcion`, undefined);
                      }}
                      aria-invalid={errorFor(`paquete.${paquete.id}.descripcion`) ? true : undefined}
                      aria-describedby={
                        errorFor(`paquete.${paquete.id}.descripcion`)
                          ? `pkg-${paquete.id}-descripcion-error`
                          : undefined
                      }
                      className={inputClass(Boolean(errorFor(`paquete.${paquete.id}.descripcion`)))}
                    />
                    <FieldError
                      id={`pkg-${paquete.id}-descripcion-error`}
                      message={errorFor(`paquete.${paquete.id}.descripcion`)}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <FieldLabel htmlFor={`pkg-${paquete.id}-peso`} required>
                      Peso (kg)
                    </FieldLabel>
                    <input
                      id={`pkg-${paquete.id}-peso`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.1"
                      placeholder="0.0"
                      value={paquete.pesoKg}
                      onChange={(event) => {
                        updatePaquete(paquete.id, { pesoKg: event.target.value });
                        setFieldError(`paquete.${paquete.id}.pesoKg`, undefined);
                      }}
                      aria-invalid={errorFor(`paquete.${paquete.id}.pesoKg`) ? true : undefined}
                      aria-describedby={
                        errorFor(`paquete.${paquete.id}.pesoKg`)
                          ? `pkg-${paquete.id}-peso-error`
                          : undefined
                      }
                      className={inputClass(Boolean(errorFor(`paquete.${paquete.id}.pesoKg`)))}
                    />
                    <FieldError
                      id={`pkg-${paquete.id}-peso-error`}
                      message={errorFor(`paquete.${paquete.id}.pesoKg`)}
                    />
                  </div>

                  <NumberField
                    id={`pkg-${paquete.id}-alto`}
                    label="Alto (cm)"
                    value={paquete.altoCm}
                    error={errorFor(`paquete.${paquete.id}.altoCm`)}
                    onChange={(value) => {
                      updatePaquete(paquete.id, { altoCm: value });
                      setFieldError(`paquete.${paquete.id}.altoCm`, undefined);
                    }}
                    className="sm:col-span-4"
                  />
                  <NumberField
                    id={`pkg-${paquete.id}-ancho`}
                    label="Ancho (cm)"
                    value={paquete.anchoCm}
                    error={errorFor(`paquete.${paquete.id}.anchoCm`)}
                    onChange={(value) => {
                      updatePaquete(paquete.id, { anchoCm: value });
                      setFieldError(`paquete.${paquete.id}.anchoCm`, undefined);
                    }}
                    className="sm:col-span-4"
                  />
                  <NumberField
                    id={`pkg-${paquete.id}-profundo`}
                    label="Prof. (cm)"
                    value={paquete.profundoCm}
                    error={errorFor(`paquete.${paquete.id}.profundoCm`)}
                    onChange={(value) => {
                      updatePaquete(paquete.id, { profundoCm: value });
                      setFieldError(`paquete.${paquete.id}.profundoCm`, undefined);
                    }}
                    className="sm:col-span-4"
                  />

                  <div className="sm:col-span-6 flex items-center">
                    <label
                      htmlFor={`pkg-${paquete.id}-fragil`}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-sand-300 bg-paper px-3 py-2 text-sm font-medium text-ink-700"
                    >
                      <input
                        id={`pkg-${paquete.id}-fragil`}
                        type="checkbox"
                        checked={paquete.fragil}
                        onChange={(event) =>
                          updatePaquete(paquete.id, { fragil: event.target.checked })
                        }
                        className="h-4 w-4 rounded border-sand-300 text-signal-600 focus:ring-route-600"
                      />
                      Frágil
                    </label>
                  </div>
                  <div className="sm:col-span-6">
                    <FieldLabel htmlFor={`pkg-${paquete.id}-valor`}>
                      Valor declarado (opcional)
                    </FieldLabel>
                    <div className="relative">
                      <span
                        aria-hidden="true"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-500"
                      >
                        $
                      </span>
                      <input
                        id={`pkg-${paquete.id}-valor`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={paquete.valorDeclarado}
                        onChange={(event) => {
                          updatePaquete(paquete.id, { valorDeclarado: event.target.value });
                          setFieldError(`paquete.${paquete.id}.valorDeclarado`, undefined);
                        }}
                        aria-invalid={
                          errorFor(`paquete.${paquete.id}.valorDeclarado`) ? true : undefined
                        }
                        aria-describedby={
                          errorFor(`paquete.${paquete.id}.valorDeclarado`)
                            ? `pkg-${paquete.id}-valor-error`
                            : undefined
                        }
                        className={clsx(
                          inputClass(Boolean(errorFor(`paquete.${paquete.id}.valorDeclarado`))),
                          'pl-7',
                        )}
                      />
                    </div>
                    <FieldError
                      id={`pkg-${paquete.id}-valor-error`}
                      message={errorFor(`paquete.${paquete.id}.valorDeclarado`)}
                    />
                  </div>
                </div>
              </fieldset>
            ))}
          </div>

          {errorFor('paquetes.general') && (
            <p role="alert" className="mt-4 text-sm font-medium text-danger-600">
              {errorFor('paquetes.general')}
            </p>
          )}

          <button
            type="button"
            onClick={() => setPaquetes((previous) => [...previous, newPaquete()])}
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg border border-dashed border-sand-300 bg-white px-4 text-sm font-semibold text-route-600 transition-colors hover:border-route-600 hover:bg-route-100/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
          >
            <Plus aria-hidden="true" className="w-4 h-4" />
            Agregar bulto
          </button>

          {/* Totals bar */}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-sand-200 bg-sand-200/40 px-4 py-3 text-sm">
            <span className="font-semibold text-ink-950">
              {totals.bultos} {totals.bultos === 1 ? 'bulto' : 'bultos'}
            </span>
            <span className="font-mono text-ink-700">
              {formatWeightKg(totals.kg)} kg
            </span>
            <span className="font-mono text-ink-700">
              {totals.m3.toLocaleString('es-AR', { maximumFractionDigits: 3 })} m³
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-sand-300 bg-white px-4 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
            >
              <ArrowLeft aria-hidden="true" className="w-4 h-4" />
              Volver
            </button>
            <button
              type="button"
              onClick={handleStep2Continue}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-ink-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
            >
              Continuar a cotización
              <ArrowRight aria-hidden="true" className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-6">
          {quoteNotice && (
            <p
              role="status"
              className="mb-4 flex items-start gap-2 rounded-lg border border-warning-500/40 bg-warning-500/10 px-4 py-2.5 text-sm font-medium text-ink-950"
            >
              <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning-500" />
              {quoteNotice}
            </p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Desglose de la cotización */}
            <section
              aria-labelledby="quote-heading"
              className="rounded-xl border border-sand-300 bg-white p-5 sm:p-6 shadow-sm lg:col-span-7"
            >
              <div className="flex items-center justify-between gap-3 border-b border-sand-200 pb-3 mb-4">
                <h2
                  id="quote-heading"
                  className="font-display font-bold text-lg text-ink-950"
                >
                  Desglose de cotización
                </h2>
                {quote?.distanciaEstimada && (
                  <span className="inline-flex items-center rounded-full border border-warning-500/50 bg-warning-500/10 px-3 py-1 text-[11px] font-semibold text-ink-950">
                    Distancia estimada (sin ruta vial)
                  </span>
                )}
              </div>

              {quoteStatus === 'loading' && <QuoteSkeleton />}

              {quoteStatus === 'error' && quoteError && (
                <div role="alert" className="py-2">
                  <div className="flex items-start gap-3">
                    <AlertCircle
                      aria-hidden="true"
                      className="mt-0.5 h-5 w-5 shrink-0 text-danger-600"
                    />
                    <div>
                      <p className="text-sm font-semibold text-ink-950">
                        {quoteError.kind === 'tarifa'
                          ? 'No hay tarifa vigente'
                          : 'No pudimos cotizar tu envío'}
                      </p>
                      <p className="mt-1 text-sm text-ink-700">{quoteError.message}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {quoteError.kind === 'direccion' ? (
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-sand-300 bg-paper px-4 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
                      >
                        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                        Volver al paso 1
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void runQuote('retry')}
                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-sand-300 bg-paper px-4 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
                      >
                        <RotateCcw aria-hidden="true" className="h-4 w-4" />
                        Reintentar cotización
                      </button>
                    )}
                  </div>
                </div>
              )}

              {quoteStatus === 'ready' && quote && (
                <>
                  <dl className="divide-y divide-sand-200 text-sm">
                    <QuoteRow label="Precio base" value={formatArs(quote.desglose.precioBase)} />
                    <QuoteRow
                      label={`Distancia · ${formatNumberAr(quote.distanciaKm)} km`}
                      value={formatArs(quote.desglose.adicionalDistancia)}
                    />
                    <QuoteRow
                      label={`Peso · ${formatWeightKg(quote.pesoTotalKg)} kg`}
                      value={formatArs(quote.desglose.adicionalPeso)}
                    />
                    <QuoteRow
                      label="Adicional frágil"
                      value={formatArs(quote.desglose.adicionalFragil)}
                    />
                    <QuoteRow label="Seguro" value={formatArs(quote.desglose.seguro)} />
                    <QuoteRow label="Subtotal" value={formatArs(quote.desglose.subtotal)} />
                    <QuoteRow label="IVA" value={formatArs(quote.desglose.iva)} />
                  </dl>

                  <div className="mt-4 flex items-end justify-between gap-4 rounded-xl border border-sand-300 bg-paper p-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                        Total
                      </p>
                      <p className="font-display font-bold text-3xl text-ink-950">
                        {formatArs(quote.desglose.total)}
                      </p>
                    </div>
                    <div className="text-right text-xs text-ink-500">
                      <p>
                        {formatNumberAr(quote.distanciaKm)} km ·{' '}
                        {formatNumberAr(quote.duracionEstimadaHoras)} h estimadas
                      </p>
                      <p className="mt-0.5">
                        {quote.volumenTotalM3.toLocaleString('es-AR', {
                          maximumFractionDigits: 3,
                        })}{' '}
                        m³
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-ink-500">
                    Cotización válida por 30 minutos. El precio final se confirma al crear el
                    envío.
                  </p>
                </>
              )}
            </section>

            {/* Resumen + confirmación */}
            <section
              aria-labelledby="confirm-heading"
              className="rounded-xl border border-sand-300 bg-white p-5 sm:p-6 shadow-sm lg:col-span-5"
            >
              <h2
                id="confirm-heading"
                className="border-b border-sand-200 pb-3 mb-4 font-display font-bold text-lg text-ink-950"
              >
                Resumen del envío
              </h2>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                    Origen
                  </dt>
                  <dd className="font-medium text-ink-900">
                    {origen.calle} {origen.numero}, {origen.ciudad}, {origen.provincia}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                    Destino
                  </dt>
                  <dd className="font-medium text-ink-900">
                    {destino.calle} {destino.numero}, {destino.ciudad}, {destino.provincia}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                    Destinatario
                  </dt>
                  <dd className="font-medium text-ink-900">
                    {destinatario.nombre} · {destinatario.telefono}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                    Carga
                  </dt>
                  <dd className="font-medium text-ink-900">
                    {totals.bultos} {totals.bultos === 1 ? 'bulto' : 'bultos'} ·{' '}
                    {formatWeightKg(totals.kg)} kg
                  </dd>
                </div>
              </dl>

              {confirmError && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg border border-danger-600/40 bg-danger-100 px-3 py-2 text-sm font-medium text-danger-600"
                >
                  {confirmError}
                </p>
              )}

              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={submitting || revalidating || quoteStatus !== 'ready'}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-signal-600 text-base font-semibold text-white shadow-sm transition-all hover:bg-signal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting || revalidating ? (
                    <>
                      <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
                      {revalidating ? 'Actualizando cotización…' : 'Confirmando…'}
                    </>
                  ) : (
                    <>
                      Confirmar envío
                      <ArrowRight aria-hidden="true" className="h-5 w-5" />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={submitting || revalidating}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-sand-300 bg-white px-4 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Volver a editar
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

const WIZARD_STEPS = [
  { n: 1, label: 'Origen y destino' },
  { n: 2, label: 'Paquetes y carga' },
  { n: 3, label: 'Cotización y confirmación' },
] as const;

function WizardStepper({ step }: { step: number }) {
  return (
    <ol
      aria-label="Progreso del nuevo envío"
      className="flex items-center gap-1 sm:gap-2 rounded-xl border border-sand-300 bg-white p-3 sm:p-4 shadow-sm"
    >
      {WIZARD_STEPS.map((item, index) => {
        const isComplete = step > item.n;
        const isCurrent = step === item.n;

        return (
          <li
            key={item.n}
            aria-current={isCurrent ? 'step' : undefined}
            className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3"
          >
            <span
              aria-hidden="true"
              className={clsx(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                isComplete && 'bg-ink-950 text-white',
                isCurrent && 'bg-signal-600 text-white shadow-sm',
                !isComplete && !isCurrent && 'border border-sand-300 bg-paper text-ink-500',
              )}
            >
              {isComplete ? <Check className="h-4 w-4" /> : item.n}
            </span>
            <span className="hidden min-w-0 sm:block">
              <span
                className={clsx(
                  'block truncate text-xs sm:text-[13px] font-semibold',
                  isCurrent ? 'text-ink-950' : 'text-ink-500',
                )}
              >
                {item.label}
              </span>
              <span
                className={clsx(
                  'block text-[10px] sm:text-[11px]',
                  isComplete && 'text-ink-500',
                  isCurrent && 'font-medium text-signal-600',
                  !isComplete && !isCurrent && 'text-ink-500',
                )}
              >
                {isComplete ? 'Completado' : isCurrent ? 'En progreso' : 'Pendiente'}
              </span>
            </span>
            {index < WIZARD_STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={clsx(
                  'mx-1 sm:mx-2 h-[2px] min-w-2 flex-1',
                  step > item.n ? 'bg-ink-950' : 'bg-sand-300',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

const inputClass = (hasError: boolean) =>
  clsx(
    'w-full h-11 rounded-lg border bg-white px-3.5 text-sm text-ink-950 placeholder:text-ink-500/60 transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-route-600/25 focus:border-route-600',
    hasError ? 'border-danger-600 bg-danger-100/30' : 'border-sand-300',
  );

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[13px] font-semibold text-ink-950"
    >
      {children}
      {required && <span className="text-signal-600"> *</span>}
    </label>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;

  return (
    <p id={id} role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-danger-600">
      <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  );
}

function DireccionFields({
  prefix,
  value,
  onChange,
  errorFor,
}: {
  prefix: 'origen' | 'destino';
  value: DireccionForm;
  onChange: (patch: Partial<DireccionForm>) => void;
  errorFor: (key: string) => string | undefined;
}) {
  const fieldId = (name: string) => `${prefix}-${name}`;
  const errorId = (name: string) => `${prefix}-${name}-error`;
  const errorOf = (name: string) => errorFor(`${prefix}.${name}`);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
      <div className="sm:col-span-8">
        <FieldLabel htmlFor={fieldId('calle')} required>
          Calle
        </FieldLabel>
        <input
          id={fieldId('calle')}
          type="text"
          autoComplete="address-line1"
          placeholder="Ej: Av. Corrientes"
          value={value.calle}
          onChange={(event) => onChange({ calle: event.target.value })}
          aria-invalid={errorOf('calle') ? true : undefined}
          aria-describedby={errorOf('calle') ? errorId('calle') : undefined}
          className={inputClass(Boolean(errorOf('calle')))}
        />
        <FieldError id={errorId('calle')} message={errorOf('calle')} />
      </div>
      <div className="sm:col-span-4">
        <FieldLabel htmlFor={fieldId('numero')} required>
          Número
        </FieldLabel>
        <input
          id={fieldId('numero')}
          type="text"
          inputMode="numeric"
          placeholder="1234"
          value={value.numero}
          onChange={(event) => onChange({ numero: event.target.value })}
          aria-invalid={errorOf('numero') ? true : undefined}
          aria-describedby={errorOf('numero') ? errorId('numero') : undefined}
          className={inputClass(Boolean(errorOf('numero')))}
        />
        <FieldError id={errorId('numero')} message={errorOf('numero')} />
      </div>
      <div className="sm:col-span-6">
        <FieldLabel htmlFor={fieldId('ciudad')} required>
          Ciudad
        </FieldLabel>
        <input
          id={fieldId('ciudad')}
          type="text"
          autoComplete="address-level2"
          placeholder="Ej: Rosario"
          value={value.ciudad}
          onChange={(event) => onChange({ ciudad: event.target.value })}
          aria-invalid={errorOf('ciudad') ? true : undefined}
          aria-describedby={errorOf('ciudad') ? errorId('ciudad') : undefined}
          className={inputClass(Boolean(errorOf('ciudad')))}
        />
        <FieldError id={errorId('ciudad')} message={errorOf('ciudad')} />
      </div>
      <div className="sm:col-span-6">
        <FieldLabel htmlFor={fieldId('provincia')} required>
          Provincia
        </FieldLabel>
        <input
          id={fieldId('provincia')}
          type="text"
          autoComplete="address-level1"
          placeholder="Ej: Santa Fe"
          value={value.provincia}
          onChange={(event) => onChange({ provincia: event.target.value })}
          aria-invalid={errorOf('provincia') ? true : undefined}
          aria-describedby={errorOf('provincia') ? errorId('provincia') : undefined}
          className={inputClass(Boolean(errorOf('provincia')))}
        />
        <FieldError id={errorId('provincia')} message={errorOf('provincia')} />
      </div>
      <div className="sm:col-span-4">
        <FieldLabel htmlFor={fieldId('cp')} required>
          Código postal
        </FieldLabel>
        <input
          id={fieldId('cp')}
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="2000"
          value={value.cp}
          onChange={(event) => onChange({ cp: event.target.value })}
          aria-invalid={errorOf('cp') ? true : undefined}
          aria-describedby={errorOf('cp') ? errorId('cp') : undefined}
          className={inputClass(Boolean(errorOf('cp')))}
        />
        <FieldError id={errorId('cp')} message={errorOf('cp')} />
      </div>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  error,
  onChange,
  className,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} required>
        {label}
      </FieldLabel>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min="0"
        step="0.1"
        placeholder="0.0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass(Boolean(error))}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function QuoteRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-mono font-medium text-ink-900">{value}</dd>
    </div>
  );
}

function QuoteSkeleton() {
  return (
    <div role="status" aria-busy="true" className="animate-pulse">
      <span className="sr-only">Calculando la cotización…</span>
      <div className="space-y-3">
        {[0, 1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className="flex items-center justify-between gap-4">
            <div className="h-4 w-40 rounded bg-sand-200" />
            <div className="h-4 w-20 rounded bg-sand-200" />
          </div>
        ))}
      </div>
      <div className="mt-4 h-20 rounded-xl border border-sand-200 bg-sand-200/50" />
    </div>
  );
}
