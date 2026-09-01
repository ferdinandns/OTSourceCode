import { useEffect, useState } from 'react';

interface RS232Data {
  timestamp: number;
  value: string;
  source: string;
  port: string;
}

export function useRS232WebSocket() {
  const [data, setData] = useState<RS232Data[]>([]);
  const [lastValue, setLastValue] = useState<RS232Data | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect ke WebSocket backend
    const ws = new WebSocket('ws://localhost:8080/ws/rs232');
    
    ws.onopen = () => {
      console.log('✅ Connected to RS-232 WebSocket');
      setIsConnected(true);
    };
    
    ws.onmessage = (event) => {
      const newData: RS232Data = JSON.parse(event.data);
      console.log('📊 Received RS-232 data:', newData);
      
      setLastValue(newData);
      setData(prev => [...prev, newData].slice(-100)); // Keep last 100
    };
    
    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setIsConnected(false);
    };
    
    ws.onclose = () => {
      console.log('❌ WebSocket disconnected');
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  return { data, lastValue, isConnected };
}