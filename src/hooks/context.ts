import { createContext, useContext } from 'react';

export interface User {
  userId?: string,
  userName: string | undefined | null,
  photoUrl: string | undefined | null,
};

export const DashboardContext = createContext<User | undefined>(undefined);

export function useUserContext() {
  const user = useContext(DashboardContext);

  if (!user) {
    throw new Error('useUserContext must be used with a DashboardContext');
  }

  return user;
}