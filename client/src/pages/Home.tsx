import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { LessonPayload, AgeGroup, VisualStyle, VoiceLang, AvatarStyle } from "@shared/schema";
import { AGE_GROUPS, VISUAL_STYLES, VOICE_LANGS, AVATAR_STYLES, AVATAR_LABELS } from "@shared/schema";

const PRESET_TOPICS = ["洗手", "情緒", "自律", "分享", "數字", "動物"];

const AGE_LABELS: Record<AgeGroup, string> = {
  "2-3": "1-3歲",
  "4-5": "4-5歲",
  "6+": "6歲以上",
};

const STYLE_LABELS: Record<VisualStyle, string> = {
  watercolor: "水彩風",
  crayon: "蠟筆風",
  kawaii: "日系可愛風",
};

const VOICE_LABELS: Record<VoiceLang, string> = {
  "zh-TW": "繁體中文",
  "en-US": "English",
  "zh-HK": "粵語",
};

export default function Home() {
  const [, setLocation] = useLocation();
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("2-3");
  const [topic, setTopic] = useState("");
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("watercolor");
  const [imageCount] = useState<number>(3);
  const [voiceLang] = useState<VoiceLang>("zh-HK");
  const [avatarStyle] = useState<AvatarStyle>("bear");

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
    <div className="min-h-screen bg-[#45BAB3] flex items-start justify-center px-4 pt-10 pb-10">
      <div className="w-full max-w-2xl">
        {/* Title */}
        <h1
          className="text-center font-bold mb-6 leading-tight"
          style={{ fontSize: "2.6rem", color: "#E8642A", textShadow: "1px 1px 0 rgba(0,0,0,0.08)" }}
        >
          看圖說故事生成器
        </h1>

        <div className="bg-[#45BAB3] rounded-sm">
          {/* Divider */}
          <hr className="border-t border-[#3aa39c]" />

          {/* Age group row */}
          <div className="flex items-center gap-6 py-5 px-2">
            <span className="text-white font-medium text-base w-20 flex-shrink-0">對象年齡</span>
            <div className="relative">
              <select
                data-testid="select-age"
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}
                className="appearance-none bg-white border border-gray-300 rounded px-3 py-1.5 pr-8 text-gray-800 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                {AGE_GROUPS.map((age) => (
                  <option key={age} value={age}>{AGE_LABELS[age]}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">▼</span>
            </div>
          </div>

          {/* Divider */}
          <hr className="border-t border-[#3aa39c]" />

          {/* Topic row */}
          <div className="py-5 px-2">
            <div className="flex items-center gap-6">
              <span className="text-white font-medium text-base w-20 flex-shrink-0">故事主題</span>
              <input
                id="topic"
                data-testid="input-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                className="flex-1 bg-white border border-gray-300 rounded px-3 py-1.5 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-3 ml-26" style={{ marginLeft: "calc(5rem + 1.5rem)" }}>
              {PRESET_TOPICS.map((t) => (
                <button
                  key={t}
                  data-testid={`btn-topic-preset-${t}`}
                  onClick={() => setTopic(t)}
                  className={`px-4 py-1 text-sm border rounded cursor-pointer transition-colors
                    ${topic === t
                      ? "bg-white/30 border-white text-white font-semibold"
                      : "bg-white/10 border-white/40 text-white hover:bg-white/20"
                    }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <hr className="border-t border-[#3aa39c]" />

          {/* Visual style row */}
          <div className="flex items-center gap-6 py-5 px-2">
            <span className="text-white font-medium text-base w-20 flex-shrink-0">畫面風格</span>
            <div className="relative">
              <select
                data-testid="select-visual-style"
                value={visualStyle}
                onChange={(e) => setVisualStyle(e.target.value as VisualStyle)}
                className="appearance-none bg-white border border-gray-300 rounded px-3 py-1.5 pr-8 text-gray-800 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                {VISUAL_STYLES.map((style) => (
                  <option key={style} value={style}>{STYLE_LABELS[style]}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">▼</span>
            </div>
          </div>

          {/* Divider */}
          <hr className="border-t border-[#3aa39c]" />

          {/* Generate button */}
          <div className="flex justify-center pt-6 pb-2">
            <button
              data-testid="btn-generate"
              onClick={handleGenerate}
              disabled={!topic.trim() || generateMutation.isPending}
              className="px-16 py-3 rounded text-white font-bold text-xl cursor-pointer transition-opacity disabled:opacity-60"
              style={{ backgroundColor: "#D93025", minWidth: "160px" }}
            >
              {generateMutation.isPending ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                  生成中…
                </span>
              ) : "生成"}
            </button>
          </div>

          {generateMutation.isError && (
            <p className="text-center text-sm text-red-200 mt-3 pb-4">
              生成失敗，請檢查 API Key 設定後重試。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
