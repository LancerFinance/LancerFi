import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Wallet, Shield, Loader2, Upload, X } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { db, supabase } from "@/lib/supabase";
import { formatUSDC, formatSOL, PaymentCurrency, getUSDCBalance, getAccountBalanceViaProxy } from "@/lib/solana";
import { PublicKey } from "@solana/web3.js";
import { getSolanaPrice, convertUSDToSOL } from "@/lib/solana-price";
import { useToast } from "@/hooks/use-toast";
import { validateProject } from "@/lib/validation";
import PaymentCurrencySelector from "@/components/PaymentCurrencySelector";
import { PROJECT_CATEGORIES } from "@/lib/categories";
import { useEscrow } from "@/hooks/useEscrow";
import { checkImageForNSFW } from "@/lib/nsfw-detection";
import { validateProjectTextForProfanity } from "@/lib/profanity-filter";
import { checkIPProjectLimit, recordProjectCreation, cleanupPendingProjects } from "@/lib/api-client";
import { sanitizeText } from "@/lib/input-sanitizer";
import { validateImageFile } from "@/lib/file-security";

const PostProject = () => {
  const navigate = useNavigate();
  const { isConnected, address } = useWallet();
  const { toast } = useToast();
  const { createProjectEscrow, isLoading: escrowLoading } = useEscrow();
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
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [selectedFreelancer, setSelectedFreelancer] = useState<any>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [projectImage, setProjectImage] = useState<File | null>(null);
  const [projectImagePreview, setProjectImagePreview] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Rate limiting: track last submission time to prevent spam
  const lastSubmissionTimeRef = useRef<number>(0);
  const MIN_TIME_BETWEEN_SUBMISSIONS = 3000; // 3 seconds minimum between submissions
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [solAmount, setSolAmount] = useState<number | null>(null);

  useEffect(() => {
    if (preselectedFreelancerId) {
      loadFreelancer(preselectedFreelancerId);
    }
  }, [preselectedFreelancerId]);

  // Cleanup stuck pending projects on page load (non-blocking)
  useEffect(() => {
    cleanupPendingProjects().catch(err => {
      console.warn('Failed to cleanup pending projects:', err);
      // Don't show error to user - this is a background cleanup
    });
  }, []);

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
      processImageFile(file);
    }
  };

  const processImageFile = (file: File) => {
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
    
    setProjectImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setProjectImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImageFile(file);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
    }
  };

  const handleDropAreaClick = () => {
    fileInputRef.current?.click();
  };

  const removeImage = () => {
    setProjectImage(null);
    setProjectImagePreview('');
  };

  const handleSubmit = useCallback(async () => {
    // Rate limiting: prevent spam clicking
    const now = Date.now();
    const timeSinceLastSubmission = now - lastSubmissionTimeRef.current;
    
    if (timeSinceLastSubmission < MIN_TIME_BETWEEN_SUBMISSIONS) {
      const remainingTime = Math.ceil((MIN_TIME_BETWEEN_SUBMISSIONS - timeSinceLastSubmission) / 1000);
      toast({
        title: "Please Wait",
        description: `Please wait ${remainingTime} second${remainingTime > 1 ? 's' : ''} before submitting again.`,
        variant: "destructive",
      });
      return;
    }
    
    // Prevent multiple simultaneous submissions
    if (isSubmitting) {
      toast({
        title: "Already Processing",
        description: "Your project is being posted. Please wait...",
        variant: "default",
      });
      return;
    }
    
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

    // Check for profanity/slurs in text fields
    const profanityCheck = validateProjectTextForProfanity({
      title: formData.title,
      description: formData.description,
      skills: formData.skills,
    });

    if (!profanityCheck.isValid) {
      setFormErrors(profanityCheck.errors);
      toast({
        title: "Inappropriate Language Detected",
        description: `Your ${profanityCheck.profaneFields.join(', ')} ${profanityCheck.profaneFields.length > 1 ? 'contain' : 'contains'} inappropriate language. Please use professional language.`,
        variant: "destructive",
      });
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
    
    // Show loading state immediately
    setIsCheckingBalance(true);
    
    // Check wallet-based rate limit (24 hours between projects)
    // Only count projects that have successfully created escrow (status = 'funded')
    // This ensures failed escrow creations don't count toward the limit
    try {
      // First, get all escrows for this wallet that are funded
      const { data: fundedEscrows, error: escrowError } = await supabase
        .from('escrows')
        .select('project_id, created_at')
        .eq('client_wallet', address)
        .eq('status', 'funded')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (!escrowError && fundedEscrows && fundedEscrows.length > 0) {
        // Get the project creation time for the most recent funded escrow
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('created_at')
          .eq('id', fundedEscrows[0].project_id)
          .eq('client_id', address)
          .single();
        
        if (!projectError && project) {
          const lastProjectTime = new Date(project.created_at);
          const now = new Date();
          const hoursSinceLastProject = (now.getTime() - lastProjectTime.getTime()) / (1000 * 60 * 60);
          
          if (hoursSinceLastProject < 24) {
            const remainingHours = Math.ceil(24 - hoursSinceLastProject);
            setIsCheckingBalance(false);
            toast({
              title: "Rate Limit Exceeded",
              description: `You can only create one project every 24 hours. Please wait ${remainingHours} more hour${remainingHours > 1 ? 's' : ''} before creating another project.`,
              variant: "destructive",
            });
            return;
          }
        }
      }
    } catch (walletLimitError: any) {
      console.error('Error checking wallet rate limit:', walletLimitError);
      // Continue if check fails (fail open)
    }
    
    // Check IP-based rate limit (3 projects per 6 hours)
    try {
      const ipLimitCheck = await checkIPProjectLimit();
      if (!ipLimitCheck.allowed) {
        setIsCheckingBalance(false);
        toast({
          title: "IP Rate Limit Exceeded",
          description: ipLimitCheck.reason || `This IP address has created ${ipLimitCheck.count}/${ipLimitCheck.limit} projects in the last 6 hours. Please wait before creating another project.`,
          variant: "destructive",
        });
        return;
      }
    } catch (ipLimitError: any) {
      console.error('Error checking IP rate limit:', ipLimitError);
      // Continue if check fails (fail open)
    }
    
    // Check wallet balances before proceeding
    // For SOL payments, check SOL balance (payment amount + platform fee + transaction fees)
    // For x402/USDC payments, check USDC balance
    // For all payments, check minimum SOL balance (needed for transaction fees)
    try {
      const walletAddress = new PublicKey(address);
      const budgetAmount = parseFloat(formData.budget);
      const platformFeePercent = 10;
      const platformFee = (budgetAmount * platformFeePercent) / 100;
      const totalRequired = budgetAmount + platformFee;
      const transactionFeeBuffer = 0.01; // Buffer for transaction fees
      
      // Get balance and price checks in parallel for better performance
      const [solBalanceData, solPriceData] = await Promise.all([
        getAccountBalanceViaProxy(address),
        paymentCurrency === 'SOLANA' ? getSolanaPrice() : Promise.resolve(null)
      ]);
      
      const solBalance = solBalanceData.balanceSOL;
      
      // For SOL payments, check if user has enough SOL for payment + platform fee + transaction fees
      if (paymentCurrency === 'SOLANA') {
        if (!solPriceData) {
          throw new Error('Failed to fetch SOL price');
        }
        
        // Convert USD amount to SOL (both can use the same price data)
        const solAmount = budgetAmount / solPriceData.price_usd;
        const solPlatformFee = platformFee / solPriceData.price_usd;
        const totalSOLRequired = solAmount + solPlatformFee + transactionFeeBuffer;
        
        if (solBalance < totalSOLRequired) {
          setIsCheckingBalance(false);
          toast({
            title: "Insufficient SOL",
            description: `You need at least ${formatSOL(totalSOLRequired)} SOL to post this project (${formatSOL(solAmount)} + ${formatSOL(solPlatformFee)} platform fee + ${formatSOL(transactionFeeBuffer)} transaction fees). You currently have ${formatSOL(solBalance)} SOL. Please add more SOL to your wallet.`,
            variant: "destructive",
          });
          return;
        }
      } else {
        // For USDC/X402 payments, check minimum SOL for transaction fees
        if (solBalance < transactionFeeBuffer) {
          setIsCheckingBalance(false);
          toast({
            title: "Insufficient SOL",
            description: `You need at least ${formatSOL(transactionFeeBuffer)} SOL for transaction fees. You currently have ${formatSOL(solBalance)} SOL. Please add more SOL to your wallet.`,
            variant: "destructive",
          });
          return;
        }
      }
      
      // For x402 and USDC payments, check USDC balance
      if (paymentCurrency === 'X402' || paymentCurrency === 'USDC') {
        const usdcBalance = await getUSDCBalance(walletAddress);
        
        if (usdcBalance < totalRequired) {
          setIsCheckingBalance(false);
          toast({
            title: "Insufficient USDC",
            description: `You need at least ${formatUSDC(totalRequired)} USDC to post this project (${formatUSDC(budgetAmount)} + ${formatUSDC(platformFee)} platform fee). You currently have ${formatUSDC(usdcBalance)} USDC. Please add more USDC to your wallet.`,
            variant: "destructive",
          });
          return;
        }
      }
      
      // Balance check passed, proceed with submission
      setIsCheckingBalance(false);
    } catch (balanceError: any) {
      setIsCheckingBalance(false);
      console.error('Error checking wallet balance:', balanceError);
      toast({
        title: "Balance Check Failed",
        description: `Unable to verify wallet balance: ${balanceError.message || 'Unknown error'}. Please try again.`,
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Check image for NSFW content before uploading
      toast({
        title: "Checking image...",
        description: "Verifying image content before upload",
      });

      const nsfwCheck = await checkImageForNSFW(projectImage, 0.75); // 75% confidence threshold
      
      if (nsfwCheck.isNSFW) {
        setIsSubmitting(false);
        toast({
          title: "Image Not Allowed",
          description: `This image contains inappropriate content (${nsfwCheck.category}, ${Math.round(nsfwCheck.confidence * 100)}% confidence). Please upload a different image.`,
          variant: "destructive",
        });
        return;
      }

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

      // Sanitize inputs before saving to database
      const sanitizedTitle = sanitizeText(formData.title.trim());
      const sanitizedDescription = sanitizeText(formData.description.trim());
      const sanitizedSkills = formData.skills.split(',').map(s => sanitizeText(s.trim())).filter(Boolean);

      // Calculate escrow amount BEFORE creating project
      // Convert amount to SOL if SOLANA is selected, otherwise use USD amount
      const budgetAmount = parseFloat(formData.budget);
      let escrowAmount = budgetAmount;
      
      // CRITICAL: If x402 is selected, don't convert to SOL - x402 uses USDC
      if (paymentCurrency === 'SOLANA') {
        // Always recalculate SOL amount from current budget to ensure accuracy
        const priceData = await getSolanaPrice();
        const converted = await convertUSDToSOL(budgetAmount);
        escrowAmount = converted;
        
        // Update state for UI
        setSolPrice(priceData.price_usd);
        setSolAmount(converted);
      } else if (paymentCurrency === 'X402' || paymentCurrency === 'USDC') {
        // For x402 and USDC, keep amount in USD (they use USDC, not SOL)
        escrowAmount = budgetAmount;
      }

      // Create project with 'pending' status FIRST (escrow creation needs project_id)
      // We'll update to 'active' only after escrow is successfully funded
      // If escrow fails, we'll delete this project
      const project = await db.createProject({
        client_id: address,
        title: sanitizedTitle,
        description: sanitizedDescription,
        category: formData.category,
        required_skills: sanitizedSkills,
        budget_usdc: parseFloat(formData.budget),
        timeline: formData.timeline,
        status: 'pending', // Start as pending - will update to active after escrow succeeds
        project_images: [publicUrl],
        ...(selectedFreelancer ? { freelancer_id: selectedFreelancer.id } : {})
      });

      // Create and fund escrow
      const escrowId = await createProjectEscrow(
        project.id, 
        escrowAmount,
        paymentCurrency
      );

      if (!escrowId) {
        // Escrow creation failed - delete the pending project and clean up image
        try {
          await supabase
            .from('projects')
            .delete()
            .eq('id', project.id);
          
          await supabase.storage
            .from('project-images')
            .remove([filePath]);
        } catch (cleanupError) {
          console.error('Failed to cleanup project and image after escrow failure:', cleanupError);
        }
        throw new Error('Failed to create escrow. Please try again.');
      }

      // Escrow was successfully created and funded - update project to 'active'
      const { error: updateError } = await supabase
        .from('projects')
        .update({ 
          status: selectedFreelancer ? 'in_progress' : 'active' 
        })
        .eq('id', project.id);

      if (updateError) {
        console.error('Failed to update project status to active:', updateError);
        // Don't fail - project exists and escrow is funded, just status update failed
      }

      // Record project creation for IP tracking (non-blocking)
      recordProjectCreation(project.id, address).catch(err => {
        console.error('Failed to record project creation for IP tracking:', err);
        // Don't fail the request if this fails
      });

      toast({
        title: "Project Posted Successfully!",
        description: `Your project "${formData.title}" is now live. Escrow of ${paymentCurrency === 'USDC' || paymentCurrency === 'X402' ? formatUSDC(totalEscrow) : formatSOL(solAmount || totalEscrow / (solPrice || 100))} has been funded and secured.`,
      });
      
      // Redirect to the new project page
      navigate(`/project/${project.id}`);
      
      // Update last submission time on success
      lastSubmissionTimeRef.current = Date.now();
      
    } catch (error) {
      console.error('Error posting project:', error);
      toast({
        title: "Failed to Post Project",
        description: error instanceof Error ? error.message : "Please check your connection and try again",
        variant: "destructive",
      });
      
      // Update last submission time even on error to prevent spam retries
      lastSubmissionTimeRef.current = Date.now();
    } finally {
      setIsSubmitting(false);
      setUploadingImage(false);
    }
  }, [isConnected, address, formData, projectImage, paymentCurrency, isSubmitting, navigate, toast]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8">
        <Link to="/">
          <Button variant="ghost" className="mb-6 sm:mb-8 text-xs sm:text-sm">
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            Back to Home
          </Button>
        </Link>

          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 md:mb-6 text-foreground px-2">
                {selectedFreelancer 
                  ? `Hire ${selectedFreelancer.full_name || selectedFreelancer.username}` 
                  : 'Post Your Web3 Project'
                }
              </h1>
              <p className="text-sm sm:text-base md:text-xl text-muted-foreground px-2">
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

          <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            {/* Main Form */}
            <div className="space-y-4 sm:space-y-6">
              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl md:text-2xl text-foreground">Project Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-5 p-4 sm:p-6">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="title" className="text-xs sm:text-sm">Project Title</Label>
                    <Input 
                      id="title" 
                      placeholder="e.g., DeFi Trading Bot Development"
                      className={`bg-muted/50 h-10 sm:h-12 text-xs sm:text-sm md:text-base ${formErrors.title ? 'border-destructive' : ''}`}
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                    />
                    {formErrors.title && (
                      <p className="text-xs sm:text-sm text-destructive">{formErrors.title}</p>
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
                      className={`bg-muted/50 text-base ${formErrors.description ? 'border-destructive' : ''}`}
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
                          ref={fileInputRef}
                          id="project_image"
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                        <div 
                          onClick={handleDropAreaClick}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={`mt-2 flex items-center justify-center w-full h-[184px] border-2 border-dashed rounded-lg bg-muted/50 cursor-pointer transition-colors ${
                            isDraggingOver ? 'bg-muted border-primary border-solid' : ''
                          } ${formErrors.project_image ? 'border-destructive' : 'border-border'}`}
                        >
                          <div className="text-center pointer-events-none">
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

                  {/* Spacer for alignment */}
                  <div className="h-4"></div>

                  <Button 
                    variant="default" 
                    size="lg" 
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={!isConnected || isSubmitting || escrowLoading || isCheckingBalance}
                  >
                    {(isSubmitting || escrowLoading || isCheckingBalance) ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <Wallet className="w-5 h-5 mr-2" />
                    )}
                    {isCheckingBalance
                      ? 'Checking Balance...'
                      : isSubmitting 
                        ? 'Creating Project...' 
                        : escrowLoading
                          ? 'Setting Up Escrow...'
                          : isConnected 
                            ? 'Post Project & Setup Escrow'
                            : 'Connect Wallet First'
                    }
                  </Button>
                </CardContent>
              </Card>
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-foreground">Pricing</CardTitle>
                    {paymentCurrency === 'SOLANA' && solPrice && (
                      <span className="text-xs text-muted-foreground">
                        (Based on current SOL price: ${solPrice.toFixed(2)})
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Project Budget</span>
                    <span className="text-foreground">
                      {paymentCurrency === 'USDC' || paymentCurrency === 'X402' ? formatUSDC(budget) : formatSOL(solAmount || budget / (solPrice || 100))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform Fee (10%)</span>
                    <span className="text-foreground">
                      {paymentCurrency === 'USDC' || paymentCurrency === 'X402' ? formatUSDC(platformFee) : formatSOL((solAmount || budget / (solPrice || 100)) * 0.1)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between font-semibold">
                    <span className="text-foreground">Total Escrow</span>
                    <span className="text-web3-primary">
                      {paymentCurrency === 'USDC' || paymentCurrency === 'X402' ? formatUSDC(totalEscrow) : formatSOL((solAmount || budget / (solPrice || 100)) * 1.1)}
                    </span>
                  </div>
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

              {/* Payment Currency Selection */}
              {budget > 0 && (
                <PaymentCurrencySelector
                  amount={budget}
                  selectedCurrency={paymentCurrency}
                  onCurrencyChange={(currency) => {
                    setPaymentCurrency(currency);
                  }}
                />
              )}
            </div>
          </div>

          {/* Payment Options and Breakdown Section */}
          {budget > 0 && (
            <Card className="bg-gradient-card border-border/50 mt-6">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Payment Options */}
                  <div className="space-y-3">
                    <div className="text-sm">
                      <div className="font-medium text-foreground mb-2">Payment Options</div>
                      <div className="text-muted-foreground text-sm">
                        Pay directly with USDC, Solana, or x402
                      </div>
                    </div>
                  </div>

                  {/* Payment Breakdown */}
                  <div className="space-y-3">
                    <div className="text-sm">
                      <div className="font-medium text-foreground mb-2">Payment Breakdown</div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Project Budget</span>
                          <span className="text-foreground">
                            {paymentCurrency === 'USDC' || paymentCurrency === 'X402' 
                              ? formatUSDC(budget) 
                              : formatSOL(solAmount || budget / (solPrice || 100))
                            }
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Platform Fee (10%)</span>
                          <span className="text-foreground">
                            {paymentCurrency === 'USDC' || paymentCurrency === 'X402'
                              ? formatUSDC(platformFee)
                              : formatSOL((solAmount || budget / (solPrice || 100)) * 0.1)
                            }
                          </span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between font-semibold">
                          <span className="text-foreground">Total Payment</span>
                          <span className="text-web3-primary">
                            {paymentCurrency === 'USDC' || paymentCurrency === 'X402'
                              ? formatUSDC(totalEscrow)
                              : formatSOL((solAmount || budget / (solPrice || 100)) * 1.1)
                            }
                          </span>
                        </div>
                        {paymentCurrency === 'SOLANA' && solPrice && (
                          <div className="text-xs text-muted-foreground mt-1">
                            (Based on current SOL price: ${solPrice.toFixed(2)})
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostProject;