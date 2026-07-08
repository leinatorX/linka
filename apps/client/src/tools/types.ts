import type { Component } from 'vue';

export type ToolCategory = 'ai' | 'dev' | 'utility' | 'design';

export interface IToolWidget {
  id: string;
  name: string;
  description: string;
  icon: Component;
  category: ToolCategory;
  component: () => Promise<any>;
}
