import assert from 'node:assert/strict';
import test from 'node:test';
import { isPlaybackShortcut } from '../src/lib/shortcuts.ts';

test('浏览器组合快捷键和已处理事件不能触发播放操作', () => {
  const plain = { ctrlKey:false, metaKey:false, altKey:false, defaultPrevented:false };
  assert.equal(isPlaybackShortcut(plain), true);
  for (const key of ['ctrlKey','metaKey','altKey','defaultPrevented']) {
    assert.equal(isPlaybackShortcut({...plain,[key]:true}), false, key);
  }
});
