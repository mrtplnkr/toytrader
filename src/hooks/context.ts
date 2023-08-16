import { createContext, useContext, useState } from 'react';

export interface User {
  userId?: string,
  userName: string | undefined | null,
  photoUrl: string | undefined | null,
};

export interface Offer {
  itemId: string,
  itemOffered: string,
}

export const DashboardContext = createContext<User | undefined>(undefined);

export function useUserContext() {
  const user = useContext(DashboardContext);
  const [itemOffers, setItemOffers] = useState<Offer[]>([]);

  if (!user) {
    throw new Error('useUserContext must be used with a DashboardContext');
  }

  return {user, setItemOffers};
}