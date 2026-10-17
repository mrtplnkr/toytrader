import { useLocation, useNavigate } from "react-router-dom";
import { facebookSign, googleSign } from "../hooks/helper";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const signedInCallback = (user: any) => {
    console.log('just signed in', user);
    // RequireAuth (App.tsx) redirects here with state.from set to the
    // originally-requested location (e.g. a shared /list?toyId=... link) -
    // return there instead of always landing on plain /list, or a deep
    // link clicked while logged out would get silently dropped.
    const from = (location.state as { from?: { pathname: string, search: string } })?.from;
    navigate(from ? `${from.pathname}${from.search}` : '/list');
  };

  return (
    <div className="card max-w-[360px] mx-auto my-12 p-8 flex flex-col gap-4">
      <h1 className="m-0">Login</h1>

      <button className="btn-primary" onClick={() => googleSign(signedInCallback)}>Google login</button>
      <button className="btn-primary" onClick={() => facebookSign(signedInCallback)}>Facebook login</button>
    </div>
  );
}

export default LoginPage;
