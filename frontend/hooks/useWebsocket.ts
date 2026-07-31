'use client';

import { useEffect, useRef, useCallback } from 'react';
import { API_BASE, WS_BASE } from '@/lib/api';
import { logger } from '@/lib/logger';

type WSMessage = { event: string; data: any };
type EventHandlers = { [event: string]: (data: any) => void };

export function useWebSocket(handlers: EventHandlers) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  const isMountedRef = useRef(true);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const connect = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      const res = await fetch(`${API_BASE}/ws-token`, {
        credentials: 'include',
        ...(API_BASE.includes('ngrok') && {
          headers: { 'ngrok-skip-browser-warning': 'true' },
        }),
      });

      if (!res.ok) {
        logger.warn('Failed to get WS token, status:', res.status);
        return;
      }

      const { data } = await res.json();
      const wsToken = data.token;

      const ws = new WebSocket(`${WS_BASE}/ws?token=${wsToken}`);
      wsRef.current = ws;

      ws.onopen = () => logger.log('🔌 WebSocket connected');

      ws.onmessage = (e) => {
        try {
          const msg: WSMessage = JSON.parse(e.data);
          handlersRef.current[msg.event]?.(msg.data);
        } catch (err) {
          logger.error('WebSocket parse error:', err);
        }
      };

      ws.onerror = () => {
        logger.warn('WebSocket error, closing...');
        ws.close();
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        logger.log('🔌 WebSocket disconnected, reconnecting in 5s...');
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      };
    } catch (err) {
      logger.error('WebSocket connection error:', err);
      if (!isMountedRef.current) return;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(connect, 5000);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);
}