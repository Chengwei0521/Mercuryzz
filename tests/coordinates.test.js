import test from 'node:test';
import assert from 'node:assert/strict';
import { latLonToPoint, pointToLatLon, validateSignal } from '../src/coordinates.js';

test('surface picking round-trips in both hemispheres and at the date line', () => {
  for (const latitude of [-89.9, -45, 0, 45, 89.9]) {
    for (const longitude of [-180, -120, 0, 89, 180]) {
      const result = pointToLatLon(latLonToPoint(latitude, longitude, 1.45));
      assert.ok(Math.abs(result.latitude - latitude) < 1e-8);
      assert.ok(Math.abs(result.longitude - longitude) < 1e-8);
    }
  }
});

test('signal validation rejects empty, out-of-range and non-finite values', () => {
  const valid = { name: 'Observer', message: 'Hello from Earth', latitude: 0, longitude: 180, mood: 'hope' };
  assert.equal(validateSignal(valid), null);
  for (const change of [{ name: '  ' }, { message: ' '.repeat(50) }, { message: 'x'.repeat(281) }, { latitude: NaN }, { latitude: 91 }, { longitude: Infinity }, { mood: 'invalid' }]) {
    assert.ok(validateSignal({ ...valid, ...change }));
  }
  assert.equal(validateSignal({ ...valid, message: '\u4f60\u597d\uff0c\u6c34\u661f' }), null);
});
