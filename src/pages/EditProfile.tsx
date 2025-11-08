import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Upload, Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/useWallet";
import { supabase, Profile } from "@/lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import Header from "@/components/Header";
import { validateProfile } from "@/lib/validation";
import { useProfile } from "@/hooks/useProfile";
import { handleError, handleSuccess } from "@/lib/error-handler";
import { checkImageForNSFW } from "@/lib/nsfw-detection";
import { validateImageFile } from "@/lib/file-security";

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
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string>('');
  const [bannerPreview, setBannerPreview] = useState<string>('');
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const [isDraggingBanner, setIsDraggingBanner] = useState(false);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const { address, isConnected, isConnecting, connectWallet } = useWallet();
  const navigate = useNavigate();
  const { profile, createOrUpdateProfile, loadProfile } = useProfile();

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

  const processProfilePhoto = async (file: File) => {
    // Validate file security
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast({
        title: "Invalid file",
        description: validation.error || "File validation failed",
        variant: "destructive",
      });
      return;
    }

    // Additional check: validate extension matches MIME type
    const extension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!extension || !validExtensions.includes(extension)) {
      toast({
        title: "Invalid file extension",
        description: "Please upload a valid image file (JPG, PNG, GIF, or WEBP)",
        variant: "destructive",
      });
      return;
    }

    // Check for NSFW content
    toast({
      title: "Checking image...",
      description: "Verifying image content before upload",
    });

    const nsfwCheck = await checkImageForNSFW(file, 0.75); // 75% confidence threshold
    
    if (nsfwCheck.isNSFW) {
      toast({
        title: "Image Not Allowed",
        description: `This image contains inappropriate content (${nsfwCheck.category}, ${Math.round(nsfwCheck.confidence * 100)}% confidence). Please upload a different image.`,
        variant: "destructive",
      });
      return;
    }

    // Set file and preview
    setProfilePhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadProfilePhoto = async (file: File): Promise<string | null> => {
    if (!address) return null;

    try {
      setUploadingPhoto(true);
      
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${address}/profile-photo.${fileExt}`;
      const filePath = fileName;

      // Delete old photo if exists
      const { data: existingFiles } = await supabase.storage
        .from('profile-photos')
        .list(address);

      if (existingFiles && existingFiles.length > 0) {
        await supabase.storage
          .from('profile-photos')
          .remove([`${address}/${existingFiles[0].name}`]);
      }

      // Upload new photo
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      toast({
        title: "Photo Uploaded",
        description: "Profile photo uploaded successfully"
      });

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload profile photo",
        variant: "destructive"
      });
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const processBanner = async (file: File) => {
    // Validate file security
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast({
        title: "Invalid file",
        description: validation.error || "File validation failed",
        variant: "destructive",
      });
      return;
    }

    // Additional check: validate extension matches MIME type
    const extension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!extension || !validExtensions.includes(extension)) {
      toast({
        title: "Invalid file extension",
        description: "Please upload a valid image file (JPG, PNG, GIF, or WEBP)",
        variant: "destructive",
      });
      return;
    }

    // Check for NSFW content
    toast({
      title: "Checking image...",
      description: "Verifying image content before upload",
    });

    const nsfwCheck = await checkImageForNSFW(file, 0.75); // 75% confidence threshold
    
    if (nsfwCheck.isNSFW) {
      toast({
        title: "Image Not Allowed",
        description: `This image contains inappropriate content (${nsfwCheck.category}, ${Math.round(nsfwCheck.confidence * 100)}% confidence). Please upload a different image.`,
        variant: "destructive",
      });
      return;
    }

    // Set file and preview
    setBannerFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setBannerPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadBanner = async (file: File): Promise<string | null> => {
    if (!address) return null;

    try {
      setUploadingBanner(true);
      
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${address}/banner.${fileExt}`;
      const filePath = fileName;

      // Delete old banner if exists
      const { data: existingFiles } = await supabase.storage
        .from('profile-banners')
        .list(address);

      if (existingFiles && existingFiles.length > 0) {
        await supabase.storage
          .from('profile-banners')
          .remove([`${address}/${existingFiles[0].name}`]);
      }

      // Upload new banner
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('profile-banners')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('profile-banners')
        .getPublicUrl(filePath);

      toast({
        title: "Banner Uploaded",
        description: "Banner image uploaded successfully"
      });

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading banner:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload banner image",
        variant: "destructive"
      });
      return null;
    } finally {
      setUploadingBanner(false);
    }
  };

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
      
      // Upload profile photo if selected
      let profilePhotoUrl = formData.profile_photo_url;
      if (profilePhotoFile) {
        const uploadedUrl = await uploadProfilePhoto(profilePhotoFile);
        if (uploadedUrl) {
          profilePhotoUrl = uploadedUrl;
        }
      }

      // Upload banner if selected
      let bannerUrl = formData.banner_url;
      if (bannerFile) {
        const uploadedUrl = await uploadBanner(bannerFile);
        if (uploadedUrl) {
          bannerUrl = uploadedUrl;
        }
      }
      
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
        banner_url: bannerUrl,
        profile_photo_url: profilePhotoUrl
      };

      await createOrUpdateProfile(profileData);

      handleSuccess("Profile Updated", "Your profile has been saved successfully!");

      // Reload profile to get updated data
      await loadProfile();
      
      // Clear file selections and previews
      setProfilePhotoFile(null);
      setBannerFile(null);
      setProfilePhotoPreview('');
      setBannerPreview('');
      
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
        <Link to="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>
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

              <div className="space-y-2">
                <Label htmlFor="profile_photo">Profile Photo</Label>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                        isDraggingPhoto
                          ? 'border-primary bg-primary/5'
                          : 'border-muted-foreground/25 hover:border-primary/50'
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDraggingPhoto(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDraggingPhoto(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDraggingPhoto(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file && file.type.startsWith('image/')) {
                          processProfilePhoto(file);
                        } else {
                          toast({
                            title: "Invalid file type",
                            description: "Please upload an image file",
                            variant: "destructive",
                          });
                        }
                      }}
                      onClick={() => profilePhotoInputRef.current?.click()}
                    >
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Drag and drop an image here, or click to select
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        JPG, PNG, GIF, or WEBP (max 10MB)
                      </p>
                    </div>
                    <Input
                      ref={profilePhotoInputRef}
                      id="profile_photo"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) processProfilePhoto(file);
                      }}
                      className="hidden"
                    />
                    {uploadingPhoto && (
                      <div className="flex items-center gap-2 mt-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Uploading...</span>
                      </div>
                    )}
                  </div>
                  {(profilePhotoPreview || (formData.profile_photo_url && !profilePhotoFile)) && (
                    <div className="relative">
                      <img
                        src={profilePhotoPreview || formData.profile_photo_url}
                        alt="Profile preview"
                        className="h-32 w-32 rounded-full object-cover border-2 border-border"
                      />
                      {profilePhotoFile && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute -top-2 -right-2 rounded-full h-6 w-6 p-0"
                          onClick={() => {
                            setProfilePhotoFile(null);
                            setProfilePhotoPreview('');
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="banner">Banner Image</Label>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                        isDraggingBanner
                          ? 'border-primary bg-primary/5'
                          : 'border-muted-foreground/25 hover:border-primary/50'
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDraggingBanner(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDraggingBanner(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDraggingBanner(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file && file.type.startsWith('image/')) {
                          processBanner(file);
                        } else {
                          toast({
                            title: "Invalid file type",
                            description: "Please upload an image file",
                            variant: "destructive",
                          });
                        }
                      }}
                      onClick={() => bannerInputRef.current?.click()}
                    >
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Drag and drop an image here, or click to select
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        JPG, PNG, GIF, or WEBP (max 10MB)
                      </p>
                    </div>
                    <Input
                      ref={bannerInputRef}
                      id="banner"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) processBanner(file);
                      }}
                      className="hidden"
                    />
                    {uploadingBanner && (
                      <div className="flex items-center gap-2 mt-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Uploading...</span>
                      </div>
                    )}
                  </div>
                  {(bannerPreview || (formData.banner_url && !bannerFile)) && (
                    <div className="relative">
                      <img
                        src={bannerPreview || formData.banner_url}
                        alt="Banner preview"
                        className="h-32 w-48 rounded object-cover border-2 border-border"
                      />
                      {bannerFile && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute -top-2 -right-2 rounded-full h-6 w-6 p-0"
                          onClick={() => {
                            setBannerFile(null);
                            setBannerPreview('');
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
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
                <Button 
                  onClick={handleSave} 
                  disabled={loading || uploadingPhoto || uploadingBanner}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
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