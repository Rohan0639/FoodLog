/**
 * Reusable date manipulation utility functions.
 */

export const getCurrentDate = (): Date => {
  return new Date();
};

export const getCurrentIsoString = (): string => {
  return new Date().toISOString();
};

export const getLocalIsoDate = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseLocalDateString = (timestamp: string): string => {
  if (!timestamp || typeof timestamp !== 'string') {
    return getLocalIsoDate();
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
    return timestamp;
  }
  try {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      return getLocalIsoDate(d);
  } catch {
    // Fallback to raw parsing
  }
  return timestamp.split('T')[0] || getLocalIsoDate();
};
