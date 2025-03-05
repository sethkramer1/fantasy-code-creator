import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";
import { cn } from "@/lib/utils";
import React from "react";
import { Loader2 } from "lucide-react";

// Custom DialogContent without the close button
const CustomDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
CustomDialogContent.displayName = "CustomDialogContent";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    // Simply navigate to the auth page
    navigate("/auth");
    onClose();
  };

  const handleSignIn = async () => {
    // Simply navigate to the auth page
    navigate("/auth");
    onClose();
  };

  const handleSignUp = async () => {
    // Simply navigate to the auth page
    navigate("/auth");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <CustomDialogContent className="sm:max-w-md bg-black text-white border-none p-0 gap-0 rounded-lg overflow-hidden">
        <button 
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full bg-transparent hover:bg-gray-800 p-1.5 text-white opacity-80 hover:opacity-100 transition-all focus:outline-none focus:ring-0 z-10"
          type="button"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>
        
        <div className="flex flex-col items-center justify-center p-10 pt-16 pb-16">
          <p className="text-2xl text-center text-white mb-12 font-normal">
            Create a free account or sign in to start generating
          </p>
          
          <div className="w-full space-y-5">
            <button 
              onClick={handleSignIn}
              className="w-full py-4 bg-white text-black rounded-md hover:bg-gray-100 font-medium text-lg"
              disabled={loading}
            >
              Sign In
            </button>
            
            <button 
              onClick={handleSignUp}
              className="w-full py-4 bg-transparent text-white border border-white rounded-md hover:bg-gray-900 font-medium text-lg"
              disabled={loading}
            >
              Sign up for free
            </button>
          </div>
        </div>
      </CustomDialogContent>
    </Dialog>
  );
} 