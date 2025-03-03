
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  description?: string;
}

export function ErrorState({ 
  title = "Game not found", 
  description = "The game you're looking for doesn't exist or is still being generated. Please check back later."
}: ErrorStateProps) {
  const navigate = useNavigate();
  
  return (
    <div className="flex h-screen items-center justify-center p-4">
      <div className="max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-md dark:border-gray-700 dark:bg-gray-800">
        <h1 className="mb-4 text-xl font-bold dark:text-white">{title}</h1>
        <p className="mb-6 text-gray-700 dark:text-gray-300">
          {description}
        </p>
        <Button
          onClick={() => navigate("/")}
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Return to Home
        </Button>
      </div>
    </div>
  );
}
