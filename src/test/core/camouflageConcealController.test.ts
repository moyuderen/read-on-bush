import * as assert from 'assert';
import { CamouflageConcealController } from '../../core/display/camouflageConcealController';

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
});
