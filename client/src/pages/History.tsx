import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, Clock, DollarSign, Zap } from "lucide-react";
import { Link } from "wouter";

interface LessonMeta {
  id: string;
  ageGroup: string;
  topic: string;
  visualStyle: string;
  createdAt: number;
  generationMs: number | null;
  totalCostUsd: number | null;
}

const STYLE_EMOJI: Record<string, string> = {
  watercolor: "🎨", crayon: "🖍️", kawaii: "🌸",
};

export default function History() {
  const { data: lessons, isLoading } = useQuery({
    queryKey: ["/api/lessons"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/lessons");
      return res.json() as Promise<LessonMeta[]>;
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-background dark:to-background">
      <header className="bg-white/80 dark:bg-card/80 backdrop-blur-sm border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="btn-back-history">
              <ArrowLeft className="w-4 h-4" />
              返回
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">歷史教案記錄</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 skeleton rounded-2xl" />
            ))}
          </div>
        ) : !lessons?.length ? (
          <div className="text-center py-20 space-y-4">
            <div className="text-5xl">📚</div>
            <p className="text-muted-foreground">還沒有生成過教案</p>
            <Link href="/">
              <Button className="gap-2">
                <BookOpen className="w-4 h-4" />
                開始生成第一個故事
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...lessons].reverse().map((lesson) => (
              <Link key={lesson.id} href={`/play/${lesson.id}`}>
                <Card
                  className="border-border/60 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer h-full"
                  data-testid={`card-lesson-${lesson.id}`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{STYLE_EMOJI[lesson.visualStyle] || "📖"}</span>
                        <div>
                          <h3 className="font-semibold text-foreground text-sm leading-tight">{lesson.topic}</h3>
                          <Badge variant="outline" className="text-xs mt-0.5">{lesson.ageGroup} 歲</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {lesson.generationMs && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {(lesson.generationMs / 1000).toFixed(1)}s
                        </span>
                      )}
                      {lesson.totalCostUsd !== null && lesson.totalCostUsd !== undefined && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          ${lesson.totalCostUsd.toFixed(4)}
                        </span>
                      )}
                      <span className="flex items-center gap-1 ml-auto">
                        <Zap className="w-3 h-3 text-amber-500" />
                        快取可用
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {new Date(lesson.createdAt).toLocaleString("zh-TW")}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
