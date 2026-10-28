// Static content: categories, goal templates, challenges, room items, badges.

export const CATEGORIES = [
  { id: 'food', label: 'Food & drink', emoji: '🍔', color: '#ff8a5b' },
  { id: 'groceries', label: 'Groceries', emoji: '🛒', color: '#7bc96f' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️', color: '#f06595' },
  { id: 'transport', label: 'Transport', emoji: '🚗', color: '#4dabf7' },
  { id: 'home', label: 'Home & rent', emoji: '🏠', color: '#9775fa' },
  { id: 'bills', label: 'Bills & utilities', emoji: '💡', color: '#fab005' },
  { id: 'subscriptions', label: 'Subscriptions', emoji: '📺', color: '#e64980' },
  { id: 'fun', label: 'Fun & going out', emoji: '🎉', color: '#20c997' },
  { id: 'health', label: 'Health', emoji: '💊', color: '#38d9a9' },
  { id: 'tech', label: 'Tech', emoji: '📱', color: '#5c7cfa' },
  { id: 'clothes', label: 'Clothes', emoji: '👕', color: '#ff922b' },
  { id: 'gifts', label: 'Gifts', emoji: '🎁', color: '#da77f2' },
  { id: 'travel', label: 'Travel', emoji: '✈️', color: '#3bc9db' },
  { id: 'education', label: 'Education', emoji: '📚', color: '#94d82d' },
  { id: 'other', label: 'Other', emoji: '📦', color: '#adb5bd' },
];

export const INCOME_CATEGORIES = [
  { id: 'paycheck', label: 'Paycheck', emoji: '💼', color: '#2bb673' },
  { id: 'side', label: 'Side hustle', emoji: '🛠️', color: '#12b886' },
  { id: 'allowance', label: 'Allowance', emoji: '🪙', color: '#82c91e' },
  { id: 'gift-in', label: 'Gift', emoji: '🎁', color: '#40c057' },
  { id: 'refund', label: 'Refund', emoji: '↩️', color: '#69db7c' },
  { id: 'other-in', label: 'Other income', emoji: '💰', color: '#8ce99a' },
];

const ALL = [...CATEGORIES, ...INCOME_CATEGORIES];
export const category = (id) => ALL.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

export const GOAL_TEMPLATES = [
  { name: 'Emergency fund', emoji: '🛟', target: 5000 },
  { name: 'Travel', emoji: '✈️', target: 2500 },
  { name: 'New car', emoji: '🚗', target: 8000 },
  { name: 'Home', emoji: '🏡', target: 20000 },
  { name: 'Debt payoff', emoji: '⛓️', target: 3000 },
  { name: 'New phone', emoji: '📱', target: 1000 },
  { name: 'Education', emoji: '🎓', target: 4000 },
  { name: 'Wedding', emoji: '💍', target: 10000 },
  { name: 'Gifts', emoji: '🎁', target: 600 },
  { name: 'Retirement', emoji: '🌴', target: 25000 },
];

export const GOAL_EMOJIS = ['🎯', '🛟', '✈️', '🚗', '🏡', '⛓️', '📱', '💻', '🎓', '💍', '🎁', '🌴', '🐶', '🎮', '🎸', '👶', '🏖️', '🏋️', '📷', '🚲'];

export const CHALLENGES = [
  'No takeout today. Cook something instead.',
  'Skip the coffee shop. Make it at home.',
  "Don't open a shopping app all day.",
  'Spend nothing that isn’t a bill or groceries.',
  'Find one subscription you can cancel.',
  'Pack lunch for tomorrow.',
  'Move one item from your cart to the cooldown list.',
  'Unsubscribe from three store email lists.',
  'Put the cost of one treat into a savings goal instead.',
  'Walk or bike one trip you would usually drive.',
  'Use something you already own instead of buying new.',
  'Plan tomorrow’s meals from what’s in the fridge.',
  'Sell or list one thing you don’t use.',
  'Fill one envelope in the 100 Envelope Challenge.',
  'Write down every purchase today, even small ones.',
  'Have a free fun night: games, a walk, a library book.',
  'Check your bank account and tag any surprise charges.',
  'Make a shopping list and buy only what’s on it.',
  'No snacks or drinks from vending machines or gas stations.',
  'Wait 24 hours before any purchase over $20.',
];

// Room decorations for the mascot. Each sits in one slot; placing one swaps out the last.
export const ROOM_ITEMS = [
  { id: 'wall-mint', slot: 'wall', name: 'Mint walls', cost: 40, color: '#cdeedd' },
  { id: 'wall-sky', slot: 'wall', name: 'Sky walls', cost: 40, color: '#cfe4ff' },
  { id: 'wall-peach', slot: 'wall', name: 'Peach walls', cost: 40, color: '#ffe0cc' },
  { id: 'wall-lilac', slot: 'wall', name: 'Lilac walls', cost: 60, color: '#e6dcff' },
  { id: 'wall-night', slot: 'wall', name: 'Starry walls', cost: 120, color: '#2b2d5c' },
  { id: 'rug-red', slot: 'rug', name: 'Red rug', cost: 30, color: '#ef6b6b' },
  { id: 'rug-teal', slot: 'rug', name: 'Teal rug', cost: 30, color: '#3fb8af' },
  { id: 'rug-gold', slot: 'rug', name: 'Gold rug', cost: 80, color: '#f2b631' },
  { id: 'window', slot: 'window', name: 'Sunny window', cost: 100, emoji: '🪟' },
  { id: 'painting', slot: 'wallLeft', name: 'Painting', cost: 60, emoji: '🖼️' },
  { id: 'rainbow', slot: 'wallLeft', name: 'Rainbow', cost: 150, emoji: '🌈' },
  { id: 'clock', slot: 'wallRight', name: 'Wall clock', cost: 80, emoji: '🕰️' },
  { id: 'calendar', slot: 'wallRight', name: 'Calendar', cost: 50, emoji: '📅' },
  { id: 'lamp', slot: 'ceiling', name: 'Hanging lamp', cost: 40, emoji: '💡' },
  { id: 'disco', slot: 'ceiling', name: 'Disco ball', cost: 220, emoji: '🪩' },
  { id: 'plant', slot: 'floorLeft', name: 'Plant', cost: 50, emoji: '🪴' },
  { id: 'guitar', slot: 'floorLeft', name: 'Guitar', cost: 140, emoji: '🎸' },
  { id: 'aquarium', slot: 'floorLeft', name: 'Fish tank', cost: 180, emoji: '🐠' },
  { id: 'couch', slot: 'floorRight', name: 'Couch', cost: 120, emoji: '🛋️' },
  { id: 'teddy', slot: 'floorRight', name: 'Teddy bear', cost: 60, emoji: '🧸' },
  { id: 'piano', slot: 'floorRight', name: 'Piano', cost: 260, emoji: '🎹' },
  { id: 'books', slot: 'shelf', name: 'Books', cost: 50, emoji: '📚' },
  { id: 'trophy', slot: 'shelf', name: 'Trophy', cost: 200, emoji: '🏆' },
  { id: 'cactus', slot: 'shelf', name: 'Tiny cactus', cost: 30, emoji: '🌵' },
  { id: 'bow', slot: 'hat', name: 'Bow', cost: 40, emoji: '🎀' },
  { id: 'cap', slot: 'hat', name: 'Cap', cost: 70, emoji: '🧢' },
  { id: 'tophat', slot: 'hat', name: 'Top hat', cost: 150, emoji: '🎩' },
  { id: 'crown', slot: 'hat', name: 'Crown', cost: 500, emoji: '👑' },
];

export const roomItem = (id) => ROOM_ITEMS.find((i) => i.id === id);

export const SLOT_LABELS = {
  wall: 'Walls', rug: 'Rug', window: 'Window', wallLeft: 'Left wall', wallRight: 'Right wall',
  ceiling: 'Ceiling', floorLeft: 'Floor (left)', floorRight: 'Floor (right)', shelf: 'Shelf', hat: 'Hat',
};

// Badges, checked after every change. Each test gets derived numbers from achievementFacts().
export const ACHIEVEMENTS = [
  { id: 'first-bye', emoji: '👋', name: 'First bye', desc: 'Skip your first purchase.', points: 20, test: (f) => f.skipCount >= 1 },
  { id: 'bye-10', emoji: '🙅', name: 'Ten byes', desc: 'Skip 10 purchases.', points: 50, test: (f) => f.skipCount >= 10 },
  { id: 'saved-100', emoji: '💵', name: 'First hundred', desc: 'Save 100 by skipping buys.', points: 40, test: (f) => f.saved >= 100 },
  { id: 'saved-1000', emoji: '💰', name: 'Big saver', desc: 'Save 1,000 by skipping buys.', points: 150, test: (f) => f.saved >= 1000 },
  { id: 'hours-40', emoji: '⏳', name: 'Week reclaimed', desc: 'Skip a full work week of purchases.', points: 120, test: (f) => f.hoursSaved >= 40 },
  { id: 'streak-3', emoji: '🔥', name: 'Three-day streak', desc: '3 no-buy days in a row.', points: 30, test: (f) => f.bestStreak >= 3 },
  { id: 'streak-7', emoji: '🌟', name: 'No-buy week', desc: '7 no-buy days in a row.', points: 80, test: (f) => f.bestStreak >= 7 },
  { id: 'envelopes-10', emoji: '✉️', name: 'Envelope stuffer', desc: 'Fill 10 envelopes.', points: 40, test: (f) => f.envelopes >= 10 },
  { id: 'envelopes-100', emoji: '📬', name: 'Challenge complete', desc: 'Fill all 100 envelopes.', points: 500, test: (f) => f.envelopes >= 100 },
  { id: 'goal-done', emoji: '🎯', name: 'Goal reached', desc: 'Fully fund a savings goal.', points: 100, test: (f) => f.goalsDone >= 1 },
  { id: 'cooldown-skip', emoji: '🧊', name: 'Cooled off', desc: 'Skip something after a cooldown.', points: 30, test: (f) => f.cooldownSkips >= 1 },
  { id: 'challenges-5', emoji: '🎲', name: 'Challenger', desc: 'Complete 5 daily challenges.', points: 60, test: (f) => f.challengesDone >= 5 },
  { id: 'block-done', emoji: '🛡️', name: 'Held the line', desc: 'Finish a Shop Block.', points: 40, test: (f) => f.blocksDone >= 1 },
  { id: 'under-budget', emoji: '📉', name: 'Under budget', desc: 'Finish a month under budget.', points: 100, test: (f) => f.monthsUnder >= 1 },
];

export const COOLDOWN_OPTIONS = [
  { hours: 1, label: '1 hour' },
  { hours: 24, label: '24 hours' },
  { hours: 48, label: '2 days' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '1 week' },
  { hours: 720, label: '30 days' },
];

export const BLOCK_OPTIONS = [
  { hours: 1, label: '1 hour' },
  { hours: 6, label: '6 hours' },
  { hours: 24, label: '1 day' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '1 week' },
];
