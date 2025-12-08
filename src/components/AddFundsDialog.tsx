import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useEscrow } from "@/hooks/useEscrow";
import { db, Escrow } from "@/lib/supabase";
import { formatUSDC, formatSOL } from "@/lib/solana";
import { getSolanaPrice, convertUSDToSOL } from "@/lib/solana-price";
import { useToast } from "@/hooks/use-toast";
import type { PaymentCurrency } from "@/lib/solana";

interface AddFundsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  currentEscrows: Escrow[];
  paymentCurrency: PaymentCurrency;
  onSuccess: () => void;
}

export const AddFundsDialog = ({
  open,
  onOpenChange,
  projectId,
  currentEscrows,
  paymentCurrency,
  onSuccess,
}: AddFundsDialogProps) => {
  const [additionalAmount, setAdditionalAmount] = useState("");
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const { createProjectEscrow } = useEscrow();
  const { toast } = useToast();

  // Calculate total currently locked (includes platform fees)
  const totalLocked = currentEscrows.reduce((sum, escrow) => {
    if (escrow.status === 'funded' || escrow.status === 'released') {
      return sum + (escrow.total_locked || 0);
    }
    return sum;
  }, 0);

  // Calculate project amount (excluding platform fees) - for display only
  const totalProjectAmount = currentEscrows.reduce((sum, escrow) => {
    if (escrow.status === 'funded' || escrow.status === 'released') {
      return sum + (escrow.amount_usdc || 0);
    }
    return sum;
  }, 0);

  useEffect(() => {
    if (open && paymentCurrency === 'SOLANA') {
      getSolanaPrice().then((data) => setSolPrice(data.price_usd));
    }
  }, [open, paymentCurrency]);

  const handleAddFunds = async () => {
    const amount = parseFloat(additionalAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (amount < 1) {
      toast({
        title: "Minimum Amount",
        description: "Minimum additional amount is $1 USDC",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let escrowAmount = amount;
      
      // Convert to SOL if payment currency is SOLANA
      if (paymentCurrency === 'SOLANA') {
        escrowAmount = await convertUSDToSOL(amount);
      }

      // Create a new escrow entry for the additional funds
      const escrowId = await createProjectEscrow(
        projectId,
        escrowAmount,
        paymentCurrency
      );

      if (escrowId) {
        toast({
          title: "Funds Added",
          description: `Successfully added ${formatUSDC(amount)} to escrow`,
        });
        setAdditionalAmount("");
        onOpenChange(false);
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: "Failed to Add Funds",
        description: error?.message || "Failed to add funds to escrow. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const additionalAmountNum = parseFloat(additionalAmount) || 0;
  const platformFee = (additionalAmountNum * 1) / 100;
  const totalAdditionalUSD = additionalAmountNum + platformFee;
  
  // Convert additional amount to payment currency for calculation
  let totalAdditionalInCurrency = totalAdditionalUSD;
  if (paymentCurrency === 'SOLANA' && solPrice) {
    totalAdditionalInCurrency = totalAdditionalUSD / solPrice;
  }
  
  const totalAfterAdd = totalLocked + totalAdditionalInCurrency;

  // For display: convert SOL to USD if needed
  let displayTotalLocked = totalLocked;
  let displayTotalAfterAdd = totalAfterAdd;
  if (paymentCurrency === 'SOLANA' && solPrice) {
    displayTotalLocked = totalLocked * solPrice;
    displayTotalAfterAdd = totalAfterAdd * solPrice;
  } else {
    displayTotalLocked = totalLocked;
    displayTotalAfterAdd = totalAfterAdd;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Funds to Escrow</DialogTitle>
          <DialogDescription>
            Add additional funds to your project escrow. These funds will be locked until the project is completed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Current Amount Locked</Label>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-2xl font-semibold text-web3-primary">
                {paymentCurrency === 'SOLANA'
                  ? formatSOL(totalLocked)
                  : formatUSDC(totalProjectAmount)}
              </div>
              {paymentCurrency === 'SOLANA' && solPrice && (
                <div className="text-sm text-muted-foreground mt-1">
                  (~{formatUSDC(displayTotalLocked)})
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="additional-amount">Additional Amount (USDC) *</Label>
            <Input
              id="additional-amount"
              type="number"
              placeholder="100"
              min="10"
              value={additionalAmount}
              onChange={(e) => setAdditionalAmount(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Minimum: $1 USDC
            </p>
          </div>

          {additionalAmountNum > 0 && (
            <div className="space-y-2 p-4 bg-muted/50 rounded-lg border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Additional Amount</span>
                <span className="font-medium">{formatUSDC(additionalAmountNum)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platform Fee (1%)</span>
                <span className="font-medium">{formatUSDC(platformFee)}</span>
              </div>
              <div className="border-t border-border pt-2 mt-2">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Additional</span>
                                <span className="font-semibold text-web3-primary">
                                  {paymentCurrency === 'SOLANA'
                                    ? formatSOL(totalAdditionalInCurrency)
                                    : formatUSDC(totalAdditionalUSD)}
                                </span>
                              </div>
                              {paymentCurrency === 'SOLANA' && solPrice && (
                                <div className="text-xs text-muted-foreground text-right mt-1">
                                  (~{formatUSDC(totalAdditionalUSD)})
                                </div>
                              )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Total After Adding</Label>
            <div className="p-3 bg-web3-primary/10 rounded-lg border border-web3-primary/20">
              <div className="text-2xl font-semibold text-web3-primary">
                {paymentCurrency === 'SOLANA'
                  ? formatSOL(totalAfterAdd)
                  : formatUSDC(totalAfterAdd)}
              </div>
              {paymentCurrency === 'SOLANA' && solPrice && (
                <div className="text-sm text-muted-foreground mt-1">
                  (~{formatUSDC(displayTotalAfterAdd)})
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddFunds}
            disabled={loading || !additionalAmountNum || additionalAmountNum < 1}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding Funds...
              </>
            ) : (
              "Add Funds"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

