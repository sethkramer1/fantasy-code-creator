
import React from 'react';
import { MainNavigation } from '@/components/common/MainNavigation';

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <MainNavigation />
      </div>
      {description && (
        <p className="text-gray-500">{description}</p>
      )}
    </div>
  );
}
