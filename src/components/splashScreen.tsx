import logo from '../logo.svg';

function SplashScreen() {
    return (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-4 bg-bg">
            <img src={logo} alt="ToyTrader" className="w-[120px]" />
            <h2 className="m-0 text-text">ToyTrader</h2>
        </div>
    );
}

export default SplashScreen;
