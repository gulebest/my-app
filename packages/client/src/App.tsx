import { useEffect, useState } from "react";
import { Button } from "./components/ui/button";

function App() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/hello")
      .then(res => res.json())
      .then(data => setMessage(data.message));
  }, []);
  return (
    <div className="p-4">
      <p className="font-semibold text-lg text-center">{message}</p>
      <Button>click me</Button>
    </div>
  );
}
export default App;
