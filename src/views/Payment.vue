<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ChevronLeft, ArrowRight, ShieldCheck, CheckCircle2, CreditCard } from 'lucide-vue-next';

const router = useRouter();

const goNext = () => {
  router.push('/card-details');
};

const goBack = () => {
  router.push('/request');
};
</script>

<template>
  <div dir="rtl" class="min-h-screen bg-[#f4f1ea] font-sans text-slate-900">
    <div class="max-w-xl mx-auto bg-[#faf8f4] min-h-screen flex flex-col shadow-[0_0_60px_rgba(11,31,56,0.12)] border-x border-[#e6decb]/80">
      
      <!-- Fazaa Top Header -->
      <header class="w-full h-16 px-5 flex items-center justify-between border-b border-[#8a6c1e]/40 relative z-20 overflow-hidden shadow-md">
        <img
          src="/assets/aistudio/header-background-gold.50f1dc5b.jpg"
          alt=""
          class="absolute inset-0 w-full h-full object-cover object-right pointer-events-none"
        />
        <div class="absolute inset-0 bg-gradient-to-l from-black/15 via-transparent to-black/25 pointer-events-none"></div>

        <button
          @click="goBack"
          aria-label="العودة"
          class="relative z-10 w-9 h-9 rounded-xl bg-[#06111f]/75 hover:bg-[#06111f] flex items-center justify-center text-[#f5e2a8] transition-colors cursor-pointer border border-[#f5e2a8]/30"
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

        <div class="relative z-10 text-[11px] text-white bg-[#06111f]/75 px-2.5 py-1 rounded-lg border border-[#f5e2a8]/30 font-bold">
          02 / 03
        </div>
      </header>

      <div class="flex-1 flex flex-col items-center pt-7 px-5 pb-8">
        <!-- Fazaa Gold Card Preview -->
        <div class="w-[240px] rounded-2xl p-[2px] bg-gradient-to-br from-[#f3de9b] via-[#c5a44e] to-[#7d621b] shadow-xl mb-5">
          <div class="rounded-[14px] overflow-hidden">
            <img
              src="/assets/aistudio/usra-gold.37a39d381c313f5791ad_9c442a5f.png"
              alt="بطاقة فزعة الذهبية - الأسرة"
              class="w-full h-auto object-cover block"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        <!-- Title Banner -->
        <div class="text-center mb-6 max-w-sm">
          <h1 class="text-[#0b1f38] font-extrabold text-lg mb-1">
            ملخص رسوم إصدار وتوصيل بطاقة فزعة
          </h1>
          <p class="text-slate-500 text-xs leading-relaxed">
            يرجى مراجعة تفاصيل الرسوم الرمزية لتأكيد الطلب وجدولة التوصيل السريع
          </p>
        </div>

        <!-- Luxury Invoice / Fees Card -->
        <div class="bg-gradient-to-b from-[#0b1f38] to-[#132e50] text-white w-full max-w-sm rounded-2xl p-6 mb-6 shadow-[0_16px_35px_rgba(11,31,56,0.2)] border border-[#c5a44e]/40 relative">
          <div class="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
            <div class="flex items-center gap-2">
              <CheckCircle2 class="w-4 h-4 text-[#e5c875]" />
              <span class="font-extrabold text-xs text-[#e5c875]">تفاصيل الفاتورة المعتمدة</span>
            </div>
            <span class="text-[11px] text-slate-300 font-mono">FAZAA-UAE</span>
          </div>

          <div class="space-y-3.5">
            <!-- Row 1 -->
            <div class="flex justify-between items-center text-xs">
              <span class="text-slate-300 font-medium">رسوم تأكيد وإصدار البطاقة</span>
              <span class="font-bold font-mono tabular-nums text-white">1.00 AED</span>
            </div>
            
            <div class="h-px w-full bg-white/10"></div>
            
            <!-- Row 2 -->
            <div class="flex justify-between items-center text-xs">
              <span class="text-slate-300 font-medium">رسوم التوصيل السريع (مجاناً)</span>
              <span class="font-bold font-mono tabular-nums text-emerald-400">0.00 AED</span>
            </div>
            
            <div class="h-px w-full bg-white/15"></div>

            <!-- Row 3 - Total -->
            <div class="flex justify-between items-center pt-1">
              <span class="font-extrabold text-sm text-white">الإجمالي المستحق للدفع</span>
              <span class="font-black text-base text-[#e5c875] font-mono tabular-nums">1.00 درهم</span>
            </div>
          </div>
        </div>

        <!-- Payment Method Card -->
        <div class="bg-white text-slate-800 w-full max-w-sm flex items-center justify-between p-3.5 rounded-2xl mb-6 border border-[#e6decb] shadow-xs">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-[#0b1f38]/5 flex items-center justify-center text-[#0b1f38]">
              <CreditCard class="w-4 h-4" />
            </div>
            <span class="font-bold text-slate-800 text-xs">الدفع الإلكتروني الفوري بالبطاقة</span>
          </div>
          <div class="bg-slate-50 px-2 py-1 rounded-lg flex items-center gap-1.5 border border-slate-100" dir="ltr">
            <div class="w-[32px] h-[20px] bg-gradient-to-br from-blue-600 to-blue-800 text-[4.5px] text-white font-bold flex items-center justify-center leading-tight text-center rounded-[3px]">AMERICAN<br/>EXPRESS</div>
            <div class="w-[32px] h-[20px] bg-gradient-to-br from-blue-800 to-indigo-950 text-[8px] text-white font-bold flex items-center justify-center italic rounded-[3px]">VISA</div>
            <div class="w-[32px] h-[20px] bg-white border border-gray-200 flex items-center justify-center relative overflow-hidden rounded-[3px]">
              <div class="w-[14px] h-[14px] bg-[#eb001b] rounded-full absolute -left-1 opacity-90"></div>
              <div class="w-[14px] h-[14px] bg-[#f79e1b] rounded-full absolute -right-1 opacity-90"></div>
              <span class="text-[4.5px] font-bold z-10 text-gray-900">MasterCard</span>
            </div>
          </div>
        </div>

        <!-- Submit Button -->
        <button
          @click="goNext"
          class="w-full max-w-sm h-12 bg-gradient-to-r from-[#c8a951] via-[#b4943c] to-[#987a28] hover:from-[#d2b35b] hover:to-[#a3842f] text-white rounded-xl flex items-center justify-center gap-2 mb-8 shadow-[0_8px_20px_rgba(180,148,60,0.3)] transition-all cursor-pointer group"
        >
          <span class="font-extrabold text-sm">الانتقال إلى بوابة الدفع الآمن</span>
          <ChevronLeft class="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" />
        </button>

        <!-- Footer Security Info -->
        <div class="text-center max-w-sm px-2 mt-auto">
          <p class="text-slate-500 font-medium text-[11px] leading-relaxed mb-3">
            تُقبل كافة البطاقات المصرفية الصادرة في دولة الإمارات العربية المتحدة ودول مجلس التعاون الخليجي.
          </p>
          <div class="flex items-center justify-center gap-2.5 bg-white py-2.5 px-4 rounded-xl border border-[#e6decb] shadow-2xs">
            <ShieldCheck class="w-4 h-4 text-[#0b1f38] shrink-0" />
            <div class="text-[#0b1f38] font-bold text-xs tracking-tight" dir="ltr">
              PCI DSS CERTIFIED
            </div>
            <span class="text-slate-300">·</span>
            <div class="text-slate-700 font-semibold text-[11px]">تشفير بنكي آمن 256-Bit</div>
          </div>
        </div>
      </div>

      <!-- Fazaa Footer -->
      <footer class="bg-[#09192d] text-white px-5 py-4 text-right border-t border-[#c5a44e]/25">
        <div class="flex items-center justify-between">
          <div class="flex items-baseline gap-2">
            <span class="text-[#e5c875] font-black text-sm leading-none">فزعة</span>
            <span class="text-white/75 font-bold text-[10px] leading-none tracking-widest">FAZAA</span>
          </div>
          <span class="text-[11px] text-slate-300 font-medium">© 2026 Fazaa · كل الحقوق محفوظة</span>
        </div>
      </footer>

    </div>
  </div>
</template>
