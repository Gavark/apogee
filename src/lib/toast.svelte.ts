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
let duration = 5000;
let paused = false;

export function showToast(message: string, action?: ToastAction, ms = 5000): void {
  clearTimeout(timer);
  duration = ms;
  paused = false;
  toast.current = { id: ++seq, message, action };
  timer = setTimeout(dismissToast, ms);
}

export function dismissToast(): void {
  clearTimeout(timer);
  timer = undefined;
  paused = false;
  toast.current = null;
}

/** Hover / focus: keep the toast (and its "Annuler") until the pointer or focus leaves. */
export function pauseToast(): void {
  if (!toast.current) return;
  clearTimeout(timer);
  timer = undefined;
  paused = true;
}

/** Pointer / focus left: restart a full countdown. No-op unless paused. */
export function resumeToast(): void {
  if (!toast.current || !paused) return;
  paused = false;
  timer = setTimeout(dismissToast, duration);
}
