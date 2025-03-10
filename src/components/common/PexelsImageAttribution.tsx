import React from 'react';

interface PexelsImageAttributionProps {
  className?: string;
}

/**
 * A component to display Pexels attribution
 * This should be added to any page that uses Pexels images
 */
const PexelsImageAttribution: React.FC<PexelsImageAttributionProps> = ({ className }) => {
  return (
    <div className={`text-xs text-gray-500 mt-4 text-center ${className || ''}`}>
      Images from{' '}
      <a 
        href="https://www.pexels.com" 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-blue-500 hover:underline"
      >
        Pexels
      </a>
    </div>
  );
};

export default PexelsImageAttribution;
