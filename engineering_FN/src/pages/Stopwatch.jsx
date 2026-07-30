import { useState, useRef, useEffect } from "react";
import { Select } from "@chakra-ui/react";
import Header from "../components/header";
import { client, subscribe } from '../features/mqttClient';

const Stopwatch = () => {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isTen, setTen] = useState();
  const intervalRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [counter, setCounter] = useState(0);

  const formatTime = (milliseconds) => {
    const totalMilliseconds = Math.floor(milliseconds);
    const totalSeconds = Math.floor(totalMilliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const millis = totalMilliseconds % 1000;
    return `${minutes.toString().padStart(2, "0")}.${seconds
      .toString()
      .padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
  };

  const startStopwatch = () => {
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setTime((prevTime) => prevTime + 10);
    }, 10);
  };

  const selectMinuits = (e) => {
    setTen(e.target.value);
  };

  const items = [
    { id: 1, name: "Item 1" },
    { id: 2, name: "Item 2" },
    { id: 3, name: "Item 3" }
  ];

  useEffect(() => {
    if (isTen == 20) {
      if (time >= 1000 && time < 1020000) {
        document.body.style.backgroundColor = "green";
      } else if (time >= 1020000 && time < 1200000) {
        document.body.style.backgroundColor = "yellow";
      } else if (time >= 1200000) {
        document.body.style.backgroundColor = "red";
      }
    } else if (isTen == 10) {
      if (time >= 1000 && time < 420000) {
        document.body.style.backgroundColor = "green";
      } else if (time >= 420000 && time < 600000) {
        document.body.style.backgroundColor = "yellow";
      } else if (time >= 600000) {
        document.body.style.backgroundColor = "red";
      }
    } else if (isTen == 15) {
      if (time >= 1000 && time < 720000) {
        document.body.style.backgroundColor = "green";
      } else if (time >= 720000 && time < 900000) {
        document.body.style.backgroundColor = "yellow";
      } else if (time >= 900000) {
        document.body.style.backgroundColor = "red";
      }
    }
  }, [time]);

  useEffect(() => {
    if (time == 0) {
      document.body.style.backgroundColor = "white";
    }
  }, [time]);

//   useEffect(() => {
//     // Subscribe to an MQTT topic
//     const topic = 'my/test/topic';
//     subscribe(topic);

//     // Listen for incoming messages
//     client.on('message', (topic, message) => {
//         setMessages((prevMessages) => [
//             ...prevMessages,
//             { topic, message: message.toString() },
//         ]);
//     });

//     // Cleanup on unmount
//     return () => {
//         client.end(); // Close MQTT connection
//     };
// }, []);

useEffect(() => {
  const topic = 'my/test/topic'; // Ganti dengan topik yang sesuai
  
  // Subscribe ke topik tertentu
  client.subscribe(topic, (err) => {
      if (err) {
          console.error('Failed to subscribe to topic:', topic);
      } else {
          console.log(`Subscribed to topic: ${topic}`);
      }
  });

  // Mendengarkan pesan masuk
  client.on('message', (topic, message) => {
      console.log(`Received message on topic ${topic}:`, message.toString());
      setMessages((prevMessages) => [
          ...prevMessages,
          { topic, message: message.toString() },
      ]);
  });

  // Membersihkan koneksi saat komponen unmount
  return () => {
      client.end(); // Menutup koneksi MQTT
  };
}, []);


  const pauseStopwatch = () => {
    setIsRunning(false);
    clearInterval(intervalRef.current);
  };

  const resetStopwatch = () => {
    setIsRunning(false);
    clearInterval(intervalRef.current);
    setTime(0);
  };

  return (
  <div>
    <Header />
    <h1 className="text-9xl text-text font-bold">{formatTime(time)}</h1>
    <div className="space-x-4">
        {!isRunning ? (
          <button
          className="bg-cta hover:bg-ctactive text-text px-8 py-4 rounded"
          onClick={startStopwatch}
          >
            Start
          </button>
        ) : (
          <button
          className="bg-red-500 hover:bg-red-600 text-text px-8 py-4 rounded"
          onClick={pauseStopwatch}
          >
            Pause
          </button>
        )}
        <button
          className="bg-blue-500 hover:bg-blue-600 text-text px-8 py-4 rounded"
          onClick={resetStopwatch}
          >
          Reset
        </button>
        <button>
          <Select placeholder="Select Min" className="text-text" onChange={selectMinuits}>
            <option value={10}>10 Menit</option>
            <option value={15}>15 Menit</option>
            <option value={20}>20 Menit</option>
          </Select>
        </button>
    </div>
    <div>
      <h1>MQTT Data</h1>
        <ul>
          {messages.map((msg, index) => (
            <li key={index}>
                <strong>Topic:</strong> {msg.topic} <br />
                <strong>Message:</strong> {msg.message}
            </li>
          ))}
        </ul>
    </div>
    <br />
    <div>
      {items.map((item) => (
        <div key={Math.random()}>
          <button onClick={() => setCounter(counter + 1)}>Increment</button>
          <p>{counter}</p>
          <p>{item.name}</p>
        </div>
      ))}
    </div>

  </div>
  );
};

export default Stopwatch;
