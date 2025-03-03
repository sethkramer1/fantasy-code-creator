import {
  createBrowserRouter,
  RouterProvider,
  Route,
  createRoutesFromElements,
} from "react-router-dom";
import Index from "./pages/Index";
import Play from "./pages/Play";
import NotFound from "./pages/NotFound";
import NetlifyCallback from "@/pages/NetlifyCallback";

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/" element={<Index />} />
      <Route path="/play/:gameId" element={<Play />} />
      <Route path="/netlify-callback" element={<NetlifyCallback />} />
      <Route path="*" element={<NotFound />} />
    </>
  )
);

function App() {
  return (
    <RouterProvider router={router} />
  );
}

export default App;
