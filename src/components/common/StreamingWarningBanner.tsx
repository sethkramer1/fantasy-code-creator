import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface StreamingWarningBannerProps {
  isVisible: boolean;
}

export const StreamingWarningBanner = ({ isVisible }: StreamingWarningBannerProps) => {
  if (!isVisible) return null;
  
  const statuses = [
    "Grooving",
    "Flowing",
    "Mellowing",
    "Resonating",
    "Harmonizing",
    "Jamming",
    "Syncing",
    "Vibing"
  ];
  
  const [randomStatus, setRandomStatus] = useState<string>("");
  
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * statuses.length);
    setRandomStatus(statuses[randomIndex]);
  }, []);
  
  return (
    <div className="absolute top-4 left-4 right-4 z-40 pointer-events-none">
      <div>
        <Alert className="pointer-events-auto shadow-lg border border-gray-200 bg-white/95 backdrop-blur-sm">
          <div className="flex items-center">
            <div className="flex flex-col w-full">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <h3 className="text-md font-medium text-gray-800">
                    {randomStatus || "Generation in progress"}...
                  </h3>
                </div>
                <div className="bg-gradient-to-r from-indigo-100 to-purple-100 h-1.5 w-24 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full animate-[progress_1.5s_ease-in-out_infinite]" style={{ width: '100%' }}></div>
                </div>
              </div>
              <AlertDescription className="text-sm text-gray-600 mt-1 text-left">
                Keep this window open until generation completes (you may go to another tab).
              </AlertDescription>
            </div>
          </div>
        </Alert>
      </div>
    </div>
  );
};

// Add the progress animation to your global CSS or tailwind.config.js
// If you want to test immediately, you can use inline styles with keyframes
const styleElement = document.createElement("style");
styleElement.textContent = `
@keyframes progress {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
`;
document.head.appendChild(styleElement);

export default StreamingWarningBanner;
