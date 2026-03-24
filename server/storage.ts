import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { lessons, type Lesson, type InsertLesson } from "@shared/schema";

const sqlite = new Database("data.db");
export const db = drizzle(sqlite);

// Auto-migrate on startup
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    cache_key TEXT NOT NULL UNIQUE,
    age_group TEXT NOT NULL,
    topic TEXT NOT NULL,
    visual_style TEXT NOT NULL,
    story_nodes_json TEXT NOT NULL,
    total_cost_usd REAL,
    generation_ms INTEGER,
    created_at INTEGER NOT NULL
  );
`);

export interface IStorage {
  getLessonByCacheKey(cacheKey: string): Lesson | undefined;
  getLessonById(id: string): Lesson | undefined;
  upsertLesson(lesson: InsertLesson): Lesson;
  listLessons(): Lesson[];
}

export const storage: IStorage = {
  getLessonByCacheKey(cacheKey: string) {
    return db.select().from(lessons).where(eq(lessons.cacheKey, cacheKey)).get();
  },
  getLessonById(id: string) {
    return db.select().from(lessons).where(eq(lessons.id, id)).get();
  },
  upsertLesson(lesson: InsertLesson) {
    return db
      .insert(lessons)
      .values({ ...lesson, createdAt: Date.now() })
      .onConflictDoUpdate({
        target: lessons.cacheKey,
        set: {
          storyNodesJson: lesson.storyNodesJson,
          totalCostUsd: lesson.totalCostUsd,
          generationMs: lesson.generationMs,
        },
      })
      .returning()
      .get();
  },
  listLessons() {
    return db.select().from(lessons).all();
  },
};
