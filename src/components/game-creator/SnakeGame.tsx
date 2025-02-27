
import React, { useState, useEffect, useRef, useCallback } from 'react';

// Game constants
const GRID_SIZE = 20;
const INITIAL_SNAKE = [
  { x: 8, y: 10 },
  { x: 7, y: 10 },
  { x: 6, y: 10 }
];
const INITIAL_DIRECTION = 'RIGHT';
const INITIAL_FOOD = { x: 15, y: 10 };
const GAME_SPEED = 60; // Slowed down from 100 to 180 milliseconds between moves
const CANVAS_SIZE = 360; // Increased from 300 to 360
const CELL_SIZE = CANVAS_SIZE / GRID_SIZE;

interface Point {
  x: number;
  y: number;
}

interface GameState {
  snake: Point[];
  food: Point;
  direction: string;
  gameOver: boolean;
  paused: boolean;
  score: number;
}

export function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>({
    snake: INITIAL_SNAKE,
    food: INITIAL_FOOD,
    direction: INITIAL_DIRECTION,
    gameOver: false,
    paused: false,
    score: 0
  });
  const gameLoopRef = useRef<number | null>(null);

  // Generate random food position
  const generateFood = useCallback((): Point => {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    return { x, y };
  }, []);

  // Reset game to initial state
  const resetGame = useCallback(() => {
    setGameState({
      snake: INITIAL_SNAKE,
      food: generateFood(),
      direction: INITIAL_DIRECTION,
      gameOver: false,
      paused: false,
      score: 0
    });
  }, [generateFood]);

  // Toggle pause state
  const togglePause = useCallback(() => {
    setGameState(prev => ({ ...prev, paused: !prev.paused }));
  }, []);

  // Handle keyboard input
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Prevent arrow keys from scrolling the page
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }

    // Handle game control keys
    switch (e.key) {
      case 'ArrowUp':
        if (gameState.direction !== 'DOWN') {
          setGameState(prev => ({ ...prev, direction: 'UP' }));
        }
        break;
      case 'ArrowDown':
        if (gameState.direction !== 'UP') {
          setGameState(prev => ({ ...prev, direction: 'DOWN' }));
        }
        break;
      case 'ArrowLeft':
        if (gameState.direction !== 'RIGHT') {
          setGameState(prev => ({ ...prev, direction: 'LEFT' }));
        }
        break;
      case 'ArrowRight':
        if (gameState.direction !== 'LEFT') {
          setGameState(prev => ({ ...prev, direction: 'RIGHT' }));
        }
        break;
      case ' ':
        if (gameState.gameOver) {
          resetGame();
        } else {
          togglePause();
        }
        break;
      default:
        break;
    }
  }, [gameState.direction, gameState.gameOver, resetGame, togglePause]);

  // Set up event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Draw the game
  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }

    // Draw food
    ctx.fillStyle = '#ff6b6b'; // Red food
    ctx.fillRect(
      gameState.food.x * CELL_SIZE,
      gameState.food.y * CELL_SIZE,
      CELL_SIZE,
      CELL_SIZE
    );
    
    // Draw snake
    gameState.snake.forEach((segment, index) => {
      // Head is slightly different color than body
      ctx.fillStyle = index === 0 ? '#4dabf7' : '#339af0';
      ctx.fillRect(
        segment.x * CELL_SIZE,
        segment.y * CELL_SIZE,
        CELL_SIZE,
        CELL_SIZE
      );
      
      // Add a border to segments
      ctx.strokeStyle = '#1c7ed6';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        segment.x * CELL_SIZE,
        segment.y * CELL_SIZE,
        CELL_SIZE,
        CELL_SIZE
      );
    });

    // If game over, show message
    if (gameState.gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      
      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over!', CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 15);
      ctx.fillText(`Score: ${gameState.score}`, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 15);
      ctx.fillText('Press SPACE to restart', CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 45);
    }
    
    // If paused, show message
    if (gameState.paused && !gameState.gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      
      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Paused', CANVAS_SIZE / 2, CANVAS_SIZE / 2);
      ctx.fillText('Press SPACE to continue', CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 30);
    }
  }, [gameState]);

  // Game loop
  useEffect(() => {
    if (gameState.gameOver || gameState.paused) {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      drawGame();
      return;
    }

    let lastTime = 0;
    const gameLoop = (timestamp: number) => {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
      
      // Update game state at the specified game speed
      if (timestamp - lastTime >= GAME_SPEED) {
        lastTime = timestamp;
        
        // Move snake
        setGameState(prevState => {
          const newSnake = [...prevState.snake];
          const head = { ...newSnake[0] };
          
          // Update head position based on direction
          switch (prevState.direction) {
            case 'UP':
              head.y -= 1;
              break;
            case 'DOWN':
              head.y += 1;
              break;
            case 'LEFT':
              head.x -= 1;
              break;
            case 'RIGHT':
              head.x += 1;
              break;
          }
          
          // Check for collisions with walls
          if (
            head.x < 0 || 
            head.x >= GRID_SIZE || 
            head.y < 0 || 
            head.y >= GRID_SIZE
          ) {
            return { ...prevState, gameOver: true };
          }
          
          // Check for collisions with self
          for (let i = 0; i < newSnake.length; i++) {
            if (head.x === newSnake[i].x && head.y === newSnake[i].y) {
              return { ...prevState, gameOver: true };
            }
          }
          
          // Add new head
          newSnake.unshift(head);
          
          let newFood = prevState.food;
          let newScore = prevState.score;
          
          // Check if snake ate food
          if (head.x === prevState.food.x && head.y === prevState.food.y) {
            // Generate new food
            newFood = generateFood();
            // Increase score
            newScore += 10;
          } else {
            // Remove tail if no food was eaten
            newSnake.pop();
          }
          
          return {
            ...prevState,
            snake: newSnake,
            food: newFood,
            score: newScore
          };
        });
      }
      
      // Draw the game on each frame
      drawGame();
    };
    
    gameLoopRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState.gameOver, gameState.paused, drawGame, generateFood]);

  // Game controls for mobile/touch
  const handleControlClick = (direction: string) => {
    if (gameState.gameOver) {
      resetGame();
      return;
    }
    
    if (
      (direction === 'UP' && gameState.direction !== 'DOWN') ||
      (direction === 'DOWN' && gameState.direction !== 'UP') ||
      (direction === 'LEFT' && gameState.direction !== 'RIGHT') ||
      (direction === 'RIGHT' && gameState.direction !== 'LEFT')
    ) {
      setGameState(prev => ({ ...prev, direction }));
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <h3 className="text-lg font-medium text-gray-800">Snake Game</h3>
      <p className="text-sm text-gray-500 mb-2">Play while you wait!</p>
      
      <div className="relative">
        <canvas 
          ref={canvasRef} 
          width={CANVAS_SIZE} 
          height={CANVAS_SIZE}
          className="border border-gray-200 rounded-lg shadow-sm"
        />
      </div>
      
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <div className="flex justify-between items-center">
          <div className="text-sm font-medium">Score: {gameState.score}</div>
          <button
            onClick={gameState.gameOver ? resetGame : togglePause}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            {gameState.gameOver ? 'Restart' : (gameState.paused ? 'Resume' : 'Pause')}
          </button>
        </div>
        
        {/* Mobile controls */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <div className="col-start-2">
            <button
              onClick={() => handleControlClick('UP')}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex justify-center items-center"
              aria-label="Move Up"
            >
              ↑
            </button>
          </div>
          <div className="col-start-1">
            <button
              onClick={() => handleControlClick('LEFT')}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex justify-center items-center"
              aria-label="Move Left"
            >
              ←
            </button>
          </div>
          <div className="col-start-2">
            <button
              onClick={() => handleControlClick('DOWN')}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex justify-center items-center"
              aria-label="Move Down"
            >
              ↓
            </button>
          </div>
          <div className="col-start-3">
            <button
              onClick={() => handleControlClick('RIGHT')}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex justify-center items-center"
              aria-label="Move Right"
            >
              →
            </button>
          </div>
        </div>
        
        <div className="text-xs text-gray-500 mt-2 text-center">
          Use arrow keys to move, space to pause/resume
        </div>
      </div>
    </div>
  );
}
