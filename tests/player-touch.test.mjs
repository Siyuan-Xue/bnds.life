import assert from "node:assert/strict";
import test from "node:test";
import { interpretVideoTap } from "../src/lib/player-touch.ts";

test("double tap in the left or right third seeks ten seconds", () => {
  const left = interpretVideoTap(null, 0.2, 1000);
  assert.equal(left.action, "controls");
  const rewind = interpretVideoTap(left.nextTap, 0.23, 1250);
  assert.equal(rewind.action, "back");
  assert.equal(rewind.nextTap, null);

  const right = interpretVideoTap(null, 0.8, 2000);
  assert.equal(interpretVideoTap(right.nextTap, 0.9, 2250).action, "forward");
});

test("single, delayed and cross-side taps only reveal controls", () => {
  const first = interpretVideoTap(null, 0.1, 1000);
  assert.equal(interpretVideoTap(first.nextTap, 0.1, 1400).action, "controls");
  assert.equal(interpretVideoTap(first.nextTap, 0.9, 1100).action, "controls");
  assert.equal(interpretVideoTap(first.nextTap, 0.5, 1100).action, "controls");
});
