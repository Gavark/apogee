import type { User, Session } from '$lib/server/db/schema';
import type { Locale } from '$lib/server/auth/locale';
import type { PublicUser } from '$lib/server/auth/public-user';

declare global {
  namespace App {
    interface Locals {
      user: User | null;
      session: Session | null;
      theme: 'auto' | 'light' | 'dark';
      locale: Locale;
    }
    interface PageData {
      user: PublicUser | null;
    }
    interface Error {}
    interface Platform {}
  }
}

export {};
