'use client';

import { createContext, useContext } from 'react';

interface UserContextType {
  roles: string[];
  isSupervisor: boolean;
}

export const UserContext = createContext<UserContextType>({
  roles: [],
  isSupervisor: false,
});

export const useUser = () => useContext(UserContext);