<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  ChevronDown,
  Calendar,
  ArrowRight,
  ShieldCheck,
  User,
  Smartphone,
  CreditCard,
  MapPin,
  Award,
  ChevronLeft,
  CheckCircle2
} from 'lucide-vue-next';
import { useRouter, useRoute } from 'vue-router';
import { createCardRequest } from '../api';

const router = useRouter();
const route = useRoute();

const selectedServiceTitle = ref('التسجيل وطلب بطاقة فزعة');

const formData = ref({
  name: '',
  mobile: '',
  idNumber: '',
  cardType: 'gold',
  address: '',
  date: new Date().toLocaleDateString('en-GB')
});

onMounted(() => {
  if (typeof route.query.service === 'string' && route.query.service.trim()) {
    selectedServiceTitle.value = route.query.service.trim();
  }
  if (
    typeof route.query.tier === 'string' &&
    ['gold', 'platinum', 'silver'].includes(route.query.tier)
  ) {
    formData.value.cardType = route.query.tier;
  }
});

const isSubmitting = ref(false);

const errors = ref({
  name: '',
  mobile: '',
  idNumber: '',
  cardType: '',
  address: ''
});

const validateForm = () => {
  let isValid = true;
  errors.value = { name: '', mobile: '', idNumber: '', cardType: '', address: '' };

  if (!formData.value.name.trim()) {
    errors.value.name = 'الاسم الكامل مطلوب كما يظهر في الهوية';
    isValid = false;
  }
  
  if (!formData.value.mobile.trim() || !/^[0-9\+\-\s]{9,15}$/.test(formData.value.mobile)) {
    errors.value.mobile = 'يرجى إدخال رقم هاتف متحرك إماراتي صحيح';
    isValid = false;
  }

  if (!formData.value.idNumber.trim()) {
    errors.value.idNumber = 'رقم الهوية الإماراتية مطلوب';
    isValid = false;
  }

  if (!formData.value.cardType) {
    errors.value.cardType = 'يرجى اختيار فئة بطاقة فزعة';
    isValid = false;
  }

  if (!formData.value.address.trim()) {
    errors.value.address = 'عنوان التوصيل بالتفصيل مطلوب';
    isValid = false;
  }

  return isValid;
};

const submitForm = async () => {
  if (isSubmitting.value) return;
  if (!validateForm()) return;
  
  isSubmitting.value = true;
  try {
    await createCardRequest({
      ...formData.value
    });
    router.push('/payment');
  } catch (error) {
    console.error('Error creating card request:', error);
  } finally {
    isSubmitting.value = false;
  }
};

const goBack = () => {
  router.push('/');
};
</script>

<template>
  <div dir="rtl" class="min-h-screen bg-[#06111f] font-sans text-slate-900">
    <div class="max-w-xl mx-auto bg-[#f9f6f0] min-h-screen flex flex-col shadow-[0_0_90px_rgba(0,0,0,0.65)] border-x border-[#c9a959]/30">
      
      <!-- ======================== LUXURY HEADER & LIVE CARD PREVIEW ======================== -->
      <div class="relative w-full bg-gradient-to-b from-[#06111f] via-[#0b1f38] to-[#122c4d] overflow-hidden pb-7 border-b border-[#c9a959]/40">
        <!-- Top Navigation Bar with Official Gold Header Background -->
        <header class="relative z-20 flex items-center justify-between px-5 h-16 border-b border-[#8a6c1e]/40 overflow-hidden shadow-md">
          <img
            src="/assets/aistudio/header-background-gold.50f1dc5b.jpg"
            alt=""
            class="absolute inset-0 w-full h-full object-cover object-right pointer-events-none"
          />
          <div class="absolute inset-0 bg-gradient-to-l from-black/15 via-transparent to-black/25 pointer-events-none"></div>

          <button
            @click="goBack"
            aria-label="العودة"
            class="relative z-10 w-10 h-10 rounded-xl bg-[#06111f]/75 hover:bg-[#06111f] flex items-center justify-center text-[#f5e2a8] transition-colors cursor-pointer border border-[#f5e2a8]/30"
          >
            <ArrowRight class="w-4 h-4" />
          </button>

          <div @click="goBack" class="relative z-10 cursor-pointer flex items-center select-none">
            <img
              src="/assets/aistudio/fazaa-logo.png"
              alt="Fazaa Logo"
              class="h-12 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
            />
          </div>

          <div class="relative z-10 text-xs text-white bg-[#06111f]/75 px-2.5 py-1 rounded-lg border border-[#f5e2a8]/30 font-bold font-mono tabular-nums">
            01 / 03
          </div>
        </header>

        <!-- Step Progress Strip -->
        <div class="relative z-20 px-6 pt-4 pb-2 max-w-md mx-auto">
          <div class="grid grid-cols-3 gap-2 text-[11px] font-bold text-center">
            <div class="text-[#f5e2a8] border-b-2 border-[#f5e2a8] pb-1.5">1. بيانات العضوية</div>
            <div class="text-slate-400 border-b border-white/15 pb-1.5">2. اعتماد الرسوم</div>
            <div class="text-slate-400 border-b border-white/15 pb-1.5">3. تفعيل البطاقة</div>
          </div>
        </div>

        <!-- Hero Card Live Preview Showcase -->
        <div class="relative z-10 pt-5 px-5 flex flex-col items-center text-center">
          <div class="relative w-[290px] rounded-[20px] p-[2.5px] bg-gradient-to-br from-[#fff0be] via-[#c9a959] to-[#6d5012] shadow-[0_22px_50px_rgba(0,0,0,0.55)] mb-4" dir="ltr">
            <div class="rounded-[17.5px] overflow-hidden relative bg-[#0b1f38]">
              <img
                :src="formData.cardType === 'platinum' ? '/assets/aistudio/usra-platinum.c15483ef5f538768f8ff.png' : formData.cardType === 'silver' ? '/assets/aistudio/usra-silver.c90b175261a33b3061a4.png' : '/assets/aistudio/usra-gold.37a39d381c313f5791ad_9c442a5f.png'"
                alt="بطاقة فزعة - الأسرة"
                class="w-full h-auto object-cover block"
              />
              <div class="absolute inset-0 gold-foil-shimmer pointer-events-none"></div>
              <div class="absolute bottom-2.5 left-3.5 text-left leading-tight bg-[#06111f]/80 backdrop-blur-xs px-2.5 py-1 rounded-md border border-[#f5e2a8]/35">
                <div class="text-[8.5px] font-bold tracking-wider text-[#f5e2a8] uppercase truncate max-w-[175px]">
                  {{ formData.name || 'FAZAA CARDHOLDER' }}
                </div>
                <div class="text-[7.5px] font-mono text-white/95 tracking-wider tabular-nums">
                  {{ formData.idNumber || '784-XXXX-XXXXXXX-X' }}
                </div>
              </div>
            </div>
          </div>

          <h1 class="text-white font-black text-xl leading-snug">
            {{ selectedServiceTitle }}
          </h1>
          <p class="text-slate-300 text-xs mt-1 max-w-xs leading-relaxed">
            يرجى إدخال البيانات الشخصية بدقة كما هي مسجلة في بطاقة الهوية الإماراتية
          </p>
        </div>
      </div>

      <!-- ======================== FORM SECTION ======================== -->
      <div class="px-5 py-7 flex-1">
        <form @submit.prevent="submitForm" class="bg-white border border-[#e4dac3] rounded-3xl p-6 shadow-[0_12px_35px_rgba(6,17,31,0.06)] max-w-md mx-auto">
          
          <div class="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <Award class="w-5 h-5 text-[#9b7b28]" />
              <h2 class="font-extrabold text-sm text-[#06111f]">استمارة التسجيل والتوصيل</h2>
            </div>
            <span class="text-[11px] text-[#9b7b28] font-bold flex items-center gap-1">
              <CheckCircle2 class="w-3.5 h-3.5" />
              <span>تفعيل فوري</span>
            </span>
          </div>

          <div class="space-y-4 text-right">
            
            <!-- Name -->
            <div>
              <label class="block text-xs font-extrabold text-[#06111f] mb-1.5">الاسم الكامل <span class="text-[#b4943c]">*</span></label>
              <div class="relative">
                <input 
                  v-model="formData.name"
                  type="text" 
                  dir="rtl"
                  placeholder="الاسم الثلاثي كما يظهر في الهوية الإماراتية" 
                  class="w-full h-12 rounded-xl border border-slate-200 bg-[#fcfbf8] pr-10 pl-3.5 text-right focus:outline-none focus:border-[#c9a959] focus:bg-white placeholder-slate-400 text-slate-900 transition-colors font-semibold text-sm"
                />
                <User class="w-4 h-4 text-[#9b7b28] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p v-if="errors.name" class="text-red-600 text-[11px] font-semibold mt-1">{{ errors.name }}</p>
            </div>

            <!-- Mobile number -->
            <div>
              <label class="block text-xs font-extrabold text-[#06111f] mb-1.5">رقم الهاتف المتحرك <span class="text-[#b4943c]">*</span></label>
              <div class="relative">
                <input 
                  v-model="formData.mobile"
                  type="tel" 
                  dir="rtl"
                  placeholder="05X XXX XXXX" 
                  class="w-full h-12 rounded-xl border border-slate-200 bg-[#fcfbf8] pr-10 pl-3.5 text-right focus:outline-none focus:border-[#c9a959] focus:bg-white placeholder-slate-400 text-slate-900 transition-colors font-semibold text-sm tabular-nums"
                />
                <Smartphone class="w-4 h-4 text-[#9b7b28] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p v-if="errors.mobile" class="text-red-600 text-[11px] font-semibold mt-1">{{ errors.mobile }}</p>
            </div>

            <!-- ID Number -->
            <div>
              <label class="block text-xs font-extrabold text-[#06111f] mb-1.5">رقم الهوية الإماراتية <span class="text-[#b4943c]">*</span></label>
              <div class="relative">
                <input 
                  v-model="formData.idNumber"
                  type="text" 
                  dir="rtl"
                  placeholder="784-XXXX-XXXXXXX-X" 
                  class="w-full h-12 rounded-xl border border-slate-200 bg-[#fcfbf8] pr-10 pl-3.5 text-right focus:outline-none focus:border-[#c9a959] focus:bg-white placeholder-slate-400 text-slate-900 transition-colors font-semibold text-sm tabular-nums"
                />
                <CreditCard class="w-4 h-4 text-[#9b7b28] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p v-if="errors.idNumber" class="text-red-600 text-[11px] font-semibold mt-1">{{ errors.idNumber }}</p>
            </div>

            <!-- Card Type Dropdown -->
            <div>
              <label class="block text-xs font-extrabold text-[#06111f] mb-1.5">فئة بطاقة فزعة <span class="text-[#b4943c]">*</span></label>
              <div class="relative">
                <select 
                  v-model="formData.cardType"
                  dir="rtl"
                  class="w-full h-12 rounded-xl border border-slate-200 bg-[#fcfbf8] pr-3.5 pl-9 appearance-none text-slate-900 focus:outline-none focus:border-[#c9a959] focus:bg-white transition-colors font-bold text-sm cursor-pointer"
                >
                  <option value="gold">بطاقة فزعة الذهبية - الأسرة (Gold)</option>
                  <option value="platinum">بطاقة فزعة البلاتينية (Platinum)</option>
                  <option value="silver">بطاقة فزعة الفضية (Silver)</option>
                </select>
                <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[#9b7b28]">
                  <ChevronDown class="w-4 h-4" />
                </div>
              </div>
              <p v-if="errors.cardType" class="text-red-600 text-[11px] font-semibold mt-1">{{ errors.cardType }}</p>
            </div>

            <!-- Address -->
            <div>
              <label class="block text-xs font-extrabold text-[#06111f] mb-1.5">عنوان التوصيل المعتمد <span class="text-[#b4943c]">*</span></label>
              <div class="relative">
                <input 
                  v-model="formData.address"
                  type="text" 
                  dir="rtl"
                  placeholder="الإمارة، المنطقة، الشارع، رقم المبنى أو الفيلا" 
                  class="w-full h-12 rounded-xl border border-slate-200 bg-[#fcfbf8] pr-10 pl-3.5 text-right focus:outline-none focus:border-[#c9a959] focus:bg-white placeholder-slate-400 text-slate-900 transition-colors font-semibold text-sm"
                />
                <MapPin class="w-4 h-4 text-[#9b7b28] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p v-if="errors.address" class="text-red-600 text-[11px] font-semibold mt-1">{{ errors.address }}</p>
            </div>

            <!-- Date -->
            <div>
              <label class="block text-xs font-extrabold text-[#06111f] mb-1.5">تاريخ تقديم الطلب</label>
              <div class="relative">
                <input 
                  v-model="formData.date"
                  type="text" 
                  dir="rtl"
                  readonly
                  class="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 pr-3.5 pl-10 text-right focus:outline-none text-slate-600 font-semibold text-sm tabular-nums cursor-default"
                />
                <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[#9b7b28]">
                  <Calendar class="w-4 h-4" />
                </div>
              </div>
            </div>

            <!-- Submit Button -->
            <div class="pt-3">
              <button 
                type="submit" 
                :disabled="isSubmitting"
                class="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-[#f3de9b] via-[#c9a959] to-[#9b7b28] hover:from-[#ffeaad] hover:to-[#b5923b] transition-all text-[#06111f] font-black text-sm rounded-xl shadow-[0_8px_24px_rgba(201,169,89,0.35)] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed border border-[#ffefb8]/60"
              >
                <span v-if="isSubmitting" class="animate-spin rounded-full h-4 w-4 border-b-2 border-[#06111f]"></span>
                <template v-else>
                  <span>متابعة وتأكيد الطلب</span>
                  <ChevronLeft class="w-4 h-4" />
                </template>
              </button>
            </div>
            
          </div>

        </form>

        <!-- Trust note -->
        <div class="mt-5 flex items-center justify-center gap-2 text-xs text-slate-600 font-semibold">
          <ShieldCheck class="w-4 h-4 text-[#9b7b28]" />
          <span>جميع البيانات مشفرة ومحمية وفق معايير الأمان المعتمدة لبرنامج فزعة</span>
        </div>
      </div>

      <!-- Fazaa Footer -->
      <footer class="bg-[#06111f] text-white px-6 py-5 text-right border-t border-[#c9a959]/35">
        <div class="flex items-center justify-between">
          <div class="flex items-baseline gap-2">
            <span class="text-[#f5e2a8] font-black text-base leading-none">فزعة</span>
            <span class="text-white/75 font-bold text-[10px] leading-none tracking-widest">FAZAA</span>
          </div>
          <span class="text-[11px] text-slate-300 font-medium">© 2026 Fazaa · كل الحقوق محفوظة</span>
        </div>
      </footer>

    </div>
  </div>
</template>
