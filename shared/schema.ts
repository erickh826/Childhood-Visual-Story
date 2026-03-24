import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Lessons table (cached lesson plans) ─────────────────────────────────────
export const lessons = sqliteTable("lessons", {
  id: text("id").primaryKey(), // UUID v4
  cacheKey: text("cache_key").notNull().unique(), // MD5 of params
  ageGroup: text("age_group").notNull(), // "2-3" | "4-5" | "6+"
  topic: text("topic").notNull(),
  visualStyle: text("visual_style").notNull(), // "watercolor" | "crayon" | "kawaii"
  storyNodesJson: text("story_nodes_json").notNull(), // serialized StoryNode[]
  totalCostUsd: real("total_cost_usd"),
  generationMs: integer("generation_ms"),
  createdAt: integer("created_at").notNull(), // unix timestamp ms
});

// ── Zod schemas ──────────────────────────────────────────────────────────────
export const insertLessonSchema = createInsertSchema(lessons).omit({
  createdAt: true,
});

export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type Lesson = typeof lessons.$inferSelect;

// ── Domain types (not DB — used in API payloads) ─────────────────────────────
export const AGE_GROUPS = ["2-3", "4-5", "6+"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const VISUAL_STYLES = ["watercolor", "crayon", "kawaii"] as const;
export type VisualStyle = (typeof VISUAL_STYLES)[number];

export interface Choice {
  button_text: string;
  next_node_id: string;
}

export interface StoryNode {
  node_id: string;
  avatar_script: string;
  teacher_prompt: string;
  image_url: string;
  is_branching: boolean;
  choices: Choice[];
}

export interface LessonPayload {
  lesson_id: string;
  metadata: {
    age_group: AgeGroup;
    topic: string;
    visual_style: VisualStyle;
    image_count?: number;
    voice_lang?: VoiceLang;
    avatar_style?: AvatarStyle;
  };
  story_nodes: StoryNode[];
  cached: boolean;
  generation_ms?: number;
  total_cost_usd?: number;
}

export const AVATAR_STYLES = ["bear", "cat", "robot", "bunny", "girl"] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];
export const AVATAR_LABELS: Record<AvatarStyle, string> = {
  bear: "小熊 🐻",
  cat: "貓咪 🐱",
  robot: "機器人 🤖",
  bunny: "兔兔 🐰",
  girl: "小女孩 👧",
};

export const VOICE_LANGS = ["zh-TW", "en-US", "zh-HK"] as const;
export type VoiceLang = (typeof VOICE_LANGS)[number];

export const VOICE_LANG_LABELS: Record<VoiceLang, string> = {
  "zh-TW": "繁體中文（台灣）",
  "en-US": "English (US)",
  "zh-HK": "廣東話（香港）",
};

// Generate request schema
export const generateRequestSchema = z.object({
  age_group: z.enum(AGE_GROUPS),
  topic: z.string().min(1).max(200),
  visual_style: z.enum(VISUAL_STYLES),
  image_count: z.number().int().min(1).max(8).default(3),
  voice_lang: z.enum(VOICE_LANGS).default("zh-TW"),
  avatar_style: z.enum(AVATAR_STYLES).default("bear"),
});
export type GenerateRequest = z.infer<typeof generateRequestSchema>;

// Branch generation request
export const branchRequestSchema = z.object({
  lesson_id: z.string().uuid(),
  node_id: z.string(),
  choice_key: z.string(), // "share" | "hide" etc.
  parent_script_context: z.string(),
  age_group: z.enum(AGE_GROUPS),
  topic: z.string(),
  visual_style: z.enum(VISUAL_STYLES),
  choice_text: z.string(),
});
export type BranchRequest = z.infer<typeof branchRequestSchema>;
