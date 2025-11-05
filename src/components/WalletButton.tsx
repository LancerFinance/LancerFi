import { Button } from "@/components/ui/button";
import { Wallet, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/hooks/useWallet";
import { SOLANA_NETWORK } from "@/lib/solana";
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
  const isMainnet = SOLANA_NETWORK === 'mainnet-beta';

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        {isMainnet && (
          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
            Mainnet
          </Badge>
        )}
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
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isMainnet && (
        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
          Mainnet
        </Badge>
      )}
      <Button 
        variant={variant} 
        className={className}
        onClick={connectWallet}
        disabled={isConnecting}
      >
        <Wallet className="w-4 h-4 mr-2" />
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    </div>
  );
};

export default WalletButton;