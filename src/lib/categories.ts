import { Code, Palette, Smartphone, TrendingUp, Shield, Database, Globe, Zap } from "lucide-react";

export interface Category {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
}

export const PROJECT_CATEGORIES: Category[] = [
  {
    value: "smart-contracts",
    label: "Smart Contracts",
    icon: Shield,
    description: "Secure blockchain contracts and protocols",
    color: "from-green-500 to-green-600"
  },
  {
    value: "dapp-development",
    label: "DApp Development",
    icon: Globe,
    description: "Decentralized application development",
    color: "from-blue-500 to-blue-600"
  },
  {
    value: "defi",
    label: "DeFi Solutions",
    icon: TrendingUp,
    description: "Decentralized finance solutions",
    color: "from-purple-500 to-purple-600"
  },
  {
    value: "nft",
    label: "NFT Development",
    icon: Palette,
    description: "Non-fungible token projects and marketplaces",
    color: "from-pink-500 to-pink-600"
  },
  {
    value: "blockchain",
    label: "Blockchain Development",
    icon: Database,
    description: "Custom blockchain and infrastructure",
    color: "from-indigo-500 to-indigo-600"
  },
  {
    value: "web3-frontend",
    label: "Web3 Frontend",
    icon: Code,
    description: "Modern Web3 user interfaces",
    color: "from-cyan-500 to-cyan-600"
  },
  {
    value: "marketing",
    label: "Web3 Marketing",
    icon: Zap,
    description: "Digital marketing and growth strategies",
    color: "from-red-500 to-red-600"
  },
  {
    value: "design",
    label: "UI/UX Design",
    icon: Palette,
    description: "User interface and experience design",
    color: "from-orange-500 to-orange-600"
  }
];

export const getCategoryByValue = (value: string): Category | undefined => {
  return PROJECT_CATEGORIES.find(cat => cat.value === value);
};
