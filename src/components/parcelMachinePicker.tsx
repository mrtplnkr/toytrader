import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ParcelMachine, listParcelMachines } from "../hooks/helper";

interface Props {
    value: string | undefined;
    onChange: (machine: ParcelMachine) => void;
}

// Great-circle (Haversine) distance in km - good enough for "which parcel
// machine is closest", no need for anything more precise than that.
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function ParcelMachinePicker({ value, onChange }: Props) {
    const { t } = useTranslation();
    const [machines, setMachines] = useState<ParcelMachine[]>([]);
    const [filter, setFilter] = useState('');
    const [debouncedFilter, setDebouncedFilter] = useState('');
    const [open, setOpen] = useState(false);
    const [locating, setLocating] = useState(false);
    const [locateError, setLocateError] = useState<string | undefined>();
    const [nearestDistanceKm, setNearestDistanceKm] = useState<number | undefined>();

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

    // Entirely optional convenience, never required - a plain search above
    // still works with no location permission granted at all.
    const useMyLocation = () => {
        if (!navigator.geolocation) {
            setLocateError(t('parcelMachinePicker:errorNoGeolocation'));
            return;
        }
        if (!machines.length) {
            setLocateError(t('parcelMachinePicker:errorStillLoading'));
            return;
        }
        setLocating(true);
        setLocateError(undefined);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                let nearest = machines[0];
                let nearestKm = distanceKm(latitude, longitude, nearest.lat, nearest.lng);
                for (const m of machines) {
                    const km = distanceKm(latitude, longitude, m.lat, m.lng);
                    if (km < nearestKm) {
                        nearest = m;
                        nearestKm = km;
                    }
                }
                setNearestDistanceKm(nearestKm);
                selectMachine(nearest);
                setLocating(false);
            },
            (err) => {
                setLocateError(err.code === err.PERMISSION_DENIED ?
                    t('parcelMachinePicker:errorPermissionDenied') :
                    t('parcelMachinePicker:errorGeneric'));
                setLocating(false);
            },
            { timeout: 10_000 }
        );
    };

    return (
        <div className="relative flex flex-col gap-[0.4em] w-full max-w-[360px]">
            <input
                type="text"
                placeholder={t('parcelMachinePicker:searchPlaceholder')}
                value={filter}
                onChange={(e) => { setFilter(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                // Delay so a click on a list item registers before the blur closes it.
                onBlur={() => setTimeout(() => setOpen(false), 150)}
            />
            <button type="button" onClick={useMyLocation} disabled={locating} className="self-start text-[0.85em]">
                {locating ? t('parcelMachinePicker:findingClosest') : t('parcelMachinePicker:useMyLocation')}
            </button>
            {locateError && <p className="text-[0.8em] text-danger m-0">{locateError}</p>}
            {selected && !open &&
                <p className="text-[0.85em] text-primary m-0">
                    {t('parcelMachinePicker:selected', { name: selected.name, address: selected.address })}
                    {nearestDistanceKm !== undefined && selected.id === value &&
                        t('parcelMachinePicker:distanceAway', { km: nearestDistanceKm < 1 ? '<1' : nearestDistanceKm.toFixed(1) })}
                </p>}
            {open &&
                <ul className="parcelMachineResults absolute top-full left-0 right-0 z-[2] bg-white text-black border border-[#ccc] rounded max-h-[220px] overflow-y-auto list-none m-0 py-[0.25em] px-0">
                    {filtered.length > 0 ? filtered.map((m) => (
                        <li
                            key={m.id}
                            className="px-[0.6em] py-[0.4em] cursor-pointer"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectMachine(m)}
                        >
                            {m.name} — {m.address}
                        </li>
                    )) : (
                        <li className="px-[0.6em] py-[0.4em] text-text-dim">
                            {machines.length === 0 ? t('parcelMachinePicker:loading') : t('parcelMachinePicker:noMatches')}
                        </li>
                    )}
                </ul>}
        </div>
    );
}

export default ParcelMachinePicker;
