import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Loader2 } from "lucide-react";
import { PaymentCurrency, formatUSDC, formatSOL } from "@/lib/solana";
import { getSolanaPrice, convertUSDToSOL } from "@/lib/solana-price";

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
        <div className="grid grid-cols-1 gap-4">
          {/* Solana Option - Collapsed when not selected */}
          <Button
            variant={selectedCurrency === 'SOLANA' ? 'default' : 'outline'}
            onClick={() => onCurrencyChange('SOLANA')}
            className={`p-4 flex flex-col items-start space-y-2 transition-all duration-200 ${
              selectedCurrency === 'SOLANA' ? 'h-auto' : 'h-16'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <img 
                  src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" 
                  alt="Solana" 
                  className="w-6 h-6 rounded-full"
                />
                <span className="font-semibold">Pay with Solana</span>
              </div>
              <Badge
                variant="secondary"
                className={`text-xs transition-opacity duration-200 ${
                  selectedCurrency === 'SOLANA' ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                Selected
              </Badge>
            </div>
            {selectedCurrency === 'SOLANA' && (
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
            )}
          </Button>

          {/* USDC Option - Collapsed when not selected */}
          <Button
            variant={selectedCurrency === 'USDC' ? 'default' : 'outline'}
            onClick={() => onCurrencyChange('USDC')}
            className={`p-4 flex flex-col items-start space-y-2 transition-all duration-200 ${
              selectedCurrency === 'USDC' ? 'h-auto' : 'h-16'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <img 
                  src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png" 
                  alt="USDC" 
                  className="w-6 h-6 rounded-full"
                />
                <span className="font-semibold">Pay with USDC</span>
              </div>
              <Badge
                variant="secondary"
                className={`text-xs transition-opacity duration-200 ${
                  selectedCurrency === 'USDC' ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                Selected
              </Badge>
            </div>
            {selectedCurrency === 'USDC' && (
              <div className="text-left text-sm opacity-80">
                <div>Amount: {formatUSDC(amount)}</div>
                <div>+ Platform Fee: {formatUSDC(platformFee)}</div>
                <div className="font-medium">Total: {formatUSDC(totalAmount)}</div>
              </div>
            )}
          </Button>

          {/* X402 Option - Collapsed when not selected */}
          <Button
            variant={selectedCurrency === 'X402' ? 'default' : 'outline'}
            onClick={() => onCurrencyChange('X402')}
            className={`p-4 flex flex-col items-start space-y-2 transition-all duration-200 ${
              selectedCurrency === 'X402' ? 'h-auto' : 'h-16'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <img 
                  src="https://s2.coinmarketcap.com/static/img/coins/64x64/38785.png" 
                  alt="x402" 
                  className="w-6 h-6 rounded-full object-cover"
                  onError={(e) => {
                    // Fallback: show purple circle with X if image fails
                    e.currentTarget.style.display = 'none';
                    const fallback = document.createElement('div');
                    fallback.className = 'w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold';
                    fallback.textContent = 'X';
                    if (e.currentTarget.parentElement) {
                      e.currentTarget.parentElement.appendChild(fallback);
                    }
                  }}
                />
                <span className="font-semibold">Pay with x402</span>
              </div>
              <Badge
                variant="secondary"
                className={`text-xs transition-opacity duration-200 ${
                  selectedCurrency === 'X402' ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                Selected
              </Badge>
            </div>
            {selectedCurrency === 'X402' && (
              <div className="text-left text-sm opacity-80">
                <div>Amount: {formatUSDC(amount)}</div>
                <div>+ Platform Fee: {formatUSDC(platformFee)}</div>
                <div className="font-medium">Total: {formatUSDC(totalAmount)}</div>
              </div>
            )}
          </Button>
        </div>

      </CardContent>
    </Card>
  );
};

export default PaymentCurrencySelector;