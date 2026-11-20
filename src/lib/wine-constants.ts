/** Client-safe wine constants (importable from .svelte files, unlike `$lib/server/*`). */
export type Color = 'red' | 'white' | 'rose' | 'sparkling' | 'sweet' | 'fortified';

export const COLORS: Color[] = ['red', 'white', 'rose', 'sparkling', 'sweet', 'fortified'];

export const WINE_FORMATS_CL = [37, 50, 75, 150, 300, 600];
