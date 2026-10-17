import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { facebookSign, googleSign } from "../hooks/helper";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

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
      <h1 className="m-0">{t('login:title')}</h1>

      <button className="btn-primary" onClick={() => googleSign(signedInCallback)}>{t('login:googleLogin')}</button>
      <button className="btn-primary" onClick={() => facebookSign(signedInCallback)}>{t('login:facebookLogin')}</button>
    </div>
  );
}

export default LoginPage;
