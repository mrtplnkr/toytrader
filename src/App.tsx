import PublicPage from "./pages/public";
import LoginPage from "./pages/login";
import ListPage from "./pages/list";
import 'react-notifications-component/dist/theme.css';
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
  Navigate,
  Outlet,
} from "react-router-dom";
import './App.css';
import Auth from './components/auth';
import AddNew from "./pages/addNewToy";
import ProfilePage from "./pages/profile";
import { auth } from "./firebase-config";
import MyToysPage from "./pages/myToys";
import { ReactNotifications } from "react-notifications-component";
import { useCallback, useEffect, useRef, useState } from "react";
import { Toy } from "./types/toy";
import { Offer } from "./types/offer";
import { GoodAppContext } from "./hooks/context";
import { getOfferList, getToyList, logOff } from "./hooks/helper";
import { diffAndNotifyShipmentStatus } from "./hooks/shipmentNotifications";
import HistoryPage from "./pages/inPost";
import MyOffersPage from "./pages/myOffers";
import ShipmentResultPage from "./pages/shipmentResult";
import { User } from "firebase/auth";

function StateProvider({children}: any) {
  const [toys, setToys] = useState<Toy[]>([])
  const [offers, setOffers] = useState<Offer[]>([]);
  const prevOffersRef = useRef<Offer[]>([]);

  const signOut = async () => {
    await logOff();
    setOffers([]);
  };

  const getData = useCallback(async() => {
    // Guard against running while signed out - the 60s interval and the
    // window "focus" listener below both fire unconditionally, and an
    // OAuth popup opening/closing (e.g. Facebook sign-in) triggers focus
    // events on this window multiple times before auth.currentUser is set,
    // which was hammering Firestore with doomed, erroring calls during the
    // exact window the sign-in popup is trying to complete.
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setToys(await getToyList());
    const newOffers = await getOfferList(uid);
    if (prevOffersRef.current.length > 0) {
      diffAndNotifyShipmentStatus(uid, prevOffersRef.current, newOffers);
    }
    prevOffersRef.current = newOffers;
    setOffers(newOffers);
  }, []);

  useEffect(() => {
    const interval = setInterval(getData, 60_000);
    window.addEventListener("focus", getData);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", getData);
    };
  }, [getData]);

  return (
    <GoodAppContext.Provider value={{toys, offers, refresh: getData, signOut}}>
      {children}
    </GoodAppContext.Provider>
  )
}

function App() {

  function RequireAuth(children: any) {
    let location = useLocation();

    const [user, setUser] = useState<User | null | undefined>(undefined);

    useEffect(() => {
      checkStatus();
    }, []);

    const checkStatus = async () => {
      await auth.onAuthStateChanged((e: User | null) => {
        setUser(e);
      });
    }

    return <>
      { user !== undefined ?
        <>{ user ? children.children : <Navigate to="/login" state={{ from: location }} replace /> }</>
        : 
        <>loading...</>
      }
    </>;
  }
  
  return (
    <div className="App">
      <ReactNotifications />
      <StateProvider>  
        <header>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<PublicPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/list"
                  element={
                    <RequireAuth>
                      <ListPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/myToys"
                  element={
                    <RequireAuth>
                      <MyToysPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/myOffers"
                  element={
                    <RequireAuth>
                      <MyOffersPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/shipment/result"
                  element={
                    <RequireAuth>
                      <ShipmentResultPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/history"
                  element={
                    <RequireAuth>
                      <HistoryPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/addNew"
                  element={
                    <RequireAuth>
                      <AddNew />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <RequireAuth>
                      <ProfilePage />
                    </RequireAuth>
                  }
                />
              </Route>
            </Routes>
          </BrowserRouter>
        </header>
      </StateProvider>
    </div>
  );
}

function Layout() {

  return (
    <div>
      <div className="navBar">
        <Link className="brand" to="/">ToyTrader</Link>

        <ul className="navigation">
          <li>
            <Link to="/">Intro</Link>
          </li>
          <li>
            <Link to="/list">Search for toys</Link>
          </li>
        </ul>

        <Auth />
      </div>

      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default App;
