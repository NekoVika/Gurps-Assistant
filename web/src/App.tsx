import { MainWorkspace } from "./components/MainWorkspace";
import { ToastProvider } from "./context/ToastContext";

export function App() {
  return (
    <ToastProvider>
      <MainWorkspace />
    </ToastProvider>
  );
}
