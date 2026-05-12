import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | undefined | null): string {
  if (!date) return 'NONE';
  const d = safeParseDate(date);
  if (!d) return String(date);
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}-${month}-${year}`;
}

export function safeParseNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/,/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export function safeParseDate(dateStr: any): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  
  // Handle DD/MM/YYYY or DD-MM-YYYY
  if (typeof dateStr === 'string') {
    const separator = dateStr.includes('/') ? '/' : (dateStr.includes('-') && dateStr.indexOf('-') < 4 ? '-' : null);
    if (separator) {
      const parts = dateStr.split(separator);
      if (parts.length === 3) {
        // Assume DD/MM/YYYY or DD-MM-YYYY
        const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        if (!isNaN(d.getTime())) return d;
      }
    }
  }
  
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}
