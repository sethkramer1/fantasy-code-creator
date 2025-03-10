import React from 'react';
import { Sparkles } from 'lucide-react';

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  return (
    <div className="space-y-3 text-center">
      <div className="inline-flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-1.5 rounded-full">
        <Sparkles size={16} className="text-indigo-500" />
        <span className="text-sm font-medium text-indigo-700">Design anything with AI</span>
      </div>
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-700">{title}</h1>
      {description && (
        <p className="text-gray-500 max-w-md mx-auto">{description}</p>
      )}
    </div>
  );
}
