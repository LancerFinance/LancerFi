import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Info, TrendingUp, ArrowRight, Loader2 } from "lucide-react";
import { PaymentCurrency } from "@/lib/solana";
import { getConversionQuote, formatOrigin, getOriginMarketData } from "@/lib/origin-token";
import { formatUSDC } from "@/lib/solana";
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
  const [conversionQuote, setConversionQuote] = useState<any>(null);
  const [marketData, setMarketData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (amount > 0) {
      loadConversionData();
    }
  }, [amount]);

  const loadConversionData = async () => {
    if (amount <= 0) return;
    
    setLoading(true);
    try {
      const [quote, market] = await Promise.all([
        getConversionQuote(amount),
        getOriginMarketData()
      ]);
      
      setConversionQuote(quote);
      setMarketData(market);
    } catch (error) {
      console.error('Error loading conversion data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOriginEquivalent = () => {
    if (!conversionQuote) return 0;
    return conversionQuote.outputAmount || (amount * 1000); // Fallback rate
  };

  const getUSDCEquivalent = () => {
    if (!marketData) return amount;
    return getOriginEquivalent() * marketData.price_usdc;
  };

  const platformFeePercent = 10;
  const platformFee = (amount * platformFeePercent) / 100;
  const totalAmount = amount + platformFee;

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

          {/* Origin Option */}
          <Button
            variant={selectedCurrency === 'ORIGIN' ? 'default' : 'outline'}
            onClick={() => onCurrencyChange('ORIGIN')}
            className="h-auto p-4 flex flex-col items-start space-y-2"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-web3-primary rounded-full flex items-center justify-center text-white text-xs font-bold">
                  O
                </div>
                <span className="font-semibold">Pay with ORIGIN</span>
              </div>
              {selectedCurrency === 'ORIGIN' && (
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
                  <div>Amount: {formatOrigin(getOriginEquivalent())}</div>
                  <div>+ Platform Fee: {formatOrigin(getOriginEquivalent() * 0.1)}</div>
                  <div className="font-medium">Total: {formatOrigin(getOriginEquivalent() * 1.1)}</div>
                </>
              )}
            </div>
          </Button>
        </div>

        {/* Conversion Information */}
        {selectedCurrency === 'USDC' && conversionQuote && (
          <Alert className="bg-web3-secondary/10 border-web3-secondary/30">
            <Info className="w-4 h-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="font-medium text-foreground">Automatic Conversion</div>
                <div className="text-sm text-muted-foreground">
                  Your {formatUSDC(amount)} USDC payment will be automatically converted to ~{formatOrigin(getOriginEquivalent())} tokens behind the scenes.
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Conversion rate: 1 USDC ≈ {formatOrigin(conversionQuote.outputAmount || 1000)}</span>
                  {conversionQuote.priceImpact > 0 && (
                    <span>• Price impact: {conversionQuote.priceImpact.toFixed(2)}%</span>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Market Data */}
        {marketData && (
          <div className="space-y-3">
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">ORIGIN Price</div>
                <div className="font-medium">{formatUSDC(marketData.price_usdc)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">24h Change</div>
                <div className={`font-medium ${marketData.price_change_24h >= 0 ? 'text-web3-success' : 'text-destructive'}`}>
                  {marketData.price_change_24h >= 0 ? '+' : ''}{marketData.price_change_24h.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Benefits Section */}
        <div className="space-y-3">
          <Separator />
          <div className="text-sm space-y-2">
            <div className="font-medium text-foreground">Why Origin Integration?</div>
            <ul className="space-y-1 text-muted-foreground text-xs">
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-web3-primary rounded-full mt-2"></div>
                <span>All payments generate trading volume for ORIGIN token</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-web3-primary rounded-full mt-2"></div>
                <span>Platform fees collected in ORIGIN support token ecosystem</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-web3-primary rounded-full mt-2"></div>
                <span>Freelancers receive ORIGIN tokens with potential upside</span>
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
                  {selectedCurrency === 'USDC' ? formatUSDC(amount) : formatOrigin(getOriginEquivalent())}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform Fee (10%)</span>
                <span className="text-foreground">
                  {selectedCurrency === 'USDC' ? formatUSDC(platformFee) : formatOrigin(getOriginEquivalent() * 0.1)}
                </span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-semibold">
                <span className="text-foreground">Total Payment</span>
                <span className="text-web3-primary">
                  {selectedCurrency === 'USDC' ? formatUSDC(totalAmount) : formatOrigin(getOriginEquivalent() * 1.1)}
                </span>
              </div>
              {selectedCurrency === 'USDC' && (
                <div className="text-xs text-muted-foreground mt-1">
                  (Converted to ~{formatOrigin(getOriginEquivalent() * 1.1)} internally)
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