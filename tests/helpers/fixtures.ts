import type { makeTestDb } from './db';

type TestDb = ReturnType<typeof makeTestDb>;

export function makeHousehold(tdb: TestDb, name = 'Foyer'): number {
  return tdb.db.insert(tdb.schema.households).values({ name }).returning({ id: tdb.schema.households.id }).get().id;
}

export function makeUser(
  tdb: TestDb,
  householdId: number,
  opts: { email?: string; isAdmin?: boolean } = {}
): number {
  return tdb.db
    .insert(tdb.schema.users)
    .values({
      email: opts.email ?? `user${Math.random().toString(36).slice(2)}@example.com`,
      passwordHash: 'x',
      isAdmin: opts.isAdmin ? 1 : 0,
      householdId
    })
    .returning({ id: tdb.schema.users.id })
    .get().id;
}

export function makeLocation(tdb: TestDb, householdId: number, name: string): number {
  return tdb.db
    .insert(tdb.schema.locations)
    .values({ householdId, name })
    .returning({ id: tdb.schema.locations.id })
    .get().id;
}
