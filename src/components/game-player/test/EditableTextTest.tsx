import React, { useState } from 'react';
import { GamePreview } from '../GamePreview';

// Sample game version for testing
const sampleVersion = {
  id: 'test-id',
  version_number: 1,
  code: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    
    h1, h2, h3 {
      color: #2563eb;
    }
    
    .hero {
      background-color: #f3f4f6;
      padding: 40px;
      border-radius: 8px;
      margin-bottom: 30px;
      text-align: center;
    }
    
    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .feature {
      background-color: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }
    
    .cta {
      background-color: #2563eb;
      color: white;
      text-align: center;
      padding: 40px;
      border-radius: 8px;
    }
    
    button {
      background-color: #2563eb;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      font-size: 16px;
      cursor: pointer;
      transition: background-color 0.3s;
    }
    
    button:hover {
      background-color: #1d4ed8;
    }
  </style>
</head>
<body>
  <div class="hero">
    <h1 class="editable">Welcome to Our Amazing Product</h1>
    <p class="editable">The best solution for your business needs. Try it today and see the difference!</p>
    <button>Get Started</button>
  </div>
  
  <div class="features">
    <div class="feature">
      <h2 class="editable">Easy to Use</h2>
      <p class="editable">Our intuitive interface makes it simple for anyone to get started without a steep learning curve.</p>
    </div>
    <div class="feature">
      <h2 class="editable">Powerful Features</h2>
      <p class="editable">Access a wide range of tools and capabilities designed to boost your productivity.</p>
    </div>
    <div class="feature">
      <h2 class="editable">Reliable Support</h2>
      <p class="editable">Our dedicated team is always ready to help you with any questions or issues.</p>
    </div>
  </div>
  
  <div class="cta">
    <h2 class="editable">Ready to Transform Your Business?</h2>
    <p class="editable">Join thousands of satisfied customers who have already made the switch.</p>
    <button>Start Free Trial</button>
  </div>
</body>
</html>
  `,
  instructions: null,
  created_at: new Date().toISOString()
};

export const EditableTextTest: React.FC = () => {
  const [currentVersion, setCurrentVersion] = useState(sampleVersion);
  
  const handleSaveCode = (updatedVersion: typeof sampleVersion) => {
    console.log('Saving updated version:', updatedVersion);
    setCurrentVersion(updatedVersion);
    return Promise.resolve();
  };
  
  return (
    <div className="w-full h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Editable Text Test</h1>
      <div className="w-full h-[calc(100vh-100px)] border border-gray-300 rounded-md overflow-hidden">
        <GamePreview
          currentVersion={currentVersion}
          showCode={false}
          isOwner={true}
          onSaveCode={handleSaveCode}
        />
      </div>
    </div>
  );
};

export default EditableTextTest;
