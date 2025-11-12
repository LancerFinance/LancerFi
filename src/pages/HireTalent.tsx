import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, MapPin, Wallet, Clock, User, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase, Profile } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { getSolanaPrice } from "@/lib/solana-price";

const HireTalent = () => {
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [freelancers, setFreelancers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [usdEarnings, setUsdEarnings] = useState<Record<string, number>>({});
  const { toast } = useToast();
  
  const categories = ["All Categories", "Developers", "Designers", "Marketers", "Auditors"];

  useEffect(() => {
    loadFreelancers();
  }, []);

  const loadFreelancers = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .not('skills', 'is', null)
        .order('rating', { ascending: false });
      
      if (error) throw error;

      const freelancerList = profiles || [];
      const freelancerIds = freelancerList.map((f) => f.id).filter(Boolean);

      let earningsByFreelancer: Record<string, number> = {};

      if (freelancerIds.length > 0) {
        // Fetch projects assigned to these freelancers
        const { data: projects, error: projErr } = await supabase
          .from('projects')
          .select('id, freelancer_id')
          .in('freelancer_id', freelancerIds);
        if (projErr) throw projErr;

        const projectIds = (projects || []).map((p: any) => p.id);
        const projectToFreelancer: Record<string, string> = {};
        (projects || []).forEach((p: any) => {
          if (p.id && p.freelancer_id) projectToFreelancer[p.id] = p.freelancer_id;
        });

        if (projectIds.length > 0) {
          // Sum released escrows for those projects
          // Fetch payment_currency to know if amount_usdc is in SOL or USD
          const { data: escrows, error: escErr } = await supabase
            .from('escrows')
            .select('project_id, amount_usdc, payment_currency, status')
            .in('project_id', projectIds)
            .eq('status', 'released');
          if (escErr) throw escErr;

          // Separate SOL and USD earnings
          const solEarningsByFreelancer: Record<string, number> = {};
          const usdEarningsByFreelancer: Record<string, number> = {};

          (escrows || []).forEach((e: any) => {
            const fid = projectToFreelancer[e.project_id as string];
            if (fid) {
              const amount = Number(e.amount_usdc || 0);
              const currency = e.payment_currency || 'SOLANA';
              
              // If currency is SOLANA, amount_usdc is in SOL - add to SOL earnings
              // If currency is X402 or USDC, amount_usdc is already in USD - add to USD earnings
              if (currency === 'SOLANA') {
                solEarningsByFreelancer[fid] = (solEarningsByFreelancer[fid] || 0) + amount;
              } else {
                usdEarningsByFreelancer[fid] = (usdEarningsByFreelancer[fid] || 0) + amount;
              }
            }
          });

          // Convert SOL earnings to USD and combine with USD earnings
          const priceData = await getSolanaPrice();
          const solPrice = priceData.price_usd;
          
          earningsByFreelancer = {};
          const allFreelancerIds = new Set([
            ...Object.keys(solEarningsByFreelancer),
            ...Object.keys(usdEarningsByFreelancer)
          ]);

          for (const fid of allFreelancerIds) {
            const solAmount = solEarningsByFreelancer[fid] || 0;
            const usdAmount = usdEarningsByFreelancer[fid] || 0;
            
            // Convert SOL to USD
            const solInUsd = solAmount * solPrice;
            
            // Total USD earnings = USD from USDC/X402 payments + USD from SOL payments
            earningsByFreelancer[fid] = usdAmount + solInUsd;
          }
        }
      }

      // Get SOL price for converting SOL amounts to USD
      let solPrice = 100; // Fallback price
      try {
        const priceData = await getSolanaPrice();
        solPrice = priceData.price_usd || 100; // Ensure we have a valid price
        if (!solPrice || solPrice <= 0) {
          solPrice = 100; // Use fallback if price is invalid
        }
      } catch (error) {
        console.error('Error fetching SOL price:', error);
        solPrice = 100; // Use fallback price
      }

      // Calculate USD earnings for each freelancer
      // earningsByFreelancer contains USD amounts from escrows (already converted)
      // For freelancers without escrows, convert their database total_earned (SOL) to USD
      const earningsMap: Record<string, number> = {};
      for (const freelancer of freelancerList) {
        let usdEarned = 0;
        
        // If we calculated earnings from escrows, use those (already in USD)
        if (earningsByFreelancer[freelancer.id] !== undefined && earningsByFreelancer[freelancer.id] > 0) {
          usdEarned = earningsByFreelancer[freelancer.id];
        } 
        // Otherwise, convert database total_earned (which is in SOL) to USD
        else if (freelancer.total_earned && Number(freelancer.total_earned) > 0) {
          // The database total_earned is stored in SOL, so convert to USD
          const solAmount = Number(freelancer.total_earned);
          usdEarned = solAmount * solPrice;
          console.log(`Converting ${solAmount} SOL to USD for freelancer ${freelancer.id}: ${solAmount} * ${solPrice} = ${usdEarned}`);
        }
        
        earningsMap[freelancer.id] = usdEarned;
      }
      
      console.log('Final earningsMap:', earningsMap);
      console.log('SOL Price used:', solPrice);

      setUsdEarnings(earningsMap);
      setFreelancers(freelancerList);
    } catch (error) {
      console.error('Error loading freelancers:', error);
      toast({
        title: "Error",
        description: "Failed to load freelancers",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const getFreelancersByCategory = () => {
    if (selectedCategory === "All Categories") return freelancers;
    
    const categoryKeywords: Record<string, string[]> = {
      "Developers": ["Solidity", "React", "Node.js", "DeFi", "Web3.js", "JavaScript", "TypeScript", "Smart Contracts"],
      "Designers": ["Figma", "Design", "UI", "UX", "Branding", "Prototyping"],
      "Marketers": ["Marketing", "Community", "Growth", "Content", "Social Media"],
      "Auditors": ["Security", "Auditing", "Solidity", "Smart Contract Security"]
    };

    const keywords = categoryKeywords[selectedCategory] || [];
    return freelancers.filter(freelancer => 
      freelancer.skills?.some(skill => 
        keywords.some(keyword => 
          skill.toLowerCase().includes(keyword.toLowerCase())
        )
      )
    );
  };

  const filteredFreelancers = getFreelancersByCategory();

  const getAvailabilityColor = (status?: string) => {
    switch (status) {
      case 'available': return 'text-web3-success';
      case 'busy': return 'text-web3-warning'; 
      default: return 'text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
            <p className="mt-4 text-muted-foreground">Loading freelancers...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8">
        <Link to="/">
          <Button variant="ghost" className="mb-4 sm:mb-6 text-xs sm:text-sm">
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            Back to Home
          </Button>
        </Link>
        {/* Page Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-2 sm:mb-3 md:mb-4 bg-gradient-to-r from-foreground to-web3-primary bg-clip-text text-transparent px-2">
            Hire Top Web3 Talent
          </h1>
          <p className="text-sm sm:text-base md:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
            Connect with verified Web3 professionals ready to bring your project to life
          </p>
        </div>

        {/* Filters Section */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-4 mb-6 sm:mb-8 justify-center px-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-3 py-1.5 sm:py-2 h-9 sm:h-10 min-w-fit"
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Talent Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredFreelancers.map((freelancer) => (
            <Card key={freelancer.id} className="hover:shadow-lg transition-shadow duration-300 border-border bg-card">
              <CardHeader className="pb-4">
                <div className="flex items-start space-x-4">
                  <Avatar className="w-16 h-16 border-2 border-background shadow-lg flex-shrink-0">
                    <AvatarImage 
                      src={freelancer.profile_photo_url || ''} 
                      alt={freelancer.full_name || freelancer.username || 'Freelancer'} 
                    />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                      {(freelancer.full_name || freelancer.username || 'F')
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-semibold text-foreground truncate">
                      {freelancer.full_name || freelancer.username}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mb-2">
                      {freelancer.skills?.[0] && `${freelancer.skills[0]} Specialist`}
                    </p>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3 mr-1" />
                      {freelancer.location || 'Remote'}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Rating and Stats */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 fill-web3-warning text-web3-warning" />
                    <span className="font-medium text-foreground">{freelancer.rating || 0}</span>
                    <span className="text-sm text-muted-foreground">({freelancer.completed_projects || 0})</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 mr-1" />
                    ${freelancer.hourly_rate || 0}/hr
                  </div>
                </div>

                {/* Total Earned */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Earned:</span>
                  <span className="font-medium text-web3-primary">
                    ${(usdEarnings[freelancer.id] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Availability Status */}
                <div className={`inline-flex items-center gap-2 text-xs ${getAvailabilityColor(freelancer.availability_status)}`}>
                  <div className="w-2 h-2 rounded-full bg-current"></div>
                  <span>{freelancer.availability_status === 'available' ? 'Available' : freelancer.availability_status === 'busy' ? 'Busy' : 'Available'}</span>
                </div>

                {/* Bio */}
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {freelancer.bio || 'Experienced Web3 professional ready to help with your project.'}
                </p>

                {/* Skills */}
                <div className="flex flex-wrap gap-1">
                  {freelancer.skills?.slice(0, 3).map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  )) || null}
                  {freelancer.skills && freelancer.skills.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{freelancer.skills.length - 3}
                    </Badge>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2 pt-2">
                  <Link to={`/freelancer/${freelancer.id}`} className="flex-1">
                    <Button size="sm" variant="outline" className="w-full">
                      View Profile
                    </Button>
                  </Link>
                  <Link to={`/post-project?freelancer=${freelancer.id}`} className="flex-1">
                    <Button size="sm" variant="default" className="w-full">
                      <Wallet className="w-4 h-4 mr-1" />
                      Hire
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredFreelancers.length === 0 && !loading && (
          <div className="text-center py-12">
            <h3 className="text-xl font-semibold mb-2">No freelancers found</h3>
            <p className="text-muted-foreground">Try selecting a different category or check back later.</p>
          </div>
        )}

        {/* Load More */}
        <div className="text-center mt-12">
          <Button 
            variant="outline" 
            size="lg"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Back to Top
          </Button>
        </div>
      </main>
    </div>
  );
};

export default HireTalent;