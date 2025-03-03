
import React, { useState, useRef, ReactNode, useEffect } from "react";
import { MoveIcon, MinimizeIcon, MaximizeIcon } from "lucide-react";

interface ResizableIframeContainerProps {
  children: ReactNode;
  initialWidth?: number;
  initialHeight?: number;
  onResize?: (width: number, height: number) => void;
}

export const ResizableIframeContainer: React.FC<ResizableIframeContainerProps> = ({
  children,
  initialWidth = 800,
  initialHeight = 600,
  onResize
}) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [previousState, setPreviousState] = useState<{ 
    position: { x: number, y: number }, 
    size: { width: number, height: number } 
  } | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startPositionRef = useRef({ x: 0, y: 0 });
  const startSizeRef = useRef({ width: 0, height: 0 });
  const startCursorRef = useRef({ x: 0, y: 0 });

  // Handle window resize
  useEffect(() => {
    const handleWindowResize = () => {
      if (isMaximized && containerRef.current) {
        const parentRect = containerRef.current.parentElement?.getBoundingClientRect();
        if (parentRect) {
          setSize({ 
            width: parentRect.width - 40, // Accounting for padding
            height: parentRect.height - 40 
          });
          setPosition({ x: 20, y: 20 });
        }
      }
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [isMaximized]);

  // Notify parent of resize
  useEffect(() => {
    if (onResize) {
      onResize(size.width, size.height);
    }
  }, [size, onResize]);

  const handleMouseDown = (e: React.MouseEvent, action: 'drag' | 'resize', direction?: string) => {
    e.preventDefault();
    
    if (action === 'drag') {
      setIsDragging(true);
      startPositionRef.current = { ...position };
      startCursorRef.current = { x: e.clientX, y: e.clientY };
    } else if (action === 'resize' && direction) {
      setIsResizing(true);
      setResizeDirection(direction);
      startSizeRef.current = { ...size };
      startPositionRef.current = { ...position };
      startCursorRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging && !isResizing) return;
    
    if (isDragging) {
      const deltaX = e.clientX - startCursorRef.current.x;
      const deltaY = e.clientY - startCursorRef.current.y;
      
      setPosition({
        x: startPositionRef.current.x + deltaX,
        y: startPositionRef.current.y + deltaY
      });
    } else if (isResizing && resizeDirection) {
      const deltaX = e.clientX - startCursorRef.current.x;
      const deltaY = e.clientY - startCursorRef.current.y;
      
      // Calculate new size and position based on resize direction
      let newWidth = size.width;
      let newHeight = size.height;
      let newX = position.x;
      let newY = position.y;
      
      if (resizeDirection.includes('e')) {
        newWidth = startSizeRef.current.width + deltaX;
      } else if (resizeDirection.includes('w')) {
        newWidth = startSizeRef.current.width - deltaX;
        newX = startPositionRef.current.x + deltaX;
      }
      
      if (resizeDirection.includes('s')) {
        newHeight = startSizeRef.current.height + deltaY;
      } else if (resizeDirection.includes('n')) {
        newHeight = startSizeRef.current.height - deltaY;
        newY = startPositionRef.current.y + deltaY;
      }
      
      // Enforce minimum size
      const minWidth = 320;
      const minHeight = 240;
      
      if (newWidth < minWidth) {
        newWidth = minWidth;
        if (resizeDirection.includes('w')) {
          newX = startPositionRef.current.x + (startSizeRef.current.width - minWidth);
        }
      }
      
      if (newHeight < minHeight) {
        newHeight = minHeight;
        if (resizeDirection.includes('n')) {
          newY = startPositionRef.current.y + (startSizeRef.current.height - minHeight);
        }
      }
      
      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeDirection(null);
  };

  const toggleMaximize = () => {
    if (!isMaximized) {
      // Save current state before maximizing
      setPreviousState({ position, size });
      
      // Get parent size for maximizing
      if (containerRef.current) {
        const parentRect = containerRef.current.parentElement?.getBoundingClientRect();
        if (parentRect) {
          setSize({ 
            width: parentRect.width - 40, // Accounting for padding
            height: parentRect.height - 40 
          });
          setPosition({ x: 20, y: 20 });
        }
      }
      
      setIsMaximized(true);
    } else {
      // Restore previous state
      if (previousState) {
        setPosition(previousState.position);
        setSize(previousState.size);
      }
      
      setIsMaximized(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="absolute bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200"
        style={{
          width: `${size.width}px`,
          height: `${size.height}px`,
          transform: `translate(${position.x}px, ${position.y}px)`,
          transition: 'box-shadow 0.2s ease',
        }}
      >
        {/* Header / Drag Handle */}
        <div 
          className="flex items-center px-3 py-2 bg-gray-100 border-b border-gray-200 cursor-move"
          onMouseDown={(e) => handleMouseDown(e, 'drag')}
        >
          <MoveIcon size={16} className="mr-2 text-gray-600" />
          <span className="text-sm font-medium text-gray-700 flex-1">Game Preview</span>
          <button 
            className="p-1 hover:bg-gray-200 rounded-md focus:outline-none focus-ring"
            onClick={toggleMaximize}
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <MinimizeIcon size={16} /> : <MaximizeIcon size={16} />}
          </button>
        </div>
        
        {/* Content */}
        <div className="absolute inset-0 top-[38px]">
          {children}
        </div>
        
        {/* Resize Handles */}
        {!isMaximized && (
          <>
            <div 
              className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10" 
              onMouseDown={(e) => handleMouseDown(e, 'resize', 'nw')}
            />
            <div 
              className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-10" 
              onMouseDown={(e) => handleMouseDown(e, 'resize', 'ne')}
            />
            <div 
              className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-10" 
              onMouseDown={(e) => handleMouseDown(e, 'resize', 'sw')}
            />
            <div 
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10" 
              onMouseDown={(e) => handleMouseDown(e, 'resize', 'se')}
            />
            <div 
              className="absolute top-0 left-4 right-4 h-2 cursor-n-resize z-10" 
              onMouseDown={(e) => handleMouseDown(e, 'resize', 'n')}
            />
            <div 
              className="absolute bottom-0 left-4 right-4 h-2 cursor-s-resize z-10" 
              onMouseDown={(e) => handleMouseDown(e, 'resize', 's')}
            />
            <div 
              className="absolute left-0 top-4 bottom-4 w-2 cursor-w-resize z-10" 
              onMouseDown={(e) => handleMouseDown(e, 'resize', 'w')}
            />
            <div 
              className="absolute right-0 top-4 bottom-4 w-2 cursor-e-resize z-10" 
              onMouseDown={(e) => handleMouseDown(e, 'resize', 'e')}
            />
          </>
        )}
      </div>
    </div>
  );
};
