import { useEffect, useState } from "react";
import { ParcelMachine, listParcelMachines } from "../hooks/helper";

interface Props {
    value: string | undefined;
    onChange: (machine: ParcelMachine) => void;
}

function ParcelMachinePicker({ value, onChange }: Props) {
    const [machines, setMachines] = useState<ParcelMachine[]>([]);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        listParcelMachines().then(setMachines).catch(() => setMachines([]));
    }, []);

    const filtered = machines.filter((m) =>
        `${m.name} ${m.address}`.toLowerCase().includes(filter.toLowerCase()));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4em', width: '100%', maxWidth: '360px' }}>
            <input
                type="text"
                placeholder="Search parcel machine by name or address..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
            />
            <select
                value={value ?? ''}
                onChange={(e) => {
                    const machine = machines.find((m) => m.id === e.target.value);
                    if (machine) onChange(machine);
                }}
            >
                <option value="" disabled>Choose a parcel machine</option>
                {filtered.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} — {m.address}</option>
                ))}
            </select>
        </div>
    );
}

export default ParcelMachinePicker;
