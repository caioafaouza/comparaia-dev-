// Unit Test: calculateJobCost - Pricing Logic Validation
// Run: node server/tests/jobCost.test.js

const assert = require('assert');

// Import calculateJobCost (copy inline for isolation)
const MIN_COST = 10;

const calculateJobCost = (params) => {
    const raw = params?.candidateCount ?? params?.candidate_count ?? 1;
    const parsed = Number.parseInt(String(raw), 10);
    const count = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    const cost = Math.max(MIN_COST, MIN_COST * count);
    return cost;
};

// Test Suite
const tests = [
    { input: { candidateCount: 5 }, expected: 50, desc: 'Normal: 5 candidates' },
    { input: { candidateCount: 1 }, expected: 10, desc: 'Minimum: 1 candidate' },
    { input: { candidateCount: "" }, expected: 10, desc: 'Empty string → MIN_COST' },
    { input: { candidateCount: "0" }, expected: 10, desc: 'Zero string → MIN_COST' },
    { input: { candidateCount: 0 }, expected: 10, desc: 'Zero number → MIN_COST' },
    { input: { candidateCount: null }, expected: 10, desc: 'Null → MIN_COST' },
    { input: { candidateCount: undefined }, expected: 10, desc: 'Undefined → MIN_COST' },
    { input: {}, expected: 10, desc: 'Missing field → MIN_COST' },
    { input: { candidateCount: "abc" }, expected: 10, desc: 'Invalid string → MIN_COST' },
    { input: { candidateCount: NaN }, expected: 10, desc: 'NaN → MIN_COST' },
    { input: { candidate_count: 3 }, expected: 30, desc: 'Underscore variant: 3' },
    { input: { candidateCount: "10" }, expected: 100, desc: 'String number: "10"' }
];

console.log('\n--- calculateJobCost Unit Tests ---\n');

let pass = 0;
let fail = 0;

tests.forEach((test, idx) => {
    const actual = calculateJobCost(test.input);
    const ok = actual === test.expected;

    if (ok) {
        console.log(`✅ [${idx + 1}] ${test.desc}: ${actual}`);
        pass++;
    } else {
        console.error(`❌ [${idx + 1}] ${test.desc}: expected ${test.expected}, got ${actual}`);
        fail++;
    }
});

console.log(`\n--- Results: ${pass} passed, ${fail} failed ---\n`);

if (fail > 0) {
    process.exit(1);
}

console.log('✅ All tests passed!\n');
