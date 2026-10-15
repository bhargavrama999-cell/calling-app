/**
 * Helper to generate unique session IDs and detect device type / platform.
 */

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'server_session';

  const STORAGE_KEY = 'calling_app_device_session_id';
  let sessionId = localStorage.getItem(STORAGE_KEY);

  if (!sessionId) {
    const randomHex = Math.random().toString(36).substring(2, 8);
    sessionId = `dev_${Date.now().toString(36)}_${randomHex}`;
    localStorage.setItem(STORAGE_KEY, sessionId);
  }

  return sessionId;
}

export function detectDeviceDetails(): { deviceType: string; suggestedName: string } {
  if (typeof window === 'undefined') {
    return { deviceType: 'Server', suggestedName: 'Server Device' };
  }

  const ua = navigator.userAgent;
  let type = 'Desktop';
  let os = 'Computer';

  if (/iPad|Tablet/i.test(ua)) {
    type = 'Tablet';
    os = 'Tablet';
  } else if (/iPhone/i.test(ua)) {
    type = 'Mobile';
    os = 'iPhone';
  } else if (/Android/i.test(ua)) {
    type = 'Mobile';
    os = 'Android';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    type = 'Desktop';
    os = 'Mac';
  } else if (/Windows NT/i.test(ua)) {
    type = 'Desktop';
    os = 'Windows PC';
  } else if (/Linux/i.test(ua)) {
    type = 'Desktop';
    os = 'Linux PC';
  }

  // Friendly short nickname
  const adjectives = ['Swift', 'Bright', 'Cosmic', 'Solar', 'Nova', 'Echo', 'Neon'];
  const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const suggestedName = `${randomAdj} ${os}`;

  return { deviceType: type, suggestedName };
}

export function getStoredDeviceName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('calling_app_device_name');
}

export function setStoredDeviceName(name: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('calling_app_device_name', name);
}

