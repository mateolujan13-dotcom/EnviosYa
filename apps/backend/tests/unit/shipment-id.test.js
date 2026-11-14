const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  nextEnvId,
  estimateDeliveryDays,
} = require(path.join(__dirname, '..', '..', 'dist', 'shipments', 'shipment-id.utils'));

test('nextEnvId incrementa el sufijo existente y mantiene 4 dígitos', () => {
  assert.equal(nextEnvId('ENV-2026-', 'ENV-2026-0012'), 'ENV-2026-0013');
  assert.equal(nextEnvId('ENV-2026-', 'ENV-2026-0001'), 'ENV-2026-0002');
});

test('nextEnvId sin máximo existente arranca en 0001', () => {
  assert.equal(nextEnvId('ENV-2026-', null), 'ENV-2026-0001');
});

test('nextEnvId con máximo malformado ignora el valor y arranca en 0001', () => {
  assert.equal(nextEnvId('ENV-2026-', 'basura'), 'ENV-2026-0001');
  assert.equal(nextEnvId('ENV-2026-', 'ENV-2026-XXXX'), 'ENV-2026-0001');
  assert.equal(nextEnvId('ENV-2026-', 'ENV-2026-'), 'ENV-2026-0001');
});

test('nextEnvId al superar 9999 extiende el sufijo sin truncar', () => {
  assert.equal(nextEnvId('ENV-2026-', 'ENV-2026-9999'), 'ENV-2026-10000');
});

test('estimateDeliveryDays aplica ceil(km/500) con mínimo 1 día', () => {
  assert.equal(estimateDeliveryDays(100), 1);
  assert.equal(estimateDeliveryDays(0), 1);
  assert.equal(estimateDeliveryDays(1), 1);
  assert.equal(estimateDeliveryDays(500), 1);
  assert.equal(estimateDeliveryDays(501), 2);
  assert.equal(estimateDeliveryDays(1000), 2);
  assert.equal(estimateDeliveryDays(1500), 3);
});
