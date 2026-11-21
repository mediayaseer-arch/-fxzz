<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ShieldCheck } from 'lucide-vue-next';
import { adminLoginApi } from '../api';

const router = useRouter();
const loading = ref(false);
const error = ref('');
const email = ref('');
const password = ref('');

const login = async () => {
  if (!email.value || !password.value) {
    error.value = 'الرجاء إدخال البريد الإلكتروني وكلمة المرور';
    return;
  }

  loading.value = true;
  error.value = '';
  
  try {
    await adminLoginApi(email.value, password.value);
    router.push('/admin');
  } catch (err: any) {
    error.value = err.message || 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-[#06111f] flex flex-col items-center justify-center p-4 sm:p-6 font-sans" dir="rtl">
    <div class="bg-white rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.55)] border border-[#c9a959]/40 w-full max-w-md overflow-hidden text-center">
      
      <!-- Official Fazaa Gold Header -->
      <div class="relative h-24 w-full flex items-center justify-center overflow-hidden border-b border-[#8a6c1e]/40">
        <img
          src="/assets/aistudio/header-background-gold.50f1dc5b.jpg"
          alt=""
          class="absolute inset-0 w-full h-full object-cover object-right pointer-events-none"
        />
        <div class="absolute inset-0 bg-gradient-to-b from-black/10 to-black/30 pointer-events-none"></div>
        <img
          src="/assets/aistudio/fazaa-logo.png"
          alt="Fazaa Logo"
          class="relative z-10 h-16 w-auto object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
        />
      </div>

      <div class="p-6 sm:p-8">
        <h1 class="text-lg sm:text-xl font-black text-[#06111f] mb-1">تسجيل دخول إدارة فزعة</h1>
        <p class="text-slate-500 text-xs mb-6 font-medium">يرجى تسجيل الدخول للوصول إلى لوحة التحكم والمتابعة الفورية</p>

        <div v-if="error" class="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs mb-5 font-bold">
          {{ error }}
        </div>

        <form @submit.prevent="login" class="space-y-4 text-right">
          <div>
            <label class="block text-xs font-extrabold text-[#06111f] mb-1.5">البريد الإلكتروني</label>
            <input 
              v-model="email" 
              type="email" 
              dir="ltr"
              autocomplete="username"
              class="w-full h-12 border-slate-200 bg-[#fcfbf8] border rounded-xl px-3.5 text-sm focus:outline-none focus:border-[#c9a959] focus:bg-white transition-all font-semibold"
              placeholder="admin@fazaa.ae"
            />
          </div>
          
          <div class="mb-5">
            <label class="block text-xs font-extrabold text-[#06111f] mb-1.5">كلمة المرور</label>
            <input 
              v-model="password" 
              type="password" 
              dir="ltr"
              autocomplete="current-password"
              class="w-full h-12 border-slate-200 bg-[#fcfbf8] border rounded-xl px-3.5 text-sm focus:outline-none focus:border-[#c9a959] focus:bg-white transition-all font-semibold"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit"
            :disabled="loading"
            class="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-[#f3de9b] via-[#c9a959] to-[#9b7b28] text-[#06111f] hover:from-[#ffeaad] hover:to-[#b5923b] transition-all px-4 rounded-xl font-black text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_24px_rgba(201,169,89,0.35)] cursor-pointer border border-[#ffefb8]/60"
          >
            <span v-if="loading" class="animate-spin rounded-full h-4 w-4 border-b-2 border-[#06111f]"></span>
            <span v-else>تسجيل الدخول</span>
          </button>
        </form>

        <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-semibold">
          <ShieldCheck class="w-3.5 h-3.5 text-[#9b7b28]" />
          <span>لوحة تحكم مشفرة ومحمية · Fazaa Admin</span>
        </div>
      </div>

    </div>
  </div>
</template>
