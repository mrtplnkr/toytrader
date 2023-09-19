//https://toystrader-a494f.firebaseapp.com/__/auth/handler
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContextSelector } from "use-context-selector";
import { auth } from "../firebase-config";
import { GoodAppContext } from "../hooks/context";
import { logOff } from "../hooks/helper";
import { Toy } from "../types/toy";

function Auth() {
  const navigate = useNavigate();

  const [loading] = useState(false);

  const [menu, openMenu] = useState(false);

  const toys = useContextSelector(GoodAppContext, (x:any) => x.toys);

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
                <img alt={auth?.currentUser?.displayName??'no name'} src={auth?.currentUser?.photoURL??''} onClick={() => openMenu(s => !s)} />
                {menu && <ul>
                  <li onClick={() => alert('click!')}>{auth.currentUser?.displayName}</li>
                  <li style={{textDecoration: 'underline', cursor: 'pointer'}} 
                    onClick={() => navigate('/myToys')}>My Toys ({toys.filter((t:Toy) => t.userId === auth.currentUser?.uid).length})</li>
                  <li onClick={() => navigate('/myOffers')}>My Offers</li>
                  {/* <li onClick={() => navigate('/history')}>My trades</li> */}
                  <li onClick={(async () => {
                    try {
                      await logOff();
                      navigate('/list');
                    } catch (err) {
                      throw new Error('err signing out' + (err as Error).message);
                    }}
                  )}>Sign out</li>
                </ul>}
              </>
            }
          </div>
      }
    </>
  );
}

export default Auth;

