import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { LessonPayload, AgeGroup, VisualStyle, VoiceLang, AvatarStyle } from "@shared/schema";
import { AGE_GROUPS, VISUAL_STYLES, VOICE_LANGS, VOICE_LANG_LABELS, AVATAR_STYLES, AVATAR_LABELS } from "@shared/schema";
import { BookOpen, Sparkles, Clock, History, Images, Mic } from "lucide-react";
import { Link } from "wouter";

const PRESET_TOPICS = [
  "情緒管理", "認識數字", "分享玩具", "洗手習慣",
  "愛護動物", "交朋友", "蔬菜朋友", "交通安全",
];

const AGE_LABELS: Record<AgeGroup, string> = {
  "2-3": "2-3 歲（嬰幼兒）",
  "4-5": "4-5 歲（幼稚園）",
  "6+": "6 歲以上（小一銜接）",
};

const STYLE_LABELS: Record<VisualStyle, { label: string; emoji: string; desc: string }> = {
  watercolor: { label: "水彩風", emoji: "🎨", desc: "柔和、夢幻的水彩插畫" },
  crayon: { label: "蠟筆風", emoji: "🖍️", desc: "活潑、手繪感的蠟筆畫" },
  kawaii: { label: "日系可愛風", emoji: "🌸", desc: "圓滾滾大眼、萌萌的插畫" },
};

export default function Home() {
  const [, setLocation] = useLocation();
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("4-5");
  const [topic, setTopic] = useState("");
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("watercolor");
  const [imageCount, setImageCount] = useState<number>(3);
  const [voiceLang, setVoiceLang] = useState<VoiceLang>("zh-TW");
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>("bear");

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/generate", {
        age_group: ageGroup,
        topic: topic.trim(),
        visual_style: visualStyle,
        image_count: imageCount,
        voice_lang: voiceLang,
        avatar_style: avatarStyle,
      });
      return res.json() as Promise<LessonPayload>;
    },
    onSuccess: (data) => {
      setLocation(`/play/${data.lesson_id}`);
    },
  });

  const handleGenerate = () => {
    if (!topic.trim()) return;
    generateMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-background dark:to-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-white/70 dark:bg-card/70 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white text-xl">
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
                {/* Book + star logo */}
                <rect x="6" y="8" width="28" height="24" rx="4" fill="white" fillOpacity="0.3"/>
                <rect x="8" y="10" width="11" height="20" rx="2" fill="white" fillOpacity="0.8"/>
                <rect x="21" y="10" width="11" height="20" rx="2" fill="white" fillOpacity="0.6"/>
                <line x1="19.5" y1="10" x2="19.5" y2="30" stroke="white" strokeWidth="1.5"/>
                <polygon points="20,3 21.5,7.5 26,7.5 22.5,10 23.8,14.5 20,12 16.2,14.5 17.5,10 14,7.5 18.5,7.5" fill="white"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground leading-none">小故事大世界</h1>
              <p className="text-xs text-muted-foreground mt-0.5">幼兒視覺故事生成器</p>
            </div>
          </div>
          <Link href="/history">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="link-history">
              <History className="w-4 h-4" />
              歷史記錄
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-10 animate-slide-up">
          <Badge className="mb-4 bg-amber-100 text-amber-700 border-amber-200 text-sm px-4 py-1 dark:bg-amber-900/30 dark:text-amber-300">
            ✨ 幼教教師專用工具
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 leading-tight">
            一鍵生成<br className="sm:hidden" />
            <span className="text-primary"> 互動故事教案</span>
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-base">
            輸入教學目標，自動生成符合幼兒認知發展的故事腳本、
            插圖圖卡與互動分支情節，並支援 Avatar 即時展演。
          </p>
        </div>

        {/* Main card */}
        <Card className="shadow-xl border-border/60 rounded-2xl overflow-hidden animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-card dark:to-card border-b border-border/50 pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
              <Sparkles className="w-5 h-5 text-primary" />
              設定教學參數
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Age group */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">目標年齡層</Label>
              <div className="grid grid-cols-3 gap-3">
                {AGE_GROUPS.map((age) => (
                  <button
                    key={age}
                    data-testid={`btn-age-${age}`}
                    onClick={() => setAgeGroup(age)}
                    className={`py-3 px-2 rounded-xl border-2 text-center transition-all duration-200 text-sm font-medium cursor-pointer
                      ${ageGroup === age
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-primary/5"
                      }`}
                  >
                    <div className="text-2xl mb-1">
                      {age === "2-3" ? "👶" : age === "4-5" ? "🧒" : "📚"}
                    </div>
                    <div className="font-semibold">{age} 歲</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {age === "2-3" ? "嬰幼兒" : age === "4-5" ? "幼稚園" : "小一銜接"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div className="space-y-2">
              <Label htmlFor="topic" className="text-sm font-semibold text-foreground">
                教學目標 / 故事主題
              </Label>
              <Input
                id="topic"
                data-testid="input-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例如：分享玩具、洗手習慣、認識顏色..."
                className="rounded-xl border-2 focus:border-primary transition-colors text-base"
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              />
              <div className="flex flex-wrap gap-2 pt-1">
                {PRESET_TOPICS.map((t) => (
                  <button
                    key={t}
                    data-testid={`btn-topic-preset-${t}`}
                    onClick={() => setTopic(t)}
                    className={`px-3 py-1 rounded-full text-sm border transition-all duration-200 cursor-pointer
                      ${topic === t
                        ? "bg-primary text-white border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-primary/10 hover:border-primary/50 hover:text-primary"
                      }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual style */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">插圖風格</Label>
              <div className="grid grid-cols-3 gap-3">
                {VISUAL_STYLES.map((style) => {
                  const { label, emoji, desc } = STYLE_LABELS[style];
                  return (
                    <button
                      key={style}
                      data-testid={`btn-style-${style}`}
                      onClick={() => setVisualStyle(style)}
                      className={`py-3 px-2 rounded-xl border-2 text-center transition-all duration-200 cursor-pointer
                        ${visualStyle === style
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border bg-background hover:border-primary/50 hover:bg-primary/5"
                        }`}
                    >
                      <div className="text-2xl mb-1">{emoji}</div>
                      <div className={`font-semibold text-sm ${visualStyle === style ? "text-primary" : "text-foreground"}`}>
                        {label}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Image count */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Images className="w-4 h-4 text-primary" />
                插圖數量：<span className="text-primary font-bold">{imageCount} 張</span>
              </Label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-4">1</span>
                <input
                  type="range"
                  min={1}
                  max={8}
                  value={imageCount}
                  onChange={(e) => setImageCount(Number(e.target.value))}
                  data-testid="slider-image-count"
                  className="flex-1 h-2 rounded-full accent-primary cursor-pointer"
                  style={{ accentColor: "hsl(var(--primary))" }}
                />
                <span className="text-xs text-muted-foreground w-4">8</span>
              </div>
              <div className="flex justify-between px-1">
                {[1,2,3,4,5,6,7,8].map((n) => (
                  <button
                    key={n}
                    onClick={() => setImageCount(n)}
                    data-testid={`btn-img-count-${n}`}
                    className={`w-7 h-7 rounded-full text-xs font-semibold transition-all cursor-pointer
                      ${imageCount === n
                        ? "bg-primary text-white shadow-sm scale-110"
                        : "bg-muted/60 text-muted-foreground hover:bg-primary/20 hover:text-primary"
                      }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Avatar character */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                🎭 說故事角色
              </Label>
              <div className="grid grid-cols-5 gap-2">
                {AVATAR_STYLES.map((style) => (
                  <button
                    key={style}
                    data-testid={`btn-avatar-${style}`}
                    onClick={() => setAvatarStyle(style)}
                    title={AVATAR_LABELS[style]}
                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border-2 transition-all duration-200 cursor-pointer
                      ${avatarStyle === style
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border bg-background hover:border-primary/50 hover:bg-primary/5"
                      }`}
                  >
                    <span className="text-2xl">{
                      style === "bear" ? "🐻" :
                      style === "cat" ? "🐱" :
                      style === "robot" ? "🤖" :
                      style === "bunny" ? "🐰" : "👧"
                    }</span>
                    <span className={`text-xs font-medium leading-tight text-center ${avatarStyle === style ? "text-primary" : "text-muted-foreground"}`}>
                      {AVATAR_LABELS[style].split(" ")[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Voice language */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Mic className="w-4 h-4 text-primary" />
                語音朗讀語言
              </Label>
              <div className="grid grid-cols-3 gap-3">
                {VOICE_LANGS.map((lang) => (
                  <button
                    key={lang}
                    data-testid={`btn-voice-${lang}`}
                    onClick={() => setVoiceLang(lang)}
                    className={`py-2.5 px-3 rounded-xl border-2 text-center transition-all duration-200 cursor-pointer
                      ${voiceLang === lang
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border bg-background hover:border-primary/50 hover:bg-primary/5"
                      }`}
                  >
                    <div className="text-lg mb-0.5">
                      {lang === "zh-TW" ? "🇹🇼" : lang === "en-US" ? "🇺🇸" : "🇭🇰"}
                    </div>
                    <div className={`text-xs font-semibold leading-tight ${voiceLang === lang ? "text-primary" : "text-foreground"}`}>
                      {VOICE_LANG_LABELS[lang]}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <Button
              data-testid="btn-generate"
              onClick={handleGenerate}
              disabled={!topic.trim() || generateMutation.isPending}
              className="w-full py-6 text-lg rounded-xl bg-primary hover:bg-primary/90 animate-pulse-glow font-semibold gap-3"
              size="lg"
            >
              {generateMutation.isPending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  生成中，請稍候...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  一鍵生成教案
                </>
              )}
            </Button>

            {generateMutation.isError && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-xl p-3 text-center">
                生成失敗，請檢查 API Key 設定後重試。
                {(generateMutation.error as any)?.message && (
                  <span className="block text-xs mt-1 text-muted-foreground">
                    {(generateMutation.error as any).message}
                  </span>
                )}
              </div>
            )}

            {/* Cost estimate */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-xl p-3">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>預估生成時間：10-20 秒 | 圖片費用：約 ${(imageCount * 0.001).toFixed(3)} USD | 相同參數第二次：&lt;1 秒（快取）</span>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          {[
            { icon: "📖", title: "AI 故事腳本", desc: "GPT-4o-mini 生成適齡故事，含教師引導提示" },
            { icon: "🖼️", title: "風格插圖生成", desc: "FLUX.1-schnell 生成風格一致的繪本插畫" },
            { icon: "🌿", title: "互動分支情節", desc: "幼兒點選後才即時觸發分支，節省 API 費用" },
          ].map((f) => (
            <Card key={f.title} className="border-border/50 rounded-xl p-4 bg-white/60 dark:bg-card/60">
              <div className="text-3xl mb-2">{f.icon}</div>
              <h3 className="font-semibold text-sm text-foreground">{f.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
