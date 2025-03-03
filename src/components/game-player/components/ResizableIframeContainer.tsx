
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
  // Calculate initial position to be on the right side
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerBounds, setContainerBounds] = useState({ width: 0, height: 0 });
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
  
  const startPositionRef = useRef({ x: 0, y: 0 });
  const startSizeRef = useRef({ width: 0, height: 0 });
  const startCursorRef = useRef({ x: 0, y: 0 });

  // Get container dimensions and set initial position on mount
  useEffect(() => {
    const updateContainerBounds = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerBounds({ width: rect.width, height: rect.height });
        
        // Set initial position on the right side (centered)
        const rightSideWidth = rect.width * 0.75; // Right side is 75% of the container
        const leftBoundary = rect.width * 0.25; // Left boundary is at 25% of the container
        
        setPosition({
          x: leftBoundary + (rightSideWidth - initialWidth) / 2,
          y: (rect.height - initialHeight) / 2
        });
      }
    };

    updateContainerBounds();
    window.addEventListener('resize', updateContainerBounds);
    return () => window.removeEventListener('resize', updateContainerBounds);
  }, [initialWidth, initialHeight]);

  // Handle window resize
  useEffect(() => {
    const handleWindowResize = () => {
      if (isMaximized && containerRef.current) {
        const parentRect = containerRef.current.getBoundingClientRect();
        if (parentRect) {
          // When maximized, take up the right 75% of the container
          const leftBoundary = parentRect.width * 0.25;
          const maxWidth = parentRect.width * 0.75 - 40; // 40px padding
          
          setSize({ 
            width: maxWidth,
            height: parentRect.height - 40 
          });
          setPosition({ x: leftBoundary + 20, y: 20 });
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
    
    // Calculate the left boundary (25% of container width)
    const leftBoundary = containerBounds.width * 0.25;
    
    if (isDragging) {
      const deltaX = e.clientX - startCursorRef.current.x;
      const deltaY = e.clientY - startCursorRef.current.y;
      
      let newX = startPositionRef.current.x + deltaX;
      let newY = startPositionRef.current.y + deltaY;
      
      // Enforce boundaries
      // Left boundary - restrict to right 75% of the container
      newX = Math.max(newX, leftBoundary);
      
      // Right boundary
      newX = Math.min(newX, containerBounds.width - size.width);
      
      // Top boundary
      newY = Math.max(newY, 0);
      
      // Bottom boundary
      newY = Math.min(newY, containerBounds.height - size.height);
      
      setPosition({ x: newX, y: newY });
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
        
        // Enforce left boundary when resizing from the left
        if (newX < leftBoundary) {
          newX = leftBoundary;
          newWidth = startSizeRef.current.width + (startPositionRef.current.x - leftBoundary);
        }
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
      
      // Enforce right boundary
      if (newX + newWidth > containerBounds.width) {
        newWidth = containerBounds.width - newX;
      }
      
      // Enforce bottom boundary
      if (newY + newHeight > containerBounds.height) {
        newHeight = containerBounds.height - newY;
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
        const parentRect = containerRef.current.getBoundingClientRect();
        if (parentRect) {
          // Calculate the left boundary and max width
          const leftBoundary = parentRect.width * 0.25;
          const maxWidth = parentRect.width * 0.75 - 40; // 40px padding
          
          setSize({ 
            width: maxWidth,
            height: parentRect.height - 40 
          });
          setPosition({ x: leftBoundary + 20, y: 20 });
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
      {/* Visual indicator for the right side area */}
      <div 
        className="absolute top-0 bottom-0 bg-gray-100 border-r border-gray-200"
        style={{ 
          left: 0, 
          width: `${containerBounds.width * 0.25}px`,
          pointerEvents: 'none'  // Make this div non-interactive
        }}
      />
      
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
