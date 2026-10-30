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
import DeleteDataPage from "./pages/deleteData";
import { auth } from "./firebase-config";
import MyToysPage from "./pages/myToys";
import { ReactNotifications } from "react-notifications-component";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Toy } from "./types/toy";
import { Offer } from "./types/offer";
import { Rating } from "./types/rating";
import { GoodAppContext } from "./hooks/context";
import { checkIsAdmin, getOfferList, getRatingList, getToyList, logOff, onForegroundMessage } from "./hooks/helper";
import { diffAndNotifyShipmentStatus } from "./hooks/shipmentNotifications";
import { Store } from "react-notifications-component";
import HistoryPage from "./pages/inPost";
import MyOffersPage from "./pages/myOffers";
import ShipmentResultPage from "./pages/shipmentResult";
import HelpPage from "./pages/help";
import SplashScreen from "./components/splashScreen";
import Bubbles from "./components/bubbles";
import AboutPage from "./pages/about";
import DisclaimerPage from "./pages/disclaimer";
import PrivacyPage from "./pages/privacy";
import { User } from "firebase/auth";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./components/languageSwitcher";

// Code-split: only the one admin account ever needs this page's code, so
// there's no reason it should be in everyone's initial bundle.
const AdminPage = lazy(() => import("./pages/admin"));

function StateProvider({children}: any) {
  const [toys, setToys] = useState<Toy[]>([])
  const [offers, setOffers] = useState<Offer[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
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
    setRatings(await getRatingList());
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

  // A push notification that arrives while this tab is open and focused
  // doesn't auto-show as an OS notification (that only happens via the
  // service worker when the tab isn't focused) - show it as the same
  // in-app toast every other notification in this app uses.
  useEffect(() => {
    onForegroundMessage((title, body) => {
      Store.addNotification({
        title,
        message: body,
        type: "info",
        insert: "top",
        container: "top-right",
        animationIn: ["animate__animated", "animate__fadeIn"],
        animationOut: ["animate__animated", "animate__fadeOut"],
        dismiss: { duration: 5000 },
      });
    });
  }, []);

  return (
    <GoodAppContext.Provider value={{toys, offers, ratings, refresh: getData, signOut}}>
      {children}
    </GoodAppContext.Provider>
  )
}

function App() {

  // Shown for a couple of seconds on initial load, then fades out - purely
  // cosmetic, doesn't block or delay auth/data fetching happening underneath.
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashFading, setSplashFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashFading(true), 1800);
    const hideTimer = setTimeout(() => setSplashVisible(false), 2100);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

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

  function RequireAdmin(children: any) {
    const [isAdmin, setIsAdmin] = useState<boolean | undefined>(undefined);

    useEffect(() => {
      checkIsAdmin().then(setIsAdmin);
    }, []);

    return <>
      { isAdmin !== undefined ?
        <>{ isAdmin ? children.children : <Navigate to="/list" replace /> }</>
        :
        <>loading...</>
      }
    </>;
  }

  return (
    <div className="App">
      {splashVisible &&
        <div className={`transition-opacity duration-300 ease-in-out ${splashFading ? 'opacity-0' : 'opacity-100'}`}>
          <SplashScreen />
        </div>}
      <ReactNotifications />
      <StateProvider>  
        <header>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<PublicPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/disclaimer" element={<DisclaimerPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
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
                <Route
                  path="/deleteData"
                  element={
                    <RequireAuth>
                      <DeleteDataPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RequireAuth>
                      <RequireAdmin>
                        <Suspense fallback={<div>loading...</div>}>
                          <AdminPage />
                        </Suspense>
                      </RequireAdmin>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/help"
                  element={
                    <RequireAuth>
                      <HelpPage />
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
  const { t } = useTranslation();

  return (
    <div>
      <Bubbles />
      <div className="relative z-10">
        <div className="navBar">
          <Link className="brand" to="/">ToyTrader</Link>

          <ul className="navigation">
            <li>
              <Link to="/">{t('common:nav.intro')}</Link>
            </li>
            <li>
              <Link to="/list">{t('common:nav.search')}</Link>
            </li>
          </ul>

          <LanguageSwitcher />

          <Auth />
        </div>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default App;
