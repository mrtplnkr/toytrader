import logo from '../logo.svg';

function SplashScreen() {
    return (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-4 bg-bg/90 backdrop-blur-sm">
            <img src={logo} alt="ToyTrader" className="w-[120px]" />
            <h2 className="m-0 text-text" style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, fontSize: '1.6em', letterSpacing: '-0.01em' }}>
                Toy<span style={{ color: 'var(--color-gold)' }}>Trader</span>
            </h2>
        </div>
    );
}

export default SplashScreen;
