import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Wallet, Shield, Loader2, Upload, X } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";
import { db, supabase } from "@/lib/supabase";
import { formatUSDC, formatSOL, PaymentCurrency } from "@/lib/solana";
import { getSolanaPrice, convertUSDToSOL } from "@/lib/solana-price";
import { useToast } from "@/hooks/use-toast";
import { validateProject } from "@/lib/validation";
import PaymentCurrencySelector from "@/components/PaymentCurrencySelector";
import { PROJECT_CATEGORIES } from "@/lib/categories";

const PostProject = () => {
  const navigate = useNavigate();
  const { isConnected, address } = useWallet();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const preselectedFreelancerId = searchParams.get('freelancer');
  
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
    budget: '',
    timeline: '',
    skills: ''
  });
  const [paymentCurrency, setPaymentCurrency] = useState<PaymentCurrency>('SOLANA');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFreelancer, setSelectedFreelancer] = useState<any>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [projectImage, setProjectImage] = useState<File | null>(null);
  const [projectImagePreview, setProjectImagePreview] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [solAmount, setSolAmount] = useState<number | null>(null);

  useEffect(() => {
    if (preselectedFreelancerId) {
      loadFreelancer(preselectedFreelancerId);
    }
  }, [preselectedFreelancerId]);

  // Load SOL price when budget changes
  useEffect(() => {
    if (formData.budget && parseFloat(formData.budget) > 0) {
      loadSolanaPrice();
    }
  }, [formData.budget]);

  const loadSolanaPrice = async () => {
    try {
      const priceData = await getSolanaPrice();
      setSolPrice(priceData.price_usd);
      const convertedAmount = await convertUSDToSOL(parseFloat(formData.budget));
      setSolAmount(convertedAmount);
    } catch (error) {
      console.error('Error loading SOL price:', error);
      setSolPrice(100); // Fallback price
      setSolAmount(parseFloat(formData.budget) / 100); // Fallback conversion
    }
  };

  const loadFreelancer = async (freelancerId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', freelancerId)
        .single();

      if (error) throw error;
      setSelectedFreelancer(data);
    } catch (error) {
      console.error('Error loading freelancer:', error);
    }
  };

  const platformFeePercent = 10;
  const budget = parseFloat(formData.budget) || 0;
  const platformFee = (budget * platformFeePercent) / 100;
  const totalEscrow = budget + platformFee;

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Image must be less than 5MB",
          variant: "destructive"
        });
        return;
      }
      
      setProjectImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProjectImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setProjectImage(null);
    setProjectImagePreview('');
  };

  const handleSubmit = async () => {
    if (!isConnected || !address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to post a project",
        variant: "destructive",
      });
      return;
    }

    // Validate image is uploaded
    if (!projectImage) {
      toast({
        title: "Image Required",
        description: "Please upload a project image",
        variant: "destructive"
      });
      setFormErrors({ ...formErrors, project_image: "Project image is required" });
      return;
    }

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

    setFormErrors({});
    setIsSubmitting(true);
    
    try {
      // Upload project image
      setUploadingImage(true);
      const fileExt = projectImage.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('project-images')
        .upload(filePath, projectImage);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('project-images')
        .getPublicUrl(filePath);

      setUploadingImage(false);

      // Create project in database
      const project = await db.createProject({
        client_id: address,
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        required_skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
        budget_usdc: parseFloat(formData.budget),
        timeline: formData.timeline,
        status: selectedFreelancer ? 'in_progress' : 'active',
        project_images: [publicUrl],
        ...(selectedFreelancer ? { freelancer_id: selectedFreelancer.id } : {})
      });

      toast({
        title: "Project Posted Successfully!",
        description: `Your project "${formData.title}" is now live with ${paymentCurrency === 'USDC' ? formatUSDC(totalEscrow) : formatSOL(solAmount || totalEscrow / (solPrice || 100))} escrow`,
      });
      
      // Reset form
      setFormData({
        title: '',
        category: '',
        description: '',
        budget: '',
        timeline: '',
        skills: ''
      });
      setProjectImage(null);
      setProjectImagePreview('');
      
    } catch (error) {
      console.error('Error posting project:', error);
      toast({
        title: "Failed to Post Project",
        description: error instanceof Error ? error.message : "Please check your connection and try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setUploadingImage(false);
    }
  };

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
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
                {selectedFreelancer 
                  ? `Hire ${selectedFreelancer.full_name || selectedFreelancer.username}` 
                  : 'Post Your Web3 Project'
                }
              </h1>
              <p className="text-xl text-muted-foreground">
                {selectedFreelancer 
                  ? `Create a project to work with ${selectedFreelancer.full_name || selectedFreelancer.username}` 
                  : 'Connect with verified Web3 talent and secure your project with smart contract escrow'
                }
              </p>
            </div>

            {selectedFreelancer && (
              <Card className="mb-8 bg-gradient-card border-web3-primary/30">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-web3-primary rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {selectedFreelancer.full_name?.split(' ').map((n: string) => n[0]).join('') || 'FL'}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{selectedFreelancer.full_name || selectedFreelancer.username}</h3>
                      <p className="text-muted-foreground">${selectedFreelancer.hourly_rate}/hr • {selectedFreelancer.location || 'Remote'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {selectedFreelancer.skills?.slice(0, 3).map((skill: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Main Form */}
            <div className="space-y-6">
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-2xl text-foreground">Project Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Project Title</Label>
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
                    <Label htmlFor="category">Category</Label>
                    <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                      <SelectTrigger className={`bg-muted/50 ${formErrors.category ? 'border-destructive' : ''}`}>
                        <SelectValue placeholder="Select project category" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_CATEGORIES.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.category && (
                      <p className="text-sm text-destructive">{formErrors.category}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Project Description</Label>
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
                      <Label htmlFor="budget">Budget (USD)</Label>
                      <Input 
                        id="budget" 
                        type="number"
                        placeholder="5000"
                        className={`bg-muted/50 ${formErrors.budget ? 'border-destructive' : ''}`}
                        value={formData.budget}
                        onChange={(e) => handleInputChange('budget', e.target.value)}
                      />
                      {formErrors.budget && (
                        <p className="text-sm text-destructive">{formErrors.budget}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timeline">Timeline</Label>
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
                    <Label htmlFor="skills">Required Skills</Label>
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
                    <Label htmlFor="project_image">Project Image *</Label>
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
                          onClick={removeImage}
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
                          onChange={handleImageChange}
                          className={`bg-muted/50 ${formErrors.project_image ? 'border-destructive' : ''}`}
                        />
                        <div className="mt-2 flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg bg-muted/50">
                          <div className="text-center">
                            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">Upload project image</p>
                            <p className="text-xs text-muted-foreground">Max 5MB</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {formErrors.project_image && (
                      <p className="text-sm text-destructive">{formErrors.project_image}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Upload an image that represents your project (required)</p>
                  </div>

                  <Button 
                    variant="default" 
                    size="lg" 
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={!isConnected || isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <Wallet className="w-5 h-5 mr-2" />
                    )}
                    {isSubmitting 
                      ? 'Creating Project...' 
                      : isConnected 
                        ? 'Post Project & Setup Escrow'
                        : 'Connect Wallet First'
                    }
                  </Button>
                </CardContent>
              </Card>

              {/* Payment Currency Selection */}
              {budget > 0 && (
                <PaymentCurrencySelector
                  amount={budget}
                  selectedCurrency={paymentCurrency}
                  onCurrencyChange={setPaymentCurrency}
                />
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card className="bg-gradient-card border-web3-primary/30">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-web3-primary">
                    <Shield className="w-5 h-5" />
                    <span>Smart Contract Protection</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-web3-success rounded-full mt-2"></div>
                    <p>Your funds are held securely in escrow until project completion</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-web3-success rounded-full mt-2"></div>
                    <p>Milestone-based payments protect both parties</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-web3-success rounded-full mt-2"></div>
                    <p>Dispute resolution handled by smart contracts</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-foreground">Pricing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Project Budget</span>
                    <span className="text-foreground">
                      {paymentCurrency === 'USDC' ? formatUSDC(budget) : formatSOL(solAmount || budget / (solPrice || 100))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform Fee (10%)</span>
                    <span className="text-foreground">
                      {paymentCurrency === 'USDC' ? formatUSDC(platformFee) : formatSOL((solAmount || budget / (solPrice || 100)) * 0.1)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between font-semibold">
                    <span className="text-foreground">Total Escrow</span>
                    <span className="text-web3-primary">
                      {paymentCurrency === 'USDC' ? formatUSDC(totalEscrow) : formatSOL((solAmount || budget / (solPrice || 100)) * 1.1)}
                    </span>
                  </div>
                  {paymentCurrency === 'SOLANA' && solPrice && (
                    <div className="text-xs text-muted-foreground mt-1">
                      (Based on current SOL price: ${solPrice.toFixed(2)})
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border/50">
                <CardContent className="p-6">
                  <h4 className="font-semibold mb-3 text-foreground">💡 Pro Tips</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Be specific about technical requirements</li>
                    <li>• Include examples of similar projects</li>
                    <li>• Set realistic budgets and timelines</li>
                    <li>• Respond quickly to freelancer questions</li>
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

export default PostProject;