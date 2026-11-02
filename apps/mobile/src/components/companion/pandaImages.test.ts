import { pandaExpressionImage, pandaStageImage } from './pandaImages';

describe('images du panda : variante (D-106)', () => {
  it('« girl » sans image propre retombe sur « boy »', () => {
    for (const st of [1, 2, 3, 4] as const) expect(pandaStageImage(st, 'small', 'girl')).toBe(pandaStageImage(st, 'small', 'boy'));
    expect(pandaExpressionImage('fier', 'full', 'girl')).toBe(pandaExpressionImage('fier', 'full'));
    expect(pandaExpressionImage('surpris')).toBeDefined();
  });
});
