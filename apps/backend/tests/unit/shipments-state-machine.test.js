const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  ShipmentsStateMachine,
  IllegalTransitionError,
  SHIPMENT_STATES,
  SHIPMENT_ACTIONS,
} = require(path.join(__dirname, '..', '..', 'dist', 'ops', 'shipments-state-machine'));

const ALL_STATES = [
  'pendiente',
  'en_transito',
  'en_sucursal',
  'en_reparto',
  'entregado',
  'con_incidencia',
  'devuelto',
];

const ALL_ACTIONS = [
  'dispatch',
  'arrive',
  'assign',
  'deliver',
  'incident',
  'resolve-incident',
];

// Tabla exhaustiva legal (independiente de la implementación).
const LEGAL_PAIRS = [
  ['dispatch', 'pendiente', undefined, 'en_transito'],
  ['arrive', 'en_transito', undefined, 'en_sucursal'],
  ['assign', 'pendiente', undefined, 'pendiente'],
  ['assign', 'en_sucursal', undefined, 'en_reparto'],
  ['deliver', 'en_reparto', undefined, 'entregado'],
  ['incident', 'en_transito', undefined, 'con_incidencia'],
  ['incident', 'en_sucursal', undefined, 'con_incidencia'],
  ['incident', 'en_reparto', undefined, 'con_incidencia'],
  ['resolve-incident', 'con_incidencia', 'en_sucursal', 'en_sucursal'],
  ['resolve-incident', 'con_incidencia', 'en_reparto', 'en_reparto'],
  ['resolve-incident', 'con_incidencia', 'devuelto', 'devuelto'],
];

test('la FSM exporta la tabla de estados y acciones TP9 esperadas', () => {
  assert.deepEqual([...SHIPMENT_STATES], ALL_STATES);
  assert.deepEqual([...SHIPMENT_ACTIONS], ALL_ACTIONS);
});

for (const [action, from, resolucion, expected] of LEGAL_PAIRS) {
  test(`legal: ${from} → ${action}${resolucion ? ` (${resolucion})` : ''} => ${expected}`, () => {
    const options = resolucion ? { resolucion } : undefined;
    assert.equal(ShipmentsStateMachine.nextStateFor(action, from, options), expected);
  });
}

// Toda combinación (estado, acción, resolucion opcional) que NO sea legal
// debe lanzar IllegalTransitionError con el mensaje exacto del contrato.
const legalKeys = new Set(
  LEGAL_PAIRS.map(([action, from, resolucion]) => `${action}|${from}|${resolucion ?? ''}`),
);

for (const action of ALL_ACTIONS) {
  for (const from of ALL_STATES) {
    if (action === 'resolve-incident') {
      for (const resolucion of ['en_sucursal', 'en_reparto', 'devuelto']) {
        if (legalKeys.has(`${action}|${from}|${resolucion}`)) continue;
        test(`ilegal: ${from} → ${action} (${resolucion})`, () => {
          assert.throws(
            () => ShipmentsStateMachine.nextStateFor(action, from, { resolucion }),
            (error) => {
              assert.ok(error instanceof IllegalTransitionError);
              assert.equal(error.message, `Transición no permitida: ${from} → ${action}`);
              return true;
            },
          );
        });
      }
      continue;
    }

    if (legalKeys.has(`${action}|${from}|`)) continue;

    test(`ilegal: ${from} → ${action}`, () => {
      assert.throws(
        () => ShipmentsStateMachine.nextStateFor(action, from),
        (error) => {
          assert.ok(error instanceof IllegalTransitionError);
          assert.equal(error.message, `Transición no permitida: ${from} → ${action}`);
          return true;
        },
      );
    });
  }
}

test('estados terminales (entregado, devuelto) rechazan TODAS las acciones', () => {
  for (const terminal of ['entregado', 'devuelto']) {
    for (const action of ALL_ACTIONS) {
      assert.throws(
        () =>
          ShipmentsStateMachine.nextStateFor(
            action,
            terminal,
            action === 'resolve-incident' ? { resolucion: 'en_sucursal' } : undefined,
          ),
        IllegalTransitionError,
        `${terminal} → ${action} debe ser ilegal`,
      );
    }
  }
});

test('resolve-incident sin resolucion desde con_incidencia es ilegal', () => {
  assert.throws(
    () => ShipmentsStateMachine.nextStateFor('resolve-incident', 'con_incidencia'),
    (error) => {
      assert.ok(error instanceof IllegalTransitionError);
      assert.equal(error.message, 'Transición no permitida: con_incidencia → resolve-incident');
      return true;
    },
  );
});

test('resolve-incident con resolucion fuera del enum es ilegal', () => {
  assert.throws(
    () => ShipmentsStateMachine.nextStateFor('resolve-incident', 'con_incidencia', { resolucion: 'entregado' }),
    IllegalTransitionError,
  );
});

test('estado desconocido fuera de la tabla es ilegal (incl. cancelado)', () => {
  for (const bogus of ['cancelado', 'volador', '', 'ENTREGADO']) {
    for (const action of ALL_ACTIONS) {
      assert.throws(
        () =>
          ShipmentsStateMachine.nextStateFor(
            action,
            bogus,
            action === 'resolve-incident' ? { resolucion: 'en_sucursal' } : undefined,
          ),
        IllegalTransitionError,
        `${bogus} → ${action} debe ser ilegal`,
      );
    }
  }
});

test('acción desconocida lanza IllegalTransitionError', () => {
  assert.throws(
    () => ShipmentsStateMachine.nextStateFor('un-assign', 'pendiente'),
    IllegalTransitionError,
  );
});

test('cancelado:true como "estado" nunca es legal (el flag lo maneja el servicio, no la FSM)', () => {
  // La FSM solo conoce los 7 estados TP9; cancelado es un flag plano fuera de la tabla.
  assert.throws(
    () => ShipmentsStateMachine.nextStateFor('dispatch', 'cancelado'),
    IllegalTransitionError,
  );
});

test('isLegal refleja la tabla', () => {
  assert.equal(ShipmentsStateMachine.isLegal('assign', 'pendiente'), true);
  assert.equal(ShipmentsStateMachine.isLegal('assign', 'entregado'), false);
  assert.equal(
    ShipmentsStateMachine.isLegal('resolve-incident', 'con_incidencia', { resolucion: 'devuelto' }),
    true,
  );
});
