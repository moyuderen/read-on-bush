import * as assert from 'assert';
import { CamouflageConcealController } from '../../presentation/readerControls/ConcealController';

suite('CamouflageConcealController', () => {
  test('reset fires reveal when it leaves concealed mode', () => {
    let revealCount = 0;
    const controller = new CamouflageConcealController({
      render: () => undefined,
      stop: () => undefined,
      onReveal: () => revealCount++
    });

    controller.toggleDebugContent();
    controller.reset();

    assert.strictEqual(revealCount, 1);
    assert.strictEqual(controller.isRealContentMode(), true);
  });

  test('clearing pending quit keeps the next q from stopping', () => {
    let stopCount = 0;
    const controller = new CamouflageConcealController({
      render: () => undefined,
      stop: () => stopCount++
    });

    controller.handleQuitKey();
    controller.clearPendingQuit();
    controller.handleQuitKey();

    assert.strictEqual(stopCount, 0);
    assert.strictEqual(controller.mode, 'debugTemplate');
    controller.clearPendingQuit();
  });

  test('conceal with auto origin switches to debug and fires conceal', () => {
    let concealCount = 0;
    const controller = new CamouflageConcealController({
      render: () => undefined,
      stop: () => undefined,
      onConceal: () => concealCount++
    });

    const result = controller.conceal('auto');

    assert.strictEqual(result, true);
    assert.strictEqual(controller.mode, 'debugTemplate');
    assert.strictEqual(controller.concealOrigin, 'auto');
    assert.strictEqual(concealCount, 1);
  });

  test('conceal is idempotent and preserves existing origin', () => {
    const controller = new CamouflageConcealController({
      render: () => undefined,
      stop: () => undefined
    });

    controller.conceal('auto');
    const result = controller.conceal('manual');

    assert.strictEqual(result, false);
    assert.strictEqual(controller.concealOrigin, 'auto');
  });

  test('reveal with auto filter reveals auto-origin conceal', () => {
    const controller = new CamouflageConcealController({
      render: () => undefined,
      stop: () => undefined
    });

    controller.conceal('auto');
    const result = controller.reveal('auto');

    assert.strictEqual(result, true);
    assert.strictEqual(controller.isRealContentMode(), true);
    assert.strictEqual(controller.concealOrigin, undefined);
  });

  test('reveal with auto filter does NOT reveal manual-origin conceal', () => {
    const controller = new CamouflageConcealController({
      render: () => undefined,
      stop: () => undefined
    });

    controller.toggleDebugContent();
    assert.strictEqual(controller.concealOrigin, 'manual');

    const result = controller.reveal('auto');

    assert.strictEqual(result, false);
    assert.strictEqual(controller.mode, 'debugTemplate');
    assert.strictEqual(controller.concealOrigin, 'manual');
  });

  test('reveal without filter always reveals', () => {
    const controller = new CamouflageConcealController({
      render: () => undefined,
      stop: () => undefined
    });

    controller.toggleDebugContent();
    const result = controller.reveal();

    assert.strictEqual(result, true);
    assert.strictEqual(controller.isRealContentMode(), true);
  });

  test('auto conceal after manual conceal preserves manual origin', () => {
    const controller = new CamouflageConcealController({
      render: () => undefined,
      stop: () => undefined
    });

    controller.toggleDebugContent();
    assert.strictEqual(controller.concealOrigin, 'manual');

    const result = controller.conceal('auto');

    assert.strictEqual(result, false);
    assert.strictEqual(controller.concealOrigin, 'manual');
  });

  test('quit key sets manual origin', () => {
    const controller = new CamouflageConcealController({
      render: () => undefined,
      stop: () => undefined
    });

    controller.handleQuitKey();

    assert.strictEqual(controller.mode, 'debugTemplate');
    assert.strictEqual(controller.concealOrigin, 'manual');
    controller.clearPendingQuit();
  });

  test('quit key upgrades auto origin to manual', () => {
    const controller = new CamouflageConcealController({
      render: () => undefined,
      stop: () => undefined
    });

    controller.conceal('auto');
    assert.strictEqual(controller.concealOrigin, 'auto');

    controller.handleQuitKey();

    assert.strictEqual(controller.mode, 'debugTemplate');
    assert.strictEqual(controller.concealOrigin, 'manual');
    controller.clearPendingQuit();
  });
});
