/**
 * Vercel Serverless Entry Point
 * This wraps the Express app as a Vercel serverless function.
 *
 * NOTE: better-sqlite3 (local file DB) is replaced with in-memory storage
 * on Vercel since the filesystem is read-only in serverless environments.
 * For production persistence, replace with PlanetScale / Neon / Supabase.
 */
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { AzureOpenAI } from "openai";

// ─── Inline in-memory storage (replaces SQLite for Vercel) ──────────────────
interface LessonRecord {
  id: string;
  cacheKey: string;
  ageGroup: string;
  topic: string;
  visualStyle: string;
  storyNodesJson: string;
  totalCostUsd: number | null;
  generationMs: number | null;
  createdAt: number;
}

const lessonStore = new Map<string, LessonRecord>(); // id → record
const cacheIndex = new Map<string, string>();         // cacheKey → id

const storage = {
  getByCacheKey: (key: string) => {
    const id = cacheIndex.get(key);
    return id ? lessonStore.get(id) : undefined;
  },
  getById: (id: string) => lessonStore.get(id),
  save: (rec: Omit<LessonRecord, "createdAt">): LessonRecord => {
    const existing = cacheIndex.get(rec.cacheKey);
    if (existing) {
      const updated = { ...lessonStore.get(existing)!, ...rec };
      lessonStore.set(existing, updated);
      return updated;
    }
    const full: LessonRecord = { ...rec, createdAt: Date.now() };
    lessonStore.set(rec.id, full);
    cacheIndex.set(rec.cacheKey, rec.id);
    return full;
  },
  list: () => Array.from(lessonStore.values()),
};

// ─── Types ───────────────────────────────────────────────────────────────────
type AgeGroup = "2-3" | "4-5" | "6+";
type VisualStyle = "watercolor" | "crayon" | "kawaii";

interface StoryNode {
  node_id: string;
  avatar_script: string;
  teacher_prompt: string;
  image_url: string;
  is_branching: boolean;
  choices: Array<{ button_text: string; next_node_id: string }>;
}

// ─── AI helpers ──────────────────────────────────────────────────────────────
const AGE_PROMPTS: Record<AgeGroup, string> = {
  "2-3": "Use very simple words (max 2-3 syllables). Very short sentences (5-8 words). Concrete concepts only.",
  "4-5": "Use simple vocabulary. Short sentences (8-12 words). One concept per sentence.",
  "6+":  "Can use moderately complex sentences (12-15 words). Can introduce cause-effect reasoning.",
};
const STYLE_PROMPTS: Record<VisualStyle, string> = {
  watercolor: "watercolor illustration, soft pastel colors, gentle brush strokes, children's picture book style, white background",
  crayon:     "crayon drawing, bright primary colors, slightly rough texture, children's artwork style, simple shapes",
  kawaii:     "kawaii cute style, pastel colors, big round eyes, simple cheerful expressions, Japanese children's illustration",
};
const NEGATIVE = "3D render, photorealistic, dark, scary, violent, complex background, adult, horror, nsfw";

function makeCacheKey(p: { age_group: string; topic: string; visual_style: string; image_count?: number }) {
  const count = p.image_count ?? 3;
  return createHash("md5").update(`${p.age_group}|${p.topic.toLowerCase().trim()}|${p.visual_style}|${count}`).digest("hex");
}
function makeSeed(key: string) { return parseInt(key.slice(0, 8), 16) % 2147483647; }
function estimateTextCost(i: number, o: number) { return i * 0.00000015 + o * 0.0000006; }

async function generateStory(ageGroup: AgeGroup, topic: string, visualStyle: VisualStyle) {
  const openai = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY || "placeholder",
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || "https://placeholder.openai.azure.com",
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
    deployment: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || "gpt-4o-mini",
  });
  const ageC = AGE_PROMPTS[ageGroup];
  const resp = await openai.chat.completions.create({
    model: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an expert early childhood educator creating story scripts for ${ageGroup} year old children.
Language rules: ${ageC}
Write avatar_script and button_text in Traditional Chinese (繁體中文). image_prompt must be English.
Return ONLY valid JSON, no markdown.`,
      },
      {
        role: "user",
        content: `Create an interactive story about: "${topic}", visual style: ${visualStyle}.
Return this exact JSON:
{
  "nodes": [
    {
      "node_id": "root_01",
      "avatar_script": "開場故事...",
      "teacher_prompt": "老師可以問...",
      "is_branching": true,
      "choices": [
        {"button_text": "選擇A", "next_node_id": "branch_a"},
        {"button_text": "選擇B", "next_node_id": "branch_b"}
      ],
      "image_prompt": "English scene description, ${STYLE_PROMPTS[visualStyle]}, under 60 words"
    },
    {
      "node_id": "branch_a",
      "avatar_script": "選擇A結果...",
      "teacher_prompt": "老師提示...",
      "is_branching": false,
      "choices": [],
      "image_prompt": "English scene, ${STYLE_PROMPTS[visualStyle]}"
    },
    {
      "node_id": "branch_b",
      "avatar_script": "選擇B結果...",
      "teacher_prompt": "老師提示...",
      "is_branching": false,
      "choices": [],
      "image_prompt": "English scene, ${STYLE_PROMPTS[visualStyle]}"
    },
    {
      "node_id": "ending",
      "avatar_script": "故事結尾...",
      "teacher_prompt": "老師總結...",
      "is_branching": false,
      "choices": [],
      "image_prompt": "Happy ending scene, ${STYLE_PROMPTS[visualStyle]}"
    }
  ]
}
Rules: root_01 must have is_branching:true with 2 choices. Write 2-4 sentences per avatar_script. Negative prompt to avoid: ${NEGATIVE}`,
      },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
    max_tokens: 1500,
  });
  const raw = JSON.parse(resp.choices[0].message.content || "{}");
  const nodes = (raw.nodes || []) as any[];
  const prompts = nodes.map((n: any) => n.image_prompt || topic);
  const cost = estimateTextCost(resp.usage?.prompt_tokens || 800, resp.usage?.completion_tokens || 500);
  return {
    nodes: nodes.map((n: any) => ({
      node_id: n.node_id, avatar_script: n.avatar_script, teacher_prompt: n.teacher_prompt,
      is_branching: n.is_branching, choices: n.choices || [],
    })),
    prompts,
    cost,
  };
}

async function generateImages(prompts: string[], style: VisualStyle, seed: number): Promise<string[]> {
  const suffix = STYLE_PROMPTS[style];
  return Promise.all(prompts.map(async (p) => {
    try {
      const r = await fetch("https://fal.run/fal-ai/flux/schnell", {
        method: "POST",
        headers: { Authorization: `Key ${process.env.FAL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `${p}, ${suffix}`, negative_prompt: NEGATIVE, image_size: "square_hd", num_inference_steps: 4, seed, num_images: 1, enable_safety_checker: true }),
      });
      const d: any = await r.json();
      return d.images?.[0]?.url || `https://placehold.co/512x512/FFE4B5/8B4513?text=Image`;
    } catch { return `https://placehold.co/512x512/FFE4B5/8B4513?text=Image`; }
  }));
}

// ─── Express app ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS for Vercel
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// POST /api/generate
app.post("/api/generate", async (req: Request, res: Response) => {
  const { age_group, topic, visual_style, image_count = 3, voice_lang = "zh-TW" } = req.body;
  if (!age_group || !topic || !visual_style) return res.status(400).json({ error: "Missing fields" });
  const clampedCount = Math.min(8, Math.max(1, Number(image_count)));
  const cacheKey = makeCacheKey({ age_group, topic, visual_style, image_count: clampedCount });

  const cached = storage.getByCacheKey(cacheKey);
  if (cached) {
    return res.json({
      lesson_id: cached.id,
      metadata: { age_group, topic, visual_style, image_count: clampedCount, voice_lang },
      story_nodes: JSON.parse(cached.storyNodesJson), cached: true,
      generation_ms: cached.generationMs, total_cost_usd: cached.totalCostUsd,
    });
  }

  const start = Date.now();
  try {
    const seed = makeSeed(cacheKey);
    const { nodes: textNodes, prompts, cost: textCost } = await generateStory(age_group as AgeGroup, topic, visual_style as VisualStyle);

    // Respect user-chosen image count — cap prompts to clampedCount
    const usedPrompts = prompts.slice(0, clampedCount);
    const batchSize = 4; // parallel batch to stay within rate limits
    const [firstUrls, secondUrls] = await Promise.all([
      generateImages(usedPrompts.slice(0, batchSize), visual_style as VisualStyle, seed),
      usedPrompts.length > batchSize ? generateImages(usedPrompts.slice(batchSize), visual_style as VisualStyle, seed + 1) : Promise.resolve([] as string[]),
    ]);
    const allUrls = [...firstUrls, ...secondUrls];

    const storyNodes: StoryNode[] = textNodes.map((n, i) => ({
      ...n,
      image_url: allUrls[i] || `https://placehold.co/512x512/FFE4B5/8B4513?text=Image`,
    }));
    const totalCost = textCost + (allUrls.length * 0.001);
    const genMs = Date.now() - start;
    const id = uuidv4();
    storage.save({ id, cacheKey, ageGroup: age_group, topic, visualStyle: visual_style, storyNodesJson: JSON.stringify(storyNodes), totalCostUsd: totalCost, generationMs: genMs });
    return res.json({
      lesson_id: id,
      metadata: { age_group, topic, visual_style, image_count: clampedCount, voice_lang },
      story_nodes: storyNodes, cached: false, generation_ms: genMs, total_cost_usd: totalCost,
    });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: "Generation failed", message: e.message });
  }
});

// POST /api/branch
app.post("/api/branch", async (req: Request, res: Response) => {
  const { lesson_id, node_id, age_group, topic, visual_style, choice_text, parent_script_context } = req.body;
  const lesson = storage.getById(lesson_id);
  if (lesson) {
    const nodes: StoryNode[] = JSON.parse(lesson.storyNodesJson);
    const existing = nodes.find(n => n.node_id === node_id);
    if (existing) return res.json({ node: existing, cached: true });
  }
  try {
    const openai = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY || "placeholder",
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || "https://placeholder.openai.azure.com",
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
    deployment: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || "gpt-4o-mini",
  });
    const style = visual_style as VisualStyle;
    const resp = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || "gpt-4o-mini",
      messages: [
        { role: "system", content: `Early childhood educator. ${AGE_PROMPTS[age_group as AgeGroup]} Write in Traditional Chinese except image_prompt (English). Return JSON only.` },
        { role: "user", content: `Child chose: "${choice_text}". Context: "${parent_script_context}". Topic: ${topic}. Return: {"avatar_script":"...","teacher_prompt":"...","image_prompt":"English, ${STYLE_PROMPTS[style]}, under 40 words"}` },
      ],
      temperature: 0.7, response_format: { type: "json_object" }, max_tokens: 400,
    });
    const raw = JSON.parse(resp.choices[0].message.content || "{}");
    const cacheKey = makeCacheKey({ age_group, topic, visual_style });
    const seed = makeSeed(cacheKey) + node_id.charCodeAt(node_id.length - 1);
    const [imgUrl] = await generateImages([raw.image_prompt || topic], style, seed);
    const node: StoryNode = { node_id, avatar_script: raw.avatar_script || "故事繼續...", teacher_prompt: raw.teacher_prompt || "請繼續引導小朋友。", image_url: imgUrl, is_branching: false, choices: [] };
    if (lesson) {
      const nodes: StoryNode[] = JSON.parse(lesson.storyNodesJson);
      nodes.push(node);
      storage.save({ ...lesson, storyNodesJson: JSON.stringify(nodes) });
    }
    return res.json({ node, cached: false });
  } catch (e: any) {
    return res.status(500).json({ error: "Branch failed", message: e.message });
  }
});

// GET /api/lessons
app.get("/api/lessons", (_req: Request, res: Response) => {
  const all = storage.list().map(l => ({ id: l.id, ageGroup: l.ageGroup, topic: l.topic, visualStyle: l.visualStyle, createdAt: l.createdAt, generationMs: l.generationMs, totalCostUsd: l.totalCostUsd }));
  res.json(all);
});

// GET /api/lessons/:id
app.get("/api/lessons/:id", (req: Request, res: Response) => {
  const lesson = storage.getById(req.params.id);
  if (!lesson) return res.status(404).json({ error: "Not found" });
  res.json({ lesson_id: lesson.id, metadata: { age_group: lesson.ageGroup, topic: lesson.topic, visual_style: lesson.visualStyle }, story_nodes: JSON.parse(lesson.storyNodesJson), cached: true, generation_ms: lesson.generationMs, total_cost_usd: lesson.totalCostUsd });
});

export default app;
