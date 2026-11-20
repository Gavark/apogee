/**
 * One transient message at a time, shown by <Toast /> (mounted once in the
 * root layout). A new toast replaces the current one: the latest action is
 * the one the user may want to undo.
 */
export type ToastAction = { label: string; run: () => void };
export type ToastItem = { id: number; message: string; action?: ToastAction };

export const toast = $state<{ current: ToastItem | null }>({ current: null });

let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(message: string, action?: ToastAction, ms = 5000): void {
  clearTimeout(timer);
  toast.current = { id: ++seq, message, action };
  timer = setTimeout(dismissToast, ms);
}

export function dismissToast(): void {
  clearTimeout(timer);
  timer = undefined;
  toast.current = null;
}
