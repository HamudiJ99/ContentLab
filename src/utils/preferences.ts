// Nutzer-Einstellungen, die lokal (localStorage) gehalten werden.

export const CONFIRM_DELETE_KEY = 'confirmDelete';

// Standard: Löschen muss bestätigt werden. In den Einstellungen abschaltbar.
export const isConfirmDeleteEnabled = (): boolean => {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(CONFIRM_DELETE_KEY) !== 'false';
};
