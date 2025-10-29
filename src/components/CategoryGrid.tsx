import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { db, supabase } from "@/lib/supabase";
import { PROJECT_CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";

interface CategoryData {
  value: string;
  label: string;
  count: number;
  description: string;
  color: string;
  Icon: React.ComponentType<{ className?: string }>;
  group?: string;
  avgValueText?: string;
  trendPercent?: number;
  topTalentName?: string;
}

const CategoryGrid = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "trending" | "most" | "new" | "high">("all");
  const [sortBy, setSortBy] = useState<"activity" | "price" | "completion" | "delivery">("activity");

  useEffect(() => {
    loadCategoryData();
  }, []);

  const loadCategoryData = async () => {
    try {
      setLoading(true);
      const projects = await db.getProjects();
      
      // Count projects by category
      const categoryCounts: Record<string, number> = {};
      // Track experience by freelancer within each category (worked projects)
      const experienceByCategory: Record<string, Record<string, number>> = {};
      projects.forEach(project => {
        if (project.status === 'active' || project.status === 'in_progress') {
          categoryCounts[project.category] = (categoryCounts[project.category] || 0) + 1;
        }
        // Count "worked" projects for top talent selection
        if ((project.status === 'in_progress' || project.status === 'completed') && project.freelancer_id) {
          const cat = project.category;
          experienceByCategory[cat] = experienceByCategory[cat] || {};
          const byFreelancer = experienceByCategory[cat];
          byFreelancer[project.freelancer_id] = (byFreelancer[project.freelancer_id] || 0) + 1;
        }
      });

      // Determine top freelancer IDs per category
      const topFreelancerIds: string[] = [];
      const topByCategory: Record<string, string | undefined> = {};
      PROJECT_CATEGORIES.forEach(category => {
        const freq = experienceByCategory[category.value];
        if (freq) {
          const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
          if (top) {
            topByCategory[category.value] = top[0];
            topFreelancerIds.push(top[0]);
          }
        }
      });

      // Fetch profile names for top freelancers
      let idToName: Record<string, string> = {};
      if (topFreelancerIds.length > 0) {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', topFreelancerIds);
        if (!error && profiles) {
          profiles.forEach((p: any) => {
            idToName[p.id] = p.full_name || p.username || 'Top Talent';
          });
        }
      }

      // Create category data with dynamic counts from PROJECT_CATEGORIES
      const categoryData: CategoryData[] = PROJECT_CATEGORIES.map(category => ({
        value: category.value,
        label: category.label,
        Icon: category.icon,
        count: categoryCounts[category.value] || 0,
        description: category.description,
        color: category.color,
        group: (category as any).group,
        avgValueText: (category as any).avgValueText,
        trendPercent: (category as any).trendPercent,
        topTalentName: topByCategory[category.value] ? idToName[topByCategory[category.value] as string] : undefined
      }));

      setCategories(categoryData);
    } catch (error) {
      console.error('Error loading category data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (categoryValue: string) => {
    navigate(`/browse-services?category=${encodeURIComponent(categoryValue)}`);
  };

  if (loading) {
    return (
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground mb-4">Browse by Category</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md">
                  <div className="h-44 w-full bg-gradient-to-br from-muted/70 to-muted/30 animate-pulse" />
                  <div className="p-6">
                    <div className="h-5 w-40 bg-muted rounded mb-3 animate-pulse" />
                    <div className="h-4 w-56 bg-muted/80 rounded mb-6 animate-pulse" />
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-24 bg-muted rounded-full animate-pulse" />
                      <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // derived filter/sort
  const filtered = categories.filter((c) => {
    if (activeFilter === "trending") return (c.trendPercent || 0) > 0;
    if (activeFilter === "most") return c.count > 0;
    if (activeFilter === "new") return true; // placeholder (no createdAt available)
    if (activeFilter === "high") return (c.avgValueText || "").includes("K");
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "activity") return (b.count || 0) - (a.count || 0);
    if (sortBy === "price") {
      const parseHigh = (s?: string) => {
        if (!s) return 0;
        const match = s.match(/\$(\d+)([Kk])/);
        return match ? parseInt(match[1], 10) : 0;
      };
      return parseHigh(b.avgValueText) - parseHigh(a.avgValueText);
    }
    if (sortBy === "completion") return (b.trendPercent || 0) - (a.trendPercent || 0);
    if (sortBy === "delivery") return a.label.localeCompare(b.label);
    return 0;
  });

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 fade-in">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Browse by Category</h2>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            Explore services across different Web3 domains and find the expertise you need
          </p>
        </div>

        {/* Sticky Filter & Sort Bar */}
        <div className="sticky top-14 z-10 mb-6">
          <div className="rounded-full border border-border bg-card/70 backdrop-blur-md px-3 py-2 shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { key: "all", label: "All" },
                  { key: "trending", label: "Trending" },
                  { key: "most", label: "Most Active" },
                  { key: "new", label: "New" },
                  { key: "high", label: "High Value" }
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setActiveFilter(f.key as any)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors motion-safe:duration-200 min-h-[32px] flex items-center justify-center whitespace-nowrap",
                      activeFilter === f.key
                        ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white"
                        : "bg-muted text-foreground hover:bg-muted/80"
                    )}
                    aria-pressed={activeFilter === f.key}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { key: "activity", label: "Activity" },
                  { key: "price", label: "Price" },
                  { key: "completion", label: "Completion" },
                  { key: "delivery", label: "Delivery" }
                ].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSortBy(s.key as any)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors motion-safe:duration-200 min-h-[32px] flex items-center justify-center whitespace-nowrap",
                      sortBy === s.key
                        ? "bg-background border border-border"
                        : "bg-muted text-foreground hover:bg-muted/80"
                    )}
                    aria-pressed={sortBy === s.key}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sorted.map((category, index) => {
            const Icon = category.Icon;
            return (
              <div
                key={category.value}
                className="group relative overflow-hidden rounded-2xl cursor-pointer fade-in border border-border/60 bg-white/60 dark:bg-white/5 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-transform motion-safe:duration-300 motion-safe:ease-out hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.15)]"
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => handleCategoryClick(category.value)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCategoryClick(category.value); }}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="w-14 h-14 rounded-xl bg-black dark:bg-black text-white border border-border flex items-center justify-center shadow-sm group-hover:scale-105 motion-safe:duration-300">
                      <Icon className="w-7 h-7" />
                    </div>
                    <div className={cn("px-2.5 py-1 rounded-full text-xs font-medium border",
                      (category.trendPercent || 0) >= 0 ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30" : "text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-950/30"
                    )}>
                      {(category.trendPercent || 0) >= 0 ? `↑ ${category.trendPercent?.toFixed(1)}%` : `↓ ${Math.abs(category.trendPercent || 0).toFixed(1)}%`}
                    </div>
                  </div>

                  <h3 className="font-semibold text-xl mt-5 mb-1 text-foreground tracking-tight">
                    {category.label}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{category.description}</p>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border/60 bg-background/50 p-3">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Active</div>
                      <div className="mt-1 text-sm font-semibold">
                        {category.count > 0 ? (
                          <>{category.count} {category.count === 1 ? 'service' : 'services'}</>
                        ) : (
                          <span className="text-muted-foreground">No active services in this category</span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/50 p-3">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Avg. Value</div>
                      <div className="mt-1 text-sm font-semibold">{category.avgValueText || "—"}</div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    {category.topTalentName ? (
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">
                          {category.topTalentName.split(' ').map(p=>p[0]).join('').slice(0,2)}
                        </div>
                        <span className="text-xs text-muted-foreground">Top talent</span>
                        <span className="text-xs font-medium text-foreground">{category.topTalentName}</span>
                      </div>
                    ) : (
                      <div />
                    )}
                    <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">Explore →</span>
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl" />
              </div>
            );
          })}
        </div>

        <div className="text-center mt-12 fade-in">
          <p className="text-muted-foreground mb-4">
            Can't find what you're looking for?
          </p>
          <button
            onClick={() => navigate('/post-project')}
            className="text-primary hover:text-primary/80 font-medium underline underline-offset-4 ripple"
          >
            Post a custom project
          </button>
        </div>
      </div>
    </section>
  );
};

export default CategoryGrid;