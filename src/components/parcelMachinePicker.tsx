import { useEffect, useState } from "react";
import { ParcelMachine, listParcelMachines } from "../hooks/helper";

interface Props {
    value: string | undefined;
    onChange: (machine: ParcelMachine) => void;
}

function ParcelMachinePicker({ value, onChange }: Props) {
    const [machines, setMachines] = useState<ParcelMachine[]>([]);
    const [filter, setFilter] = useState('');
    const [debouncedFilter, setDebouncedFilter] = useState('');
    const [open, setOpen] = useState(false);

    useEffect(() => {
        listParcelMachines().then(setMachines).catch(() => setMachines([]));
    }, []);

    // Debounce the filter so the list only recomputes/re-renders once typing
    // pauses, rather than on every keystroke - the input itself (`filter`)
    // still updates instantly, only the matching below lags by up to 1s.
    useEffect(() => {
        const timeout = setTimeout(() => setDebouncedFilter(filter), 1000);
        return () => clearTimeout(timeout);
    }, [filter]);

    const filtered = machines.filter((m) =>
        `${m.name} ${m.address}`.toLowerCase().includes(debouncedFilter.toLowerCase()));

    const selected = machines.find((m) => m.id === value);

    const selectMachine = (machine: ParcelMachine) => {
        onChange(machine);
        setFilter('');
        setOpen(false);
    };

    return (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.4em', width: '100%', maxWidth: '360px' }}>
            <input
                type="text"
                placeholder="Search parcel machine by name or address..."
                value={filter}
                onChange={(e) => { setFilter(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                // Delay so a click on a list item registers before the blur closes it.
                onBlur={() => setTimeout(() => setOpen(false), 150)}
            />
            {selected && !open &&
                <p style={{fontSize: '0.85em', color: 'var(--color-primary)', margin: 0}}>
                    Selected: {selected.name} — {selected.address}
                </p>}
            {open &&
                <ul style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 2,
                    background: 'white', color: 'black', border: '1px solid #ccc', borderRadius: '4px',
                    maxHeight: '220px', overflowY: 'auto', listStyle: 'none', margin: 0, padding: '0.25em 0',
                }}>
                    {filtered.length > 0 ? filtered.map((m) => (
                        <li
                            key={m.id}
                            style={{padding: '0.4em 0.6em', cursor: 'pointer'}}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectMachine(m)}
                        >
                            {m.name} — {m.address}
                        </li>
                    )) : (
                        <li style={{padding: '0.4em 0.6em', color: 'var(--color-text-dim)'}}>
                            {machines.length === 0 ? 'Loading parcel machines...' : 'No matches'}
                        </li>
                    )}
                </ul>}
        </div>
    );
}

export default ParcelMachinePicker;
