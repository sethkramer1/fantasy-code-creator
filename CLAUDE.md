# Development Commands
- Development server: `npm run dev`
- Build project: `npm run build`
- Development build: `npm run build:dev` 
- Lint code: `npm run lint`
- Preview build: `npm run preview`

# Code Style Guidelines
- **Component Structure**: Use functional components with React hooks
- **Type Safety**: Utilize TypeScript for type definitions
- **Styling**: Use Tailwind CSS for styling components
- **UI Components**: Use shadcn/ui component library
- **Import Syntax**: Use path aliasing with "@/*" for src directory imports
- **Error Handling**: Wrap components with ErrorBoundary where appropriate
- **State Management**: Use React context for global state (AuthContext)
- **Naming Conventions**:
  - Components: PascalCase (e.g., GameCard)
  - Hooks: camelCase with "use" prefix (e.g., useGames)
  - Utilities: camelCase (e.g., promptBuilder)
- **File Organization**: Group related components in directories by feature
- **Component Props**: Define explicit interfaces for component props