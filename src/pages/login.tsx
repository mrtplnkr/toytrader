import { useNavigate } from "react-router-dom";
import { useContextSelector } from "use-context-selector";
import { GoodAppContext } from "../hooks/context";
import { facebookSign, googleSign } from "../hooks/helper";

function LoginPage() {
  const navigate = useNavigate();
  const setUser = useContextSelector(GoodAppContext, (state: any) => state.setUser);

  const signedInCallback = (user: any) => {
    console.log('just signed in', user);
    setUser(user);
    navigate('/list');
  };

  return (
    <>
      <h1>Login page</h1>

      <button onClick={() => googleSign(signedInCallback)}>Google login</button>
      <button onClick={() => facebookSign(signedInCallback)}>Facebook login</button>
      {/* <form onSubmit={() => alert('welcome not')}>
        <button>Login with email</button>
      </form> */}
    </>
  );
}
  
export default LoginPage;