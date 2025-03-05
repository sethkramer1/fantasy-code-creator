import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/game-creator/Header";
import { GenerationForm } from "@/components/game-creator/GenerationForm";
import { useAuth } from "@/context/AuthContext";
import { ModelType } from "@/types/generation";
import { LoginModal } from "@/components/auth/LoginModal";

// Constants for localStorage keys
const SAVED_PROMPT_KEY = "savedPrompt";
const SAVED_GAME_TYPE_KEY = "savedGameType";
const SAVED_IMAGE_URL_KEY = "savedImageUrl";

interface GenerationPanelProps {
  loading: boolean;
  showTerminal: boolean;
  setShowTerminal: (show: boolean) => void;
  terminalOutput: string[];
}

export function GenerationPanel({ 
  loading, 
  showTerminal, 
  setShowTerminal, 
  terminalOutput 
}: GenerationPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [gameType, setGameType] = useState<string>("webdesign");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [visibility, setVisibility] = useState<string>("public");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const modelType: ModelType = "smart";
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Check for saved prompt data when component mounts or user changes
  useEffect(() => {
    // Only load saved prompt if user is logged in and there's a saved prompt
    if (user) {
      const savedPrompt = localStorage.getItem(SAVED_PROMPT_KEY);
      const savedGameType = localStorage.getItem(SAVED_GAME_TYPE_KEY);
      const savedImageUrl = localStorage.getItem(SAVED_IMAGE_URL_KEY);
      
      if (savedPrompt) {
        setPrompt(savedPrompt);
        // Clear the saved prompt after loading it
        localStorage.removeItem(SAVED_PROMPT_KEY);
      }
      
      if (savedGameType) {
        setGameType(savedGameType);
        localStorage.removeItem(SAVED_GAME_TYPE_KEY);
      }
      
      if (savedImageUrl) {
        setImageUrl(savedImageUrl);
        localStorage.removeItem(SAVED_IMAGE_URL_KEY);
      }
    }
  }, [user]);

  const handleImageUploaded = (url: string) => {
    setImageUrl(url);
  };

  const handleImageRemoved = () => {
    setImageUrl("");
  };

  const handleGenerate = async () => {
    try {
      if (!prompt.trim()) {
        toast({
          title: "Please enter a description",
          variant: "destructive",
        });
        return;
      }

      if (!gameType) {
        toast({
          title: "Please select a content type",
          description: "Choose what you want to create before proceeding",
          variant: "destructive",
        });
        return;
      }

      // If user is not logged in, save the prompt data and show login modal
      if (!user) {
        // Save current prompt data to localStorage
        localStorage.setItem(SAVED_PROMPT_KEY, prompt);
        localStorage.setItem(SAVED_GAME_TYPE_KEY, gameType);
        if (imageUrl) {
          localStorage.setItem(SAVED_IMAGE_URL_KEY, imageUrl);
        }
        
        // Show login modal
        setShowLoginModal(true);
        return;
      }

      console.log("Generating with prompt:", prompt);
      console.log("Using model type:", modelType);

      const { data: placeholderGame, error: placeholderError } = await supabase
        .from('games')
        .insert([{ 
          prompt: prompt,
          code: "Generating...",
          instructions: "Content is being generated...",
          current_version: 1,
          type: gameType,
          model_type: modelType,
          user_id: user?.id || null,
          visibility: visibility
        }])
        .select()
        .single();

      if (placeholderError) {
        console.error("Error creating placeholder game:", placeholderError);
        toast({
          title: "Error starting generation",
          description: placeholderError.message,
          variant: "destructive",
        });
        return;
      }

      const { error: versionError } = await supabase
        .from('game_versions')
        .insert([{
          game_id: placeholderGame.id,
          code: "Generating...",
          instructions: "Content is being generated...",
          version_number: 1
        }]);

      if (versionError) {
        console.error("Error creating placeholder version:", versionError);
      }
      
      const { error: messageError } = await supabase
        .from('game_messages')
        .insert([{
          game_id: placeholderGame.id,
          message: prompt,
          response: "Initial generation in progress...",
          model_type: modelType,
          image_url: imageUrl || null
        }]);
      
      if (messageError) {
        console.error("Error creating initial game_message:", messageError);
        // Non-fatal error, continue with generation
      } else {
        console.log("Created initial game_message for prompt");
      }
      
      let navigationParams = `?generating=true&type=${gameType}&modelType=${modelType}`;
      
      if (imageUrl) {
        const encodedImageUrl = encodeURIComponent(imageUrl);
        navigationParams += `&imageUrl=${encodedImageUrl}`;
      }
      
      navigationParams += `&prompt=${encodeURIComponent(prompt)}`;
      
      console.log("Navigating with prompt:", prompt);
      console.log("Encoded prompt in URL:", encodeURIComponent(prompt));
      
      navigate(`/play/${placeholderGame.id}${navigationParams}`);
      
      toast({
        title: "Starting generation",
        description: "Your content is being created...",
      });
      
    } catch (error) {
      console.error("Error in handleGenerate:", error);
      toast({
        title: "Error starting generation",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
      <div className="space-y-10">
        <Header 
          title="What would you like to mock up?"
          description="Describe what you want to create and watch it come to life"
        />

        <GenerationForm
          gameType={gameType}
          setGameType={setGameType}
          prompt={prompt}
          setPrompt={setPrompt}
          onGenerate={handleGenerate}
          loading={loading}
          showTerminalOutput={() => setShowTerminal(true)}
          hasTerminalOutput={!showTerminal && terminalOutput.length > 0}
          imageUrl={imageUrl}
          onImageUploaded={handleImageUploaded}
          onImageRemoved={handleImageRemoved}
          modelType={modelType}
          showModelPreference={false}
          visibility={visibility}
          setVisibility={setVisibility}
        />
      </div>

      {/* Login Modal */}
      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
      />
    </div>
  );
}
