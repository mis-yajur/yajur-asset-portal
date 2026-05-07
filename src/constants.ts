import { ThemeSettings } from './types';

export interface ThemePreset {
  id: string;
  name: string;
  primary: string;
  accent: string;
  type: 'light' | 'dark';
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'slate-light', name: 'Slate Light', primary: '#0d1b3e', accent: '#f59e0b', type: 'light' },
  { id: 'emerald-light', name: 'Emerald Light', primary: '#064e3b', accent: '#10b981', type: 'light' },
  { id: 'amber-light', name: 'Amber Light', primary: '#78350f', accent: '#f59e0b', type: 'light' },
  { id: 'midnight-dark', name: 'Midnight Dark', primary: '#3b82f6', accent: '#60a5fa', type: 'dark' },
  { id: 'deep-blue-dark', name: 'Deep Blue Dark', primary: '#38bdf8', accent: '#0ea5e9', type: 'dark' },
  { id: 'forest-dark', name: 'Forest Dark', primary: '#10b981', accent: '#059669', type: 'dark' },
];
