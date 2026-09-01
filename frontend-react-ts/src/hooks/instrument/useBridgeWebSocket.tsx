import { useEffect, useState } from 'react';

interface BridgeData {
  pc_id: string;
  location: string;
  instrument_id: number;
  instrument_name: string;
  timestamp: string;
  value: string;
  hostname: string;
}

export function useBridgeWebSocket() {
  const [data, setData] = useState<BridgeData[]>([]);
  const [lastValue, setLastValue] = useState<BridgeData | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080/ws/bridge');
    
    ws.onopen = () => {
      console.log('✅ Connected to Bridge WebSocket');
      setIsConnected(true);
    };
    
    ws.onmessage = (event) => {
      const newData: BridgeData = JSON.parse(event.data);
      console.log('📊 Bridge data:', newData);
      
      setLastValue(newData);
      setData(prev => [...prev, newData].slice(-100));
    };
    
    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setIsConnected(false);
    };
    
    ws.onclose = () => {
      console.log('❌ WebSocket closed');
      setIsConnected(false);
    };

    return () => ws.close();
  }, []);

  return { data, lastValue, isConnected };
}
