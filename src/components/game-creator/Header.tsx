
import { Wand2 } from "lucide-react";

interface HeaderProps {
  title: string;
  description: string;
}

export function Header({ title, description }: HeaderProps) {
  return (
    <div className="text-center space-y-4">
      <div className="flex justify-center">
        <div className="bg-black rounded-full p-4 mb-2">
          <Wand2 size={40} className="text-white" />
        </div>
      </div>
      <h1 className="text-3xl md:text-4xl font-light tracking-tight text-black">{title}</h1>
      <p className="text-base md:text-lg text-[#757575]">
        {description}
      </p>
    </div>
  );
}
