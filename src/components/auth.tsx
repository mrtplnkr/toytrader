//https://toystrader-a494f.firebaseapp.com/__/auth/handler
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase-config";
import { logOff } from "../hooks/helper";

function Auth() {
  const navigate = useNavigate();

  const [loading] = useState(false);

  const [menu, openMenu] = useState(false);

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
                  <li onClick={(() => alert('click!'))}>{auth.currentUser?.displayName}</li>
                  <li style={{textDecoration: 'underline', cursor: 'pointer'}} 
                    onClick={() => navigate('/myToys')}>My Toys ({localStorage.getItem('myToys')})</li>
                  <li>{auth?.currentUser?.uid}</li>
                  <li onClick={(async () => {
                    try {
                      await logOff();
                      navigate('/login');
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

