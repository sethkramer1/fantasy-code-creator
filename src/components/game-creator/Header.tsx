
import React from 'react';
import { MainNavigation } from '@/components/common/MainNavigation';

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:justify-between items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-center md:text-left">{title}</h1>
        <MainNavigation />
      </div>
      {description && (
        <p className="text-gray-500 text-center md:text-left">{description}</p>
      )}
    </div>
  );
}
