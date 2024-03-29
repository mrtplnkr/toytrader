//https://toystrader-a494f.firebaseapp.com/__/auth/handler
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContextSelector } from "use-context-selector";
import { auth } from "../firebase-config";
import { GoodAppContext } from "../hooks/context";
import { Toy } from "../types/toy";
import appConfig from "../../package.json";

function Auth() {
  const navigate = useNavigate(); 
  const signOut = useContextSelector(GoodAppContext, (state: any) => state.signOut);

  const [loading] = useState(false);

  const [menu, openMenu] = useState(false);

  const toys = useContextSelector(GoodAppContext, (x:any) => x.toys);

  const [greyUser, setGreyUser] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) setGreyUser(true);
    else {
      setGreyUser(false);
    }
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
                <img alt={auth?.currentUser?.displayName??'no name'} style={{opacity: greyUser ? '0.1' : ''}} 
                  src={auth?.currentUser?.photoURL??''} onClick={() => openMenu(s => !s)} />
                {menu && <ul>
                  <li onClick={() => alert('click!')}>{auth.currentUser?.displayName}</li>
                  <li style={{textDecoration: 'underline', cursor: 'pointer'}} 
                    onClick={() => navigate('/myToys')}>My Toys ({toys.filter((t:Toy) => t.userId === auth.currentUser?.uid).length})</li>
                  <li onClick={() => navigate('/myOffers')}>My Offers</li>
                  {/* <li onClick={() => navigate('/history')}>My trades</li> */}
                  <li onClick={(async () => {
                    try {
                      openMenu(x => !x);
                      await signOut();
                      navigate('/login');
                    } catch (err) {
                      throw new Error('err signing out' + (err as Error).message);
                    }}
                  )}>Sign out</li>
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

