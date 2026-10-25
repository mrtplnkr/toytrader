import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Store } from "react-notifications-component";
import { emailSignIn, emailSignUp, facebookSign, googleSign, resetPassword } from "../hooks/helper";

function notify(title: string, message: string, type: 'success' | 'danger') {
  Store.addNotification({
    title,
    message,
    type,
    insert: "top",
    container: "top-right",
    animationIn: ["animated", "fadeIn"],
    animationOut: ["animated", "fadeOut"],
    dismiss: { duration: 5000, onScreen: true },
  });
}

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const signedInCallback = (user: any) => {
    console.log('just signed in', user);
    // RequireAuth (App.tsx) redirects here with state.from set to the
    // originally-requested location (e.g. a shared /list?toyId=... link) -
    // return there instead of always landing on plain /list, or a deep
    // link clicked while logged out would get silently dropped.
    const from = (location.state as { from?: { pathname: string, search: string } })?.from;
    navigate(from ? `${from.pathname}${from.search}` : '/list');
  };

  // Firebase Auth error codes -> a message specific enough to act on,
  // rather than one generic failure toast for every case.
  const authErrorMessage = (err: any): string => {
    switch (err?.code) {
      case 'auth/email-already-in-use': return t('login:errorEmailInUse');
      case 'auth/invalid-email': return t('login:errorInvalidEmail');
      case 'auth/weak-password': return t('login:errorWeakPassword');
      case 'auth/wrong-password':
      case 'auth/user-not-found':
      case 'auth/invalid-credential': return t('login:errorInvalidCredentials');
      case 'auth/too-many-requests': return t('login:errorTooManyRequests');
      default: return t('common:toast.tryAgainLater');
    }
  };

  const onSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signup' && !displayName.trim()) {
      notify(t('login:nameRequiredTitle'), t('login:nameRequiredBody'), "danger");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await emailSignUp(email, password, displayName.trim(), signedInCallback);
      } else {
        await emailSignIn(email, password, signedInCallback);
      }
    } catch (err) {
      notify(t('common:toast.actionFailedTitle'), authErrorMessage(err), "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const onForgotPassword = async () => {
    if (!email) {
      notify(t('login:emailRequiredTitle'), t('login:emailRequiredBody'), "danger");
      return;
    }
    try {
      await resetPassword(email);
      notify(t('login:resetSentTitle'), t('login:resetSentBody'), "success");
    } catch (err) {
      notify(t('common:toast.actionFailedTitle'), authErrorMessage(err), "danger");
    }
  };

  return (
    <div className="card max-w-[360px] mx-auto my-12 p-8 flex flex-col gap-4">
      <h1 className="m-0">{t('login:title')}</h1>

      <button className="btn-primary" onClick={() => googleSign(signedInCallback)}>{t('login:googleLogin')}</button>
      <button className="btn-primary" onClick={() => facebookSign(signedInCallback)}>{t('login:facebookLogin')}</button>

      <div className="flex items-center gap-2 text-text-dim text-[0.85em]">
        <hr className="flex-1" /> {t('login:or')} <hr className="flex-1" />
      </div>

      <div className="flex text-[0.9em]">
        <button type="button" className={mode === 'signin' ? 'font-bold' : 'text-text-dim'}
          onClick={() => setMode('signin')}>{t('login:signIn')}</button>
        <span className="mx-2 text-text-dim">|</span>
        <button type="button" className={mode === 'signup' ? 'font-bold' : 'text-text-dim'}
          onClick={() => setMode('signup')}>{t('login:createAccount')}</button>
      </div>

      <form className="flex flex-col gap-3" onSubmit={onSubmitEmail}>
        {mode === 'signup' &&
          <input id="displayName" type="text" placeholder={t('login:namePlaceholder')}
            value={displayName} onChange={(e) => setDisplayName(e.target.value)} />}
        <input id="email" type="email" placeholder={t('login:emailPlaceholder')} required
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <input id="password" type="password" placeholder={t('login:passwordPlaceholder')} required
          minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? t('login:submitting') : mode === 'signin' ? t('login:signIn') : t('login:createAccount')}
        </button>

        {mode === 'signin' &&
          <button type="button" className="text-[0.85em] text-text-dim self-start" onClick={onForgotPassword}>
            {t('login:forgotPassword')}
          </button>}
      </form>
    </div>
  );
}

export default LoginPage;
