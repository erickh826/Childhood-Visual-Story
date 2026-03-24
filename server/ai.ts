import { AzureOpenAI } from "openai";
import type { AgeGroup, VisualStyle, StoryNode, Choice } from "@shared/schema";

/**
 * Returns an AzureOpenAI client.
 * Required env vars:
 *   AZURE_OPENAI_API_KEY      — Azure resource key (Keys & Endpoint in portal)
 *   AZURE_OPENAI_ENDPOINT     — e.g. https://YOUR-RESOURCE.openai.azure.com
 *   AZURE_OPENAI_DEPLOYMENT   — your deployment name (e.g. gpt-4o-mini)
 *   AZURE_OPENAI_API_VERSION  — e.g. 2024-12-01-preview  (optional, defaults below)
 */
function getOpenAI() {
  return new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY || "placeholder",
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || "https://placeholder.openai.azure.com",
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini",
  });
}

// ── Age → prompt constraints ─────────────────────────────────────────────────
const AGE_PROMPTS: Record<AgeGroup, string> = {
  "2-3": "Use very simple words (max 2-3 syllables). Very short sentences (5-8 words). Concrete concepts only. No abstract ideas.",
  "4-5": "Use simple vocabulary. Short sentences (8-12 words). One concept per sentence. Emotions are ok.",
  "6+": "Can use moderately complex sentences (12-15 words). Can introduce cause-effect reasoning.",
};

// ── Visual style → image prompt suffix ───────────────────────────────────────
const STYLE_PROMPTS: Record<VisualStyle, string> = {
  watercolor: "watercolor illustration, soft pastel colors, gentle brush strokes, children's picture book style, white background",
  crayon: "crayon drawing, bright primary colors, slightly rough texture, children's artwork style, simple shapes",
  kawaii: "kawaii cute style, pastel colors, big round eyes, simple cheerful expressions, Japanese children's illustration",
};

const NEGATIVE_PROMPT = "3D render, photorealistic, dark, scary, violent, complex background, adult, horror, nsfw";

// Rough cost tracking (GPT-4o-mini pricing: $0.15/1M input, $0.60/1M output)
function estimateTextCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens * 0.00000015) + (outputTokens * 0.0000006);
}

// fal.ai FLUX.1-schnell at ~$0.001 per image
const IMAGE_COST_USD = 0.001;

// ── Generate story text via GPT-4o-mini ──────────────────────────────────────
export async function generateStoryText(
  ageGroup: AgeGroup,
  topic: string,
  visualStyle: VisualStyle
): Promise<{ nodes: Omit<StoryNode, "image_url">[]; imagePrompts: string[]; costUsd: number }> {
  const ageConstraints = AGE_PROMPTS[ageGroup];

  const systemPrompt = `You are an expert early childhood educator creating interactive story scripts for ${ageGroup} year old children.
Language rules: ${ageConstraints}
Always write in Traditional Chinese (繁體中文) for avatar_script and button_text, but English for image prompts.
Return ONLY valid JSON, no markdown or explanation.`;

  const userPrompt = `Create an interactive story about: "${topic}"
Visual style for illustrations: ${visualStyle}

Return this exact JSON structure:
{
  "nodes": [
    {
      "node_id": "root_01",
      "avatar_script": "故事開場...",
      "teacher_prompt": "老師可以問...",
      "is_branching": true,
      "choices": [
        {"button_text": "選擇A", "next_node_id": "branch_a"},
        {"button_text": "選擇B", "next_node_id": "branch_b"}
      ],
      "image_prompt": "short english description for illustration, child, ${topic}, ${STYLE_PROMPTS[visualStyle]}"
    },
    {
      "node_id": "branch_a",
      "avatar_script": "選擇A的結果...",
      "teacher_prompt": "老師可以說...",
      "is_branching": false,
      "choices": [],
      "image_prompt": "short english description, ${STYLE_PROMPTS[visualStyle]}"
    },
    {
      "node_id": "branch_b",
      "avatar_script": "選擇B的結果...",
      "teacher_prompt": "老師可以說...",
      "is_branching": false,
      "choices": [],
      "image_prompt": "short english description, ${STYLE_PROMPTS[visualStyle]}"
    },
    {
      "node_id": "ending",
      "avatar_script": "故事結尾...",
      "teacher_prompt": "老師可以總結...",
      "is_branching": false,
      "choices": [],
      "image_prompt": "short english description, happy ending, ${STYLE_PROMPTS[visualStyle]}"
    }
  ]
}

Rules:
- The root_01 node must have is_branching: true with exactly 2 choices
- branch_a and branch_b must link to "ending" implicitly (they are the last branches before the final "ending" node)
- Write 2-4 sentences per avatar_script
- teacher_prompt should be a practical tip for the teacher at that moment
- image_prompt must be in English, under 60 words, describe a simple scene
- Do NOT include ${NEGATIVE_PROMPT} in image_prompt`;

  const response = await getOpenAI().chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
    max_tokens: 1500,
  });

  const raw = JSON.parse(response.choices[0].message.content || "{}");
  const nodes: Omit<StoryNode, "image_url">[] = raw.nodes || [];
  const imagePrompts: string[] = nodes.map((n: any) => n.image_prompt || topic);

  const inputTokens = response.usage?.prompt_tokens || 800;
  const outputTokens = response.usage?.completion_tokens || 500;
  const costUsd = estimateTextCost(inputTokens, outputTokens);

  return {
    nodes: nodes.map((n: any) => ({
      node_id: n.node_id,
      avatar_script: n.avatar_script,
      teacher_prompt: n.teacher_prompt,
      is_branching: n.is_branching,
      choices: n.choices || [],
    })),
    imagePrompts,
    costUsd,
  };
}

// ── Generate images via fal.ai FLUX.1-schnell ────────────────────────────────
export async function generateImages(
  prompts: string[],
  visualStyle: VisualStyle,
  seed: number
): Promise<{ urls: string[]; costUsd: number }> {
  const styleSuffix = STYLE_PROMPTS[visualStyle];

  const imageJobs = prompts.map(async (prompt) => {
    const fullPrompt = `${prompt}, ${styleSuffix}`;
    try {
      const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
        method: "POST",
        headers: {
          Authorization: `Key ${process.env.FAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          negative_prompt: NEGATIVE_PROMPT,
          image_size: "square_hd",
          num_inference_steps: 4,
          seed,
          num_images: 1,
          enable_safety_checker: true,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("fal.ai error:", res.status, errText);
        return `https://placehold.co/512x512/FFE4B5/8B4513?text=${encodeURIComponent("生成中...")}`;
      }
      const data: any = await res.json();
      return data.images?.[0]?.url || `https://placehold.co/512x512/FFE4B5/8B4513?text=Image`;
    } catch (e) {
      console.error("Image generation error:", e);
      return `https://placehold.co/512x512/FFE4B5/8B4513?text=${encodeURIComponent("生成中...")}`;
    }
  });

  const urls = await Promise.all(imageJobs);
  const costUsd = prompts.length * IMAGE_COST_USD;
  return { urls, costUsd };
}

// ── Generate a single branch node (lazy loading) ─────────────────────────────
export async function generateBranchNode(params: {
  ageGroup: AgeGroup;
  topic: string;
  visualStyle: VisualStyle;
  choiceText: string;
  parentContext: string;
  nodeId: string;
  seed: number;
}): Promise<{ node: StoryNode; costUsd: number }> {
  const { ageGroup, topic, visualStyle, choiceText, parentContext, nodeId, seed } = params;
  const ageConstraints = AGE_PROMPTS[ageGroup];

  const systemPrompt = `You are an expert early childhood educator. Language rules: ${ageConstraints}. Write in Traditional Chinese (繁體中文) except image_prompt which must be English. Return ONLY valid JSON.`;

  const userPrompt = `Continue the story. The child chose: "${choiceText}"
Previous story context: "${parentContext}"
Topic: ${topic}

Return this JSON:
{
  "avatar_script": "2-3 sentences about what happens after the child chooses '${choiceText}'",
  "teacher_prompt": "Practical teacher tip for this moment",
  "image_prompt": "English description of illustration scene, ${STYLE_PROMPTS[visualStyle]}, under 40 words"
}`;

  const response = await getOpenAI().chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
    max_tokens: 400,
  });

  const raw = JSON.parse(response.choices[0].message.content || "{}");
  const inputTokens = response.usage?.prompt_tokens || 300;
  const outputTokens = response.usage?.completion_tokens || 150;
  const textCost = estimateTextCost(inputTokens, outputTokens);

  const imageResult = await generateImages([raw.image_prompt || topic], visualStyle, seed);

  const node: StoryNode = {
    node_id: nodeId,
    avatar_script: raw.avatar_script || "故事繼續...",
    teacher_prompt: raw.teacher_prompt || "請繼續引導小朋友思考。",
    image_url: imageResult.urls[0],
    is_branching: false,
    choices: [],
  };

  return { node, costUsd: textCost + imageResult.costUsd };
}
