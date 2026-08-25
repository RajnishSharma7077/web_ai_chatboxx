const financeKeywords = [
  'finance', 'money', 'budget', 'expense', 'spend', 'save', 'income', 'bank', 'wallet',
  'payment', 'loan', 'credit', 'debt', 'cash', 'cost', 'invest', 'travel', 'shopping',
  'food', 'rent', 'bills', 'subscription'
];

const studyKeywords = [
  'study', 'learn', 'dsa', 'algorithm', 'programming', 'javascript', 'python', 'sql',
  'dbms', 'statistics', 'database', 'code', 'debug', 'data structure', 'graph', 'heap',
  'tree', 'array', 'linked list', 'recursion', 'binary search'
];

const expenseCategories = {
  food: ['food', 'meal', 'groceries', 'restaurant', 'coffee', 'snacks'],
  travel: ['travel', 'fuel', 'bus', 'flight', 'uber', 'rail', 'train', 'taxi'],
  bills: ['rent', 'electricity', 'wifi', 'internet', 'water', 'phone', 'bills', 'utility'],
  shopping: ['shopping', 'clothes', 'electronics', 'gadget', 'apparel'],
  entertainment: ['movie', 'streaming', 'games', 'music', 'party', 'subscription'],
  health: ['medicine', 'health', 'doctor', 'gym', 'fitness'],
  education: ['course', 'book', 'study', 'tuition', 'learning']
};

const categoriseExpense = (text) => {
  const lowerText = text.toLowerCase();

  for (const [category, keywords] of Object.entries(expenseCategories)) {
    if (keywords.some((keyword) => lowerText.includes(keyword))) {
      return category;
    }
  }

  return 'miscellaneous';
};

const detectIntent = (text) => {
  const lower = text.toLowerCase();
  const financeMatches = financeKeywords.some((keyword) => lower.includes(keyword));
  const studyMatches = studyKeywords.some((keyword) => lower.includes(keyword));

  if (financeMatches && studyMatches) return 'hybrid';
  if (financeMatches) return 'finance';
  if (studyMatches) return 'study';
  return 'general';
};

const moneyPattern = /(\d+(?:\.\d+)?)\s*(?:on|for|spent|cost|expense|paid|buying)?\s*(.*)/i;

export const generateAssistantReply = ({ message, context = [], user = { name: 'Guest' } }) => {
  const intent = detectIntent(message);
  const normalizedMessage = message.trim();
  const lowerMessage = normalizedMessage.toLowerCase();
  const match = normalizedMessage.match(moneyPattern);
  const amount = match ? Number(match[1]) : null;
  const label = match ? match[2].trim() : '';
  const category = amount && label ? categoriseExpense(label) : null;

  if (intent === 'finance' || intent === 'hybrid') {
    const insightLines = [
      '### Finance guidance',
      '- Review your spending by category and look for recurring leaks.',
      '- Keep a 50/30/20 split in mind for essentials, lifestyle, and savings.',
      '- Automate a small transfer to savings right after payday.'
    ];

    if (amount && category) {
      insightLines.push(`- I detected a spending entry of $${amount} in the ${category} category.`);
      insightLines.push('- Consider tracking this against your monthly budget and checking whether it is essential or impulsive.');
    }

    const extra = intent === 'hybrid' ? ['- If this from a study/productivity angle, try limiting distractions before the next spend trigger.'] : [];

    return [
      ...insightLines,
      ...extra,
      '',
      '### Quick plan',
      '1. Identify the top 3 categories of your recent spending.',
      '2. Set a weekly cap for non-essential spending.',
      '3. Review your progress every 7 days and adjust.',
      '',
      `You can say: “I spent $150 on food” or “How can I save more?”` 
    ].join('\n');
  }

  if (intent === 'study' || intent === 'hybrid') {
    const studyPrompt = `${lowerMessage.includes('dsa') || lowerMessage.includes('algorithm') ? '### DSA strategy\n- Start from the core idea, then derive the pattern.\n- Work through small examples before looking at the optimised solution.\n- Validate complexity after you find a working approach.' : '### Study strategy\n- Start with the concept in plain language.\n- Learn the working logic with 1–2 examples.\n- Then go deeper into edge cases and complexity.'}`;

    return `${studyPrompt}\n\n- Explain the topic step by step, not just the final answer.\n- Connect each concept to a real example or code snippet.\n- If you want, I can help with a specific algorithm, DBMS concept, or coding interview problem.`;
  }

  const contextSummary = context.length ? `Recent context: ${context.slice(-2).map((entry) => entry.content).join(' | ')}` : 'No prior context yet.';

  return [
    '### General help',
    `Hi ${user.name || 'there'} — I can help with either finance or study questions.`,
    '- Ask for a budget check, a learning roadmap, or a coding explanation.',
    '- I can also combine both if your goal is productivity and money management.',
    '',
    contextSummary
  ].join('\n');
};
