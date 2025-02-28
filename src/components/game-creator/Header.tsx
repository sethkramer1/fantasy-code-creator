
import { Wand2 } from "lucide-react";

interface HeaderProps {
  title: string;
  description: string;
}

export function Header({ title, description }: HeaderProps) {
  return (
    <div className="text-center space-y-5">
      <div className="inline-flex items-center justify-center">
        <div className="bg-black rounded-full p-4 mb-2 shadow-lg hover:shadow-gray-200 transition-shadow duration-300">
          <Wand2 size={36} className="text-white" />
        </div>
      </div>
      <h1 className="text-3xl md:text-4xl font-semibold text-black tracking-tight">
        {title}
      </h1>
      <p className="text-lg md:text-xl text-gray-700 max-w-2xl mx-auto">
        {description}
      </p>
    </div>
  );
}
