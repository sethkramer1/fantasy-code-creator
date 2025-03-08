import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DesignStyle {
  id: string;
  name: string;
  description: string;
  promptSnippet: string;
  exampleImageUrl: string;
}

const designStyles: DesignStyle[] = [
  {
    id: "glassmorphic",
    name: "Glassmorphic",
    description: "Transparent, blurred glass-like elements with subtle borders",
    promptSnippet: "Glassmorphic Elements: Frosted glass effect on cards and panels creating depth and lightness. Semi-transparent containers that let the background subtly show through. Soft blur effects that mimic translucent surfaces. Light border highlights that enhance the glass-like appearance. Layered transparency creating an elegant, modern aesthetic.\n\nColor Palette: Soft muted blue-gray background creating a serene atmosphere. White and light gray components that float with subtle shadows. Minimal use of accent colors. Overall desaturated tones that reduce visual stress.\n\nTypography: Modern sans-serif typography with varying weights for clear hierarchy. Bold display font for the month (\"Agustus\"). Light, spacious text throughout that enhances readability. Subtle text color variations to indicate importance levels.\n\nLayout Structure: Card-based modular design with generous whitespace. Floating glassmorphic panels with soft shadows for depth. Clean grid system that maintains alignment while feeling relaxed. Asymmetrical balance that feels intentional yet organic.\n\nUI Elements: Minimalist, borderless containers with rounded corners. Subtle shadows and transparency creating a layered interface effect. Simple checkbox and button designs with ample padding. Understated icons that complement rather than dominate.\n\nVisual Touches: Nature photography as visual elements rather than decorative icons. Thoughtful spacing that allows the interface to \"breathe\". Calendar events that visually stack without overwhelming. Refined micro-interactions implied through the careful placement of elements.",
    exampleImageUrl: "https://cdn.dribbble.com/userupload/7915514/file/original-7a27fe131f29295e737930be8cef2fc5.png?resize=1504x1128&vertical=center"
  },
  {
    id: "flat",
    name: "Flat Design",
    description: "Minimalist approach with clean lines and solid colors",
    promptSnippet: "Flat Design Interface: This design style embraces simplicity through clean lines and two-dimensional elements without realistic effects. Key elements include:\n\nColor Palette: Soft blue-gray background creating a calm, neutral canvas. Teal and navy as primary UI colors with clear purpose and meaning. Strategic use of red as a functional accent for negative indicators. White content cards providing clear visual separation.\n\nVisual Characteristics: Completely flat elements without shadows, gradients or bevels. Two-dimensional illustrations and icons throughout. Sharp edges and geometric shapes with precise lines. Strong focus on color blocking for visual organization.\n\nTypography: Clean sans-serif typography with excellent readability. Bold weight variations for establishing clear hierarchy. Consistent type styling across similar information types. Generous spacing enhancing legibility.\n\nUI Elements: Minimal, streamlined controls with geometric shapes. Simple iconography with consistent line weights. Progress bars and indicators using solid colors rather than effects. Buttons and interactive elements distinguished by color rather than depth.\n\nLayout Principles: Strong grid-based organization with clear alignment. Generous whitespace creating visual breathing room. Card-based content containers with minimal styling. Content arranged in logical, digestible sections.\n\nDesign Philosophy: Embracing simplicity through reduction of decorative elements. Using color and typography rather than effects to create hierarchy. Maintaining clarity through consistent application of flat principles. Prioritizing content over interface decoration.\n\nThis flat design approach strips away artificial depth and ornamentation to create a clean, efficient interface where content and function take center stage, resulting in a timeless, uncluttered aesthetic.",
    exampleImageUrl: "https://cdn.dribbble.com/userupload/16333794/file/original-48997473e346ac256d30965c86c2dc5e.jpg?resize=2048x1536&vertical=center"
  },
  {
    id: "skeuomorphism",
    name: "Skeuomorphism",
    description: "Realistic elements that mimic their real-world counterparts",
    promptSnippet: "Dark Mode Skeuomorphic Interface: This design style combines minimalism with digital representations of physical objects and textures. Key elements include:\n\nColor Palette: Deep slate/navy background creating a sophisticated dark canvas. Bright accent colors (blue, yellow, green) used selectively for emphasis. Monochromatic gray variations mimicking physical materials. Subtle gradients suggesting real-world lighting conditions.\n\nSkeuomorphic Elements: Digital representations of real-world objects (folders, sliders, buttons). Textured surfaces that mimic physical materials. Realistic shadows and highlights suggesting 3D forms. Input fields that resemble physical text entry areas. Toggle switches and buttons that appear pressable.\n\nTypography: Clean sans-serif typography with excellent readability against dark backgrounds. Text that appears slightly embossed or inset into surfaces. Clear hierarchy through size and treatment variations. Secondary text with subtle material-like qualities.\n\nUI Components: Buttons that appear to depress when activated. Form elements that mimic physical counterparts. Containers with subtle texture suggesting materials like metal, plastic, or paper. Icons that represent real-world objects rather than abstract symbols.\n\nInteractive Elements: Buttons with visible depth changes on interaction. Sliders that mimic physical controls with tactile appearance. Selection elements that show physical-like state changes. Scrollable areas with visual cues from physical interfaces.\n\nOverall Aesthetic: Digital interface that references familiar physical objects. Textures and materials creating visual interest without overwhelming. Careful balance between realism and digital usability. Depth and dimension suggesting a space rather than a flat surface.",
    exampleImageUrl: "https://cdn.dribbble.com/userupload/36937705/file/original-b2f13cb043acb73b80d91f407faff2b7.jpg?resize=752x&vertical=center"
  },
  {
    id: "minimalism",
    name: "Minimalism",
    description: "Extreme simplicity with essential elements and generous whitespace",
    promptSnippet: "Ultra-Minimal Interface: This design style embraces pure minimalism for professional data display with exceptional clarity and focus. Key elements include:\n\nColor Palette: Stark black and white as primary colors. Minimal color indicators (green, yellow, red) used only for status signifiers. No decorative colors - purely functional color application. High contrast for maximum readability.\n\nTypography: Clean sans-serif typography with excellent hierarchy. Restrained font weight variations - primarily regular with selective bold. Generous letter spacing for enhanced legibility. Consistent text sizing with minimal variation.\n\nLayout Structure: Strict grid-based organization with perfect alignment. Compact data presentation without wasted space. Strategic whitespace creating clear section boundaries. Horizontal rule divisions used sparingly.\n\nUI Elements: Reduced to absolute essentials - no decorative elements. Small, precise status indicators. Minimal navigation controls. Understated profile images that don't distract from data.\n\nData Presentation: Table format optimized for scanning efficiency. Column alignment that enhances readability. Consistent data formatting across all entries. Information density balanced with clarity.\n\nVisual Philosophy: Every element serves a functional purpose. Interface disappears to highlight the data itself. No drop shadows, gradients, or dimensional effects. Absolute commitment to reduction and clarity.",
    exampleImageUrl: "https://cdn.dribbble.com/userupload/15765873/file/original-524cd41d027679fb597b7dda48053958.png?resize=2048x1536&vertical=center"
  },
  {
    id: "cozy",
    name: "Cozy",
    description: "Warm, inviting design with a nostalgic, comfortable feel",
    promptSnippet: "Color Palette: Soft beige/cream background creating a warm, paper-like feel. Muted accent colors (navy blue, red, green, orange) that feel inviting rather than harsh. Limited color usage that creates a calm, focused atmosphere.\n\nIllustration Style: Minimalist, slightly whimsical line drawings with simple color blocking. Childlike but sophisticated illustrations that evoke a sense of creativity. Clean outlines with selective color fills.\n\nTypography: Monospace or typewriter-inspired fonts that evoke a literary feel. Clear hierarchy with prominent headings. Minimalist text presentation with ample whitespace.\n\nUI Elements: Simple, clearly defined buttons with rounded corners. Clean, thin icons with consistent styling. Subtle dividing lines and containers. Minimalist navigation system with icon + label combinations.\n\nOverall Aesthetic: Digital coziness that mimics the comfort of physical books. Balanced whitespace that allows content to breathe. Focus on reading experience with minimal distractions. Nostalgic elements that reference traditional reading while embracing digital capabilities.",
    exampleImageUrl: "https://cdn.dribbble.com/userupload/17714997/file/original-9931b65a666ab3f0eecddd2cc885bebd.png?resize=1504x1128&vertical=center"
  }
];

interface DesignStyleButtonsProps {
  onStyleSelected: (promptSnippet: string | null, styleId: string | null) => void;
  activeStyleId: string | null;
}

export function DesignStyleButtons({ onStyleSelected, activeStyleId }: DesignStyleButtonsProps) {
  const handleStyleClick = (style: DesignStyle) => {
    if (activeStyleId === style.id) {
      // If clicking the active style, deselect it
      onStyleSelected(null, null);
    } else {
      // Otherwise, select the new style
      onStyleSelected(style.promptSnippet, style.id);
    }
  };

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium mb-2">Design Styles for App Generation</h3>
      <div className="grid grid-cols-1 gap-2">
        {designStyles.map((style) => {
          const isActive = activeStyleId === style.id;
          return (
            <div key={style.id} className="flex items-start">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={isActive ? "default" : "outline"} 
                      size="sm" 
                      className={`text-left justify-between h-auto py-2 ${isActive ? "bg-primary text-primary-foreground" : ""}`}
                      onClick={() => handleStyleClick(style)}
                    >
                      <span className="font-medium">{style.name}</span>
                      {isActive && <Check size={16} className="ml-2" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" className="w-[300px] p-0">
                    <div className="overflow-hidden rounded-md">
                      <img 
                        src={style.exampleImageUrl} 
                        alt={`${style.name} example`}
                        className="w-full h-auto object-cover"
                      />
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <p className="text-xs text-gray-500 ml-3 mt-2 flex-1 text-left">{style.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
