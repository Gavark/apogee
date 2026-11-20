import type { User, Session } from '$lib/server/db/schema';

// Placeholder: `Locale` comes from the i18n module (Task 3).
type Locale = 'fr' | 'en';

declare global {
  namespace App {
    interface Locals {
      user: User | null;
      session: Session | null;
      theme: 'auto' | 'light' | 'dark';
      locale: Locale;
    }
    interface PageData {
      user: User | null;
    }
    interface Error {}
    interface Platform {}
  }
}

export {};
