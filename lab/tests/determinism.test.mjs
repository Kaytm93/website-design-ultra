import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createClock,
  createRandomStreams,
  getCameraStation,
  createStableFrameMarker,
  type CameraStation,
} from '../../references/determinism-runtime.ts';

test('two RandomStreams with the same root seed produce identical 5-value sequences', () => {
  const a = createRandomStreams('wdu-lab-v1');
  const b = createRandomStreams('wdu-lab-v1');
  const seqA = [0, 1, 2, 3, 4].map(() => a.stream('capture-geometry').next());
  const seqB = [0, 1, 2, 3, 4].map(() => b.stream('capture-geometry').next());
  assert.deepEqual(seqA, seqB);
});

test('adding an unrelated stream does not change an existing stream sequence', () => {
  const rng = createRandomStreams('isolation-test');
  const before = [0, 1, 2].map(() => rng.stream('primary').next());
  rng.stream('unrelated'); // should not advance primary
  const after = [0, 1, 2].map(() => rng.stream('primary').next());
  assert.deepEqual(before, after);
});

test('deterministic clock advances by the declared step', () => {
  const clock = createClock({ mode: 'deterministic', stepSeconds: 1 / 30 });
  assert.equal(clock.elapsed, 0);
  clock.tick();
  assert.equal(clock.elapsed, 1 / 30);
  clock.tick();
  assert.equal(clock.elapsed, 2 / 30);
  assert.equal(clock.frame, 2);
});

test('unknown camera station throws with available stations listed', () => {
  const stations: Record<string, CameraStation> = {
    hero: {
      position: [0, 1, 3],
      target: [0, 0, 0],
      projection: 'perspective',
      fov: 50,
      sceneState: 'default',
    },
  };
  assert.throws(
    () => getCameraStation(stations, 'missing'),
    /Unknown camera station "missing"[^]*available stations: hero/,
  );
  assert.doesNotThrow(() => getCameraStation(stations, 'hero'));
});

test('stable frame marker fires data-wdu-ready after the declared frame count', () => {
  const target = {
    _attrs: {} as Record<string, string>,
    setAttribute(name: string, value: string) {
      this._attrs[name] = value;
    },
    removeAttribute(name: string) {
      delete this._attrs[name];
    },
  };
  const marker = createStableFrameMarker({
    target: target as unknown as Element,
    stableFrame: 3,
  });

  assert.equal(marker.ready, false);
  assert.equal(target._attrs['data-wdu-ready'], undefined);

  // Frame 1 — not ready yet
  marker.afterVisibleRender({
    frame: 1,
    assetsReady: true,
    cameraStationApplied: true,
    streamsInitialized: true,
  });
  assert.equal(marker.ready, false);

  // Frame 3 — should fire ready
  marker.afterVisibleRender({
    frame: 3,
    assetsReady: true,
    cameraStationApplied: true,
    streamsInitialized: true,
  });
  assert.equal(marker.ready, true);
  assert.equal(target._attrs['data-wdu-ready'], 'true');

  // Invalidate
  marker.invalidate();
  assert.equal(marker.ready, false);
  assert.equal(target._attrs['data-wdu-ready'], undefined);
});

test('stable frame marker does not fire when assets are not ready', () => {
  const target = {
    _attrs: {} as Record<string, string>,
    setAttribute(name: string, value: string) {
      this._attrs[name] = value;
    },
    removeAttribute(name: string) {
      delete this._attrs[name];
    },
  };
  const marker = createStableFrameMarker({
    target: target as unknown as Element,
    stableFrame: 1,
  });

  // Frame 5 but assets not ready
  marker.afterVisibleRender({
    frame: 5,
    assetsReady: false,
    cameraStationApplied: true,
    streamsInitialized: true,
  });
  assert.equal(marker.ready, false);
  assert.equal(target._attrs['data-wdu-ready'], undefined);
});