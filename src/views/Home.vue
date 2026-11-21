<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Plane,
  Building,
  ShoppingBag,
  HeartPulse,
  Film,
  Utensils,
  ChevronLeft,
  ShieldCheck,
  Award,
  CreditCard,
  Users,
  Truck,
  UserPlus,
  CheckCircle2,
  Globe,
  PhoneCall
} from 'lucide-vue-next'

const router = useRouter()
const selectedTier = ref<'gold' | 'platinum' | 'silver'>('gold')

const tierCardImage = computed(() => {
  if (selectedTier.value === 'platinum') {
    return '/assets/aistudio/usra-platinum.c15483ef5f538768f8ff.png'
  }
  if (selectedTier.value === 'silver') {
    return '/assets/aistudio/usra-silver.c90b175261a33b3061a4.png'
  }
  return '/assets/aistudio/usra-gold.37a39d381c313f5791ad_9c442a5f.png'
})

const navigateToForm = (serviceTitle?: string, defaultTier: 'gold' | 'platinum' | 'silver' = selectedTier.value) => {
  router.push({
    path: '/request',
    query: {
      ...(serviceTitle ? { service: serviceTitle } : {}),
      tier: defaultTier
    }
  })
}

const membershipTiers = [
  {
    id: 'gold' as const,
    name: 'الذهبية · الأسرة',
    enName: 'FAZAA GOLD · AL USRA',
    discount: 'خصومات تصل إلى 70%',
    badge: 'الأكثر طلباً'
  },
  {
    id: 'platinum' as const,
    name: 'البلاتينية',
    enName: 'FAZAA PLATINUM',
    discount: 'مزايا سفر وفنادق VIP',
    badge: 'كبار الشخصيات'
  },
  {
    id: 'silver' as const,
    name: 'الفضية',
    enName: 'FAZAA SILVER',
    discount: 'عروض يومية في +26,000 متجر',
    badge: 'الأساسية'
  }
]

const serviceActions = [
  {
    title: 'التسجيل في فزعه',
    subtitle: 'إصدار عضوية فزعة جديدة وتفعيل المزايا الفورية عبر الهوية الإماراتية',
    tag: 'إصدار فوري',
    tier: 'gold' as const,
    icon: UserPlus
  },
  {
    title: 'طلب بطاقة الأسرة',
    subtitle: 'بطاقة عام الأسرة الذهبية المخصصة لأفراد الأسرة في كافة القطاعات',
    tag: 'عام الأسرة',
    tier: 'gold' as const,
    icon: Users
  },
  {
    title: 'طلب بطاقة للمقيمين',
    subtitle: 'باقات عضوية متكاملة للمقيمين في دولة الإمارات العربية المتحدة',
    tag: 'للمقيمين',
    tier: 'silver' as const,
    icon: CreditCard
  },
  {
    title: 'طلب توصيل بطاقة',
    subtitle: 'خدمة التوصيل السريع والمؤمّن للبطاقة الفعلية إلى عنوانك الوطني',
    tag: 'توصيل سريع',
    tier: 'gold' as const,
    icon: Truck
  }
]

const benefits = [
  {
    title: 'تسوق ومتاجر',
    subtitle: 'خصومات فورية في أرقى المراكز التجارية',
    stat: 'حتى 60%',
    icon: ShoppingBag
  },
  {
    title: 'خصومات السفر',
    subtitle: 'عروض حصرية على تذاكر الطيران والدرجة الأولى',
    stat: 'حتى 50%',
    icon: Plane
  },
  {
    title: 'خدمات صحية',
    subtitle: 'تغطية وخصومات المستشفيات والعيادات التخصصية',
    stat: 'حتى 70%',
    icon: HeartPulse
  },
  {
    title: 'عروض الفنادق',
    subtitle: 'إقامات فاخرة في أرقى الفنادق والمنتجعات عالمياً',
    stat: 'حتى 65%',
    icon: Building
  },
  {
    title: 'ترفيه وفعاليات',
    subtitle: 'تذاكر مخفضة للمدن والوجهات الترفيهية العائلية',
    stat: 'حتى 55%',
    icon: Film
  },
  {
    title: 'مطاعم وكافيهات',
    subtitle: 'خصومات يومية في المطاعم الفاخرة والمقاهي',
    stat: 'حتى 40%',
    icon: Utensils
  }
]
</script>

<template>
  <div dir="rtl" class="min-h-screen bg-[#06111f] text-slate-900 font-sans selection:bg-[#d4b65f] selection:text-[#06111f]">
    <div class="max-w-xl mx-auto bg-[#f9f6f0] min-h-screen flex flex-col shadow-[0_0_90px_rgba(0,0,0,0.65)] border-x border-[#c9a959]/30 relative overflow-hidden">
      
      <!-- ======================== OFFICIAL FAZAA GOLD HEADER BAR ======================== -->
      <header class="sticky top-0 z-30 h-20 relative overflow-hidden border-b border-[#8a6c1e]/45 shadow-[0_6px_25px_rgba(0,0,0,0.35)]">
        <!-- Official Gold Header Background with Embossed Calligraphy -->
        <img
          src="/assets/aistudio/header-background-gold.50f1dc5b.jpg"
          alt=""
          class="absolute inset-0 w-full h-full object-cover object-right pointer-events-none"
        />
        <div class="absolute inset-0 bg-gradient-to-l from-black/10 via-transparent to-black/25 pointer-events-none"></div>

        <div class="relative z-10 h-full px-5 flex items-center justify-between">
          <!-- Official Fazaa Logo -->
          <div @click="navigateToForm()" class="flex items-center gap-3 cursor-pointer shrink-0 group">
            <img
              src="/assets/aistudio/fazaa-logo.png"
              alt="Fazaa Logo"
              class="h-14 w-auto object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)] transition-transform duration-200 group-hover:scale-105"
            />
          </div>

          <button
            @click="navigateToForm()"
            class="px-4 py-2.5 rounded-xl bg-[#06111f] hover:bg-[#0d2340] text-[#f5e2a8] font-black text-xs shadow-[0_6px_20px_rgba(6,17,31,0.4)] transition-all cursor-pointer whitespace-nowrap shrink-0 border border-[#f5e2a8]/40 active:scale-95"
          >
            طلب البطاقة الآن
          </button>
        </div>
      </header>

      <!-- ======================== OFFICIAL FAZAA MAIN PAGE BANNER ======================== -->
      <div class="w-full bg-[#06111f] relative overflow-hidden border-b border-[#c9a959]/40">
        <img
          src="/assets/aistudio/fazaa-page-banner-1736312280581.jpg"
          alt="فزعة أسلوب حياة للسعادة والإيجابية - Fazaa Memberships"
          class="w-full h-auto object-cover block"
        />
        <div class="inset-x-0 bottom-0 h-4 bg-gradient-to-t from-[#06111f] to-transparent absolute pointer-events-none"></div>
      </div>

      <!-- ======================== ROYAL HERO CARD & SERVICES SECTION ======================== -->
      <section class="px-5 pt-7 pb-11 relative overflow-hidden bg-gradient-to-b from-[#06111f] via-[#0b1f38] to-[#112a4a] text-white">
        <!-- Subtle geometric arabesque background pattern -->
        <svg class="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="fazaaGeo" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M24 0 L48 24 L24 48 L0 24 Z" fill="none" stroke="#ffffff" stroke-width="1" />
              <circle cx="24" cy="24" r="6" fill="none" stroke="#ffffff" stroke-width="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#fazaaGeo)" />
        </svg>

        <!-- Ambient golden crown spotlight -->
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,_rgba(218,184,96,0.26)_0%,_transparent_65%)] pointer-events-none"></div>

        <!-- Editorial Kicker -->
        <div class="relative z-10 flex items-center justify-center gap-2 text-xs font-bold text-[#f3de9b] mb-4">
          <Award class="w-4 h-4 text-[#f3de9b]" />
          <span>البرنامج الوطني للمكافآت والمزايا الحصرية</span>
          <span class="text-white/30">·</span>
          <span class="text-white/80">الإمارات العربية المتحدة</span>
        </div>

        <!-- Featured Fazaa Al Usra Card Showcase with Foil Shimmer -->
        <div @click="navigateToForm('طلب بطاقة الأسرة', selectedTier)" class="relative z-10 mb-6 flex flex-col items-center cursor-pointer group">
          <div class="relative w-full max-w-[355px] rounded-[24px] p-[2.5px] bg-gradient-to-br from-[#fff0be] via-[#c9a959] to-[#6d5012] shadow-[0_28px_65px_rgba(0,0,0,0.65)] transition-all duration-300 group-hover:scale-[1.02]">
            <div class="rounded-[21.5px] overflow-hidden bg-[#0b1f38] relative">
              <img
                :src="tierCardImage"
                alt="بطاقة فزعة - الأسرة"
                class="w-full h-auto object-cover block transition-opacity duration-300"
              />
              <!-- Animated Gold Foil Shimmer Sweep -->
              <div class="absolute inset-0 gold-foil-shimmer pointer-events-none"></div>
            </div>
          </div>
        </div>

        <!-- Interactive Membership Tier Selector -->
        <div class="relative z-10 max-w-[355px] mx-auto mb-8">
          <div class="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-[#040c17]/80 border border-[#c9a959]/30 backdrop-blur-md">
            <button
              v-for="tier in membershipTiers"
              :key="tier.id"
              type="button"
              @click="selectedTier = tier.id"
              class="py-2 px-2 rounded-xl text-center transition-all cursor-pointer"
              :class="
                selectedTier === tier.id
                  ? 'bg-gradient-to-b from-[#e5c875] to-[#b5923b] text-[#06111f] font-black shadow-md'
                  : 'text-slate-300 hover:text-white font-bold'
              "
            >
              <div class="text-xs whitespace-nowrap">{{ tier.name }}</div>
              <div
                class="text-[9.5px] truncate mt-0.5"
                :class="selectedTier === tier.id ? 'text-[#06111f]/80 font-bold' : 'text-slate-400'"
              >
                {{ tier.discount }}
              </div>
            </button>
          </div>
        </div>

        <!-- Headline -->
        <div class="relative z-10 text-center mb-7">
          <h1
            class="text-white font-black text-[23px] leading-[1.42] px-2 mb-2 tracking-tight"
            style="text-wrap: balance;"
          >
            عالم من المزايا الحصرية والخصومات الغير محدودة مع بطاقة فزعة
          </h1>
          <p class="text-slate-300 text-xs font-medium max-w-md mx-auto leading-relaxed">
            اختر البوابة المطلوبة أدناه لإتمام التسجيل الإلكتروني الفوري أو جدولة توصيل بطاقتك
          </p>
        </div>

        <!-- 4 Luxury Sovereign Action Cards with Official Gold Header Texture -->
        <div class="relative z-10 space-y-3.5">
          <button
            v-for="(item, idx) in serviceActions"
            :key="idx"
            @click="navigateToForm(item.title, item.tier)"
            class="w-full group relative overflow-hidden rounded-2xl p-[1.5px] bg-gradient-to-l from-[#fff0be]/90 via-[#c9a959] to-[#7a5c18] shadow-[0_14px_32px_rgba(0,0,0,0.4)] transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer text-right block"
          >
            <div class="relative overflow-hidden px-4 py-4 rounded-[14.5px] flex items-center justify-between gap-3.5 transition-all bg-gradient-to-l from-[#c8a951] via-[#b29138] to-[#8f7122]">
              <img
                src="/assets/aistudio/header-background-gold.50f1dc5b.jpg"
                alt=""
                class="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-300 pointer-events-none"
              />
              <div class="absolute inset-0 bg-gradient-to-l from-black/10 via-transparent to-black/30 pointer-events-none"></div>

              <div class="relative z-10 flex items-center gap-3.5 min-w-0">
                <div class="w-12 h-12 rounded-2xl bg-[#06111f]/90 border border-[#ffefb8]/45 flex items-center justify-center shrink-0 text-[#f5e2a8] shadow-md group-hover:scale-105 transition-transform">
                  <component :is="item.icon" class="w-5 h-5" />
                </div>
                <div class="min-w-0 text-right">
                  <div class="flex items-center gap-2">
                    <span class="text-white font-black text-[19px] leading-snug tracking-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
                      {{ item.title }}
                    </span>
                    <span class="text-[10px] font-bold text-[#06111f] bg-[#fff0be]/95 px-2 py-0.5 rounded-md whitespace-nowrap shadow-2xs">
                      {{ item.tag }}
                    </span>
                  </div>
                  <div class="text-white text-xs font-semibold truncate mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
                    {{ item.subtitle }}
                  </div>
                </div>
              </div>

              <div class="relative z-10 w-9 h-9 rounded-xl bg-[#06111f]/35 group-hover:bg-[#06111f]/60 flex items-center justify-center shrink-0 transition-all group-hover:-translate-x-1 border border-white/25">
                <ChevronLeft class="w-5 h-5 text-white" />
              </div>
            </div>
          </button>
        </div>

        <!-- Quantitative Trust Metrics Strip -->
        <div class="relative z-10 mt-9 pt-6 border-t border-white/15 grid grid-cols-3 gap-2 text-center">
          <div>
            <div class="text-[#f5e2a8] font-black text-2xl font-mono tabular-nums tracking-tight">+26,000</div>
            <div class="text-[11px] text-slate-300 font-semibold mt-0.5">شريك وعلامة تجارية</div>
          </div>
          <div class="border-x border-white/15 px-2">
            <div class="text-[#f5e2a8] font-black text-2xl font-mono tabular-nums tracking-tight">70%</div>
            <div class="text-[11px] text-slate-300 font-semibold mt-0.5">خصومات فورية حصرية</div>
          </div>
          <div>
            <div class="text-[#f5e2a8] font-black text-2xl font-mono tabular-nums tracking-tight">7 إمارات</div>
            <div class="text-[11px] text-slate-300 font-semibold mt-0.5">تغطية وتوصيل شامل</div>
          </div>
        </div>
      </section>

      <!-- ======================== BENEFITS GRID SECTION ======================== -->
      <section class="px-5 py-10 bg-[#f9f6f0] border-t border-[#e4dac3]">
        <div class="flex items-end justify-between mb-6">
          <div class="text-right">
            <div class="text-[11px] font-extrabold tracking-[0.18em] uppercase text-[#9a7b2c] mb-1">
              FAZAA CARD PRIVILEGES
            </div>
            <h2 class="text-2xl font-black text-[#06111f]">
              مزايا وعروض بطاقة فزعة
            </h2>
          </div>
          <button
            @click="navigateToForm()"
            class="text-xs font-extrabold text-[#9a7b2c] hover:text-[#06111f] transition-colors cursor-pointer whitespace-nowrap"
          >
            استكشف العروض &larr;
          </button>
        </div>

        <div class="grid grid-cols-2 gap-3.5 text-right mb-8">
          <div
            v-for="(benefit, index) in benefits"
            :key="index"
            @click="navigateToForm(benefit.title)"
            class="bg-white hover:bg-[#fffdfa] border border-[#e4dac3] hover:border-[#c9a959] rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-[0_4px_16px_rgba(6,17,31,0.04)] hover:shadow-[0_10px_26px_rgba(201,169,89,0.16)] transition-all cursor-pointer group"
          >
            <div class="flex items-center justify-between">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-[#06111f] to-[#112a4a] text-[#f5e2a8] flex items-center justify-center shrink-0 group-hover:from-[#c9a959] group-hover:to-[#9b7b28] group-hover:text-[#06111f] transition-all shadow-xs">
                <component :is="benefit.icon" class="w-5 h-5" />
              </div>
              <span class="text-[11px] font-extrabold text-[#9a7b2c] font-mono tabular-nums">
                {{ benefit.stat }}
              </span>
            </div>

            <div>
              <div class="font-extrabold text-[14.5px] text-[#06111f] group-hover:text-[#9a7b2c] transition-colors">
                {{ benefit.title }}
              </div>
              <div class="text-[11px] text-slate-500 leading-relaxed mt-0.5 font-medium">
                {{ benefit.subtitle }}
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Royal Concierge Action Banner -->
        <div class="bg-gradient-to-r from-[#06111f] via-[#0c213b] to-[#132f52] rounded-3xl p-6 text-white flex items-center justify-between gap-4 border border-[#c9a959]/50 shadow-[0_18px_40px_rgba(6,17,31,0.25)] relative overflow-hidden">
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_85%_50%,_rgba(218,184,96,0.2)_0%,_transparent_60%)] pointer-events-none"></div>

          <div class="relative z-10 text-right">
            <div class="text-[#f5e2a8] font-black text-base mb-1 flex items-center gap-2">
              <CheckCircle2 class="w-4 h-4 text-[#f5e2a8]" />
              <span>اشترك الآن واستمتع بالمزايا الفورية</span>
            </div>
            <p class="text-xs text-slate-300 leading-relaxed font-medium">
              إصدار رقمي فوري وتوصيل البطاقة المعتمدة إلى كافة إمارات الدولة
            </p>
          </div>
          <button
            @click="navigateToForm()"
            class="relative z-10 px-5 py-3 rounded-xl bg-gradient-to-r from-[#f5e2a8] via-[#c9a959] to-[#9b7b28] hover:from-white hover:to-[#f5e2a8] text-[#06111f] font-black text-xs whitespace-nowrap shrink-0 shadow-[0_6px_20px_rgba(201,169,89,0.35)] cursor-pointer transition-all active:scale-95 border border-[#ffefb8]/60"
          >
            ابدأ التسجيل
          </button>
        </div>
      </section>

      <!-- ======================== SOVEREIGN FOOTER ======================== -->
      <footer class="bg-[#06111f] text-slate-300 px-6 py-7 border-t border-[#c9a959]/35 mt-auto">
        <div class="flex items-center justify-between pb-4 border-b border-white/10">
          <div class="flex items-center gap-3">
            <img
              src="/assets/aistudio/fazaa-logo.png"
              alt="Fazaa Logo"
              class="h-11 w-auto object-contain"
            />
            <span class="text-white/30">·</span>
            <span class="text-xs font-extrabold tracking-[0.22em] text-white/85">FAZAA UAE</span>
          </div>
          <div class="flex items-center gap-3 text-[11px] text-[#f5e2a8] font-bold">
            <span class="flex items-center gap-1">
              <Globe class="w-3.5 h-3.5" />
              <span>fazaa.ae</span>
            </span>
            <span class="text-white/25">·</span>
            <span class="flex items-center gap-1">
              <PhoneCall class="w-3.5 h-3.5" />
              <span class="font-mono tabular-nums">600 520003</span>
            </span>
          </div>
        </div>
        <div class="pt-4 flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <span class="flex items-center gap-1.5">
            <ShieldCheck class="w-3.5 h-3.5 text-[#c9a959]" />
            <span>© 2026 برنامج فزعة (Fazaa). جميع الحقوق محفوظة.</span>
          </span>
          <span>الإمارات العربية المتحدة</span>
        </div>
      </footer>

    </div>
  </div>
</template>
