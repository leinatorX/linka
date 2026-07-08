import type { IToolWidget } from './types';
import { Languages, Ratio, Clock } from '@lucide/vue';
import { defineAsyncComponent } from 'vue';

// Registry of all tools
export const registeredTools: IToolWidget[] = [
  {
    id: 'ai-translator',
    name: 'toolbox.tools.aiTranslator.name',
    description: 'toolbox.tools.aiTranslator.desc',
    icon: Languages,
    category: 'ai',
    component: defineAsyncComponent(() => import('./widgets/AiTranslator.vue')) as any
  },
  {
    id: 'aspect-ratio',
    name: 'toolbox.tools.aspectRatio.name',
    description: 'toolbox.tools.aspectRatio.desc',
    icon: Ratio,
    category: 'dev',
    component: defineAsyncComponent(() => import('./widgets/AspectRatio.vue')) as any
  },
  {
    id: 'timestamp',
    name: 'toolbox.tools.timestamp.name',
    description: 'toolbox.tools.timestamp.desc',
    icon: Clock,
    category: 'utility',
    component: defineAsyncComponent(() => import('./widgets/Timestamp.vue')) as any
  }
];
