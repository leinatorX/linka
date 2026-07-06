import { createI18n } from 'vue-i18n';
import zhCN from './locales/zh-CN';
import enUS from './locales/en-US';
import zhTW from './locales/zh-TW';
import zhHK from './locales/zh-HK';

export type MessageSchema = typeof zhCN;

const messages = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'zh-TW': zhTW,
  'zh-HK': zhHK,
};

const savedLocale = localStorage.getItem('linka_locale');
const defaultLocale = savedLocale || 'zh-CN';

export const i18n = createI18n<[MessageSchema], 'zh-CN' | 'en-US' | 'zh-TW' | 'zh-HK'>({
  legacy: false,
  locale: defaultLocale,
  fallbackLocale: 'zh-CN',
  messages,
});

export function setLocale(locale: 'zh-CN' | 'en-US' | 'zh-TW' | 'zh-HK') {
  (i18n.global.locale as any).value = locale;
  localStorage.setItem('linka_locale', locale);
}
