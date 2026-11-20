import { sqliteTable, integer, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const households = sqliteTable('households', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phaseScanDate: text('phase_scan_date'), // YYYY-MM-DD, jour du dernier scan des phases (null = jamais scanné)
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`)
});

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isAdmin: integer('is_admin').notNull().default(0),
  timezone: text('timezone').notNull().default('Europe/Paris'),
  locale: text('locale').notNull().default('fr'),
  notifyPhases: integer('notify_phases').notNull().default(1),
  notifyMonthly: integer('notify_monthly').notNull().default(1),
  lastDispatchDate: text('last_dispatch_date'), // YYYY-MM-DD, jour du dernier envoi quotidien
  lastDispatchAt: integer('last_dispatch_at'),
  lastMonthlyMonth: text('last_monthly_month'), // YYYY-MM
  householdId: integer('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'restrict' }),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`)
});

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at').notNull(),
    lastUsedAt: integer('last_used_at').notNull(),
    userAgent: text('user_agent'),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch())`)
  },
  (t) => ({
    expIdx: index('sessions_expires_at').on(t.expiresAt),
    userIdx: index('sessions_user_id').on(t.userId)
  })
);

export const invitations = sqliteTable('invitations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  token: text('token').notNull().unique(),
  createdBy: integer('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  householdId: integer('household_id').references(() => households.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
  usedAt: integer('used_at'),
  usedBy: integer('used_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`)
});

export const appConfig = sqliteTable('app_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`)
});

export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
    lastSeenAt: integer('last_seen_at').notNull().default(sql`(unixepoch())`)
  },
  (t) => ({
    userIdx: index('push_subscriptions_user_id').on(t.userId)
  })
);

export const locations = sqliteTable(
  'locations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch())`)
  },
  (t) => ({
    householdNameUq: uniqueIndex('locations_household_name').on(t.householdId, t.name)
  })
);

export const wines = sqliteTable(
  'wines',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    producer: text('producer'),
    cuvee: text('cuvee'),
    appellation: text('appellation'),
    region: text('region'),
    country: text('country'),
    color: text('color'),
    vintage: integer('vintage'),
    grapes: text('grapes'),
    formatCl: integer('format_cl').notNull().default(75),
    acquiredYear: integer('acquired_year'),
    drinkFrom: integer('drink_from'),
    peakFrom: integer('peak_from'),
    peakTo: integer('peak_to'),
    drinkUntil: integer('drink_until'),
    windowSource: text('window_source', { enum: ['ai', 'manual'] }).notNull().default('manual'),
    aiConfidence: text('ai_confidence'),
    aiRationale: text('ai_rationale'),
    aiModel: text('ai_model'),
    aiAnalyzedAt: integer('ai_analyzed_at'),
    labelPhoto: text('label_photo'),
    notes: text('notes'),
    identityKey: text('identity_key').notNull(),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`)
  },
  (t) => ({
    identityIdx: index('wines_household_identity').on(t.householdId, t.identityKey)
  })
);

export const stockLots = sqliteTable(
  'stock_lots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    wineId: integer('wine_id').notNull().references(() => wines.id, { onDelete: 'cascade' }),
    locationId: integer('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'restrict' }),
    position: text('position').notNull().default(''),
    quantity: integer('quantity').notNull().default(0)
  },
  (t) => ({
    lotUq: uniqueIndex('stock_lots_wine_location_position').on(t.wineId, t.locationId, t.position)
  })
);

export const consumptions = sqliteTable('consumptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  wineId: integer('wine_id').notNull().references(() => wines.id, { onDelete: 'cascade' }),
  lotId: integer('lot_id').references(() => stockLots.id, { onDelete: 'set null' }),
  locationId: integer('location_id').references(() => locations.id, { onDelete: 'set null' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  consumedOn: text('consumed_on').notNull(),
  rating: integer('rating'),
  note: text('note'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`)
});

export const appliedOps = sqliteTable('applied_ops', {
  opId: text('op_id').primaryKey(),
  householdId: integer('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  appliedAt: integer('applied_at').notNull().default(sql`(unixepoch())`),
  result: text('result').notNull()
});

export type Household = typeof households.$inferSelect;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type AppConfig = typeof appConfig.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Wine = typeof wines.$inferSelect;
export type StockLot = typeof stockLots.$inferSelect;
export type Consumption = typeof consumptions.$inferSelect;

export const labelAnalyses = sqliteTable(
  'label_analyses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    photoPath: text('photo_path'),
    /** The normalized LabelAnalysis, as JSON. Null when the analysis failed. */
    result: text('result'),
    errorCode: text('error_code'),
    model: text('model'),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch())`)
  },
  (t) => ({
    householdCreatedIdx: index('label_analyses_household_created').on(t.householdId, t.createdAt)
  })
);

/** Phases notifiables déjà vues pour un vin ; `silent` = enregistrée sans notification (action de l'utilisateur, amorçage). */
export const notificationLog = sqliteTable(
  'notification_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    wineId: integer('wine_id').notNull().references(() => wines.id, { onDelete: 'cascade' }),
    phase: text('phase').notNull(),
    detectedAt: integer('detected_at').notNull(),
    silent: integer('silent').notNull().default(0)
  },
  (t) => ({
    winePhaseUq: uniqueIndex('notification_log_wine_phase').on(t.wineId, t.phase),
    detectedIdx: index('notification_log_detected_at').on(t.detectedAt)
  })
);
