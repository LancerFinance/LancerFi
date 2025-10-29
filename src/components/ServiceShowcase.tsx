import smartContractsImg from "@/assets/services/smart-contracts.jpg";
import defiImg from "@/assets/services/defi.jpg";
import nftImg from "@/assets/services/nft.jpg";
import dappImg from "@/assets/services/dapp.jpg";
import { useNavigate } from "react-router-dom";

const ServiceShowcase = () => {
  const navigate = useNavigate();

  const services = [
    {
      title: "Smart Contracts",
      description: "Secure blockchain development",
      image: smartContractsImg,
      category: "smart-contracts",
    },
    {
      title: "DeFi Solutions",
      description: "Decentralized finance platforms",
      image: defiImg,
      category: "defi",
    },
    {
      title: "NFT Development",
      description: "Digital collectibles & marketplaces",
      image: nftImg,
      category: "nft",
    },
    {
      title: "DApp Development",
      description: "Web3 applications & platforms",
      image: dappImg,
      category: "dapp-development",
    },
  ];

  return (
    <section className="py-16 bg-secondary/20">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {services.map((service, index) => (
            <div
              key={index}
              className="group relative overflow-hidden rounded-2xl cursor-pointer hover-lift fade-in shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
              style={{ animationDelay: `${index * 0.1}s` }}
              onClick={() => navigate('/browse-services')}
            >
              <div className="aspect-[4/3] relative">
                <img
                  src={service.image}
                  alt={service.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-90 group-hover:opacity-95 transition-opacity"></div>
                <div className="absolute inset-0 flex flex-col justify-end p-4">
                  <h3 className="text-white font-bold text-lg mb-1">{service.title}</h3>
                  <p className="text-white/80 text-sm">{service.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServiceShowcase;
