
import logo from '../logo.svg';

function PublicPage() {
    return (
      <>
        <h1 className="App-header">Toy Trader App</h1>

        <img src={logo} className="App-logo" alt="logo" />
        
        <div id="intro">
          <h3>
            Bored of your old toys ?
          </h3>
          <h2>Well, trade them !</h2>
          <p style={{fontSize: '1.5em'}}>
            <span style={{color: 'yellow', fontWeight: 'bold'}}> Discover </span> the 
            <span style={{color: 'darkred', fontWeight: 'bold' }}> fun </span>
             of 
             <span style={{color: 'green', fontWeight: 'bold'}}> trading </span>
             , just like the <span style={{fontWeight: 'bold'}}> GROWN UPS </span> do !
          </p>
          <p style={{fontSize: '1.2em'}}>
            Just login and start checking all them toys of other children
             which you can swap and share as you grow.
          </p>
          <p style={{color: 'red', fontWeight: 'bold', fontSize: '1.5em'}}>Enjoy !</p>
        </div>

        <div id="parentIntro">
          <p>as for the parents :</p>
          <p>don't you have enough plastic at home ? ;"D</p>
          <p>help your youngsters to showcase their unwanted toys instead of discarding them..</p>
          <p>some others would still appreciate them as new !</p>
          <p>so go ahead, let them share !</p>
        </div>

        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </>
    );
}
  
export default PublicPage;