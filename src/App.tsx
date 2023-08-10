import PublicPage from "./components/public";
import LoginPage from "./components/login";
import ListPage from "./components/list";
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
import AddNew from "./components/addNew";
import { auth } from "./firebase-config";
import { DashboardContext } from "./hooks/context";

function App() {

  function RequireAuth(children: any) {
    let location = useLocation();

    if (!auth.currentUser?.uid) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
  
    return children.children;
  }
  
  return (
    <div className="App">
      <header>
        <DashboardContext.Provider value={undefined}>
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
        </DashboardContext.Provider>
      </header>
    </div>
  );
}

function Layout() {
  return (
    <div>
      <Auth />

      <ul className="navigation">
        <li>
          <Link to="/">Public Page</Link>
        </li>
        <li>
          <Link to="/list">Protected Page</Link>
        </li>
      </ul>

      <Outlet />
    </div>
  );
}

export default App;
