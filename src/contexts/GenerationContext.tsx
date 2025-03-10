import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface GenerationContextType {
  isGenerating: boolean;
  setIsGenerating: (isGenerating: boolean) => void;
}

const GenerationContext = createContext<GenerationContextType | undefined>(undefined);

export const useGeneration = () => {
  const context = useContext(GenerationContext);
  if (context === undefined) {
    throw new Error('useGeneration must be used within a GenerationProvider');
  }
  return context;
};

interface GenerationProviderProps {
  children: ReactNode;
}

export const GenerationProvider: React.FC<GenerationProviderProps> = ({ children }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Add beforeunload event listener to warn users when they try to close the window during generation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isGenerating) {
        // Standard way to show a confirmation dialog
        e.preventDefault();
        // Chrome requires returnValue to be set
        e.returnValue = 'Generation in progress. If you leave now, your progress will be lost.';
        return 'Generation in progress. If you leave now, your progress will be lost.';
      }
    };

    if (isGenerating) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isGenerating]);

  const value = {
    isGenerating,
    setIsGenerating,
  };

  return (
    <GenerationContext.Provider value={value}>
      {children}
    </GenerationContext.Provider>
  );
};
