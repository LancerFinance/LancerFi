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
import { validateProfile } from "@/lib/validation";
import { useProfile } from "@/hooks/useProfile";
import { handleError, handleSuccess } from "@/lib/error-handler";

const EditProfile = () => {
  const [loading, setLoading] = useState(false);
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
    certifications: [] as string[],
    banner_url: '',
    profile_photo_url: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [newSkill, setNewSkill] = useState('');
  const [newLanguage, setNewLanguage] = useState('');
  const [newCertification, setNewCertification] = useState('');
  
  const { toast } = useToast();
  const { address, isConnected, isConnecting, connectWallet } = useWallet();
  const navigate = useNavigate();
  const { profile, createOrUpdateProfile } = useProfile();

  useEffect(() => {
    // Load profile data when available
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        username: profile.username || '',
        bio: profile.bio || '',
        skills: profile.skills || [],
        hourly_rate: profile.hourly_rate?.toString() || '',
        portfolio_url: profile.portfolio_url || '',
        location: profile.location || '',
        education: profile.education || '',
        response_time: profile.response_time || '< 24 hours',
        availability_status: profile.availability_status || 'available',
        experience_years: profile.experience_years?.toString() || '',
        languages: profile.languages || ['English'],
        certifications: profile.certifications || [],
        banner_url: profile.banner_url || '',
        profile_photo_url: profile.profile_photo_url || ''
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!address) return;

    // Validate form using validation utility
    const validationErrors = validateProfile(formData);
    if (validationErrors.length > 0) {
      const errorMap: Record<string, string> = {};
      validationErrors.forEach(error => {
        errorMap[error.field] = error.message;
      });
      setFormErrors(errorMap);
      
      const details = validationErrors.map(err => `• ${err.message}`).join('\n');

      toast({
        title: `Validation errors (${validationErrors.length})`,
        description: details,
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      setFormErrors({});
      
      const profileData = {
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
        certifications: formData.certifications,
        banner_url: formData.banner_url.trim(),
        profile_photo_url: formData.profile_photo_url.trim()
      };

      await createOrUpdateProfile(profileData);

      handleSuccess("Profile Updated", "Your profile has been saved successfully!");
      
      navigate('/');
    } catch (error) {
      handleError(error, "Profile Save Failed");
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
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-3xl font-bold text-foreground mb-2">Connect your wallet</h1>
            <p className="text-muted-foreground mb-6">Please connect your wallet to edit your profile.</p>
            <Button onClick={connectWallet} disabled={isConnecting}>
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </Button>
          </div>
        </main>
      </div>
    );
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
                      className={formErrors.full_name ? "border-destructive" : ""}
                    />
                    {formErrors.full_name && (
                      <p className="text-sm text-destructive mt-1">{formErrors.full_name}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="Your username"
                      className={formErrors.username ? "border-destructive" : ""}
                    />
                    {formErrors.username && (
                      <p className="text-sm text-destructive mt-1">{formErrors.username}</p>
                    )}
                  </div>
              </div>

              <div>
                <Label htmlFor="profile_photo_url">Profile Photo URL</Label>
                <Input
                  id="profile_photo_url"
                  value={formData.profile_photo_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, profile_photo_url: e.target.value }))}
                  placeholder="https://example.com/photo.jpg"
                />
              </div>

              <div>
                <Label htmlFor="banner_url">Banner Image URL</Label>
                <Input
                  id="banner_url"
                  value={formData.banner_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, banner_url: e.target.value }))}
                  placeholder="https://example.com/banner.jpg"
                />
              </div>

              <div>
                <Label htmlFor="bio">Bio *</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell clients about yourself and your expertise..."
                  rows={4}
                  className={formErrors.bio ? "border-destructive" : ""}
                />
                {formErrors.bio && (
                  <p className="text-sm text-destructive mt-1">{formErrors.bio}</p>
                )}
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
                    className={formErrors.hourly_rate ? "border-destructive" : ""}
                  />
                  {formErrors.hourly_rate && (
                    <p className="text-sm text-destructive mt-1">{formErrors.hourly_rate}</p>
                  )}
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
                    className={formErrors.portfolio_url ? "border-destructive" : ""}
                  />
                  {formErrors.portfolio_url && (
                    <p className="text-sm text-destructive mt-1">{formErrors.portfolio_url}</p>
                  )}
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