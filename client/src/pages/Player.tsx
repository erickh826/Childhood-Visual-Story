import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { LessonPayload, StoryNode } from "@shared/schema";
import { ArrowLeft, BookOpen, GraduationCap, Volume2, VolumeX } from "lucide-react";
import { Link } from "wouter";

// ── Avatar SVG component ─────────────────────────────────────────────────────
function Avatar({ isTalking }: { isTalking: boolean }) {
  return (
    <svg
      viewBox="0 0 120 140"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      aria-label="Story avatar character"
    >
      {/* Body */}
      <ellipse cx="60" cy="115" rx="30" ry="18" fill="hsl(28 85% 65%)" />
      {/* Head */}
      <circle cx="60" cy="62" r="38" fill="hsl(35 100% 85%)" />
      {/* Hair */}
      <ellipse cx="60" cy="30" rx="30" ry="16" fill="hsl(28 60% 35%)" />
      <ellipse cx="34" cy="48" rx="10" ry="20" fill="hsl(28 60% 35%)" />
      <ellipse cx="86" cy="48" rx="10" ry="20" fill="hsl(28 60% 35%)" />
      {/* Eyes */}
      <circle cx="47" cy="60" r="8" fill="white" />
      <circle cx="73" cy="60" r="8" fill="white" />
      <circle cx="49" cy="62" r="5" fill="hsl(28 40% 25%)" />
      <circle cx="75" cy="62" r="5" fill="hsl(28 40% 25%)" />
      <circle cx="51" cy="60" r="2" fill="white" />
      <circle cx="77" cy="60" r="2" fill="white" />
      {/* Cheeks */}
      <circle cx="40" cy="72" r="7" fill="hsl(0 80% 80%)" opacity="0.6" />
      <circle cx="80" cy="72" r="7" fill="hsl(0 80% 80%)" opacity="0.6" />
      {/* Mouth — animated when talking */}
      {isTalking ? (
        <ellipse cx="60" cy="82" rx="10" ry="6" fill="hsl(0 60% 40%)" className="animate-avatar-talk" />
      ) : (
        <path d="M 50 80 Q 60 88 70 80" stroke="hsl(28 40% 35%)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
      {/* Outfit */}
      <path d="M 30 115 Q 60 100 90 115 L 90 140 L 30 140 Z" fill="hsl(200 70% 60%)" />
      <circle cx="60" cy="118" r="4" fill="hsl(200 60% 80%)" />
      <circle cx="60" cy="126" r="4" fill="hsl(200 60% 80%)" />
    </svg>
  );
}

// ── TTS narration ─────────────────────────────────────────────────────────────
function useNarration(lang: string = "zh-TW") {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const uttRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Rate / pitch tuning per language
  const getLangSettings = (l: string) => {
    if (l === "en-US") return { rate: 0.9, pitch: 1.1 };
    if (l === "zh-HK") return { rate: 0.85, pitch: 1.1 };
    return { rate: 0.85, pitch: 1.15 }; // zh-TW default
  };

  const speak = (text: string) => {
    if (!enabled || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    const { rate, pitch } = getLangSettings(lang);
    utt.lang = lang;
    utt.rate = rate;
    utt.pitch = pitch;
    utt.onstart = () => setIsSpeaking(true);
    utt.onend = () => setIsSpeaking(false);
    utt.onerror = () => setIsSpeaking(false);
    uttRef.current = utt;
    window.speechSynthesis.speak(utt);
  };

  const stop = () => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  };

  const toggle = () => {
    if (isSpeaking) stop();
    setEnabled((e) => !e);
  };

  return { speak, stop, isSpeaking, enabled, toggle };
}

export default function Player() {
  const [, params] = useRoute("/play/:id");
  const [, setLocation] = useLocation();
  const lessonId = params?.id;
  const queryClient = useQueryClient();

  const [currentNodeId, setCurrentNodeId] = useState("root_01");
  const [visitedNodes, setVisitedNodes] = useState<StoryNode[]>([]);
  const [extraNodes, setExtraNodes] = useState<Map<string, StoryNode>>(new Map());
  const [showTeacherTip, setShowTeacherTip] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [voiceLang, setVoiceLang] = useState<string>("zh-TW");
  const { speak, isSpeaking, enabled, toggle, stop } = useNarration(voiceLang);
  const nodeRef = useRef<HTMLDivElement>(null);

  const { data: lesson, isLoading, isError } = useQuery({
    queryKey: ["/api/lessons", lessonId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/lessons/${lessonId}`);
      return res.json() as Promise<LessonPayload>;
    },
    enabled: !!lessonId,
    staleTime: Infinity,
  });

  const branchMutation = useMutation({
    mutationFn: async (choice: { button_text: string; next_node_id: string }) => {
      const currentNode = getAllNodes().find((n) => n.node_id === currentNodeId);
      const res = await apiRequest("POST", "/api/branch", {
        lesson_id: lessonId,
        node_id: choice.next_node_id,
        choice_key: choice.next_node_id,
        parent_script_context: currentNode?.avatar_script || "",
        age_group: lesson?.metadata.age_group,
        topic: lesson?.metadata.topic,
        visual_style: lesson?.metadata.visual_style,
        choice_text: choice.button_text,
      });
      return res.json() as Promise<{ node: StoryNode; cached: boolean }>;
    },
    onSuccess: (data, choice) => {
      setExtraNodes((prev) => new Map(prev).set(data.node.node_id, data.node));
      navigateTo(data.node.node_id, data.node);
    },
  });

  function getAllNodes(): StoryNode[] {
    const base = lesson?.story_nodes || [];
    return [...base, ...Array.from(extraNodes.values())];
  }

  function getCurrentNode(): StoryNode | undefined {
    return getAllNodes().find((n) => n.node_id === currentNodeId);
  }

  function navigateTo(nodeId: string, node?: StoryNode) {
    setCurrentNodeId(nodeId);
    setImageLoaded(false);
    setShowTeacherTip(false);
    const target = node || getAllNodes().find((n) => n.node_id === nodeId);
    if (target && enabled) {
      setTimeout(() => speak(target.avatar_script), 300);
    }
    nodeRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    if (lesson?.story_nodes?.[0]) {
      setVisitedNodes([lesson.story_nodes[0]]);
      // Apply voice language from lesson metadata
      if (lesson.metadata.voice_lang) {
        setVoiceLang(lesson.metadata.voice_lang);
      }
      speak(lesson.story_nodes[0].avatar_script);
    }
  }, [lesson]);

  const currentNode = getCurrentNode();
  const allNodes = getAllNodes();

  // Progress: how many story nodes visited vs total base nodes
  const baseNodeCount = lesson?.story_nodes?.length || 4;
  const visitedCount = visitedNodes.length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-background dark:to-background flex items-center justify-center">
        <div className="text-center space-y-4 animate-slide-up">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-primary animate-bounce" />
          </div>
          <p className="text-muted-foreground">載入故事中...</p>
        </div>
      </div>
    );
  }

  if (isError || !lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive">找不到故事，請返回重新生成。</p>
          <Link href="/"><Button>返回首頁</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 dark:from-background dark:to-background">
      {/* Header */}
      <header className="bg-white/80 dark:bg-card/80 backdrop-blur-sm border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 shrink-0" data-testid="btn-back">
              <ArrowLeft className="w-4 h-4" />
              返回
            </Button>
          </Link>

          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-sm font-semibold text-foreground truncate">{lesson.metadata.topic}</h1>
            <div className="flex items-center justify-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-xs px-2 py-0">
                {lesson.metadata.age_group} 歲
              </Badge>
              <Badge variant="outline" className="text-xs px-2 py-0 capitalize">
                {{watercolor:"水彩風", crayon:"蠟筆風", kawaii:"可愛風"}[lesson.metadata.visual_style]}
              </Badge>
              {lesson.metadata.voice_lang && (
                <Badge variant="outline" className="text-xs px-2 py-0">
                  {lesson.metadata.voice_lang === "zh-TW" ? "🇹🇼 台灣中文" : lesson.metadata.voice_lang === "en-US" ? "🇺🇸 English" : "🇭🇰 廣東話"}
                </Badge>
              )}
              {lesson.metadata.image_count && (
                <Badge variant="outline" className="text-xs px-2 py-0">
                  🖼️ {lesson.metadata.image_count}張
                </Badge>
              )}
              {lesson.cached && (
                <Badge className="text-xs px-2 py-0 bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300">
                  ⚡ 快取
                </Badge>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            data-testid="btn-voice-toggle"
            className="shrink-0"
            aria-label={enabled ? "關閉語音" : "開啟語音"}
          >
            {enabled ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
          </Button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-700 ease-out"
            style={{ width: `${Math.min(100, (visitedCount / baseNodeCount) * 100)}%` }}
          />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6" ref={nodeRef}>
        {currentNode ? (
          <div className="animate-slide-up" key={currentNodeId}>
            {/* Story layout: Avatar + Image */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Left: Avatar */}
              <div className="space-y-4">
                <div className="flex gap-4 items-end">
                  <div className="w-24 h-28 flex-shrink-0 animate-bounce-gentle">
                    <Avatar isTalking={isSpeaking} />
                  </div>
                  <div className="avatar-bubble flex-1">
                    <p
                      className="text-base leading-relaxed text-foreground font-medium"
                      data-testid="text-avatar-script"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      {currentNode.avatar_script}
                    </p>
                  </div>
                </div>

                {/* Teacher tip toggle */}
                <button
                  onClick={() => setShowTeacherTip((v) => !v)}
                  data-testid="btn-teacher-tip"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors px-3 py-2 rounded-xl hover:bg-primary/5 w-full text-left"
                >
                  <GraduationCap className="w-4 h-4 flex-shrink-0" />
                  <span>{showTeacherTip ? "收起" : "查看"} 教師提示</span>
                </button>

                {showTeacherTip && (
                  <Card className="p-4 bg-amber-50/80 dark:bg-amber-900/10 border-amber-200/60 dark:border-amber-700/30 rounded-xl animate-fade-in">
                    <p className="text-sm text-amber-800 dark:text-amber-300" data-testid="text-teacher-prompt">
                      💡 {currentNode.teacher_prompt}
                    </p>
                  </Card>
                )}
              </div>

              {/* Right: Story image */}
              <div className="story-image aspect-square bg-muted relative overflow-hidden rounded-2xl">
                {!imageLoaded && (
                  <div className="absolute inset-0 skeleton" />
                )}
                <img
                  src={currentNode.image_url}
                  alt={`故事插圖 — ${currentNode.node_id}`}
                  className={`w-full h-full object-cover transition-opacity duration-500 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                  onLoad={() => setImageLoaded(true)}
                  data-testid="img-story"
                />
              </div>
            </div>

            {/* Branching choices or continue */}
            <div className="mt-8">
              {currentNode.is_branching && currentNode.choices.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground text-center mb-4">
                    🤔 小朋友，你覺得應該怎麼做呢？
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {currentNode.choices.map((choice, i) => (
                      <button
                        key={choice.next_node_id}
                        data-testid={`btn-choice-${i}`}
                        onClick={() => {
                          // Check if branch already in main nodes
                          const existing = allNodes.find((n) => n.node_id === choice.next_node_id);
                          if (existing) {
                            navigateTo(choice.next_node_id, existing);
                          } else {
                            branchMutation.mutate(choice);
                          }
                        }}
                        disabled={branchMutation.isPending}
                        className={`choice-btn ${
                          i === 0
                            ? "bg-primary text-white border-primary hover:bg-primary/90"
                            : "bg-sky-500 text-white border-sky-500 hover:bg-sky-400"
                        }`}
                      >
                        {branchMutation.isPending ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            生成中...
                          </span>
                        ) : (
                          <>
                            <span className="mr-2">{i === 0 ? "👍" : "🤔"}</span>
                            {choice.button_text}
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex justify-center gap-4">
                  {/* Find the next sequential node */}
                  {(() => {
                    const allBaseNodes = lesson.story_nodes;
                    const currentIdx = allBaseNodes.findIndex((n) => n.node_id === currentNodeId);
                    const nextNode = allBaseNodes[currentIdx + 1];

                    if (nextNode) {
                      return (
                        <Button
                          data-testid="btn-next-node"
                          onClick={() => {
                            setVisitedNodes((prev) => [...prev, nextNode]);
                            navigateTo(nextNode.node_id, nextNode);
                          }}
                          className="px-8 py-5 text-base rounded-xl gap-2"
                        >
                          繼續故事 →
                        </Button>
                      );
                    }

                    return (
                      <div className="text-center space-y-3 animate-slide-up">
                        <div className="text-4xl">🎉</div>
                        <p className="text-lg font-semibold text-foreground">故事結束！</p>
                        <p className="text-muted-foreground text-sm">感謝小朋友一起參與這個故事！</p>
                        <Link href="/">
                          <Button className="mt-2 gap-2">
                            <BookOpen className="w-4 h-4" />
                            生成新故事
                          </Button>
                        </Link>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground">找不到故事節點</p>
          </div>
        )}

        {/* Debug info */}
        {lesson.generation_ms && (
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground/60 pt-4 border-t border-border/30">
            <span>生成耗時：{(lesson.generation_ms / 1000).toFixed(1)}s</span>
            {lesson.total_cost_usd !== undefined && (
              <span>費用：${lesson.total_cost_usd.toFixed(4)} USD</span>
            )}
            <span>{lesson.cached ? "✅ 快取命中" : "🆕 新生成"}</span>
          </div>
        )}
      </main>
    </div>
  );
}
