import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/supabase";
import { PROJECT_CATEGORIES } from "@/lib/categories";

interface CategoryData {
  value: string;
  label: string;
  count: number;
  description: string;
  color: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const CategoryGrid = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategoryData();
  }, []);

  const loadCategoryData = async () => {
    try {
      setLoading(true);
      const projects = await db.getProjects();
      
      // Count projects by category
      const categoryCounts: Record<string, number> = {};
      projects.forEach(project => {
        if (project.status === 'active' || project.status === 'in_progress') {
          categoryCounts[project.category] = (categoryCounts[project.category] || 0) + 1;
        }
      });

      // Create category data with dynamic counts from PROJECT_CATEGORIES
      const categoryData: CategoryData[] = PROJECT_CATEGORIES.map(category => ({
        value: category.value,
        label: category.label,
        Icon: category.icon,
        count: categoryCounts[category.value] || 0,
        description: category.description,
        color: category.color
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-muted h-32 rounded-lg"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 fade-in">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Browse by Category</h2>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            Explore services across different Web3 domains and find the expertise you need
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((category, index) => {
            const Icon = category.Icon;
            return (
              <div
                key={category.value}
                className="group relative overflow-hidden rounded-2xl cursor-pointer hover-lift fade-in shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-border bg-gradient-to-br from-card to-secondary/20"
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => handleCategoryClick(category.value)}
              >
                <div className="p-8">
                  <div className="w-16 h-16 mb-4 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Icon className="w-8 h-8" />
                  </div>
                  
                  <h3 className="font-bold text-xl mb-2 text-foreground group-hover:text-primary transition-colors">
                    {category.label}
                  </h3>
                  
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {category.description}
                  </p>
                  
                  <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-secondary/80 text-secondary-foreground border border-border">
                    {category.count} {category.count === 1 ? 'service' : 'services'}
                  </div>
                </div>
                <div className="absolute bottom-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mb-12"></div>
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