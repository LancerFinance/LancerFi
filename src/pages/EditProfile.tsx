import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/useWallet";
import { supabase, Profile } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";

const EditProfile = () => {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    bio: '',
    skills: [] as string[],
    hourly_rate: '',
    portfolio_url: '',
    location: '',
    education: '',
    response_time: '< 24 hours',
    availability_status: 'available',
    experience_years: '',
    languages: [] as string[],
    certifications: [] as string[]
  });
  const [newSkill, setNewSkill] = useState('');
  const [newLanguage, setNewLanguage] = useState('');
  const [newCertification, setNewCertification] = useState('');
  
  const { toast } = useToast();
  const { address, isConnected } = useWallet();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isConnected) {
      navigate('/');
      return;
    }
    
    if (address) {
      loadProfile();
    }
  }, [address, isConnected]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('wallet_address', address)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setProfile(data);
        setFormData({
          full_name: data.full_name || '',
          username: data.username || '',
          bio: data.bio || '',
          skills: data.skills || [],
          hourly_rate: data.hourly_rate?.toString() || '',
          portfolio_url: data.portfolio_url || '',
          location: data.location || '',
          education: data.education || '',
          response_time: data.response_time || '< 24 hours',
          availability_status: data.availability_status || 'available',
          experience_years: data.experience_years?.toString() || '',
          languages: data.languages || ['English'],
          certifications: data.certifications || []
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!address) return;

    // Validate required fields
    if (!formData.full_name.trim() || !formData.username.trim() || !formData.bio.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      
      const profileData = {
        wallet_address: address,
        full_name: formData.full_name.trim(),
        username: formData.username.trim(),
        bio: formData.bio.trim(),
        skills: formData.skills,
        hourly_rate: parseFloat(formData.hourly_rate) || 0,
        portfolio_url: formData.portfolio_url.trim(),
        location: formData.location.trim(),
        education: formData.education.trim(),
        response_time: formData.response_time,
        availability_status: formData.availability_status,
        experience_years: parseInt(formData.experience_years) || 0,
        languages: formData.languages,
        certifications: formData.certifications
      };

      if (profile) {
        // Update existing profile
        const { error } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', profile.id);
        
        if (error) throw error;
      } else {
        // Create new profile
        const { error } = await supabase
          .from('profiles')
          .insert(profileData);
        
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Profile updated successfully!",
      });
      
      navigate('/');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Error",
        description: "Failed to save profile",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
      setNewSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skill)
    }));
  };

  const addLanguage = () => {
    if (newLanguage.trim() && !formData.languages.includes(newLanguage.trim())) {
      setFormData(prev => ({
        ...prev,
        languages: [...prev.languages, newLanguage.trim()]
      }));
      setNewLanguage('');
    }
  };

  const removeLanguage = (language: string) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.filter(l => l !== language)
    }));
  };

  const addCertification = () => {
    if (newCertification.trim() && !formData.certifications.includes(newCertification.trim())) {
      setFormData(prev => ({
        ...prev,
        certifications: [...prev.certifications, newCertification.trim()]
      }));
      setNewCertification('');
    }
  };

  const removeCertification = (certification: string) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.filter(c => c !== certification)
    }));
  };

  if (!isConnected) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Edit Your Profile</h1>
            <p className="text-muted-foreground">Update your freelancer profile information</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Your username"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="bio">Bio *</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell clients about yourself and your expertise..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="hourly_rate">Hourly Rate (USDC)</Label>
                  <Input
                    id="hourly_rate"
                    type="number"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData(prev => ({ ...prev, hourly_rate: e.target.value }))}
                    placeholder="50"
                  />
                </div>
                <div>
                  <Label htmlFor="experience_years">Years of Experience</Label>
                  <Input
                    id="experience_years"
                    type="number"
                    value={formData.experience_years}
                    onChange={(e) => setFormData(prev => ({ ...prev, experience_years: e.target.value }))}
                    placeholder="3"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Remote, USA"
                  />
                </div>
                <div>
                  <Label htmlFor="portfolio_url">Portfolio URL</Label>
                  <Input
                    id="portfolio_url"
                    value={formData.portfolio_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, portfolio_url: e.target.value }))}
                    placeholder="https://yourportfolio.com"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="education">Education</Label>
                <Input
                  id="education"
                  value={formData.education}
                  onChange={(e) => setFormData(prev => ({ ...prev, education: e.target.value }))}
                  placeholder="Computer Science, University of Technology"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Response Time</Label>
                  <Select
                    value={formData.response_time}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, response_time: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="< 2 hours">Under 2 hours</SelectItem>
                      <SelectItem value="< 4 hours">Under 4 hours</SelectItem>
                      <SelectItem value="< 24 hours">Under 24 hours</SelectItem>
                      <SelectItem value="1-3 days">1-3 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Availability Status</Label>
                  <Select
                    value={formData.availability_status}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, availability_status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="busy">Busy</SelectItem>
                      <SelectItem value="unavailable">Unavailable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Skills Section */}
              <div>
                <Label>Skills</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    placeholder="Add a skill"
                    onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                  />
                  <Button type="button" onClick={addSkill} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.skills.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {skill}
                      <X 
                        className="w-3 h-3 cursor-pointer" 
                        onClick={() => removeSkill(skill)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Languages Section */}
              <div>
                <Label>Languages</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newLanguage}
                    onChange={(e) => setNewLanguage(e.target.value)}
                    placeholder="Add a language"
                    onKeyPress={(e) => e.key === 'Enter' && addLanguage()}
                  />
                  <Button type="button" onClick={addLanguage} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.languages.map((language, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {language}
                      <X 
                        className="w-3 h-3 cursor-pointer" 
                        onClick={() => removeLanguage(language)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Certifications Section */}
              <div>
                <Label>Certifications</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newCertification}
                    onChange={(e) => setNewCertification(e.target.value)}
                    placeholder="Add a certification"
                    onKeyPress={(e) => e.key === 'Enter' && addCertification()}
                  />
                  <Button type="button" onClick={addCertification} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.certifications.map((certification, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {certification}
                      <X 
                        className="w-3 h-3 cursor-pointer" 
                        onClick={() => removeCertification(certification)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
                <Button variant="outline" onClick={() => navigate('/')}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default EditProfile;