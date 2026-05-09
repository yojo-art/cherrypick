
const STATUSES = ['none', 'running', 'success', 'error'] as const;
export type TranslateStatus = typeof STATUSES[number];
