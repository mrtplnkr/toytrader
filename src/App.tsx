import PublicPage from "./pages/public";
import LoginPage from "./pages/login";
import ListPage from "./pages/list";
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
import AddNew from "./pages/addNew";
import { auth } from "./firebase-config";
import MyToysPage from "./pages/myToys";

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
    </div>
  );
}

function Layout() {
  return (
    <div>
      <Auth />

      <ul className="navigation">
        <li>
          <Link to="/">Intro</Link>
        </li>
        <li>
          <Link to="/list">Search for toys</Link>
        </li>
      </ul>

      <Outlet />
    </div>
  );
}

export default App;
