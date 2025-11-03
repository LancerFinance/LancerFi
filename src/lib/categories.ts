import { Code, Palette, TrendingUp, Shield, Database, Globe, Zap, Layers, Wallet, Activity, Users, Briefcase, BarChart3 } from "lucide-react";

export interface Category {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
  group: "Core Development" | "Specialized Services" | "Strategic & Creative";
  avgValueText: string; // e.g., "$2K - $10K"
  trendPercent: number; // positive for up, negative for down
  topTalent?: {
    name: string;
    avatarUrl?: string; // optional, fallback to initials
  };
}

export const PROJECT_CATEGORIES: Category[] = [
  // Core Development
  {
    value: "smart-contracts",
    label: "Smart Contract Development",
    icon: Shield,
    description: "Secure, audited blockchain contracts and protocols",
    color: "from-green-500 to-green-600",
    group: "Core Development",
    avgValueText: "$5K - $25K",
    trendPercent: 12.8,
    topTalent: { name: "A. Nakamoto" }
  },
  {
    value: "dapp-development",
    label: "DApp Development",
    icon: Globe,
    description: "Full-stack decentralized application development",
    color: "from-blue-500 to-blue-600",
    group: "Core Development",
    avgValueText: "$8K - $40K",
    trendPercent: 6.3,
    topTalent: { name: "R. Buterin" }
  },
  {
    value: "blockchain-infra",
    label: "Blockchain Infrastructure",
    icon: Layers,
    description: "Custom chains, nodes, validators, and infrastructure",
    color: "from-indigo-500 to-indigo-600",
    group: "Core Development",
    avgValueText: "$15K - $100K",
    trendPercent: 4.1,
    topTalent: { name: "C. Wood" }
  },
  {
    value: "web3-frontend",
    label: "Web3 Frontend",
    icon: Code,
    description: "Modern React/Next.js Web3 user interfaces",
    color: "from-cyan-500 to-cyan-600",
    group: "Core Development",
    avgValueText: "$3K - $15K",
    trendPercent: 9.4,
    topTalent: { name: "M. Olson" }
  },

  // Specialized Services
  {
    value: "defi-engineering",
    label: "DeFi Engineering",
    icon: TrendingUp,
    description: "DeFi protocols, AMMs, lending, and yield strategies",
    color: "from-purple-500 to-purple-600",
    group: "Specialized Services",
    avgValueText: "$20K - $120K",
    trendPercent: 15.3,
    topTalent: { name: "Y. Farmer" }
  },
  {
    value: "nft-solutions",
    label: "NFT Solutions",
    icon: Palette,
    description: "Collections, marketplaces, minting platforms, utilities",
    color: "from-pink-500 to-pink-600",
    group: "Specialized Services",
    avgValueText: "$5K - $35K",
    trendPercent: -2.1,
    topTalent: { name: "B. Artist" }
  },
  {
    value: "solana-specialists",
    label: "Solana Specialists",
    icon: Activity,
    description: "Solana-native development and optimization",
    color: "from-emerald-500 to-emerald-600",
    group: "Specialized Services",
    avgValueText: "$6K - $45K",
    trendPercent: 18.6,
    topTalent: { name: "S. Sealevel" }
  },
  {
    value: "smart-contract-audits",
    label: "Smart Contract Audits",
    icon: Shield,
    description: "Security reviews, penetration testing, and code audits",
    color: "from-zinc-500 to-zinc-600",
    group: "Specialized Services",
    avgValueText: "$12K - $80K",
    trendPercent: 7.2,
    topTalent: { name: "K. Formal" }
  },

  // Strategic & Creative
  {
    value: "token-economics",
    label: "Token Economics",
    icon: Wallet,
    description: "Tokenomics design, modeling, and economic analysis",
    color: "from-amber-500 to-amber-600",
    group: "Strategic & Creative",
    avgValueText: "$8K - $50K",
    trendPercent: 3.9,
    topTalent: { name: "T. Econ" }
  },
  {
    value: "dao-development",
    label: "DAO Development",
    icon: Users,
    description: "Governance systems, voting mechanisms, DAO tooling",
    color: "from-sky-500 to-sky-600",
    group: "Strategic & Creative",
    avgValueText: "$7K - $30K",
    trendPercent: 5.5,
    topTalent: { name: "D. Voter" }
  },
  {
    value: "web3-marketing",
    label: "Web3 Marketing",
    icon: Zap,
    description: "Community growth, crypto campaigns, and branding",
    color: "from-red-500 to-red-600",
    group: "Strategic & Creative",
    avgValueText: "$2K - $12K",
    trendPercent: 1.4,
    topTalent: { name: "C. Growth" }
  },
  {
    value: "ui-ux-design",
    label: "UI/UX Design",
    icon: BarChart3,
    description: "Premium Web3 interface design and user experience",
    color: "from-orange-500 to-orange-600",
    group: "Strategic & Creative",
    avgValueText: "$2K - $10K",
    trendPercent: 10.2,
    topTalent: { name: "U. X. Pro" }
  }
];

export const getCategoryByValue = (value: string): Category | undefined => {
  return PROJECT_CATEGORIES.find(cat => cat.value === value);
};
