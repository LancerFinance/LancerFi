import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { PROJECT_CATEGORIES } from "@/lib/categories";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, Upload, X } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { db, Project, supabase } from "@/lib/supabase";
import { formatUSDC } from "@/lib/solana";
import { useToast } from "@/hooks/use-toast";
import { validateProject } from "@/lib/validation";


const EditProject = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isConnected, address } = useWallet();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasEscrow, setHasEscrow] = useState(false); // Track if escrow exists
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
    budget: '',
    timeline: '',
    skills: '',
    project_images: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [projectImage, setProjectImage] = useState<File | null>(null);
  const [projectImagePreview, setProjectImagePreview] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (id) {
      loadProject();
    }
  }, [id]);

  const loadProject = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const projectData = await db.getProject(id);
      
      if (!projectData) {
        toast({
          title: "Project Not Found",
          description: "The project you're trying to edit doesn't exist",
          variant: "destructive"
        });
        navigate('/dashboard');
        return;
      }

      // Check if user is the project owner
      const isOwner = address && projectData.client_id === address;
      
      if (!address || !isOwner) {
        toast({
          title: "Access Denied",
          description: "You can only edit your own projects",
          variant: "destructive"
        });
        navigate(`/project/${id}`);
        return;
      }

      // Check if project can be edited (only active projects)
      if (projectData.status !== 'active') {
        toast({
          title: "Cannot Edit Project",
          description: "Only active projects can be edited",
          variant: "destructive"
        });
        navigate(`/project/${id}`);
        return;
      }

      setProject(projectData);
      setFormData({
        title: projectData.title,
        category: projectData.category,
        description: projectData.description,
        budget: projectData.budget_usdc.toString(),
        timeline: projectData.timeline,
        skills: projectData.required_skills.join(', '),
        project_images: projectData.project_images?.[0] || ''
      });
      setProjectImagePreview(projectData.project_images?.[0] || '');

      // Check if escrow exists for this project
      try {
        const escrow = await db.getEscrow(id);
        if (escrow && (escrow.status === 'funded' || escrow.status === 'pending')) {
          setHasEscrow(true);
        }
      } catch (error) {
        // Escrow doesn't exist, which is fine
        setHasEscrow(false);
      }

    } catch (error) {
      console.error('Error loading project:', error);
      toast({
        title: "Error",
        description: "Failed to load project details",
        variant: "destructive"
      });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSave = async () => {
    if (!id || !project || !address) return;

    // Validate form data
    const validationErrors = validateProject(formData);
    if (validationErrors.length > 0) {
      const errorMap: Record<string, string> = {};
      validationErrors.forEach(error => {
        errorMap[error.field] = error.message;
      });
      setFormErrors(errorMap);
      
      toast({
        title: "Validation Error",
        description: "Please fix the errors below",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    setFormErrors({});

    try {
      // If a new image file is selected, upload it and get public URL
      let updatedImages: string[] | null = null;
      if (projectImage) {
        setUploadingImage(true);
        const fileExt = projectImage.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('project-images')
          .upload(filePath, projectImage);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('project-images')
          .getPublicUrl(filePath);

        updatedImages = [publicUrl];
        setUploadingImage(false);
      } else if (projectImagePreview) {
        // Keep existing preview URL if present and not removed
        updatedImages = [projectImagePreview];
      } else {
        updatedImages = null;
      }

      const updatedData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        required_skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
        budget_usdc: parseFloat(formData.budget),
        timeline: formData.timeline,
        project_images: updatedImages,
      };

      await db.updateProject(id, updatedData);

      toast({
        title: "Project Updated!",
        description: "Your project has been successfully updated",
      });

      navigate(`/project/${id}`);
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update project. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const platformFeePercent = 1;
  const budget = parseFloat(formData.budget) || 0;
  const platformFee = (budget * platformFeePercent) / 100;
  const totalEscrow = budget + platformFee;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading project details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Wallet Required</h2>
            <p className="text-muted-foreground mb-6">Please connect your wallet to edit projects.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <Link to={`/project/${id}`}>
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Project
          </Button>
        </Link>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Edit Project
            </h1>
            <p className="text-lg text-muted-foreground">
              Update your project details and requirements
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-2xl text-foreground">Project Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Project Title *</Label>
                    <Input 
                      id="title" 
                      placeholder="e.g., DeFi Trading Bot Development"
                      className={`bg-muted/50 ${formErrors.title ? 'border-destructive' : ''}`}
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                    />
                    {formErrors.title && (
                      <p className="text-sm text-destructive">{formErrors.title}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                      <SelectTrigger className={`bg-muted/50 ${formErrors.category ? 'border-destructive' : ''}`}>
                        <SelectValue placeholder="Select project category" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.category && (
                      <p className="text-sm text-destructive">{formErrors.category}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Project Description *</Label>
                    <Textarea 
                      id="description"
                      placeholder="Describe your project in detail. Include technical requirements, expected deliverables, and any specific technologies you want to use..."
                      rows={6}
                      className={`bg-muted/50 ${formErrors.description ? 'border-destructive' : ''}`}
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                    />
                    {formErrors.description && (
                      <p className="text-sm text-destructive">{formErrors.description}</p>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="budget" className={hasEscrow ? 'text-muted-foreground' : ''}>
                        Budget (USDC) *
                        {hasEscrow && (
                          <span className="ml-2 text-xs text-muted-foreground italic">
                            (Cannot be changed after payment)
                          </span>
                        )}
                      </Label>
                      <Input 
                        id="budget" 
                        type="number"
                        placeholder="5000"
                        disabled={hasEscrow}
                        className={`bg-muted/50 ${formErrors.budget ? 'border-destructive' : ''} ${hasEscrow ? 'opacity-60 cursor-not-allowed' : ''}`}
                        value={formData.budget}
                        onChange={(e) => handleInputChange('budget', e.target.value)}
                      />
                      {formErrors.budget && (
                        <p className="text-sm text-destructive">{formErrors.budget}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timeline">Timeline *</Label>
                      <Select value={formData.timeline} onValueChange={(value) => handleInputChange('timeline', value)}>
                        <SelectTrigger className="bg-muted/50">
                          <SelectValue placeholder="Select timeline" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-week">1 Week</SelectItem>
                          <SelectItem value="2-weeks">2 Weeks</SelectItem>
                          <SelectItem value="1-month">1 Month</SelectItem>
                          <SelectItem value="2-months">2 Months</SelectItem>
                          <SelectItem value="3-months">3+ Months</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="skills">Required Skills *</Label>
                    <Input 
                      id="skills" 
                      placeholder="Solidity, React, Web3.js, DeFi protocols..."
                      className={`bg-muted/50 ${formErrors.skills ? 'border-destructive' : ''}`}
                      value={formData.skills}
                      onChange={(e) => handleInputChange('skills', e.target.value)}
                    />
                    {formErrors.skills && (
                      <p className="text-sm text-destructive">{formErrors.skills}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="project_image">Project Image</Label>
                    {projectImagePreview ? (
                      <div className="relative">
                        <img 
                          src={projectImagePreview} 
                          alt="Project preview" 
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={() => { setProjectImage(null); setProjectImagePreview(''); }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Input
                          id="project_image"
                          type="file"
                          accept="image/*"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) { setProjectImage(f); const r = new FileReader(); r.onloadend = () => setProjectImagePreview(r.result as string); r.readAsDataURL(f);} }}
                          className={`bg-muted/50 ${formErrors.project_image ? 'border-destructive' : ''}`}
                        />
                        <div className="mt-2 flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg bg-muted/50">
                          <div className="text-center">
                            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">Upload project image</p>
                            <p className="text-xs text-muted-foreground">Optional • Max 5MB</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button 
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => navigate(`/project/${id}`)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-foreground">Updated Pricing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Project Budget</span>
                    <span className="text-foreground">{formatUSDC(budget)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform Fee (1%)</span>
                    <span className="text-foreground">{formatUSDC(platformFee)}</span>
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between font-semibold">
                    <span className="text-foreground">Total Escrow (USDC)</span>
                    <span className="text-web3-primary">{formatUSDC(totalEscrow)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border/50">
                <CardContent className="p-6">
                  <h4 className="font-semibold mb-3 text-foreground">📝 Edit Guidelines</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Only active projects can be edited</li>
                    <li>• Budget changes affect escrow amount</li>
                    <li>• Existing proposals may need review</li>
                    <li>• Save changes before leaving the page</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProject;