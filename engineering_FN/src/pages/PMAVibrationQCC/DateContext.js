import React, { createContext, useState } from 'react';

export const DateContext = createContext();

export const DateProvider = ({ children }) => {
  const [dates, setDates] = useState({ 
    start: '2026-07-13T00:00', 
    finish: '2026-07-14T23:59' 
  });

  return (
    <DateContext.Provider value={{ dates, setDates }}>
      {children}
    </DateContext.Provider>
  );
};