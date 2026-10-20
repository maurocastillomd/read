import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const libraryBooks = sqliteTable("library_books", {
  userId: text("user_id").notNull(), bookId: text("book_id").notNull(),
  sourceHash: text("source_hash").notNull(), objectKey: text("object_key").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [primaryKey({ columns: [t.userId, t.bookId] })]);

export const libraryGuides = sqliteTable("library_guides", {
  userId: text("user_id").notNull(), bookId: text("book_id").notNull(), sourceHash: text("source_hash").notNull(),
  unitId: text("unit_id").notNull(), objectKey: text("object_key").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [primaryKey({ columns: [t.userId, t.bookId, t.sourceHash, t.unitId] })]);

export const libraryState = sqliteTable("library_state", {
  userId: text("user_id").notNull(), area: text("area").notNull(), bookId: text("book_id").notNull(),
  fieldKey: text("field_key").notNull(), valueJson: text("value_json").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [primaryKey({ columns: [t.userId, t.area, t.bookId, t.fieldKey] })]);

// One current full-book generation job per user. Guides survive job replacement.
export const generationJobs = sqliteTable("generation_jobs", {
  userId: text("user_id").primaryKey(), jobId: text("job_id").notNull(),
  jobJson: text("job_json").notNull(), leaseToken: text("lease_token").notNull().default(""),
  leaseUntil: integer("lease_until").notNull().default(0), updatedAt: text("updated_at").notNull(),
});
