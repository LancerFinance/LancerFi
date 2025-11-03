import { Button } from "@/components/ui/button";
import { Wallet, LogOut } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WalletButtonProps {
  variant?: "default" | "ghost" | "outline";
  className?: string;
}

const WalletButton = ({ variant = "default", className }: WalletButtonProps) => {
  const { isConnected, isConnecting, address, connectWallet, disconnectWallet, formatAddress } = useWallet();

  if (isConnected && address) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} className={className}>
            <Wallet className="w-4 h-4 mr-2" />
            {formatAddress(address)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={disconnectWallet}>
            <LogOut className="w-4 h-4 mr-2" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button 
      variant={variant} 
      className={className}
      onClick={connectWallet}
      disabled={isConnecting}
    >
      <Wallet className="w-4 h-4 mr-2" />
      {isConnecting ? "Connecting..." : "Connect Wallet"}
    </Button>
  );
};

export default WalletButton;