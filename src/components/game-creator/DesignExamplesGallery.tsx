import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface DesignExample {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  designSystem?: string;
  promptSnippet: string;
}

// High-quality design examples organized by type
const designExamples: Record<string, DesignExample[]> = {
  webapp: [
    {
      id: "webapp-1",
      title: "Analytics Dashboard",
      description: "Modern analytics dashboard with data visualization components",
      imageUrl: "https://cdn.dribbble.com/userupload/9430205/file/original-a9d1a1f0f1f8a0b9c64d4d0f0d8c4e6a.png?resize=1600x1200",
      designSystem: "Tailwind CSS",
      promptSnippet: "Use a clean dashboard layout with a sidebar navigation, card components with subtle shadows, and a muted color palette of navy, teal, and light gray. Include data visualizations like bar charts and line graphs with proper labels and legends."
    },
    {
      id: "webapp-2",
      title: "Task Management App",
      description: "Task management application with modern UI components",
      imageUrl: "https://cdn.dribbble.com/userupload/7825321/file/original-a6c0e064e9978c0f6f0d302f8a7d7142.jpg?resize=1600x1200",
      designSystem: "Material Design",
      promptSnippet: "Design with a card-based layout, floating action buttons, and a color scheme of purple (#6200ee) and teal (#03dac6). Use proper spacing (8px grid system) and include realistic task data with completion status indicators."
    }
  ],
  mobileapp: [
    {
      id: "mobile-1",
      title: "Fitness Tracking App",
      description: "iOS fitness app with activity tracking and statistics",
      imageUrl: "https://cdn.dribbble.com/userupload/7406637/file/original-e8e2413b0b3384d9737daa1e5d363f5a.png?resize=1600x1200",
      designSystem: "iOS Design",
      promptSnippet: "Follow iOS design guidelines with native components like tab bars and navigation bars. Use a vibrant accent color (#FF2D55) against white backgrounds. Include realistic fitness metrics, progress rings, and activity charts."
    },
    {
      id: "mobile-2",
      title: "Food Delivery App",
      description: "Material Design food delivery app interface",
      imageUrl: "https://cdn.dribbble.com/userupload/7825321/file/original-a6c0e064e9978c0f6f0d302f8a7d7142.jpg?resize=1600x1200",
      designSystem: "Material Design",
      promptSnippet: "Use Material Design components with bottom navigation, cards with rounded corners, and proper elevation shadows. Implement a color scheme with orange (#FF9800) as the primary color. Include realistic restaurant listings with food images, ratings, and delivery times."
    }
  ],
  website: [
    {
      id: "website-1",
      title: "SaaS Landing Page",
      description: "Modern SaaS product landing page with clean sections",
      imageUrl: "https://cdn.dribbble.com/userupload/8623424/file/original-a0f6f25a2e6c2a0f8a1c7a3f3f3d3c3e.png?resize=1600x1200",
      designSystem: "Custom",
      promptSnippet: "Design with a 12-column grid layout, generous whitespace (32px between sections), and a clean typography system using Inter font. Include a hero section with product screenshot, feature grid with icons, pricing table, and testimonial carousel."
    },
    {
      id: "website-2",
      title: "E-commerce Product Page",
      description: "Modern e-commerce product detail page",
      imageUrl: "https://cdn.dribbble.com/userupload/7825321/file/original-a6c0e064e9978c0f6f0d302f8a7d7142.jpg?resize=1600x1200",
      designSystem: "Custom",
      promptSnippet: "Create a product page with large product images, clear typography hierarchy, and ample whitespace. Use a minimal color palette with one accent color. Include product details, specifications table, related products carousel, and customer reviews section."
    }
  ],
  infographic: [
    {
      id: "infographic-1",
      title: "Climate Change Data Visualization",
      description: "Data-driven infographic about climate change impacts",
      imageUrl: "https://cdn.dribbble.com/userupload/7825321/file/original-a6c0e064e9978c0f6f0d302f8a7d7142.jpg?resize=1600x1200",
      promptSnippet: "Create an infographic with a cohesive visual style using blues and greens. Include properly labeled line charts showing temperature changes, bar graphs for emissions data, and icon-based statistics. Use a clear visual flow with numbered sections and minimal text."
    }
  ],
  game: [
    {
      id: "game-1",
      title: "Space Shooter Game",
      description: "Retro-style space shooter with modern UI elements",
      imageUrl: "https://cdn.dribbble.com/userupload/7825321/file/original-a6c0e064e9978c0f6f0d302f8a7d7142.jpg?resize=1600x1200",
      promptSnippet: "Design with a dark space theme, neon accents, and pixel art style. Include game UI elements like health bar, score counter, and power-up indicators. Create responsive controls that work on both desktop and mobile."
    }
  ],
  wireframe: [
    {
      id: "wireframe-1",
      title: "E-commerce App Wireframe",
      description: "Low-fidelity wireframe for mobile e-commerce app",
      imageUrl: "https://cdn.dribbble.com/userupload/7825321/file/original-a6c0e064e9978c0f6f0d302f8a7d7142.jpg?resize=1600x1200",
      promptSnippet: "Create a wireframe with consistent 8px grid alignment. Use standard placeholder patterns for images and icons. Include essential UI elements with clear labels and establish proper information hierarchy through varying element sizes."
    }
  ]
};

interface DesignExamplesGalleryProps {
  selectedType: string;
  onExampleSelected: (promptSnippet: string) => void;
}

export function DesignExamplesGallery({ selectedType, onExampleSelected }: DesignExamplesGalleryProps) {
  const [open, setOpen] = useState(false);
  const examples = designExamples[selectedType] || [];
  
  const handleExampleClick = (promptSnippet: string) => {
    onExampleSelected(promptSnippet);
    setOpen(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Sparkles size={16} />
          <span>Design Examples</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Design Examples</DialogTitle>
          <DialogDescription>
            Browse high-quality design examples to inspire your creation. Click on any example to use its design pattern in your prompt.
          </DialogDescription>
        </DialogHeader>
        
        {examples.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            No examples available for this type yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {examples.map((example) => (
              <div 
                key={example.id} 
                className="border rounded-lg overflow-hidden hover:border-gray-400 transition-all cursor-pointer"
                onClick={() => handleExampleClick(example.promptSnippet)}
              >
                <div className="aspect-video bg-gray-100 overflow-hidden">
                  <img 
                    src={example.imageUrl} 
                    alt={example.title} 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3">
                  <h3 className="font-medium">{example.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{example.description}</p>
                  {example.designSystem && (
                    <div className="mt-2">
                      <span className="inline-block px-2 py-0.5 text-xs bg-gray-100 rounded-full">
                        {example.designSystem}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
