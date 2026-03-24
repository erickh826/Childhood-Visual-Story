import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { LessonPayload, StoryNode, AvatarStyle } from "@shared/schema";
import { AVATAR_STYLES, AVATAR_LABELS } from "@shared/schema";
import { ArrowLeft, BookOpen, GraduationCap, Volume2, VolumeX } from "lucide-react";
import { Link } from "wouter";

// ── Avatar SVG characters ─────────────────────────────────────────────────────
function AvatarBear({ isTalking }: { isTalking: boolean }) {
  return (
    <svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" aria-label="Bear avatar">
      {/* Ears */}
      <circle cx="35" cy="32" r="14" fill="hsl(28 60% 55%)" />
      <circle cx="85" cy="32" r="14" fill="hsl(28 60% 55%)" />
      <circle cx="35" cy="32" r="9" fill="hsl(28 60% 70%)" />
      <circle cx="85" cy="32" r="9" fill="hsl(28 60% 70%)" />
      {/* Head */}
      <circle cx="60" cy="65" r="40" fill="hsl(28 60% 65%)" />
      {/* Muzzle */}
      <ellipse cx="60" cy="80" rx="18" ry="13" fill="hsl(28 50% 78%)" />
      {/* Eyes */}
      <circle cx="45" cy="57" r="8" fill="white" />
      <circle cx="75" cy="57" r="8" fill="white" />
      <circle cx="47" cy="59" r="5" fill="hsl(220 30% 20%)" />
      <circle cx="77" cy="59" r="5" fill="hsl(220 30% 20%)" />
      <circle cx="49" cy="57" r="2" fill="white" />
      <circle cx="79" cy="57" r="2" fill="white" />
      {/* Nose */}
      <ellipse cx="60" cy="74" rx="6" ry="4" fill="hsl(340 40% 40%)" />
      {/* Mouth */}
      {isTalking ? (
        <ellipse cx="60" cy="84" rx="9" ry="6" fill="hsl(0 55% 40%)" />
      ) : (
        <path d="M 52 82 Q 60 88 68 82" stroke="hsl(28 40% 35%)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
      {/* Cheeks */}
      <circle cx="38" cy="70" r="7" fill="hsl(0 70% 75%)" opacity="0.5" />
      <circle cx="82" cy="70" r="7" fill="hsl(0 70% 75%)" opacity="0.5" />
      {/* Body */}
      <ellipse cx="60" cy="122" rx="32" ry="20" fill="hsl(140 60% 55%)" />
      <circle cx="60" cy="115" r="5" fill="hsl(140 55% 75%)" />
      <circle cx="60" cy="125" r="5" fill="hsl(140 55% 75%)" />
    </svg>
  );
}

function AvatarCat({ isTalking }: { isTalking: boolean }) {
  return (
    <svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" aria-label="Cat avatar">
      {/* Ears */}
      <polygon points="28,48 22,22 48,38" fill="hsl(270 40% 65%)" />
      <polygon points="92,48 98,22 72,38" fill="hsl(270 40% 65%)" />
      <polygon points="31,46 26,28 46,40" fill="hsl(330 70% 82%)" />
      <polygon points="89,46 94,28 74,40" fill="hsl(330 70% 82%)" />
      {/* Head */}
      <circle cx="60" cy="68" r="38" fill="hsl(270 40% 75%)" />
      {/* Eyes — cat-shaped */}
      <ellipse cx="45" cy="60" rx="9" ry="8" fill="white" />
      <ellipse cx="75" cy="60" rx="9" ry="8" fill="white" />
      <ellipse cx="45" cy="61" rx="5" ry="7" fill="hsl(120 50% 30%)" />
      <ellipse cx="75" cy="61" rx="5" ry="7" fill="hsl(120 50% 30%)" />
      <circle cx="46" cy="58" r="2" fill="white" />
      <circle cx="76" cy="58" r="2" fill="white" />
      {/* Nose */}
      <polygon points="60,72 56,76 64,76" fill="hsl(330 65% 65%)" />
      {/* Whiskers */}
      <line x1="20" y1="74" x2="50" y2="76" stroke="hsl(270 20% 50%)" strokeWidth="1.2" />
      <line x1="20" y1="79" x2="50" y2="79" stroke="hsl(270 20% 50%)" strokeWidth="1.2" />
      <line x1="70" y1="76" x2="100" y2="74" stroke="hsl(270 20% 50%)" strokeWidth="1.2" />
      <line x1="70" y1="79" x2="100" y2="79" stroke="hsl(270 20% 50%)" strokeWidth="1.2" />
      {/* Mouth */}
      {isTalking ? (
        <ellipse cx="60" cy="83" rx="9" ry="6" fill="hsl(0 55% 40%)" />
      ) : (
        <path d="M 56 80 Q 60 85 64 80" stroke="hsl(270 30% 40%)" strokeWidth="2" fill="none" strokeLinecap="round" />
      )}
      {/* Cheeks */}
      <circle cx="36" cy="72" r="7" fill="hsl(330 60% 78%)" opacity="0.5" />
      <circle cx="84" cy="72" r="7" fill="hsl(330 60% 78%)" opacity="0.5" />
      {/* Body */}
      <ellipse cx="60" cy="122" rx="32" ry="20" fill="hsl(200 70% 60%)" />
      {/* Tail hint */}
      <path d="M 88 122 Q 105 110 100 100" stroke="hsl(270 40% 65%)" strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function AvatarRobot({ isTalking }: { isTalking: boolean }) {
  return (
    <svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" aria-label="Robot avatar">
      {/* Antenna */}
      <line x1="60" y1="22" x2="60" y2="35" stroke="hsl(200 70% 50%)" strokeWidth="3" />
      <circle cx="60" cy="19" r="5" fill="hsl(50 100% 60%)" />
      {/* Head */}
      <rect x="22" y="35" width="76" height="60" rx="12" fill="hsl(200 40% 75%)" />
      {/* Screen face */}
      <rect x="28" y="41" width="64" height="48" rx="8" fill="hsl(220 60% 25%)" />
      {/* Eyes — LED style */}
      <rect x="36" y="52" width="16" height="12" rx="4" fill="hsl(50 100% 60%)" />
      <rect x="68" y="52" width="16" height="12" rx="4" fill="hsl(50 100% 60%)" />
      <rect x="40" y="55" width="8" height="6" rx="2" fill="hsl(50 100% 85%)" />
      <rect x="72" y="55" width="8" height="6" rx="2" fill="hsl(50 100% 85%)" />
      {/* Mouth — LED bar */}
      {isTalking ? (
        <>
          <rect x="36" y="73" width="12" height="8" rx="3" fill="hsl(140 80% 50%)" />
          <rect x="52" y="73" width="16" height="8" rx="3" fill="hsl(140 80% 65%)" />
          <rect x="72" y="73" width="12" height="8" rx="3" fill="hsl(140 80% 50%)" />
        </>
      ) : (
        <rect x="36" y="74" width="48" height="7" rx="3" fill="hsl(140 60% 45%)" />
      )}
      {/* Ear bolts */}
      <circle cx="22" cy="65" r="5" fill="hsl(200 50% 60%)" />
      <circle cx="98" cy="65" r="5" fill="hsl(200 50% 60%)" />
      {/* Body */}
      <rect x="28" y="95" width="64" height="36" rx="10" fill="hsl(200 45% 65%)" />
      <circle cx="48" cy="113" r="6" fill="hsl(50 100% 60%)" />
      <circle cx="72" cy="113" r="6" fill="hsl(200 70% 50%)" />
      <rect x="55" y="108" width="10" height="10" rx="2" fill="hsl(0 70% 55%)" />
    </svg>
  );
}

function AvatarBunny({ isTalking }: { isTalking: boolean }) {
  return (
    <svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" aria-label="Bunny avatar">
      {/* Long ears */}
      <ellipse cx="42" cy="25" rx="10" ry="26" fill="hsl(0 0% 90%)" />
      <ellipse cx="78" cy="25" rx="10" ry="26" fill="hsl(0 0% 90%)" />
      <ellipse cx="42" cy="25" rx="5" ry="20" fill="hsl(330 60% 82%)" />
      <ellipse cx="78" cy="25" rx="5" ry="20" fill="hsl(330 60% 82%)" />
      {/* Head */}
      <circle cx="60" cy="72" r="38" fill="hsl(0 0% 93%)" />
      {/* Eyes */}
      <circle cx="46" cy="62" r="9" fill="white" />
      <circle cx="74" cy="62" r="9" fill="white" />
      <circle cx="48" cy="64" r="6" fill="hsl(280 70% 55%)" />
      <circle cx="76" cy="64" r="6" fill="hsl(280 70% 55%)" />
      <circle cx="50" cy="62" r="2.5" fill="white" />
      <circle cx="78" cy="62" r="2.5" fill="white" />
      {/* Nose */}
      <polygon points="60,74 57,78 63,78" fill="hsl(330 65% 70%)" />
      {/* Mouth */}
      {isTalking ? (
        <ellipse cx="60" cy="85" rx="9" ry="6" fill="hsl(0 55% 40%)" />
      ) : (
        <path d="M 54 82 Q 60 88 66 82" stroke="hsl(330 30% 50%)" strokeWidth="2" fill="none" strokeLinecap="round" />
      )}
      {/* Cheeks */}
      <circle cx="37" cy="75" r="8" fill="hsl(330 70% 75%)" opacity="0.45" />
      <circle cx="83" cy="75" r="8" fill="hsl(330 70% 75%)" opacity="0.45" />
      {/* Body */}
      <ellipse cx="60" cy="124" rx="32" ry="18" fill="hsl(280 55% 65%)" />
      <circle cx="60" cy="116" r="5" fill="hsl(280 50% 80%)" />
      <circle cx="60" cy="126" r="5" fill="hsl(280 50% 80%)" />
    </svg>
  );
}

function AvatarGirl({ isTalking }: { isTalking: boolean }) {
  return (
    <svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" aria-label="Girl avatar">
      {/* Hair back */}
      <ellipse cx="60" cy="55" rx="40" ry="38" fill="hsl(30 60% 30%)" />
      {/* Pigtails */}
      <circle cx="20" cy="58" r="13" fill="hsl(30 60% 30%)" />
      <circle cx="100" cy="58" r="13" fill="hsl(30 60% 30%)" />
      {/* Hair ribbon left */}
      <circle cx="20" cy="44" r="8" fill="hsl(0 80% 65%)" />
      <circle cx="100" cy="44" r="8" fill="hsl(0 80% 65%)" />
      {/* Head */}
      <circle cx="60" cy="62" r="34" fill="hsl(35 100% 85%)" />
      {/* Hair top */}
      <ellipse cx="60" cy="36" rx="30" ry="18" fill="hsl(30 60% 30%)" />
      {/* Eyes */}
      <circle cx="47" cy="58" r="8" fill="white" />
      <circle cx="73" cy="58" r="8" fill="white" />
      <circle cx="49" cy="60" r="5" fill="hsl(220 50% 25%)" />
      <circle cx="75" cy="60" r="5" fill="hsl(220 50% 25%)" />
      <circle cx="51" cy="58" r="2" fill="white" />
      <circle cx="77" cy="58" r="2" fill="white" />
      {/* Eyelashes */}
      <line x1="41" y1="53" x2="39" y2="49" stroke="hsl(220 30% 20%)" strokeWidth="1.5" />
      <line x1="47" y1="51" x2="47" y2="47" stroke="hsl(220 30% 20%)" strokeWidth="1.5" />
      <line x1="53" y1="52" x2="55" y2="48" stroke="hsl(220 30% 20%)" strokeWidth="1.5" />
      {/* Nose */}
      <circle cx="60" cy="68" r="2.5" fill="hsl(10 50% 70%)" opacity="0.7" />
      {/* Mouth */}
      {isTalking ? (
        <ellipse cx="60" cy="77" rx="9" ry="6" fill="hsl(0 55% 45%)" />
      ) : (
        <path d="M 52 76 Q 60 83 68 76" stroke="hsl(340 60% 55%)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
      {/* Cheeks */}
      <circle cx="39" cy="70" r="7" fill="hsl(0 75% 75%)" opacity="0.55" />
      <circle cx="81" cy="70" r="7" fill="hsl(0 75% 75%)" opacity="0.55" />
      {/* Body — dress */}
      <path d="M 28 118 Q 60 100 92 118 L 92 140 L 28 140 Z" fill="hsl(340 70% 65%)" />
      <ellipse cx="60" cy="118" rx="18" ry="6" fill="hsl(340 60% 75%)" />
    </svg>
  );
}

// Map avatar style → component
const AVATAR_COMPONENTS: Record<string, (props: { isTalking: boolean }) => JSX.Element> = {
  bear: AvatarBear,
  cat: AvatarCat,
  robot: AvatarRobot,
  bunny: AvatarBunny,
  girl: AvatarGirl,
};

// ── TTS narration — simple functional approach, no stale closures ────────────
// speak() receives lang as a direct argument every time — no hooks, no refs.
function getLangSettings(l: string) {
  if (l === "en-US") return { rate: 0.9, pitch: 1.1 };
  if (l === "zh-HK") return { rate: 0.82, pitch: 1.05 };
  return { rate: 0.85, pitch: 1.15 }; // zh-TW default
}

function speakText(text: string, lang: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  const { rate, pitch } = getLangSettings(lang);
  utt.lang = lang;
  utt.rate = rate;
  utt.pitch = pitch;
  window.speechSynthesis.speak(utt);
}

function stopSpeech() {
  window.speechSynthesis?.cancel();
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

  // Voice: simple state values, passed directly to speakText() each call
  const [voiceLang, setVoiceLang] = useState<string>("zh-TW");
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>("bear");
  const nodeRef = useRef<HTMLDivElement>(null);

  // Wrapper: passes current voiceLang directly — no stale closure possible
  const speak = useCallback((text: string, lang?: string) => {
    if (!voiceEnabled) return;
    const useLang = lang ?? voiceLang;
    setIsSpeaking(true);
    const utt = new SpeechSynthesisUtterance(text);
    const { rate, pitch } = getLangSettings(useLang);
    utt.lang = useLang;
    utt.rate = rate;
    utt.pitch = pitch;
    utt.onend = () => setIsSpeaking(false);
    utt.onerror = () => setIsSpeaking(false);
    window.speechSynthesis?.cancel();
    window.speechSynthesis?.speak(utt);
  }, [voiceEnabled, voiceLang]);  // re-created when voiceEnabled OR voiceLang changes

  const stop = useCallback(() => {
    stopSpeech();
    setIsSpeaking(false);
  }, []);

  const toggle = useCallback(() => {
    stop();
    setVoiceEnabled((e) => !e);
  }, [stop]);

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
    onSuccess: (data) => {
      setExtraNodes((prev) => new Map(prev).set(data.node.node_id, data.node));
      navigateTo(data.node.node_id, data.node);
    },
  });

  function getAllNodes(): StoryNode[] {
    return [...(lesson?.story_nodes || []), ...Array.from(extraNodes.values())];
  }
  function getCurrentNode(): StoryNode | undefined {
    return getAllNodes().find((n) => n.node_id === currentNodeId);
  }

  function navigateTo(nodeId: string, node?: StoryNode) {
    setCurrentNodeId(nodeId);
    setImageLoaded(false);
    setShowTeacherTip(false);
    const target = node || getAllNodes().find((n) => n.node_id === nodeId);
    if (target && voiceEnabled) {
      const text = target.avatar_script;
      const lang = voiceLang;  // captured from closure at call time (current render)
      setTimeout(() => speakText(text, lang), 300);
    }
    nodeRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  // FIX 2: set lang BEFORE calling speak so ref is updated
  useEffect(() => {
    if (lesson?.story_nodes?.[0]) {
      setVisitedNodes([lesson.story_nodes[0]]);
      const lang = lesson.metadata.voice_lang ?? "zh-TW";
      if (lesson.metadata.voice_lang) setVoiceLang(lang);
      if (lesson.metadata.avatar_style) setAvatarStyle(lesson.metadata.avatar_style as AvatarStyle);
      // Pass lang directly — does NOT depend on voiceLang state at all
      const text = lesson.story_nodes[0].avatar_script;
      setTimeout(() => speakText(text, lang), 600);
    }
  }, [lesson]);

  const currentNode = getCurrentNode();
  const baseNodeCount = lesson?.story_nodes?.length || 4;
  const visitedCount = visitedNodes.length;

  const AvatarComp = AVATAR_COMPONENTS[avatarStyle] || AvatarBear;

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
          {/* FIX 1: stop voice on back */}
          <Link href="/" onClick={() => stop()}>
            <Button variant="ghost" size="sm" className="gap-2 shrink-0" data-testid="btn-back">
              <ArrowLeft className="w-4 h-4" />
              返回
            </Button>
          </Link>

          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-sm font-semibold text-foreground truncate">{lesson.metadata.topic}</h1>
            <div className="flex items-center justify-center gap-1.5 mt-0.5 flex-wrap">
              <Badge variant="outline" className="text-xs px-2 py-0">{lesson.metadata.age_group} 歲</Badge>
              <Badge variant="outline" className="text-xs px-2 py-0 capitalize">
                {{ watercolor: "水彩風", crayon: "蠟筆風", kawaii: "可愛風" }[lesson.metadata.visual_style]}
              </Badge>
              {lesson.metadata.voice_lang && (
                <Badge variant="outline" className="text-xs px-2 py-0">
                  {lesson.metadata.voice_lang === "zh-TW" ? "🇹🇼" : lesson.metadata.voice_lang === "en-US" ? "🇺🇸" : "🇭🇰"}
                </Badge>
              )}
              {lesson.metadata.image_count && (
                <Badge variant="outline" className="text-xs px-2 py-0">🖼️ {lesson.metadata.image_count}張</Badge>
              )}
              {lesson.cached && (
                <Badge className="text-xs px-2 py-0 bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300">⚡ 快取</Badge>
              )}
            </div>
          </div>

          <Button variant="ghost" size="icon" onClick={toggle} data-testid="btn-voice-toggle" className="shrink-0" aria-label={enabled ? "關閉語音" : "開啟語音"}>
            {voiceEnabled ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
          </Button>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div className="h-full bg-primary transition-all duration-700 ease-out" style={{ width: `${Math.min(100, (visitedCount / baseNodeCount) * 100)}%` }} />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6" ref={nodeRef}>
        {currentNode ? (
          <div className="animate-slide-up" key={currentNodeId}>
            {/* Avatar selector strip */}
            <div className="flex gap-2 justify-center mb-4 flex-wrap">
              {AVATAR_STYLES.map((style) => (
                <button
                  key={style}
                  onClick={() => setAvatarStyle(style)}
                  data-testid={`btn-avatar-${style}`}
                  title={AVATAR_LABELS[style]}
                  className={`w-12 h-12 rounded-full border-3 transition-all duration-200 cursor-pointer overflow-hidden
                    ${avatarStyle === style ? "border-primary shadow-md scale-110 border-[3px]" : "border-border hover:border-primary/50 border-[2px]"}`}
                >
                  <div className="w-full h-full bg-amber-50 dark:bg-card flex items-center justify-center p-0.5">
                    {AVATAR_COMPONENTS[style]({ isTalking: false })}
                  </div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Left: Avatar + speech bubble */}
              <div className="space-y-4">
                <div className="flex gap-4 items-end">
                  <div className="w-24 h-28 flex-shrink-0 animate-bounce-gentle">
                    <AvatarComp isTalking={isSpeaking} />
                  </div>
                  <div className="avatar-bubble flex-1">
                    <p className="text-base leading-relaxed text-foreground font-medium" data-testid="text-avatar-script">
                      {currentNode.avatar_script}
                    </p>
                  </div>
                </div>

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
                {!imageLoaded && <div className="absolute inset-0 skeleton" />}
                <img
                  src={currentNode.image_url}
                  alt={`故事插圖`}
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
                  <p className="text-sm font-semibold text-muted-foreground text-center mb-4">🤔 小朋友，你覺得應該怎麼做呢？</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {currentNode.choices.map((choice, i) => (
                      <button
                        key={choice.next_node_id}
                        data-testid={`btn-choice-${i}`}
                        onClick={() => {
                          const existing = getAllNodes().find((n) => n.node_id === choice.next_node_id);
                          if (existing) navigateTo(choice.next_node_id, existing);
                          else branchMutation.mutate(choice);
                        }}
                        disabled={branchMutation.isPending}
                        className={`choice-btn ${i === 0 ? "bg-primary text-white border-primary hover:bg-primary/90" : "bg-sky-500 text-white border-sky-500 hover:bg-sky-400"}`}
                      >
                        {branchMutation.isPending ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />生成中...
                          </span>
                        ) : (
                          <><span className="mr-2">{i === 0 ? "👍" : "🤔"}</span>{choice.button_text}</>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex justify-center gap-4">
                  {(() => {
                    const allBaseNodes = lesson.story_nodes;
                    const currentIdx = allBaseNodes.findIndex((n) => n.node_id === currentNodeId);
                    const nextNode = allBaseNodes[currentIdx + 1];
                    if (nextNode) {
                      return (
                        <Button data-testid="btn-next-node" onClick={() => { setVisitedNodes((prev) => [...prev, nextNode]); navigateTo(nextNode.node_id, nextNode); }} className="px-8 py-5 text-base rounded-xl gap-2">
                          繼續故事 →
                        </Button>
                      );
                    }
                    return (
                      <div className="text-center space-y-3 animate-slide-up">
                        <div className="text-4xl">🎉</div>
                        <p className="text-lg font-semibold text-foreground">故事結束！</p>
                        <p className="text-muted-foreground text-sm">感謝小朋友一起參與這個故事！</p>
                        <Link href="/"><Button className="mt-2 gap-2" onClick={() => stop()}><BookOpen className="w-4 h-4" />生成新故事</Button></Link>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-20"><p className="text-muted-foreground">找不到故事節點</p></div>
        )}

        {lesson.generation_ms && (
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground/60 pt-4 border-t border-border/30">
            <span>生成耗時：{(lesson.generation_ms / 1000).toFixed(1)}s</span>
            {lesson.total_cost_usd !== undefined && <span>費用：${lesson.total_cost_usd.toFixed(4)} USD</span>}
            <span>{lesson.cached ? "✅ 快取命中" : "🆕 新生成"}</span>
          </div>
        )}
      </main>
    </div>
  );
}
