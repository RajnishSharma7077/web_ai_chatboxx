import { moneyPattern, categoriseExpense, detectIntent } from './ai_helpers.js';
import { assistantGuidelines } from './kb.js';

// Small knowledge base for common study topics (medium-depth)
const studyKB = {
  'binary search': `### Binary Search — medium example (JavaScript)

Binary search finds the index of a target value in a sorted array in O(log n).

Example (iterative):

<pre><code class="language-javascript">function binarySearch(arr, target) {\n  let left = 0;\n  let right = arr.length - 1;\n  while (left <= right) {\n    const mid = Math.floor((left + right) / 2);\n    if (arr[mid] === target) return mid;\n    if (arr[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}\n</code></pre>`,
};

// fallback medium-depth JS example for binary search
const binarySearchExample = `### Binary Search — medium example (JavaScript)

Binary search finds a target in a sorted array in O(log n). Here's a clear iterative implementation with comments and an example:

<pre><code class="language-javascript">function binarySearch(arr, target) {\n  let left = 0;\n  let right = arr.length - 1;\n  while (left <= right) {\n    const mid = Math.floor((left + right) / 2);\n    if (arr[mid] === target) return mid; // found\n    if (arr[mid] < target) left = mid + 1; // go right\n    else right = mid - 1; // go left\n  }\n  return -1; // not found\n}\n\n// Example\nconst arr = [1,2,3,4,5,7,9];\nconsole.log(binarySearch(arr, 4)); // 3\n</code></pre>

Explanation:\n- Keep left/right pointers and compare the middle element.\n- Each step halves the search space → O(log n).\n- Works only on sorted arrays.\n`;

export const runPreprocessor = ({ message }) => {
  const text = (message || '').trim();
  const lower = text.toLowerCase();

  // 1) Expense parsing: exact-capture for patterns like "I spent 500 on food"
  const moneyMatch = text.match(moneyPattern);
  if (moneyMatch) {
    const amount = Number(moneyMatch[1]);
    const label = (moneyMatch[2] || '').trim();
    const category = label ? categoriseExpense(label) : 'miscellaneous';

    const reply = [
      '### Quick finance capture',
      `- I recorded an expense of $${amount} in the *${category}* category.`,
      '- Tip: Add this to your monthly budget and mark whether it was essential or optional.',
      '',
      'Short plan:',
      '1) Log similar spends for 7 days\n2) Set a weekly cap for non-essential items\n3) Automate a small transfer to savings'
    ].join('\n');

    return { handled: true, response: reply, meta: { intent: 'finance', amount, category } };
  }

  // 2) Study KB: exact matches for common technical topics
  if (lower.includes('binary search')) {
    return { handled: true, response: binarySearchExample, meta: { intent: 'study', topic: 'binary search' } };
  }

  // Prefix sum / cumulative sum medium-depth example
  if (lower.includes('prefix sum') || lower.includes('prefix-sum') || lower.includes('prefix sums') || lower.includes('cumulative sum')) {
    const prefixExample = `### Prefix Sum (Cumulative Sum) — explanation + examples\n\nWhat it is:\n- Prefix sum transforms an array into cumulative sums so you can answer range-sum queries in O(1) after O(n) preprocessing.\n\nHow to build (shifted form, recommended):\n\n- Let P be an array of length n+1 where P[0]=0. For i from 0..n-1: P[i+1] = P[i] + a[i].\n- Then sum(l, r) = P[r+1] - P[l] (0-based indices, r inclusive).\n\nJavaScript example (clear):\n\n<pre><code class="language-javascript">function buildPrefix(a) {\n  const P = new Array(a.length + 1).fill(0);\n  for (let i = 0; i < a.length; i++) P[i+1] = P[i] + a[i];\n  return P;\n}\n\nfunction rangeSum(P, l, r) {\n  if (l > r) return 0;\n  return P[r+1] - P[l];\n}\n\nconst a = [1,2,3,4,5];\nconst P = buildPrefix(a);\nconsole.log(rangeSum(P, 1, 3)); // 2+3+4 = 9\n</code></pre>\n\nPython example:\n\n<pre><code class="language-python">def build_prefix(a):\n    n = len(a)\n    P = [0] * (n + 1)\n    for i in range(n):\n        P[i+1] = P[i] + a[i]\n    return P\n\ndef range_sum(P, l, r):\n    if l > r:\n        return 0\n    return P[r+1] - P[l]\n\n# Example\na = [1,2,3,4,5]\nP = build_prefix(a)\nprint(range_sum(P, 1, 3))  # 9\n</code></pre>\n\nCommon pitfalls (why solutions "don't work"):\n- Off-by-one: using P[r] instead of P[r+1] or mixing shifted/unshifted forms.\n- 1-based vs 0-based indices in input — adjust accordingly.\n- Forgetting to set P[0] = 0.\n- Not using BIT/Segment tree when array needs updates (prefix sums are static).\n- Integer overflow in low-level languages for large sums.\n\nQuick debug checklist:\n1) Print P for small arrays (e.g., a=[1,2,3] → P=[0,1,3,6]).\n2) Test sum(0,0), sum(0,n-1), sum(l,l).\n3) Verify input indices base (1-based vs 0-based).\n4) Add assertions for 0 <= l <= r < n.\n\nIf you want, I can also return a ready-to-run test harness in your chat window that runs sample cases and explains mistakes step-by-step.`;
    return { handled: true, response: prefixExample, meta: { intent: 'study', topic: 'prefix sum' } };
  }

  // 3) Direct 'explain X' pattern — treat as study but not in KB
  const explainMatch = lower.match(/(?:explain|what is|how does)\s+(.+)/);
  if (explainMatch) {
    const topic = explainMatch[1].trim();
    const short = `### Explanation (short) — ${topic}\n\nI can explain ${topic} step-by-step. Do you want a plain-language overview, a medium-level example, or a detailed deep-dive?`;
    return { handled: true, response: short, meta: { intent: 'study', topic } };
  }

  // 4) Intent-based deterministic guidance using the assistant guidelines
  const intent = detectIntent(text);
  if (intent === 'finance') {
    const category = (text.match(moneyPattern) && text.match(moneyPattern)[2]) ? categoriseExpense(text.match(moneyPattern)[2]) : 'general';
    const reply = [
      '### Finance guidance',
      `- Detected intent: finance (category: ${category}).`,
      "- I can help even without numbers — tell me about habits, recurring spends, or goals.",
      '- Practical steps:',
      '  1. Identify top 3 spending categories.',
      '  2. Set simple rules: weekly cap, no-spend days, automate savings.',
      '  3. Revisit after 7 days and adjust.'
    ].join('\n');

    return { handled: true, response: reply, meta: { intent: 'finance', category } };
  }

  if (intent === 'study') {
    const reply = [
      '### Study guidance',
      '- Detected intent: study.',
      "- I will explain concept step-by-step, start simple then go deeper.",
      '- Try: ask for a medium-level example or request a code snippet and I will include one.'
    ].join('\n');

    return { handled: true, response: reply, meta: { intent: 'study' } };
  }

  if (intent === 'hybrid') {
    const reply = [
      '### Hybrid guidance',
      '- I detected mixed intent (productivity/finance/study).',
      '- Quick plan:',
      '  1. Identify time and money leaks.',
      '  2. Create a small action (e.g., 30-minute focused study, limit impulse buys).',
      '  3. Review results in a week.'
    ].join('\n');

    return { handled: true, response: reply, meta: { intent: 'hybrid' } };
  }

  // Nothing handled
  return { handled: false };
};
