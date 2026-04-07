const KEY = 'promethee_mentor_live_screen';

export function getMentorLiveScreenEveryMessage(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setMentorLiveScreenEveryMessage(enabled: boolean): void {
  try {
    localStorage.setItem(KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}
