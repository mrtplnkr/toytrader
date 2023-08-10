import { createContext, useContext } from 'react';

export interface User {
  userId: string,
  userName: string,
  photoUrl: string,
};

export const DashboardContext = createContext<User | undefined>(undefined);

export function useUserContext() {
  const user = useContext(DashboardContext);

  if (user === undefined) {
    throw new Error('useUserContext must be used with a DashboardContext');
  }

  return user;
}