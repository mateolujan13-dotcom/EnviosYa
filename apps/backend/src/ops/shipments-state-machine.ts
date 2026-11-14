/**
 * Máquina de estados finita del envío (ADR-004). Módulo PURO: sin dependencias
 * de Nest ni de MongoDB, para poder testearla sola. La cancelación lógica
 * (`cancelado: true`) NO pasa por la FSM: la maneja el servicio (409).
 */

export const SHIPMENT_STATES = [
  'pendiente',
  'en_transito',
  'en_sucursal',
  'en_reparto',
  'entregado',
  'con_incidencia',
  'devuelto',
] as const;

export type ShipmentState = (typeof SHIPMENT_STATES)[number];

export const SHIPMENT_ACTIONS = [
  'dispatch',
  'arrive',
  'assign',
  'deliver',
  'incident',
  'resolve-incident',
] as const;

export type ShipmentAction = (typeof SHIPMENT_ACTIONS)[number];

export type ResolveIncidentResolution = 'en_sucursal' | 'en_reparto' | 'devuelto';

export interface NextStateOptions {
  resolucion?: ResolveIncidentResolution | string;
}

export class IllegalTransitionError extends Error {
  constructor(from: string, action: string) {
    super(`Transición no permitida: ${from} → ${action}`);
    this.name = 'IllegalTransitionError';
  }
}

/**
 * Tabla explícita (origen → acción → destino). `resolve-incident` se resuelve
 * con `options.resolucion` (el destino es la propia resolución) y por eso su
 * fila exige `con_incidencia` como origen.
 */
const TRANSITION_TABLE: Record<
  Exclude<ShipmentAction, 'resolve-incident'>,
  Partial<Record<ShipmentState, ShipmentState>>
> = {
  dispatch: { pendiente: 'en_transito' },
  arrive: { en_transito: 'en_sucursal' },
  assign: { pendiente: 'pendiente', en_sucursal: 'en_reparto' },
  deliver: { en_reparto: 'entregado' },
  incident: {
    en_transito: 'con_incidencia',
    en_sucursal: 'con_incidencia',
    en_reparto: 'con_incidencia',
  },
};

const RESOLVE_INCIDENT_TARGETS: Record<ResolveIncidentResolution, ShipmentState> = {
  en_sucursal: 'en_sucursal',
  en_reparto: 'en_reparto',
  devuelto: 'devuelto',
};

export class ShipmentsStateMachine {
  /**
   * Devuelve el estado destino para `(action, current)` o lanza
   * `IllegalTransitionError` con «Transición no permitida: <from> → <action>».
   * Cualquier estado/acción desconocido (incluido `cancelado`) es ilegal.
   */
  static nextStateFor(
    action: ShipmentAction | string,
    current: ShipmentState | string,
    options: NextStateOptions = {},
  ): ShipmentState {
    if (action === 'resolve-incident') {
      const resolucion = options.resolucion;
      if (
        current === 'con_incidencia' &&
        typeof resolucion === 'string' &&
        resolucion in RESOLVE_INCIDENT_TARGETS
      ) {
        return RESOLVE_INCIDENT_TARGETS[resolucion as ResolveIncidentResolution];
      }

      throw new IllegalTransitionError(String(current), String(action));
    }

    const row = TRANSITION_TABLE[action as Exclude<ShipmentAction, 'resolve-incident'>];
    const target = row?.[current as ShipmentState];
    if (!target) {
      throw new IllegalTransitionError(String(current), String(action));
    }

    return target;
  }

  static isLegal(
    action: ShipmentAction | string,
    current: ShipmentState | string,
    options: NextStateOptions = {},
  ): boolean {
    try {
      ShipmentsStateMachine.nextStateFor(action, current, options);
      return true;
    } catch (error) {
      if (error instanceof IllegalTransitionError) {
        return false;
      }

      throw error;
    }
  }
}
