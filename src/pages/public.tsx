
import { faSmileWink } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import logo from '../logo.svg';

const randomWord = ['trade', 'swap', 'switch', 'exchange']

function PublicPage() {

    const randomSelect = () => {
      return randomWord[Math.floor(Math.random() * randomWord.length)];
    }

    return (
      <>
        <h1 className="App-header">Toy Trader App</h1>

        <img src={logo} className="App-logo" alt="logo" />
        
        <div id="intro">
          <h3>
            Bored of <span style={{color: 'brown'}}>your old</span> toys ?
          </h3>
          <h2>Well, <span style={{color: 'green'}}>{randomSelect()}</span> them !</h2>
          <p style={{fontSize: '1.5em'}}>
            <span style={{color: 'yellow', fontWeight: 'bold'}}> Discover </span> the 
            <span style={{color: 'darkred', fontWeight: 'bold' }}> fun </span>
             of 
             <span style={{color: 'green', fontWeight: 'bold'}}> trading </span>
             , just like the <span style={{fontWeight: 'bold'}}> GROWN UPS </span> do !
             <div style={{fontSize: '0.8em'}}>Except, not for money, just {randomSelect()} toy4toy</div>
          </p>
          <p style={{fontSize: '1.2em'}}>
            Just login and start checking all them toys of other children
             which you can swap and share as you grow.
          </p>
          <p style={{color: 'darkred', fontWeight: 'bold', fontSize: '1.5em'}}>Enjoy !</p>
        </div>

        <div id="parentIntro">
          <p style={{fontSize: '1.4em'}}>as for the parents :</p>
          <p style={{color: 'darkgreen', fontSize: '1.2em'}}>don't you have enough plastic at home ? <FontAwesomeIcon icon={faSmileWink} /></p>
          <p style={{color: 'yellow', fontSize: '1.5em'}}>help your youngsters to showcase their unwanted toys instead of discarding them..</p>
          <p style={{color: 'darkred', fontSize: '1.3em'}}>someone would still appreciate them as new !</p>
          <p style={{fontSize: '1.6em'}}>so go ahead, let them share !</p>
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