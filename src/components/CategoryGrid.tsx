import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Code, Palette, Smartphone, TrendingUp, Shield, Database, Globe, Zap } from "lucide-react";
import { db } from "@/lib/supabase";

interface CategoryData {
  name: string;
  icon: React.ReactNode;
  count: number;
  description: string;
  color: string;
}

const CategoryGrid = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);

  const categoryIcons = {
    "Web Development": <Globe className="w-8 h-8" />,
    "Smart Contracts": <Shield className="w-8 h-8" />,
    "DeFi Development": <TrendingUp className="w-8 h-8" />,
    "NFT Development": <Palette className="w-8 h-8" />,
    "Blockchain Development": <Database className="w-8 h-8" />,
    "UI/UX Design": <Palette className="w-8 h-8" />,
    "Mobile Development": <Smartphone className="w-8 h-8" />,
    "Marketing": <Zap className="w-8 h-8" />,
    "Content Writing": <Code className="w-8 h-8" />,
    "Data Analysis": <Database className="w-8 h-8" />
  };

  const categoryDescriptions = {
    "Web Development": "Modern web applications and platforms",
    "Smart Contracts": "Secure blockchain contracts and protocols",
    "DeFi Development": "Decentralized finance solutions",
    "NFT Development": "Non-fungible token projects and marketplaces",
    "Blockchain Development": "Custom blockchain and dApp development",
    "UI/UX Design": "User interface and experience design",
    "Mobile Development": "Mobile apps and responsive design",
    "Marketing": "Digital marketing and growth strategies",
    "Content Writing": "Technical writing and documentation",
    "Data Analysis": "Data science and blockchain analytics"
  };

  const categoryColors = {
    "Web Development": "from-blue-500 to-blue-600",
    "Smart Contracts": "from-green-500 to-green-600",
    "DeFi Development": "from-purple-500 to-purple-600",
    "NFT Development": "from-pink-500 to-pink-600",
    "Blockchain Development": "from-indigo-500 to-indigo-600",
    "UI/UX Design": "from-orange-500 to-orange-600",
    "Mobile Development": "from-cyan-500 to-cyan-600",
    "Marketing": "from-red-500 to-red-600",
    "Content Writing": "from-yellow-500 to-yellow-600",
    "Data Analysis": "from-gray-500 to-gray-600"
  };

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

      // Create category data with dynamic counts
      const categoryData: CategoryData[] = Object.keys(categoryIcons).map(category => ({
        name: category,
        icon: categoryIcons[category as keyof typeof categoryIcons],
        count: categoryCounts[category] || 0,
        description: categoryDescriptions[category as keyof typeof categoryDescriptions],
        color: categoryColors[category as keyof typeof categoryColors]
      }));

      setCategories(categoryData);
    } catch (error) {
      console.error('Error loading category data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (categoryName: string) => {
    navigate(`/browse-services?category=${encodeURIComponent(categoryName)}`);
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
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">Browse by Category</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Explore services across different Web3 domains and find the expertise you need
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {categories.map((category) => (
            <Card 
              key={category.name}
              className="group hover:shadow-glow transition-all duration-300 cursor-pointer border-border/50 bg-card/80 backdrop-blur-sm hover:scale-105"
              onClick={() => handleCategoryClick(category.name)}
            >
              <CardContent className="p-6 text-center">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br ${category.color} flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-300`}>
                  {category.icon}
                </div>
                
                <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                  {category.name}
                </h3>
                
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {category.description}
                </p>
                
                <Badge variant="secondary" className="text-xs">
                  {category.count} {category.count === 1 ? 'service' : 'services'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">
            Can't find what you're looking for?
          </p>
          <button
            onClick={() => navigate('/post-project')}
            className="text-primary hover:text-primary/80 underline font-medium"
          >
            Post a custom project
          </button>
        </div>
      </div>
    </section>
  );
};

export default CategoryGrid;