import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "@/hooks/use-toast";

const PostServiceButton = () => {
  const navigate = useNavigate();
  const { isConnected } = useWallet();

  const handlePostService = () => {
    if (!isConnected) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to post a service",
        variant: "destructive"
      });
      return;
    }
    
    navigate('/post-project');
  };

  return (
    <Button 
      onClick={handlePostService}
      size="lg" 
      className="bg-web3-success hover:bg-web3-success/90 text-white font-semibold shadow-glow"
    >
      <Plus className="h-5 w-5 mr-2" />
      Post a Service
    </Button>
  );
};

export default PostServiceButton;