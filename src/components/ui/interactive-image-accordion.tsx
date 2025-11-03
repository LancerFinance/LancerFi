import React, { useState } from 'react';

// --- Data for the image accordion ---
const accordionItems = [
  {
    id: 1,
    title: 'Smart Contracts',
    imageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2070&auto=format&fit=crop',
  },
  {
    id: 2,
    title: 'DeFi Development',
    imageUrl: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?q=80&w=2070&auto=format&fit=crop',
  },
  {
    id: 3,
    title: 'NFT Marketplace',
    imageUrl: 'https://images.unsplash.com/photo-1644361566696-3d442b5b482a?q=80&w=2070&auto=format&fit=crop',
  },
  {
    id: 4,
    title: 'DApp Creation',
    imageUrl: 'https://images.unsplash.com/photo-1639762681057-408e52192e55?q=80&w=2070&auto=format&fit=crop',
  },
];

// --- Accordion Item Component ---
const AccordionItem = ({ item, isActive, onMouseEnter }: { 
  item: typeof accordionItems[0], 
  isActive: boolean, 
  onMouseEnter: () => void 
}) => {
  return (
    <div
      className={`
        relative rounded-2xl overflow-hidden cursor-pointer
        transition-all duration-700 ease-in-out
        h-[300px] sm:h-[400px] lg:h-[450px]
        ${isActive ? 'w-[200px] sm:w-[280px] lg:w-[400px]' : 'w-[40px] sm:w-[50px] lg:w-[60px]'}
      `}
      onMouseEnter={onMouseEnter}
    >
      {/* Background Image */}
      <img
        src={item.imageUrl}
        alt={item.title}
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => { 
          const target = e.target as HTMLImageElement;
          target.onerror = null; 
          target.src = 'https://placehold.co/400x450/2d3748/ffffff?text=Image+Error'; 
        }}
      />
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black bg-opacity-40"></div>

      {/* Caption Text */}
      <span
        className={`
          absolute text-white font-semibold whitespace-nowrap
          transition-all duration-300 ease-in-out
          text-sm sm:text-base lg:text-lg
          ${
            isActive
              ? 'bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 rotate-0'
              : 'w-auto text-left bottom-16 sm:bottom-20 lg:bottom-24 left-1/2 -translate-x-1/2 rotate-90'
          }
        `}
      >
        {item.title}
      </span>
    </div>
  );
};

// --- Main Component ---
export function InteractiveImageAccordion() {
  const [activeIndex, setActiveIndex] = useState(3);

  const handleItemHover = (index: number) => {
    setActiveIndex(index);
  };

  return (
    <div className="flex flex-row items-center justify-center gap-2 sm:gap-3 lg:gap-4 overflow-x-auto p-2 sm:p-4">
      {accordionItems.map((item, index) => (
        <AccordionItem
          key={item.id}
          item={item}
          isActive={index === activeIndex}
          onMouseEnter={() => handleItemHover(index)}
        />
      ))}
    </div>
  );
}
