import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, X, User } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

const CreateFreelancerProfile = () => {
  const navigate = useNavigate();
  const { isConnected, address } = useWallet();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    bio: '',
    hourly_rate: '',
    experience_years: '',
    portfolio_url: '',
    location: '',
    education: '',
    response_time: '&lt; 24 hours',
    availability_status: 'available'
  });
  
  const [skills, setSkills] = useState<string[]>([]);
  const [currentSkill, setCurrentSkill] = useState('');
  const [languages, setLanguages] = useState<string[]>(['English']);
  const [currentLanguage, setCurrentLanguage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addSkill = () => {
    if (currentSkill.trim() && !skills.includes(currentSkill.trim())) {
      setSkills([...skills, currentSkill.trim()]);
      setCurrentSkill('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter(skill => skill !== skillToRemove));
  };

  const addLanguage = () => {
    if (currentLanguage.trim() && !languages.includes(currentLanguage.trim())) {
      setLanguages([...languages, currentLanguage.trim()]);
      setCurrentLanguage('');
    }
  };

  const removeLanguage = (langToRemove: string) => {
    setLanguages(languages.filter(lang => lang !== langToRemove));
  };

  const handleSubmit = async () => {
    if (!isConnected || !address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to create a freelancer profile",
        variant: "destructive",
      });
      return;
    }

    const missing: string[] = [];
    const fullName = formData.full_name.trim();
    const username = formData.username.trim();
    const bio = formData.bio.trim();
    const rate = parseFloat(formData.hourly_rate.toString());

    if (!fullName) missing.push("Full Name");
    if (!username) missing.push("Username");
    if (!bio) missing.push("Bio");
    if (Number.isNaN(rate) || rate <= 0) missing.push("Hourly Rate (> 0)");

    if (missing.length > 0) {
      toast({
        title: "Missing Information",
        description: `Please provide: ${missing.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    if (skills.length === 0) {
      toast({
        title: "Skills Required",
        description: "Please add at least one skill to your profile",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Check if profile already exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('wallet_address', address)
        .single();

      if (existingProfile) {
        toast({
          title: "Profile Exists",
          description: "You already have a freelancer profile. Redirecting...",
          variant: "destructive",
        });
        navigate(`/freelancer/${existingProfile.id}`);
        return;
      }

      // Create new profile
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          wallet_address: address,
          username,
          full_name: fullName,
          bio,
          skills: skills,
          hourly_rate: rate,
          experience_years: parseInt(formData.experience_years) || 0,
          portfolio_url: formData.portfolio_url || null,
          location: formData.location || null,
          education: formData.education || null,
          languages: languages,
          response_time: formData.response_time,
          availability_status: formData.availability_status,
          rating: 5.0,
          completed_projects: 0,
          total_earned: 0
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Profile Created!",
        description: "Your freelancer profile has been created successfully",
      });
      
      navigate(`/freelancer/${data.id}`);
      
    } catch (error) {
      console.error('Error creating profile:', error);
      toast({
        title: "Failed to Create Profile",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Connect Wallet Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Please connect your wallet to create a freelancer profile.
              </p>
              <Link to="/">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <Link to="/">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4 text-foreground">
              Create Your Freelancer Profile
            </h1>
            <p className="text-xl text-muted-foreground">
              Join the Web3 freelance community and start earning USDC
            </p>
          </div>

          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-2xl">Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Information */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input 
                    id="full_name" 
                    placeholder="John Doe"
                    value={formData.full_name}
                    onChange={(e) => handleInputChange('full_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input 
                    id="username" 
                    placeholder="johndoe_web3"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Professional Bio *</Label>
                <Textarea 
                  id="bio"
                  placeholder="Describe your Web3 experience, specializations, and what makes you unique..."
                  rows={4}
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                />
              </div>

              {/* Skills */}
              <div className="space-y-2">
                <Label>Skills *</Label>
                <div className="flex gap-2 mb-2">
                  <Input 
                    placeholder="e.g., Solidity, React, DeFi..."
                    value={currentSkill}
                    onChange={(e) => setCurrentSkill(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                  />
                  <Button type="button" onClick={addSkill} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-sm">
                      {skill}
                      <button
                        onClick={() => removeSkill(skill)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Rates and Experience */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hourly_rate">Hourly Rate (USDC) *</Label>
                  <Input 
                    id="hourly_rate" 
                    type="number"
                    placeholder="75"
                    value={formData.hourly_rate}
                    onChange={(e) => handleInputChange('hourly_rate', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="experience_years">Years of Experience</Label>
                  <Input 
                    id="experience_years" 
                    type="number"
                    placeholder="3"
                    value={formData.experience_years}
                    onChange={(e) => handleInputChange('experience_years', e.target.value)}
                  />
                </div>
              </div>

              {/* Location and Portfolio */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input 
                    id="location" 
                    placeholder="San Francisco, CA"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="portfolio_url">Portfolio URL</Label>
                  <Input 
                    id="portfolio_url" 
                    placeholder="https://portfolio.example.com"
                    value={formData.portfolio_url}
                    onChange={(e) => handleInputChange('portfolio_url', e.target.value)}
                  />
                </div>
              </div>

              {/* Languages */}
              <div className="space-y-2">
                <Label>Languages</Label>
                <div className="flex gap-2 mb-2">
                  <Input 
                    placeholder="e.g., Spanish, French..."
                    value={currentLanguage}
                    onChange={(e) => setCurrentLanguage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLanguage())}
                  />
                  <Button type="button" onClick={addLanguage} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {languages.map((language, index) => (
                    <Badge key={index} variant="outline" className="text-sm">
                      {language}
                      {language !== 'English' && (
                        <button
                          onClick={() => removeLanguage(language)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Availability Settings */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="response_time">Response Time</Label>
                  <Select value={formData.response_time} onValueChange={(value) => handleInputChange('response_time', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="&lt; 2 hours">&lt; 2 hours</SelectItem>
                      <SelectItem value="&lt; 4 hours">&lt; 4 hours</SelectItem>
                      <SelectItem value="&lt; 24 hours">&lt; 24 hours</SelectItem>
                      <SelectItem value="1-3 days">1-3 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="availability_status">Availability Status</Label>
                  <Select value={formData.availability_status} onValueChange={(value) => handleInputChange('availability_status', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available for new projects</SelectItem>
                      <SelectItem value="busy">Currently busy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="education">Education (Optional)</Label>
                <Input 
                  id="education" 
                  placeholder="Computer Science, Stanford University"
                  value={formData.education}
                  onChange={(e) => handleInputChange('education', e.target.value)}
                />
              </div>

              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                size="lg" 
                className="w-full"
              >
                {isSubmitting ? 'Creating Profile...' : 'Create Freelancer Profile'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CreateFreelancerProfile;