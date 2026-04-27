import { useEffect, useState } from "react";

function App() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/hello")
      .then(res => res.json())
      .then(data => setMessage(data.message));
  }, []);
  return <p className="font-semibold p-4 text-lg text-center">{message}</p>;
}
export default App;
