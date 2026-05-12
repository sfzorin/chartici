import assert from 'assert';
import { getFittedText, tokenizeWrapWords } from '../utils/textUtils.js';
import { test, summary } from './testRunner.mjs';

console.log('\n🔤 Node Text Wrapping');

globalThis.document = {
  createElement() {
    return {
      getContext() {
        return {
          font: '',
          measureText(text) {
            const size = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] || 12);
            return { width: String(text).length * size * 0.6 };
          },
        };
      },
    };
  },
};

test('Node text treats hyphens as soft wrap points', () => {
  const tokens = tokenizeWrapWords('Over-compression risk').map(token => token.text);
  assert.deepEqual(tokens, ['Over-', 'compression', 'risk']);

  const wrapped = getFittedText('Over-compression risk', 96, 80, 14, 'normal', 700);
  if (!wrapped.lines.includes('Over-') || !wrapped.lines.includes('compression')) {
    throw new Error(`expected hyphenated word to wrap without shrinking: ${wrapped.lines.join(' / ')} @ ${wrapped.fontSize}`);
  }
  if (wrapped.fontSize < 12) {
    throw new Error(`expected hyphen wrapping to preserve readable font size, got ${wrapped.fontSize}`);
  }
});

summary('engine.text.test.mjs');
