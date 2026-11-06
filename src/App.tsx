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
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Toy } from "./types/toy";
import { Offer } from "./types/offer";
import { Rating } from "./types/rating";
import { GoodAppContext } from "./hooks/context";
import { checkIsAdmin, logOff, onForegroundMessage, subscribeOffers, subscribeRatings, subscribeToys } from "./hooks/helper";
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
import { onAuthStateChanged, User } from "firebase/auth";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./components/languageSwitcher";

// Code-split: only the one admin account ever needs this page's code, so
// there's no reason it should be in everyone's initial bundle.
const AdminPage = lazy(() => import("./pages/admin"));

function StateProvider({children}: any) {
  const [toys, setToys] = useState<Toy[]>([])
  const [offers, setOffers] = useState<Offer[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  // Used only by diffAndNotifyShipmentStatus's before/after comparison, not
  // by rendering - a ref so updating it doesn't itself trigger a re-render.
  const prevOffersRef = useRef<Offer[]>([]);

  const signOut = async () => {
    await logOff();
  };

  // toys/ratings/offers are now real-time Firestore listeners rather than a
  // poll - see subscribeToys/subscribeRatings/subscribeOffers in helper.ts
  // for why (billed reads only on actual document changes instead of a
  // full re-read of every document on a timer). This effect's job is just
  // the subscribe/unsubscribe lifecycle: (re)attach all three whenever the
  // signed-in user changes, and tear everything down on sign-out so a
  // stale listener doesn't keep running (and erroring on permission-denied)
  // after the session that authorized it ends.
  useEffect(() => {
    let unsubToys: (() => void) | undefined;
    let unsubRatings: (() => void) | undefined;
    let unsubOffers: (() => void) | undefined;
    // onSnapshot fires immediately with the current state on attach, the
    // same way the very first poll used to - skip diffing/notifying on
    // that first emission per (re)subscription, same as the old
    // `prevOffersRef.current.length > 0` guard did.
    let isFirstOffersSnapshot = true;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubToys?.();
      unsubRatings?.();
      unsubOffers?.();

      if (!user) {
        setToys([]);
        setRatings([]);
        setOffers([]);
        prevOffersRef.current = [];
        return;
      }

      unsubToys = subscribeToys(setToys);
      unsubRatings = subscribeRatings(setRatings);
      isFirstOffersSnapshot = true;
      unsubOffers = subscribeOffers(user.uid, (newOffers) => {
        if (!isFirstOffersSnapshot) {
          diffAndNotifyShipmentStatus(user.uid, prevOffersRef.current, newOffers);
        }
        isFirstOffersSnapshot = false;
        prevOffersRef.current = newOffers;
        setOffers(newOffers);
      });
    });

    return () => {
      unsubAuth();
      unsubToys?.();
      unsubRatings?.();
      unsubOffers?.();
    };
  }, []);

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
    <GoodAppContext.Provider value={{toys, offers, ratings, signOut}}>
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
          <Link className="brand" to="/">
            <img src="/logo192.png" alt="" className="brandLogo" />
            <span className="brandWord">Toy<span className="brandAccent">Trader</span></span>
          </Link>

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
