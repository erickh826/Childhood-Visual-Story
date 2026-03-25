// ─── Utility: getLangInstruction ─────────────────────────────────────────────
function getLangInstruction(lang: string): string {
  if (lang === "en-US") return "All story text and prompts must be in English.";
  if (lang === "zh-HK") return "All story text and prompts must be in Cantonese (粵語, zh-HK), using Traditional Chinese characters.";
  return "All story text and prompts must be in Traditional Chinese (繁體中文, zh-TW).";
}

import express, { type Request, type NextFunction } from "express";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { AzureOpenAI } from "openai";

// ─── Constants ───────────────────────────────────────────────────────────────
const FAL_COST_PER_IMAGE_USD = 0.001;
const MAX_TOPIC_LENGTH = 200;

// ─── Inline in-memory storage (replaces SQLite for Vercel) ──────────────────
interface LessonRecord {
  id: string;
  cacheKey: string;
  ageGroup: string;
  topic: string;
  visualStyle: string;
  voiceLang: string;
  avatarStyle: string;
  storyNodesJson: string;
  totalCostUsd: number | null;
  generationMs: number | null;
  createdAt: number;
}

const lessonStore = new Map<string, LessonRecord>();
const cacheIndex = new Map<string, string>();

const storage = {
  getByCacheKey: (key: string) => {
    const id = cacheIndex.get(key);
    return id ? lessonStore.get(id) : undefined;
  },
  getById: (id: string) => lessonStore.get(id),
  save: (rec: LessonRecord): LessonRecord => {
    const existing = cacheIndex.get(rec.cacheKey);
    if (existing) {
      lessonStore.set(existing, rec);
      return rec;
    }
    lessonStore.set(rec.id, rec);
    cacheIndex.set(rec.cacheKey, rec.id);
    return rec;
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
const NEGATIVE = [
  "realistic", "semi-realistic", "photorealistic", "3D render", "3D CGI",
  "detailed textures", "hyper-detailed", "HDR photo",
  "dark colors", "dark background", "low lighting", "gloomy", "monochrome",
  "distorted face", "extra limbs", "deformed hands", "missing fingers",
  "bad anatomy", "disfigured", "mutation", "ugly",
  "inconsistent style", "mixed styles", "messy lines", "sketch",
  "complex background", "busy background", "cluttered",
  "adult", "nsfw", "violence", "horror", "scary", "blood",
].join(", ");

function sanitizeTopic(topic: string): string {
  return topic.trim().slice(0, MAX_TOPIC_LENGTH).replace(/[\r\n]+/g, " ");
}

function makeCacheKey(p: { age_group: string; topic: string; visual_style: string; image_count?: number }) {
  const count = p.image_count ?? 3;
  return createHash("md5").update(`${p.age_group}|${p.topic.toLowerCase().trim()}|${p.visual_style}|${count}`).digest("hex");
}

function makeSeed(key: string) {
  return (parseInt(key.slice(0, 8), 16) % 2147483646) + 1;
}

function estimateTextCost(i: number, o: number) {
  return i * 0.00000015 + o * 0.0000006;
}

function safeParseLLMJson(content: string | null | undefined): Record<string, any> {
  try {
    return JSON.parse(content || "{}");
  } catch {
    throw new Error("LLM returned invalid JSON");
  }
}


function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

function createOpenAIClient(): AzureOpenAI {
  return new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY || "placeholder",
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || "https://placeholder.openai.azure.com",
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
    deployment: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || "gpt-4o-mini",
  });
}

async function generateStory(ageGroup: AgeGroup, topic: string, visualStyle: VisualStyle, voiceLang: string = "zh-TW") {
  const openai = createOpenAIClient();
  const ageC = AGE_PROMPTS[ageGroup];
  const safeTopic = sanitizeTopic(topic);
  const resp = await openai.chat.completions.create({
    model: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an expert early childhood educator creating story scripts for ${ageGroup} year old children.
Language rules: ${ageC}
${getLangInstruction(voiceLang)}
Return ONLY valid JSON, no markdown.`,
      },
      {
        role: "user",
        content: `Create an interactive story about: "${safeTopic}", visual style: ${visualStyle}.
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

  const raw = safeParseLLMJson(resp.choices[0].message.content);
  const nodes = (raw.nodes || []) as any[];
  const prompts = nodes.map((n: any) => n.image_prompt || safeTopic);
  const cost = estimateTextCost(resp.usage?.prompt_tokens || 800, resp.usage?.completion_tokens || 500);
  return {
    nodes: nodes.map((n: any) => ({
      node_id: n.node_id,
      avatar_script: n.avatar_script,
      teacher_prompt: n.teacher_prompt,
      is_branching: n.is_branching,
      choices: n.choices || [],
    })),
    prompts,
    cost,
  };
}

async function generateImages(prompts: string[], style: VisualStyle, seed: number): Promise<string[]> {
  const suffix = STYLE_PROMPTS[style];
  return Promise.all(prompts.map(async (p) => {
    try {
      const r = await globalThis.fetch("https://fal.run/fal-ai/flux/schnell", {
        method: "POST",
        headers: { Authorization: `Key ${process.env.FAL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${p}, ${suffix}`,
          negative_prompt: NEGATIVE,
          image_size: "square_hd",
          num_inference_steps: 4,
          seed,
          num_images: 1,
          enable_safety_checker: true,
        }),
      }, 25000);  // 25s timeout per image
      const d: any = await r.json();
      return d.images?.[0]?.url || `https://placehold.co/512x512/FFE4B5/8B4513?text=Image`;
    } catch {
      return `https://placehold.co/512x512/FFE4B5/8B4513?text=Image`;
    }
  }));
}

// ─── Express app ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS
app.use((_req: Request, res: express.Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// POST /api/generate
app.post("/api/generate", async (req: Request, res: express.Response) => {
  const {
    age_group,
    topic,
    visual_style,
    image_count = 3,
    voice_lang = "zh-TW",
    avatar_style = "bear",
  } = req.body;

  if (!age_group || !topic || !visual_style) {
    res.status(400).json({ error: "Missing fields" });
    return;
  }

  const safeTopic = sanitizeTopic(topic);
  const clampedCount = Math.min(8, Math.max(1, Number(image_count)));
  const cacheKey = makeCacheKey({ age_group, topic: safeTopic, visual_style, image_count: clampedCount });

  const cached = storage.getByCacheKey(cacheKey);
  if (cached) {
    res.json({
      lesson_id: cached.id,
      metadata: { age_group, topic: safeTopic, visual_style, image_count: clampedCount, voice_lang, avatar_style },
      story_nodes: JSON.parse(cached.storyNodesJson),
      cached: true,
      generation_ms: cached.generationMs,
      total_cost_usd: cached.totalCostUsd,
    });
    return;
  }

  const start = Date.now();
  try {
    const seed = makeSeed(cacheKey);
    const { nodes: textNodes, prompts, cost: textCost } = await generateStory(
      age_group as AgeGroup,
      safeTopic,
      visual_style as VisualStyle,
      voice_lang,
    );

    const usedPrompts = prompts.slice(0, clampedCount);
    const batchSize = 4;
    const [firstUrls, secondUrls] = await Promise.all([
      generateImages(usedPrompts.slice(0, batchSize), visual_style as VisualStyle, seed),
      usedPrompts.length > batchSize
        ? generateImages(usedPrompts.slice(batchSize), visual_style as VisualStyle, seed + 1)
        : Promise.resolve([] as string[]),
    ]);
    const allUrls = [...firstUrls, ...secondUrls];

    const storyNodes: StoryNode[] = textNodes.map((n, i) => ({
      ...n,
      image_url: allUrls[i] || `https://placehold.co/512x512/FFE4B5/8B4513?text=Image`,
    }));

    const totalCost = textCost + (allUrls.length * FAL_COST_PER_IMAGE_USD);
    const genMs = Date.now() - start;
    const id = uuidv4();

    storage.save({
      id,
      cacheKey,
      ageGroup: age_group,
      topic: safeTopic,
      visualStyle: visual_style,
      voiceLang: voice_lang,
      avatarStyle: avatar_style,
      storyNodesJson: JSON.stringify(storyNodes),
      totalCostUsd: totalCost,
      generationMs: genMs,
      createdAt: Date.now(),
    });

    res.json({
      lesson_id: id,
      metadata: { age_group, topic: safeTopic, visual_style, image_count: clampedCount, voice_lang, avatar_style },
      story_nodes: storyNodes,
      cached: false,
      generation_ms: genMs,
      total_cost_usd: totalCost,
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Generation failed", message: e.message });
  }
});

// POST /api/branch
app.post("/api/branch", async (req: Request, res: express.Response) => {
  const {
    lesson_id,
    node_id,
    age_group,
    topic,
    visual_style,
    choice_text,
    parent_script_context,
    voice_lang = "zh-TW",
  } = req.body;

  const lesson = storage.getById(lesson_id);
  if (lesson) {
    const nodes: StoryNode[] = JSON.parse(lesson.storyNodesJson);
    const existing = nodes.find((n) => n.node_id === node_id);
    if (existing) {
      res.json({ node: existing, cached: true });
      return;
    }
  }

  try {
    const openai = createOpenAIClient();
    const style = visual_style as VisualStyle;
    const safeTopic = sanitizeTopic(topic);
    const safeChoice = sanitizeTopic(choice_text);
    const safeContext = (parent_script_context || "").trim().slice(0, 500);

    const resp = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Early childhood educator. ${AGE_PROMPTS[age_group as AgeGroup]} ${getLangInstruction(voice_lang)}. Return JSON only.`,
        },
        {
          role: "user",
          content: `Child chose: "${safeChoice}". Context: "${safeContext}". Topic: ${safeTopic}. Return: {"avatar_script":"...","teacher_prompt":"...","image_prompt":"English, ${STYLE_PROMPTS[style]}, under 40 words"}`,
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
      max_tokens: 400,
    });

    const raw = safeParseLLMJson(resp.choices[0].message.content);
    const cacheKey = makeCacheKey({ age_group, topic: safeTopic, visual_style });
    const seed = makeSeed(cacheKey) + node_id.charCodeAt(node_id.length - 1);
    const [imgUrl] = await generateImages([raw.image_prompt || safeTopic], style, seed);

    const node: StoryNode = {
      node_id,
      avatar_script: raw.avatar_script || (voice_lang === "en-US" ? "The story continues..." : "故事繼續..."),
      teacher_prompt: raw.teacher_prompt || (voice_lang === "en-US" ? "Guide the children to reflect on their choice." : "請繼續引導小朋友。"),
      image_url: imgUrl,
      is_branching: false,
      choices: [],
    };

    if (lesson) {
      const nodes: StoryNode[] = JSON.parse(lesson.storyNodesJson);
      nodes.push(node);
      storage.save({
        ...lesson,
        storyNodesJson: JSON.stringify(nodes),
      });
    }

    res.json({ node, cached: false });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Branch failed", message: e.message });
  }
});

// GET /api/health — quick liveness check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", ts: Date.now() });
});

// GET /api/lessons
app.get("/api/lessons", (_req: Request, res: express.Response) => {
  const all = storage.list().map((l) => ({
    id: l.id,
    ageGroup: l.ageGroup,
    topic: l.topic,
    visualStyle: l.visualStyle,
    createdAt: l.createdAt,
    generationMs: l.generationMs,
    totalCostUsd: l.totalCostUsd,
  }));
  res.json(all);
});

// GET /api/lessons/:id
app.get("/api/lessons/:id", (req: Request, res: express.Response) => {
  const id = String(req.params.id);
  const lesson = storage.getById(id);
  if (!lesson) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    lesson_id: lesson.id,
    metadata: {
      age_group: lesson.ageGroup,
      topic: lesson.topic,
      visual_style: lesson.visualStyle,
      voice_lang: lesson.voiceLang,
      avatar_style: lesson.avatarStyle,
    },
    story_nodes: JSON.parse(lesson.storyNodesJson),
    cached: true,
    generation_ms: lesson.generationMs,
    total_cost_usd: lesson.totalCostUsd,
  });
});

export default app;