import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, MapPin, Wallet, Clock } from "lucide-react";

const HireTalent = () => {
  const talents = [
    {
      id: 1,
      name: "Alex Chen",
      title: "Full-Stack Web3 Developer",
      location: "San Francisco, CA",
      rating: 4.9,
      reviews: 47,
      hourlyRate: "$85-120",
      skills: ["Solidity", "React", "Node.js", "DeFi"],
      bio: "Experienced Web3 developer with 5+ years building DeFi protocols and dApps.",
      avatar: "/placeholder.svg"
    },
    {
      id: 2,
      name: "Sarah Kim",
      title: "Smart Contract Auditor",
      location: "Austin, TX",
      rating: 5.0,
      reviews: 23,
      hourlyRate: "$100-150",
      skills: ["Solidity", "Security", "Auditing", "Foundry"],
      bio: "Security-focused smart contract auditor with expertise in DeFi and NFT protocols.",
      avatar: "/placeholder.svg"
    },
    {
      id: 3,
      name: "Marcus Johnson",
      title: "Web3 UI/UX Designer",
      location: "New York, NY",
      rating: 4.8,
      reviews: 31,
      hourlyRate: "$70-95",
      skills: ["Figma", "Web3 UX", "Prototyping", "Branding"],
      bio: "Creative designer specializing in intuitive Web3 user experiences.",
      avatar: "/placeholder.svg"
    },
    {
      id: 4,
      name: "Elena Rodriguez",
      title: "Blockchain Marketing Expert",
      location: "Miami, FL",
      rating: 4.7,
      reviews: 19,
      hourlyRate: "$60-80",
      skills: ["Marketing", "Community", "Content", "Growth"],
      bio: "Growth marketer helping Web3 projects build engaged communities.",
      avatar: "/placeholder.svg"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-foreground to-web3-primary bg-clip-text text-transparent">
            Hire Top Web3 Talent
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Connect with verified Web3 professionals ready to bring your project to life
          </p>
        </div>

        {/* Filters Section */}
        <div className="flex flex-wrap gap-4 mb-8 justify-center">
          <Button variant="outline" size="sm">All Categories</Button>
          <Button variant="outline" size="sm">Developers</Button>
          <Button variant="outline" size="sm">Designers</Button>
          <Button variant="outline" size="sm">Marketers</Button>
          <Button variant="outline" size="sm">Auditors</Button>
        </div>

        {/* Talent Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {talents.map((talent) => (
            <Card key={talent.id} className="hover:shadow-lg transition-shadow duration-300 border-border bg-card">
              <CardHeader className="pb-4">
                <div className="flex items-start space-x-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={talent.avatar} alt={talent.name} />
                    <AvatarFallback className="bg-web3-primary text-white font-semibold">
                      {talent.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-semibold text-foreground truncate">
                      {talent.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mb-2">
                      {talent.title}
                    </p>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3 mr-1" />
                      {talent.location}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Rating */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 fill-web3-warning text-web3-warning" />
                    <span className="font-medium text-foreground">{talent.rating}</span>
                    <span className="text-sm text-muted-foreground">({talent.reviews})</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 mr-1" />
                    {talent.hourlyRate}/hr
                  </div>
                </div>

                {/* Bio */}
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {talent.bio}
                </p>

                {/* Skills */}
                <div className="flex flex-wrap gap-1">
                  {talent.skills.slice(0, 3).map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                  {talent.skills.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{talent.skills.length - 3}
                    </Badge>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    View Profile
                  </Button>
                  <Button size="sm" variant="default" className="flex-1">
                    <Wallet className="w-4 h-4 mr-1" />
                    Hire
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Load More */}
        <div className="text-center mt-12">
          <Button variant="outline" size="lg">
            Load More Talent
          </Button>
        </div>
      </main>
    </div>
  );
};

export default HireTalent;