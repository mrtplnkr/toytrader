import { useNavigate } from "react-router-dom";
import { facebookSign, googleSign } from "../hooks/helper";

function LoginPage() {
  const navigate = useNavigate();

  const signedInCallback = () => {
    navigate('/list');
  }

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