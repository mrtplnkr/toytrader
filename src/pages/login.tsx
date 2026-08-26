import { useNavigate } from "react-router-dom";
import { facebookSign, googleSign } from "../hooks/helper";

function LoginPage() {
  const navigate = useNavigate();

  const signedInCallback = (user: any) => {
    console.log('just signed in', user);
    navigate('/list');
  };

  return (
    <div className="card" style={{maxWidth: '360px', margin: '3em auto', padding: '2em', display: 'flex', flexDirection: 'column', gap: '1em'}}>
      <h1 style={{margin: 0}}>Login</h1>

      <button className="btn-primary" onClick={() => googleSign(signedInCallback)}>Google login</button>
      <button className="btn-primary" onClick={() => facebookSign(signedInCallback)}>Facebook login</button>
    </div>
  );
}

export default LoginPage;
