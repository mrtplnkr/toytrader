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
import { auth } from "./firebase-config";
import MyToysPage from "./pages/myToys";
import { ReactNotifications } from "react-notifications-component";
import { useCallback, useEffect, useState } from "react";
import { Toy } from "./types/toy";
import { Offer } from "./types/offer";
import { GoodAppContext } from "./hooks/context";
import { checkStatus, getOfferList, getToyList, logOff } from "./hooks/helper";
import HistoryPage from "./pages/inPost";
import MyOffersPage from "./pages/myOffers";
import { useContextSelector } from "use-context-selector";

function StateProvider({children}: any) {
  const [toys, setToys] = useState<Toy[]>([])
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    if (auth.currentUser?.uid) { 
      getData();
    } else {
      setToys([]);
      setOffers([]);
    }
  }, [auth.currentUser?.uid]);
  
  const signOut = () => {
    logOff();
  };

  const getData = useCallback(async() => {
    setToys(await getToyList());
    setOffers(await getOfferList(auth.currentUser?.uid!));
  }, []);
  
  return (
    <GoodAppContext.Provider value={{toys, offers, refresh: getData, signOut}}>
      {auth ? children : ''}
    </GoodAppContext.Provider>
  )
}

function App() {

  function RequireAuth(children: any) {
    let location = useLocation();
    
    if (!auth) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
  
    return children.children;
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
              </Route>
            </Routes>
          </BrowserRouter>
        </header>
      </StateProvider>
    </div>
  );
}

function Layout() {
  const user = useContextSelector(GoodAppContext, (a:any) => a.user);

  useEffect(() => {
    console.log('bingo', user);    
  }, []);

  return (
    <div>
      <Auth />

      <ul className="navigation">
        <li>
          <Link to="/">Intro</Link>
        </li>
        <li>
          {user ? <Link to="/list">Search for toys</Link>
          : <Link to="/login">Login</Link>}
        </li>
      </ul>

      <Outlet />
    </div>
  );
}

export default App;
