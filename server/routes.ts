import type { Express } from "express";
import type { Server } from "http";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { storage } from "./storage";
import { generateStoryText, generateImages, generateBranchNode } from "./ai";
import { generateRequestSchema, branchRequestSchema } from "@shared/schema";
import type { LessonPayload, StoryNode } from "@shared/schema";

function makeCacheKey(params: { age_group: string; topic: string; visual_style: string; image_count?: number }): string {
  const count = params.image_count ?? 3;
  const str = `${params.age_group}|${params.topic.toLowerCase().trim()}|${params.visual_style}|${count}`;
  return createHash("md5").update(str).digest("hex");
}

function makeSeed(cacheKey: string): number {
  // Deterministic seed from cache key so same params = same images
  return parseInt(cacheKey.slice(0, 8), 16) % 2147483647;
}

export function registerRoutes(httpServer: Server, app: Express) {
  // ── POST /api/generate ────────────────────────────────────────────────────
  app.post("/api/generate", async (req, res) => {
    const parsed = generateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    }
    const { age_group, topic, visual_style, image_count = 3, voice_lang = "zh-TW", avatar_style = "bear" } = parsed.data;
    const clampedCount = Math.min(8, Math.max(1, image_count));
    const cacheKey = makeCacheKey({ age_group, topic, visual_style, image_count: clampedCount });

    // ── Cache hit ─────────────────────────────────────────────────────────
    const cached = storage.getLessonByCacheKey(cacheKey);
    if (cached) {
      const payload: LessonPayload = {
        lesson_id: cached.id,
        metadata: { age_group: cached.ageGroup as any, topic: cached.topic, visual_style: cached.visualStyle as any, image_count: clampedCount, voice_lang: voice_lang as any, avatar_style: avatar_style as any },
        story_nodes: JSON.parse(cached.storyNodesJson),
        cached: true,
        generation_ms: cached.generationMs || 0,
        total_cost_usd: cached.totalCostUsd || 0,
      };
      return res.json(payload);
    }

    // ── Cache miss: generate in parallel ─────────────────────────────────
    const startMs = Date.now();
    try {
      const seed = makeSeed(cacheKey);

      // Generate text first (we need image prompts from text output)
      const { nodes: textNodes, imagePrompts, costUsd: textCost } = await generateStoryText(age_group, topic, visual_style, clampedCount, voice_lang);

      // Only generate images for root and branches, not ALL nodes — but for PoC generate main 3 in parallel
      // We generate images for root_01, branch_a, branch_b upfront; ending is the 4th
      const usedPrompts = imagePrompts.slice(0, clampedCount);
      const batchSize = 4;
      const [mainImages, remainingImages] = await Promise.all([
        generateImages(usedPrompts.slice(0, batchSize), visual_style, seed),
        usedPrompts.length > batchSize ? generateImages(usedPrompts.slice(batchSize), visual_style, seed + 1) : Promise.resolve({ urls: [], costUsd: 0 }),
      ]);

      const allImageUrls = [...mainImages.urls, ...remainingImages.urls];
      const imageCost = mainImages.costUsd + remainingImages.costUsd;
      const totalCost = textCost + imageCost;

      const storyNodes: StoryNode[] = textNodes.map((node, i) => ({
        ...node,
        image_url: allImageUrls[i] || `https://placehold.co/512x512/FFE4B5/8B4513?text=${encodeURIComponent(node.avatar_script.slice(0, 10))}`,
      }));

      const genMs = Date.now() - startMs;
      const lessonId = uuidv4();

      storage.upsertLesson({
        id: lessonId,
        cacheKey,
        ageGroup: age_group,
        topic,
        visualStyle: visual_style,
        storyNodesJson: JSON.stringify(storyNodes),
        totalCostUsd: totalCost,
        generationMs: genMs,
      });

      const payload: LessonPayload = {
        lesson_id: lessonId,
        metadata: { age_group, topic, visual_style, image_count: clampedCount, voice_lang: voice_lang as any, avatar_style: avatar_style as any },
        story_nodes: storyNodes,
        cached: false,
        generation_ms: genMs,
        total_cost_usd: totalCost,
      };

      return res.json(payload);
    } catch (err: any) {
      console.error("Generation error:", err);
      return res.status(500).json({ error: "Generation failed", message: err.message });
    }
  });

  // ── POST /api/branch ──────────────────────────────────────────────────────
  // Lazy-load a branch node when a child clicks a choice
  app.post("/api/branch", async (req, res) => {
    const parsed = branchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    }

    const { lesson_id, node_id, age_group, topic, visual_style, choice_text, parent_script_context } = parsed.data;

    // Check if this lesson already has this node cached
    const lesson = storage.getLessonById(lesson_id);
    if (lesson) {
      const nodes: StoryNode[] = JSON.parse(lesson.storyNodesJson);
      const existingNode = nodes.find((n) => n.node_id === node_id);
      if (existingNode) {
        return res.json({ node: existingNode, cached: true });
      }
    }

    try {
      const clampedCount = Math.min(8, Math.max(1, image_count));
    const cacheKey = makeCacheKey({ age_group, topic, visual_style, image_count: clampedCount });
      const seed = makeSeed(cacheKey) + node_id.charCodeAt(node_id.length - 1);

      const voiceLangFromLesson = lesson?.ageGroup ? (storage.getLessonById(lesson_id)?.storyNodesJson ? "zh-TW" : "zh-TW") : "zh-TW";
      const { node, costUsd } = await generateBranchNode({
        ageGroup: age_group as any,
        topic,
        visualStyle: visual_style as any,
        choiceText: choice_text,
        parentContext: parent_script_context,
        nodeId: node_id,
        seed,
        voiceLang: req.body.voice_lang || "zh-TW",
      });

      // Append new node to cached lesson
      if (lesson) {
        const nodes: StoryNode[] = JSON.parse(lesson.storyNodesJson);
        nodes.push(node);
        storage.upsertLesson({
          id: lesson.id,
          cacheKey: lesson.cacheKey,
          ageGroup: lesson.ageGroup,
          topic: lesson.topic,
          visualStyle: lesson.visualStyle,
          storyNodesJson: JSON.stringify(nodes),
          totalCostUsd: (lesson.totalCostUsd || 0) + costUsd,
          generationMs: lesson.generationMs,
        });
      }

      return res.json({ node, cached: false });
    } catch (err: any) {
      console.error("Branch generation error:", err);
      return res.status(500).json({ error: "Branch generation failed", message: err.message });
    }
  });

  // ── GET /api/lessons ──────────────────────────────────────────────────────
  app.get("/api/lessons", (_req, res) => {
    const all = storage.listLessons().map((l) => ({
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

  // ── GET /api/lessons/:id ──────────────────────────────────────────────────
  app.get("/api/lessons/:id", (req, res) => {
    const lesson = storage.getLessonById(req.params.id);
    if (!lesson) return res.status(404).json({ error: "Not found" });
    const payload: LessonPayload = {
      lesson_id: lesson.id,
      metadata: { age_group: lesson.ageGroup as any, topic: lesson.topic, visual_style: lesson.visualStyle as any },
      story_nodes: JSON.parse(lesson.storyNodesJson),
      cached: true,
      generation_ms: lesson.generationMs || 0,
      total_cost_usd: lesson.totalCostUsd || 0,
    };
    res.json(payload);
  });
}
