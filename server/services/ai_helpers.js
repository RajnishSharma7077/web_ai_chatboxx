// Helper exports derived from ai.js so preprocessor can reuse patterns and categorisation

const expenseCategories = {
  food: ['food', 'meal', 'groceries', 'restaurant', 'coffee', 'snacks'],
  travel: ['travel', 'fuel', 'bus', 'flight', 'uber', 'rail', 'train', 'taxi'],
  bills: ['rent', 'electricity', 'wifi', 'internet', 'water', 'phone', 'bills', 'utility'],
  shopping: ['shopping', 'clothes', 'electronics', 'gadget', 'apparel'],
  entertainment: ['movie', 'streaming', 'games', 'music', 'party', 'subscription'],
  health: ['medicine', 'health', 'doctor', 'gym', 'fitness'],
  education: ['course', 'book', 'study', 'tuition', 'learning']
};

export const categoriseExpense = (text) => {
  const lowerText = (text || '').toLowerCase();

  for (const [category, keywords] of Object.entries(expenseCategories)) {
    if (keywords.some((keyword) => lowerText.includes(keyword))) {
      return category;
    }
  }

  return 'miscellaneous';
};

export const detectIntent = (text) => {
  const lower = (text || '').toLowerCase();
  const financeKeywords = ['finance', 'money', 'budget', 'expense', 'spend', 'save', 'income'];
  const studyKeywords = ['study', 'learn', 'dsa', 'algorithm', 'programming', 'javascript', 'python', 'sql', 'dbms', 'statistics', 'database', 'code', 'debug', 'binary search'];

  const financeMatches = financeKeywords.some((keyword) => lower.includes(keyword));
  const studyMatches = studyKeywords.some((keyword) => lower.includes(keyword));

  if (financeMatches && studyMatches) return 'hybrid';
  if (financeMatches) return 'finance';
  if (studyMatches) return 'study';
  return 'general';
};

export const moneyPattern = /(\d+(?:\.\d+)?)\s*(?:on|for|spent|cost|expense|paid|buying)?\s*(.*)/i;
