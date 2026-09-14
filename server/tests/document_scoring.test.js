// Unit Test: document scoring guardrails
// Run: node server/tests/document_scoring.test.js

const assert = require('assert');

const parseNumberList = (value) => {
  if (!value) return [];
  const normalized = String(value).replace(/\./g, '').replace(/,/g, '.');
  const matches = normalized.match(/-?\d+(?:\.\d+)?/g);
  if (!matches) return [];
  return matches.map((v) => Number(v)).filter((n) => Number.isFinite(n));
};

const parseNumericRange = (value) => {
  const nums = parseNumberList(value);
  if (!nums.length) return null;
  if (nums.length >= 2) {
    return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
  }
  return { value: nums[0] };
};

const scoreNumeric = (baselineValue, candidateValue) => {
  const baseline = parseNumericRange(baselineValue);
  const candidate = parseNumericRange(candidateValue);
  if (!baseline || !candidate) return { score: 0 };
  const candidateVal = candidate.value ?? candidate.min ?? candidate.max;
  if (baseline.min !== undefined || baseline.max !== undefined) {
    const min = baseline.min ?? -Infinity;
    const max = baseline.max ?? Infinity;
    if (candidateVal >= min && candidateVal <= max) return { score: 100 };
    return { score: 50 };
  }
  if (baseline.value !== undefined) {
    const diff = Math.abs(candidateVal - baseline.value);
    return { score: diff <= Math.max(1, baseline.value * 0.15) ? 80 : 0 };
  }
  return { score: 0 };
};

const scoreCategorical = (baselineValue, candidateValue) => {
  if (!baselineValue || !candidateValue) return { score: 0 };
  return baselineValue.trim().toLowerCase() === candidateValue.trim().toLowerCase()
    ? { score: 100 }
    : { score: 0 };
};

console.log('\n--- document_scoring.test.js ---\n');

const numeric = scoreNumeric('100 V', '95 V');
assert.ok(numeric.score <= 100 && numeric.score >= 50, 'score numerico deve refletir proximidade');

const cat = scoreCategorical('cobre', 'cobre');
assert.strictEqual(cat.score, 100, 'score categorico exato deve ser 100');

console.log('OK: guardrails basicos validados.\n');
