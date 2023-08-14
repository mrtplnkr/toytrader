import { createContext, useContext } from 'react';
import { auth } from '../firebase-config';

export interface User {
  userId?: string,
  userName: string,
  photoUrl?: string,
};

export const DashboardContext = createContext<User | undefined>(undefined);

export function useUserContext() {
  const user = useContext(DashboardContext);

  if (!auth) {
    throw new Error('useUserContext must be used with a DashboardContext');
  } else {
    //set user?
  }

  return user;
}