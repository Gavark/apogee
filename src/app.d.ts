// Placeholder types: `User` and `Session` come from the schema in Task 2
// (users / sessions tables) and `Locale` from the auth module.
type User = { id: number };
type Session = { id: string };
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
