
import React from 'react';
import { ChevronRight } from 'lucide-react';

interface PathBarProps {
  fileName?: string;
}

export const PathBar: React.FC<PathBarProps> = ({ fileName = 'index.html' }) => {
  // Create a fake path structure
  const parts = ['components', fileName];
  
  return (
    <div className="flex items-center px-3 py-2 text-sm text-gray-500 bg-gray-50 border-b border-gray-200">
      {parts.map((part, index) => (
        <React.Fragment key={index}>
          {index > 0 && <ChevronRight className="h-4 w-4 mx-1 text-gray-400" />}
          <span>{part}</span>
        </React.Fragment>
      ))}
    </div>
  );
};
