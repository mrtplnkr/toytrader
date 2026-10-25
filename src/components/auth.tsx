//https://toystrader-a494f.firebaseapp.com/__/auth/handler
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContextSelector } from "use-context-selector";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleUser } from "@fortawesome/free-solid-svg-icons";
import { auth } from "../firebase-config";
import { GoodAppContext } from "../hooks/context";
import { Toy } from "../types/toy";
import { checkIsAdmin } from "../hooks/helper";
import appConfig from "../../package.json";

function Auth() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const signOut = useContextSelector(GoodAppContext, (state: any) => state.signOut);

  const [loading] = useState(false);

  const [menu, openMenu] = useState(false);

  const toys = useContextSelector(GoodAppContext, (x:any) => x.toys);

  const [greyUser, setGreyUser] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) setGreyUser(true);
    else {
      setGreyUser(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.currentUser?.uid])

  useEffect(() => {
    if (!auth.currentUser) {
      setIsAdmin(false);
      return;
    }
    checkIsAdmin().then(setIsAdmin);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.currentUser?.uid])

  return (
    <>
      {
        loading ? 
          <div className="loading">loading...</div>
        :
          <div className="menu">
            {
              auth?.currentUser?.uid &&
              <>
                {/* Email/password accounts have no photoURL (no profile
                    for Firebase to pull one from, unlike Google/Facebook) -
                    fall back to a generic icon instead of a broken <img>. */}
                {auth?.currentUser?.photoURL ?
                  <img alt={auth?.currentUser?.displayName??t('auth:noName')} className={greyUser ? 'opacity-10' : ''}
                    src={auth.currentUser.photoURL} onClick={() => openMenu(s => !s)} />
                :
                  <FontAwesomeIcon icon={faCircleUser} size="2x" className={greyUser ? 'opacity-10 cursor-pointer self-end' : 'cursor-pointer self-end'}
                    title={auth?.currentUser?.displayName??t('auth:noName')} onClick={() => openMenu(s => !s)} />}
                {menu && <ul>
                  <li className="underline cursor-pointer"
                    onClick={() => { openMenu(x => !x); navigate('/profile'); }}>{auth.currentUser?.displayName}</li>
                  <li className="underline cursor-pointer"
                    onClick={() => navigate('/myToys')}>{t('auth:myToysCount', { count: toys.filter((toy:Toy) => toy.userId === auth.currentUser?.uid).length })}</li>
                  <li onClick={() => navigate('/myOffers')}>{t('auth:myOffers')}</li>
                  {/* <li onClick={() => navigate('/history')}>My trades</li> */}
                  <li onClick={() => { openMenu(x => !x); navigate('/help'); }}>{t('auth:help')}</li>
                  {isAdmin && <li onClick={() => { openMenu(x => !x); navigate('/admin'); }}>{t('auth:admin')}</li>}
                  <li onClick={(async () => {
                    try {
                      openMenu(x => !x);
                      await signOut();
                      navigate('/login');
                    } catch (err) {
                      throw new Error('err signing out' + (err as Error).message);
                    }}
                  )}>{t('auth:signOut')}</li>
                  <li>{appConfig.version}</li>
                </ul>}
              </>
            }
          </div>
      }
    </>
  );
}

export default Auth;

