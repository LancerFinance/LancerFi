import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Info, TrendingUp, ArrowRight, Loader2 } from "lucide-react";
import { PaymentCurrency, formatUSDC, formatSOL } from "@/lib/solana";
import { getSolanaPrice, convertUSDToSOL } from "@/lib/solana-price";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PaymentCurrencySelectorProps {
  amount: number;
  selectedCurrency: PaymentCurrency;
  onCurrencyChange: (currency: PaymentCurrency) => void;
  className?: string;
}

const PaymentCurrencySelector = ({ 
  amount, 
  selectedCurrency, 
  onCurrencyChange, 
  className 
}: PaymentCurrencySelectorProps) => {
  const [loading, setLoading] = useState(false);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [solAmount, setSolAmount] = useState<number | null>(null);

  useEffect(() => {
    if (amount > 0) {
      loadSolanaPrice();
    }
  }, [amount]);

  const loadSolanaPrice = async () => {
    setLoading(true);
    try {
      const priceData = await getSolanaPrice();
      setSolPrice(priceData.price_usd);
      const convertedAmount = await convertUSDToSOL(amount);
      setSolAmount(convertedAmount);
    } catch (error) {
      console.error('Error loading SOL price:', error);
      setSolPrice(100); // Fallback price
      setSolAmount(amount / 100); // Fallback conversion
    } finally {
      setLoading(false);
    }
  };

  const getSolEquivalent = () => solAmount || (amount / (solPrice || 100));
  const getUSDCEquivalent = () => amount;

  const platformFeePercent = 10;
  const platformFee = (amount * platformFeePercent) / 100;
  const totalAmount = amount + platformFee;
  
  // SOL calculations
  const solPlatformFee = getSolEquivalent() * 0.1;
  const solTotalAmount = getSolEquivalent() + solPlatformFee;

  return (
    <Card className={`bg-gradient-card border-border/50 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <TrendingUp className="w-5 h-5 text-web3-primary" />
          Payment Currency Selection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Currency Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* USDC Option */}
          <Button
            variant={selectedCurrency === 'USDC' ? 'default' : 'outline'}
            onClick={() => onCurrencyChange('USDC')}
            className="h-auto p-4 flex flex-col items-start space-y-2"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  $
                </div>
                <span className="font-semibold">Pay with USDC</span>
              </div>
              {selectedCurrency === 'USDC' && (
                <Badge variant="secondary" className="text-xs">Selected</Badge>
              )}
            </div>
            <div className="text-left text-sm opacity-80">
              <div>Amount: {formatUSDC(amount)}</div>
              <div>+ Platform Fee: {formatUSDC(platformFee)}</div>
              <div className="font-medium">Total: {formatUSDC(totalAmount)}</div>
            </div>
          </Button>

          {/* Solana Option */}
          <Button
            variant={selectedCurrency === 'SOLANA' ? 'default' : 'outline'}
            onClick={() => onCurrencyChange('SOLANA')}
            className="h-auto p-4 flex flex-col items-start space-y-2"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center text-white text-xs font-bold">
                  S
                </div>
                <span className="font-semibold">Pay with SOLANA</span>
              </div>
              {selectedCurrency === 'SOLANA' && (
                <Badge variant="secondary" className="text-xs">Selected</Badge>
              )}
            </div>
            <div className="text-left text-sm opacity-80">
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading rates...</span>
                </div>
              ) : (
                <>
                  <div>Amount: {formatSOL(getSolEquivalent())}</div>
                  <div>+ Platform Fee: {formatSOL(solPlatformFee)}</div>
                  <div className="font-medium">Total: {formatSOL(solTotalAmount)}</div>
                </>
              )}
            </div>
          </Button>
        </div>

        {/* Conversion Information */}
        {false && (
          <></>
        )}

        {/* Market Data */}
        {false && <></>}

        {/* Benefits Section */}
        <div className="space-y-3">
          <Separator />
          <div className="text-sm space-y-2">
            <div className="font-medium text-foreground">Payment Options</div>
            <ul className="space-y-1 text-muted-foreground text-xs">
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-web3-primary rounded-full mt-2"></div>
                <span>Pay directly with USDC or SOLANA</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Pricing Breakdown */}
        <div className="space-y-3">
          <Separator />
          <div className="text-sm">
            <div className="font-medium text-foreground mb-2">Payment Breakdown</div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Project Budget</span>
                <span className="text-foreground">
                  {selectedCurrency === 'USDC' ? formatUSDC(amount) : formatSOL(getSolEquivalent())}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform Fee (10%)</span>
                <span className="text-foreground">
                  {selectedCurrency === 'USDC' ? formatUSDC(platformFee) : formatSOL(solPlatformFee)}
                </span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-semibold">
                <span className="text-foreground">Total Payment</span>
                <span className="text-web3-primary">
                  {selectedCurrency === 'USDC' ? formatUSDC(totalAmount) : formatSOL(solTotalAmount)}
                </span>
              </div>
              {selectedCurrency === 'SOLANA' && solPrice && (
                <div className="text-xs text-muted-foreground mt-1">
                  (Based on current SOL price: ${solPrice.toFixed(2)})
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentCurrencySelector;