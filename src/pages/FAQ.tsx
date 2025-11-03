import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Shield, CreditCard, Users, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const FAQ = () => {
  const faqs = [
    {
      icon: <Shield className="w-5 h-5" />,
      question: "How does smart contract escrow work?",
      answer: "When a project is agreed upon, the client's payment is automatically locked in a smart contract. The funds are only released to the freelancer once the project milestones are completed and approved. This ensures both parties are protected throughout the process."
    },
    {
      icon: <CreditCard className="w-5 h-5" />,
      question: "What are the platform fees?",
      answer: "We charge a 10% platform fee on successfully completed projects. This fee covers smart contract deployment, dispute resolution, and platform maintenance. No hidden fees - what you see is what you pay."
    },
    {
      icon: <Users className="w-5 h-5" />,
      question: "How are freelancers verified?",
      answer: "All freelancers undergo a verification process including portfolio review, skill assessment, and identity verification. We also use blockchain-based reputation systems to track performance and build trust in our community."
    },
    {
      icon: <Zap className="w-5 h-5" />,
      question: "What cryptocurrencies do you accept?",
      answer: "We accept major stablecoins (USDC, USDT, DAI) and our native platform token. All payments are processed instantly on the blockchain with minimal gas fees thanks to our Layer 2 integration."
    },
    {
      icon: <Shield className="w-5 h-5" />,
      question: "What happens if there's a dispute?",
      answer: "Our smart contracts include built-in dispute resolution mechanisms. If issues arise, our team of Web3 experts mediates the dispute. In extreme cases, funds can be released proportionally based on completed work."
    },
    {
      icon: <CreditCard className="w-5 h-5" />,
      question: "Can I get refunds if work is not delivered?",
      answer: "Yes. If a freelancer fails to deliver according to the agreed terms, the smart contract automatically refunds your escrowed funds minus any completed milestones. Our reputation system also protects against unreliable freelancers."
    }
  ];

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
              Frequently Asked Questions
            </h1>
            <p className="text-xl text-muted-foreground">
              Everything you need to know about our Web3 freelance platform
            </p>
          </div>

          <div className="grid gap-6">
            {faqs.map((faq, index) => (
              <Card key={index} className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-3 text-foreground">
                    <div className="w-10 h-10 bg-web3-primary/20 rounded-full flex items-center justify-center text-web3-primary">
                      {faq.icon}
                    </div>
                    <span>{faq.question}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed ml-13">
                    {faq.answer}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <Card className="bg-gradient-card border-web3-primary/30 p-8">
              <CardContent className="p-0">
                <h3 className="text-2xl font-bold mb-4 text-foreground">
                  Still have questions?
                </h3>
                <p className="text-muted-foreground mb-6">
                  Our team is here to help you navigate the Web3 freelance ecosystem
                </p>
                <Link to="/post-project">
                  <Button variant="default" size="lg">
                    Post a Project
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQ;